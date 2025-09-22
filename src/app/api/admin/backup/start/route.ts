import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getSupabaseFor } from '@/lib/supabaseEnv';
import { getBackupTasks, setBackupTask } from '@/lib/backup-tasks';
import { createDatabaseConnection, testDatabaseConnection, getTableList, getTableColumns, getTableData, DatabaseType } from '@/lib/backup-db';
import fsPromises from 'fs/promises';
import path from 'path';

// 使用archiver创建ZIP文件
async function createZipFile(files: { path: string; name: string }[], outputPath: string): Promise<void> {
  const archiver = await import('archiver');
  const { createWriteStream } = await import('fs');
  
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver.default('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`ZIP文件创建完成: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('创建ZIP文件失败:', err);
      reject(err);
    });

    archive.pipe(output);

    // 添加文件到ZIP
    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }

    archive.finalize();
  });
}

// 递归收集目录中的所有文件
async function collectFilesFromDirectory(dirPath: string, basePath: string = ''): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = [];
  
  try {
    const items = await fsPromises.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fsPromises.stat(itemPath);
      
      if (stats.isDirectory()) {
        const subFiles = await collectFilesFromDirectory(itemPath, path.join(basePath, item));
        files.push(...subFiles);
      } else {
        files.push({
          path: itemPath,
          name: path.join(basePath, item)
        });
      }
    }
  } catch (err) {
    console.error('收集文件失败:', err);
  }
  
  return files;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { 
      backupPath, 
      backupType = 'all',
      incremental = false,
      overwriteExisting = false,
      compareWith = null,
      databaseType = 'supabase'
    } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    if (!['all', 'database', 'storage'].includes(backupType)) {
      return NextResponse.json({ error: '无效的备份类型' }, { status: 400 });
    }

    if (!['local', 'prod', 'supabase'].includes(databaseType)) {
      return NextResponse.json({ error: '无效的数据库类型' }, { status: 400 });
    }

    // 检查备份路径是否存在和可写
    try {
      await fsPromises.access(backupPath);
      // 检查是否为目录
      const stats = await fsPromises.stat(backupPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { 
            error: '备份路径不是目录',
            details: `路径 ${backupPath} 存在但不是目录`,
            suggestions: ['请提供目录路径而不是文件路径']
          },
          { status: 400 }
        );
      }
    } catch {
      // 尝试创建目录
      try {
        await fsPromises.mkdir(backupPath, { recursive: true });
        console.log(`成功创建备份目录: ${backupPath}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '未知错误';
        console.error(`创建备份目录失败: ${backupPath}`, errorMessage);
        
        return NextResponse.json(
          { 
            error: '无法创建备份目录，请检查路径权限',
            details: errorMessage,
            suggestions: [
              '请检查路径是否存在',
              '确保应用有创建目录的权限',
              '尝试使用绝对路径',
              '在 Linux/Mac 上检查父目录权限',
              '在 Windows 上以管理员身份运行'
            ],
            alternativePaths: [
              '/tmp/backups',
              './backups',
              '../backups'
            ]
          },
          { status: 400 }
        );
      }
    }

    // 验证目录写入权限
    try {
      const testFile = path.join(backupPath, '.backup-test-' + Date.now());
      await fsPromises.writeFile(testFile, 'test');
      await fsPromises.unlink(testFile);
      console.log(`备份目录写入权限验证成功: ${backupPath}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误';
      console.error(`备份目录写入权限验证失败: ${backupPath}`, errorMessage);
      
      return NextResponse.json(
        { 
          error: '备份目录无写入权限',
          details: errorMessage,
          suggestions: [
            '请检查目录写入权限',
            '在 Linux/Mac 上尝试: chmod 755 ' + backupPath,
            '在 Windows 上更改文件夹权限',
            '确保应用有写入权限'
          ]
        },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tasks = [];

    // 根据备份类型创建任务
    if (backupType === 'all' || backupType === 'database') {
      tasks.push({
        id: `db-${timestamp}`,
        type: 'database',
        databaseType,
        status: 'pending',
        progress: 0,
        message: '等待开始',
        createdAt: new Date().toISOString(),
      });
    }

    if (backupType === 'all' || backupType === 'storage') {
      tasks.push({
        id: `storage-${timestamp}`,
        type: 'storage',
        status: 'pending',
        progress: 0,
        message: '等待开始',
        createdAt: new Date().toISOString(),
      });
    }

    // 存储任务状态
    const backupTasks = getBackupTasks();
    tasks.forEach((task) => {
      setBackupTask(task.id, { 
        ...task, 
        backupPath,
        incremental,
        overwriteExisting,
        compareWith,
        databaseType
      });
    });

    // 异步执行备份任务
    executeBackupTasks(tasks, backupPath, incremental, overwriteExisting, compareWith, databaseType);

    return NextResponse.json({ 
      tasks,
      backupType,
      message: `已启动${backupType === 'all' ? '全部' : backupType === 'database' ? '数据库' : '存储桶'}备份任务`
    });
  } catch (error) {
    console.error('启动备份失败:', error);
    return NextResponse.json(
      { error: '启动备份失败' },
      { status: 500 }
    );
  }
}

async function executeBackupTasks(tasks: any[], backupPath: string, incremental: boolean, overwriteExisting: boolean, compareWith: string | null = null, databaseType: DatabaseType = 'supabase') {
  // 执行数据库备份
  const dbTask = tasks.find((t) => t.type === 'database');
  if (dbTask) {
    await executeDatabaseBackup(dbTask.id, backupPath, incremental, overwriteExisting, compareWith, databaseType);
  }

  // 执行存储桶备份
  const storageTask = tasks.find((t) => t.type === 'storage');
  if (storageTask) {
    await executeStorageBackup(storageTask.id, backupPath, incremental, overwriteExisting, compareWith, databaseType);
  }
}

async function executeDatabaseBackup(taskId: string, backupPath: string, incremental: boolean = false, overwriteExisting: boolean = false, compareWith: string | null = null, databaseType: DatabaseType = 'supabase') {
  const backupTasks = getBackupTasks();
  const task = backupTasks.get(taskId);
  if (!task) return;

  try {
    // 更新状态为运行中
    task.status = 'running';
    task.message = `正在连接${databaseType === 'local' ? '本地' : databaseType === 'prod' ? '生产环境' : 'Supabase'}数据库...`;
    backupTasks.set(taskId, task);

    // 根据数据库类型获取表列表
    console.log(`开始获取${databaseType}数据库表列表...`);
    const tables = await getTableList(databaseType);

    console.log('获取到表列表:', tables);

    task.message = `找到 ${tables.length} 个表，开始导出...`;
    task.progress = 10;
    backupTasks.set(taskId, task);

    const sqlContent = [];
    sqlContent.push('-- 数据库备份');
    sqlContent.push(`-- 创建时间: ${new Date().toISOString()}`);
    sqlContent.push('');

    let totalRows = 0;
    let totalColumns = 0;

    // 并行导出表 - 高性能优化
    const CONCURRENT_TABLES = 5; // 同时处理的表数量
    const tableChunks = [];
    for (let i = 0; i < tables.length; i += CONCURRENT_TABLES) {
      tableChunks.push(tables.slice(i, i + CONCURRENT_TABLES));
    }

    const allTableResults = [];
    let processedTables = 0;

    for (const tableChunk of tableChunks) {
      // 并行处理每个表
      const chunkPromises = tableChunk.map(async (tableName) => {
        try {
          console.log(`开始并行处理表: ${tableName}`);
          
          // 并行获取表结构和数据
          const [columns, rows] = await Promise.all([
            getTableColumns(databaseType, tableName),
            getTableData(databaseType, tableName)
          ]);

          totalColumns += columns.length;
          totalRows += rows ? rows.length : 0;

          // 生成表的SQL内容
          const tableSQL = [];
          
          // 生成CREATE TABLE语句
          tableSQL.push(`-- 表: ${tableName}`);
          tableSQL.push(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
          tableSQL.push(`CREATE TABLE "${tableName}" (`);

          const columnDefs = columns.map((col: any) => {
            let def = `  "${col.column_name}" ${col.data_type}`;
            if (col.is_nullable === false || col.is_nullable === 'NO') def += ' NOT NULL';
            if (col.column_default) def += ` DEFAULT ${col.column_default}`;
            return def;
          });

          tableSQL.push(columnDefs.join(',\n'));
          tableSQL.push(');');
          tableSQL.push('');

          if (rows && rows.length > 0) {
            tableSQL.push(`-- 数据: ${tableName} (${rows.length} 行)`);
            
            // 优化批处理大小 - 根据列数调整
            const batchSize = Math.max(500, Math.min(2000, Math.floor(10000 / columns.length)));
            
            for (let j = 0; j < rows.length; j += batchSize) {
              const batch = rows.slice(j, j + batchSize);
              
              // 并行处理数据行
              const values = await Promise.all(batch.map(async (row) => {
                const rowValues = columns.map((col: any) => {
                  const value = row[col.column_name];
                  if (value === null) return 'NULL';
                  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                  return String(value);
                });
                return `(${rowValues.join(', ')})`;
              }));

              tableSQL.push(`INSERT INTO "${tableName}" (${columns.map((c: any) => `"${c.column_name}"`).join(', ')}) VALUES`);
              tableSQL.push(values.join(',\n') + ';');
              tableSQL.push('');
            }
          }

          console.log(`完成处理表: ${tableName}, 行数: ${rows ? rows.length : 0}`);
          return { tableName, sql: tableSQL.join('\n'), rowCount: rows ? rows.length : 0 };
        } catch (err) {
          console.error(`处理表 ${tableName} 时出错:`, err);
          return { 
            tableName, 
            sql: `-- 错误: 无法导出表 ${tableName}\n-- ${err instanceof Error ? err.message : '未知错误'}\n`, 
            rowCount: 0,
            error: true 
          };
        }
      });

      // 等待当前批次完成
      const chunkResults = await Promise.all(chunkPromises);
      allTableResults.push(...chunkResults);
      
      processedTables += tableChunk.length;
      const progressPercent = Math.round(10 + (processedTables / tables.length) * 70);
      task.message = `并行导出完成 ${processedTables}/${tables.length} 个表 (已导出 ${allTableResults.reduce((sum, r) => sum + r.rowCount, 0)} 行)`;
      task.progress = progressPercent;
      backupTasks.set(taskId, task);
    }

    // 合并所有表的SQL
    allTableResults.forEach(result => {
      sqlContent.push(result.sql);
    });

    const successTables = allTableResults.filter(r => !r.error).length;
    const errorTables = allTableResults.filter(r => r.error).length;
    console.log(`表导出完成: 成功 ${successTables} 个，失败 ${errorTables} 个`);

    // 创建ZIP压缩文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const dbTypePrefix = databaseType === 'local' ? 'local' : databaseType === 'prod' ? 'prod' : 'supabase';
    const zipFilePath = path.join(backupPath, `database-backup-${dbTypePrefix}-${timestamp}.zip`);
    
    // 创建临时SQL文件
    task.message = '正在写入SQL文件...';
    task.progress = 80;
    backupTasks.set(taskId, task);
    
    const tempSqlFilePath = path.join(backupPath, `temp-database-${timestamp}.sql`);
    await fsPromises.writeFile(tempSqlFilePath, sqlContent.join('\n'), 'utf8');

    // 创建ZIP文件
    task.message = '正在创建ZIP压缩文件...';
    task.progress = 90;
    backupTasks.set(taskId, task);
    
    await createZipFile([{ path: tempSqlFilePath, name: `database-backup-${timestamp}.sql` }], zipFilePath);
    
    // 删除临时SQL文件
    await fsPromises.unlink(tempSqlFilePath);

    const stats = await fsPromises.stat(zipFilePath);

    // 更新任务状态
    const dbTypeName = databaseType === 'local' ? '本地' : databaseType === 'prod' ? '生产环境' : 'Supabase';
    task.status = 'completed';
    task.message = `${dbTypeName}数据库备份完成！共导出 ${tables.length} 个表，${totalColumns} 个字段，${totalRows} 行数据，文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    task.progress = 100;
    task.filePath = zipFilePath;
    task.fileSize = stats.size;
    backupTasks.set(taskId, task);

  } catch (error) {
    console.error('数据库备份失败:', error);
    task.status = 'failed';
    task.message = `数据库备份失败: ${error instanceof Error ? error.message : '未知错误'}`;
    backupTasks.set(taskId, task);
    
    // 添加更详细的错误信息
    if (error instanceof Error) {
      console.error('错误堆栈:', error.stack);
    }
  }
}

async function executeStorageBackup(taskId: string, backupPath: string, incremental: boolean = false, overwriteExisting: boolean = false, compareWith: string | null = null, databaseType: DatabaseType = 'supabase') {
  const backupTasks = getBackupTasks();
  const task = backupTasks.get(taskId);
  if (!task) return;

  try {
    // 更新状态为运行中
    task.status = 'running';
    task.message = `正在连接${databaseType === 'prod' ? '生产' : databaseType === 'local' ? '本地' : '默认'}存储服务...`;
    backupTasks.set(taskId, task);

    const supabase = getSupabaseFor(databaseType);

    // 获取所有存储桶
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error(`获取存储桶列表失败: ${bucketsError.message}`);
    }

    task.message = `找到 ${buckets.length} 个存储桶，开始下载文件...`;
    task.progress = 10;
    backupTasks.set(taskId, task);

    // 创建带时间戳的临时存储目录
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const tempStorageDir = path.join(backupPath, `temp-storage-${timestamp}`);
    await fsPromises.mkdir(tempStorageDir, { recursive: true });

    let totalFiles = 0;
    let downloadedFiles = 0;
    let skippedFiles = 0;

    // 如果是增量备份，检查现有备份文件
    let existingBackupFiles = new Set<string>();
    if (incremental) {
      task.message = '正在检查对比备份文件...';
      task.progress = 5;
      backupTasks.set(taskId, task);
      
      try {
        let compareBackupPath: string | null = null;
        
        if (compareWith && compareWith !== 'auto') {
          // 使用指定的对比备份文件
          compareBackupPath = path.join(backupPath, compareWith);
          console.log(`增量备份：使用指定对比文件 ${compareWith}`);
        } else {
          // 自动选择最新的备份文件
          const existingBackups = await fsPromises.readdir(backupPath);
          const storageBackups = existingBackups.filter(file => 
            file.startsWith('storage-backup-') && file.endsWith('.zip')
          );
          
          if (storageBackups.length > 0) {
            const latestBackup = storageBackups.sort().pop();
            if (latestBackup) {
              compareBackupPath = path.join(backupPath, latestBackup);
              console.log(`增量备份：自动选择最新备份文件 ${latestBackup}`);
            }
          }
        }
        
        if (compareBackupPath) {
          console.log(`增量备份：使用对比文件 ${compareBackupPath}`);
          // 解压并获取现有文件列表
          const tempExtractDir = path.join(backupPath, `temp-extract-${Date.now()}`);
          await fsPromises.mkdir(tempExtractDir, { recursive: true });
          
          try {
            console.log(`增量备份：开始解压ZIP文件到 ${tempExtractDir}`);
            await extractZip(compareBackupPath, tempExtractDir);
            console.log(`增量备份：ZIP解压完成`);
            
            // 等待解压完成，检查解压目录是否存在文件
            let retryCount = 0;
            const maxRetries = 10;
            let extractSuccess = false;
            
            while (retryCount < maxRetries) {
              try {
                const extractItems = await fsPromises.readdir(tempExtractDir);
                if (extractItems.length > 0) {
                  extractSuccess = true;
                  console.log(`增量备份：解压目录内容:`, extractItems);
                  break;
                }
              } catch (err) {
                console.log(`增量备份：等待解压完成... (${retryCount + 1}/${maxRetries})`);
              }
              
              // 等待1秒后重试
              await new Promise(resolve => setTimeout(resolve, 1000));
              retryCount++;
            }
            
            if (!extractSuccess) {
              throw new Error('解压目录为空或解压失败');
            }
            
            console.log(`增量备份：解压验证完成，开始获取文件列表`);
            
            // 查找storage目录，因为ZIP文件中的文件结构是 storage/bucket_name/file_path
            const storageDir = path.join(tempExtractDir, 'storage');
            let extractDirToProcess = tempExtractDir;
            
            try {
              const storageDirStats = await fsPromises.stat(storageDir);
              if (storageDirStats.isDirectory()) {
                extractDirToProcess = storageDir;
                console.log(`增量备份：找到storage目录，使用 ${storageDir}`);
              } else {
                console.log(`增量备份：未找到storage目录，使用根目录 ${tempExtractDir}`);
              }
            } catch (err) {
              console.log(`增量备份：检查storage目录失败，使用根目录 ${tempExtractDir}`);
            }
            
            existingBackupFiles = await getExistingFilesFromExtractedDir(extractDirToProcess);
            console.log(`增量备份：找到 ${existingBackupFiles.size} 个现有文件`);
            
            // 调试信息：显示前10个现有文件
            const sampleFiles = Array.from(existingBackupFiles).slice(0, 10);
            console.log(`增量备份：现有文件示例:`, sampleFiles);
            
            // 清理临时解压目录
            await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
            console.log(`增量备份：临时目录清理完成`);
          } catch (err) {
            console.error('解压对比备份失败，将进行完整备份:', err);
            // 清理临时目录
            try {
              await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
            } catch (cleanupErr) {
              console.error('清理临时目录失败:', cleanupErr);
            }
          }
        } else {
          console.log('增量备份：未找到对比备份文件，将进行完整备份');
        }
      } catch (err) {
        console.error('检查对比备份失败，将进行完整备份:', err);
      }
    }

    // 先统计总文件数（递归统计）
    for (const bucket of buckets) {
      const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
      totalFiles += allFiles.length;
      console.log(`存储桶 ${bucket.name} 中有 ${allFiles.length} 个文件`);
    }

    // 如果是增量备份，调整进度计算
    const progressSteps = incremental ? 4 : 3; // 增量备份有4个步骤：下载、合并、压缩、清理
    const downloadProgressMax = incremental ? 70 : 80; // 增量备份下载占70%，普通备份占80%

    task.message = `找到 ${totalFiles} 个文件，开始下载...`;
    task.progress = 10;
    backupTasks.set(taskId, task);

    // 并行下载存储桶文件 - 高性能优化
    const CONCURRENT_BUCKETS = 2; // 同时处理的存储桶数量（降低以避免API限制）
    const bucketChunks = [];
    for (let i = 0; i < buckets.length; i += CONCURRENT_BUCKETS) {
      bucketChunks.push(buckets.slice(i, i + CONCURRENT_BUCKETS));
    }

    let processedBuckets = 0;
    let bucketResults = [];

    for (const bucketChunk of bucketChunks) {
      // 并行处理存储桶
      const bucketPromises = bucketChunk.map(async (bucket) => {
        const bucketDir = path.join(tempStorageDir, bucket.name);
        await fsPromises.mkdir(bucketDir, { recursive: true });

        try {
          console.log(`开始并行处理存储桶: ${bucket.name}`);
          
          // 递归获取所有文件（包括子目录）
          const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
          console.log(`存储桶 ${bucket.name} 中找到 ${allFiles.length} 个文件`);
          
          return { bucket, bucketDir, allFiles, error: null };
        } catch (err) {
          console.error(`获取存储桶 ${bucket.name} 文件列表失败:`, err);
          return { bucket, bucketDir: null, allFiles: [], error: err };
        }
      });

      // 等待当前批次完成
      const chunkResults = await Promise.all(bucketPromises);
      bucketResults.push(...chunkResults);
      
      processedBuckets += bucketChunk.length;
      task.message = `已获取 ${processedBuckets}/${buckets.length} 个存储桶的文件列表`;
      task.progress = 10 + (processedBuckets / buckets.length) * 20;
      backupTasks.set(taskId, task);
    }

    // 现在并行下载所有文件
    const CONCURRENT_DOWNLOADS = 10; // 同时下载的文件数量
    const allDownloadTasks = [];
    
    for (const bucketResult of bucketResults) {
      if (bucketResult.error || !bucketResult.bucketDir) continue;
      
      const { bucket, bucketDir, allFiles } = bucketResult;
      
      // 为当前存储桶创建下载任务
      for (const filePath of allFiles) {
        allDownloadTasks.push({
          bucket,
          bucketDir,
          filePath,
          localPath: path.join(bucketDir, filePath)
        });
      }
    }

    // 并行下载所有文件
    let downloadedFiles = 0;
    let skippedFiles = 0;
    let totalDownloadTasks = allDownloadTasks.length;
    
    console.log(`开始并行下载 ${totalDownloadTasks} 个文件，并发数: ${CONCURRENT_DOWNLOADS}`);
    
    // 分批并行下载
    for (let i = 0; i < allDownloadTasks.length; i += CONCURRENT_DOWNLOADS) {
      const batch = allDownloadTasks.slice(i, i + CONCURRENT_DOWNLOADS);
      
      const downloadPromises = batch.map(async (downloadTask) => {
        const { bucket, bucketDir, filePath, localPath } = downloadTask;
        
        try {
          // 如果是增量备份，检查文件是否已存在
          if (incremental) {
            const normalizedPath = normalizeFilePath(filePath);
            let isFound = false;
            
            // 多种方式检查文件是否存在
            if (existingBackupFiles.has(normalizedPath) ||
                existingBackupFiles.has(`${bucket.name}/${normalizedPath}`)) {
              isFound = true;
            }
            
            if (!isFound) {
              for (const existingFile of existingBackupFiles) {
                if (existingFile.endsWith(`/${normalizedPath}`) || existingFile === normalizedPath) {
                  isFound = true;
                  break;
                }
              }
            }
            
            if (isFound) {
              return { success: true, skipped: true, filePath };
            }
          }

          // 下载文件
          const { data, error: downloadError } = await supabase.storage
            .from(bucket.name)
            .download(filePath);

          if (downloadError) {
            throw new Error(`下载失败: ${downloadError.message}`);
          }

          // 确保目录存在
          await fsPromises.mkdir(path.dirname(localPath), { recursive: true });
          
          // 写入文件
          const arrayBuffer = await (data as Blob).arrayBuffer();
          await fsPromises.writeFile(localPath, Buffer.from(arrayBuffer));
          
          return { success: true, skipped: false, filePath };
        } catch (err) {
          console.error(`下载文件 ${filePath} 失败:`, err);
          return { success: false, skipped: false, filePath, error: err };
        }
      });

      // 等待当前批次完成
      const batchResults = await Promise.all(downloadPromises);
      
      // 统计结果
      batchResults.forEach(result => {
        if (result.success) {
          if (result.skipped) {
            skippedFiles++;
          } else {
            downloadedFiles++;
          }
        }
      });

      const progress = Math.round(30 + ((i + batch.length) / totalDownloadTasks) * 50);
      task.message = `并行下载进度: ${downloadedFiles}/${totalDownloadTasks} (跳过 ${skippedFiles})`;
      task.progress = progress;
      backupTasks.set(taskId, task);
    }

    console.log(`文件下载完成: 成功 ${downloadedFiles} 个，跳过 ${skippedFiles} 个`);

    // 增量备份只保存新文件，不需要合并现有文件
    if (incremental) {
      task.message = '增量备份：只保存新下载的文件...';
      task.progress = 85;
      backupTasks.set(taskId, task);
      console.log(`增量备份：只保存 ${downloadedFiles} 个新文件，跳过 ${skippedFiles} 个现有文件`);
    }

    // 创建ZIP压缩文件
    task.message = '正在创建ZIP压缩文件...';
    task.progress = incremental ? 85 : 90; // 增量备份合并后是85%，普通备份是90%
    backupTasks.set(taskId, task);
    
    const backupTypePrefix = incremental ? 'storage-incremental' : 'storage-backup';
    const zipFilePath = path.join(backupPath, `${backupTypePrefix}-${timestamp}.zip`);
    const files = await collectFilesFromDirectory(tempStorageDir, 'storage');
    
    // 调试信息：显示要打包的文件数量
    console.log(`准备创建ZIP文件，包含 ${files.length} 个文件`);
    if (files.length > 0) {
      console.log(`ZIP文件内容示例:`, files.slice(0, 5).map(f => f.name));
    }
    
    await createZipFile(files, zipFilePath);
    
    // 删除临时存储目录
    task.message = '正在清理临时文件...';
    task.progress = incremental ? 95 : 95; // 清理阶段都是95%
    backupTasks.set(taskId, task);
    
    await fsPromises.rm(tempStorageDir, { recursive: true, force: true });

    const stats = await fsPromises.stat(zipFilePath);

    // 更新任务状态
    task.status = 'completed';
    const message = incremental 
      ? `存储桶增量备份完成！共扫描 ${totalFiles} 个文件，下载 ${downloadedFiles} 个新文件，跳过 ${skippedFiles} 个现有文件，增量文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
      : `存储桶备份完成！共下载 ${downloadedFiles}/${totalFiles} 个文件，文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    
    task.message = message;
    task.progress = 100;
    task.filePath = zipFilePath;
    task.fileSize = stats.size;
    backupTasks.set(taskId, task);

  } catch (error) {
    console.error('存储桶备份失败:', error);
    task.status = 'failed';
    task.message = `存储桶备份失败: ${error instanceof Error ? error.message : '未知错误'}`;
    backupTasks.set(taskId, task);
  }
}

async function getAllFilesFromBucket(supabase: any, bucketName: string, prefix: string = ''): Promise<string[]> {
  const allFiles: string[] = [];
  
  try {
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, { 
        limit: 1000, 
        sortBy: { column: 'name', order: 'asc' },
        offset: 0
      });

    if (error) {
      console.error(`获取存储桶 ${bucketName} 文件列表失败:`, error);
      return allFiles;
    }

    if (files) {
      for (const file of files) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        
        if (file.metadata && file.metadata.size !== undefined) {
          // 这是一个文件
          allFiles.push(fullPath);
        } else {
          // 这可能是一个目录，递归获取
          const subFiles = await getAllFilesFromBucket(supabase, bucketName, fullPath);
          allFiles.push(...subFiles);
        }
      }
    }
  } catch (err) {
    console.error(`递归获取存储桶 ${bucketName} 文件失败:`, err);
  }
  
  return allFiles;
}

// 从解压的目录中获取现有文件列表
async function getExistingFilesFromExtractedDir(extractDir: string, relativePath: string = ''): Promise<Set<string>> {
  const files = new Set<string>();
  
  try {
    const items = await fsPromises.readdir(extractDir);
    
    for (const item of items) {
      const itemPath = path.join(extractDir, item);
      const stats = await fsPromises.stat(itemPath);
      
      if (stats.isDirectory()) {
        // 递归处理子目录
        const subRelativePath = relativePath ? `${relativePath}/${item}` : item;
        const subFiles = await getExistingFilesFromExtractedDir(itemPath, subRelativePath);
        subFiles.forEach(file => files.add(file));
      } else {
        // 这是一个文件，构建完整路径并标准化
        const fullPath = relativePath ? `${relativePath}/${item}` : item;
        // 标准化路径：使用正斜杠，去掉开头的斜杠
        const normalizedPath = normalizeFilePath(fullPath);
        files.add(normalizedPath);
      }
    }
  } catch (err) {
    console.error('获取现有文件列表失败:', err);
  }
  
  return files;
}

// 标准化文件路径的辅助函数
function normalizeFilePath(filePath: string): string {
  // 将反斜杠转换为正斜杠
  let normalized = filePath.replace(/\\/g, '/');
  // 去掉开头的斜杠
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  // 去掉末尾的斜杠
  if (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

// 解压ZIP文件的辅助函数 - 使用Node.js内置模块
async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    // 使用系统命令解压ZIP文件
    // Windows: PowerShell Expand-Archive
    // Linux/Mac: unzip
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      // Windows PowerShell解压
      await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);
    } else {
      // Linux/Mac unzip
      await execAsync(`unzip -o '${zipPath}' -d '${extractDir}'`);
    }
    
    console.log(`ZIP文件解压成功: ${zipPath} -> ${extractDir}`);
  } catch (error) {
    console.error('ZIP解压失败:', error);
    throw new Error(`ZIP解压失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const items = await fsPromises.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fsPromises.stat(itemPath);
      
      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (err) {
    console.error('计算目录大小失败:', err);
  }
  
  return totalSize;
}

