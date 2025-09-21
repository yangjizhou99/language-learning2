import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getBackupTasks, setBackupTask } from '@/lib/backup-tasks';
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
      compareWith = null
    } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    if (!['all', 'database', 'storage'].includes(backupType)) {
      return NextResponse.json({ error: '无效的备份类型' }, { status: 400 });
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
        compareWith
      });
    });

    // 异步执行备份任务
    executeBackupTasks(tasks, backupPath, incremental, overwriteExisting, compareWith);

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

async function executeBackupTasks(tasks: any[], backupPath: string, incremental: boolean, overwriteExisting: boolean, compareWith: string | null = null) {
  // 执行数据库备份
  const dbTask = tasks.find((t) => t.type === 'database');
  if (dbTask) {
    await executeDatabaseBackup(dbTask.id, backupPath, incremental, overwriteExisting, compareWith);
  }

  // 执行存储桶备份
  const storageTask = tasks.find((t) => t.type === 'storage');
  if (storageTask) {
    await executeStorageBackup(storageTask.id, backupPath, incremental, overwriteExisting, compareWith);
  }
}

async function executeDatabaseBackup(taskId: string, backupPath: string, incremental: boolean = false, overwriteExisting: boolean = false, compareWith: string | null = null) {
  const backupTasks = getBackupTasks();
  const task = backupTasks.get(taskId);
  if (!task) return;

  try {
    // 更新状态为运行中
    task.status = 'running';
    task.message = '正在连接数据库...';
    backupTasks.set(taskId, task);

    const supabase = getServiceSupabase();

    // 获取所有表名 - 使用 RPC 函数查询
    console.log('开始获取表列表...');
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_list');

    if (tablesError) {
      console.error('获取表列表失败:', tablesError);
      throw new Error(`获取表列表失败: ${tablesError.message}`);
    }

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

    // 导出每个表
    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i].table_name;
      const progressPercent = Math.round(10 + (i / tables.length) * 70);
      task.message = `正在导出表: ${tableName} (${i + 1}/${tables.length})`;
      task.progress = progressPercent;
      backupTasks.set(taskId, task);

      try {
        // 获取表结构
        const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
          table_name_param: tableName
        });

        if (columnsError) {
          console.error(`获取表 ${tableName} 结构失败:`, columnsError);
          continue;
        }

        totalColumns += columns.length;

        // 生成CREATE TABLE语句
        sqlContent.push(`-- 表: ${tableName}`);
        sqlContent.push(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);
        sqlContent.push(`CREATE TABLE "${tableName}" (`);

        const columnDefs = columns.map((col: any) => {
          let def = `  "${col.column_name}" ${col.data_type}`;
          if (col.is_nullable === 'NO') def += ' NOT NULL';
          if (col.column_default) def += ` DEFAULT ${col.column_default}`;
          return def;
        });

        sqlContent.push(columnDefs.join(',\n'));
        sqlContent.push(');');
        sqlContent.push('');

        // 获取表数据
        const { data: rows, error: dataError } = await supabase
          .from(tableName)
          .select('*');

        if (dataError) {
          console.error(`获取表 ${tableName} 数据失败:`, dataError);
          continue;
        }

        if (rows && rows.length > 0) {
          totalRows += rows.length;
          sqlContent.push(`-- 数据: ${tableName} (${rows.length} 行)`);
          
          // 分批插入数据
          const batchSize = 1000;
          for (let j = 0; j < rows.length; j += batchSize) {
            const batch = rows.slice(j, j + batchSize);
            const values = batch.map((row) => {
              const rowValues = columns.map((col: any) => {
                const value = row[col.column_name];
                if (value === null) return 'NULL';
                if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
                if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
                return String(value);
              });
              return `(${rowValues.join(', ')})`;
            });

            sqlContent.push(`INSERT INTO "${tableName}" (${columns.map((c: any) => `"${c.column_name}"`).join(', ')}) VALUES`);
            sqlContent.push(values.join(',\n') + ';');
            sqlContent.push('');

            // 更新进度（每处理一批数据更新一次）
            const dataProgressPercent = Math.round(10 + (i / tables.length) * 70 + (j / rows.length) * (70 / tables.length));
            task.message = `正在导出表: ${tableName} (${i + 1}/${tables.length}) - 数据批次 ${Math.floor(j/batchSize) + 1}/${Math.ceil(rows.length/batchSize)} (已导出 ${totalRows} 行)`;
            task.progress = dataProgressPercent;
            backupTasks.set(taskId, task);
          }
        } else {
          task.message = `正在导出表: ${tableName} (${i + 1}/${tables.length}) - 无数据`;
          backupTasks.set(taskId, task);
        }
      } catch (err) {
        console.error(`处理表 ${tableName} 时出错:`, err);
        sqlContent.push(`-- 错误: 无法导出表 ${tableName}`);
        sqlContent.push('');
      }
    }

    // 创建ZIP压缩文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const zipFilePath = path.join(backupPath, `database-backup-${timestamp}.zip`);
    
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
    task.status = 'completed';
    task.message = `数据库备份完成！共导出 ${tables.length} 个表，${totalColumns} 个字段，${totalRows} 行数据，文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`;
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

async function executeStorageBackup(taskId: string, backupPath: string, incremental: boolean = false, overwriteExisting: boolean = false, compareWith: string | null = null) {
  const backupTasks = getBackupTasks();
  const task = backupTasks.get(taskId);
  if (!task) return;

  try {
    // 更新状态为运行中
    task.status = 'running';
    task.message = '正在连接存储服务...';
    backupTasks.set(taskId, task);

    const supabase = getServiceSupabase();

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

    // 下载每个存储桶的文件
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const bucketDir = path.join(tempStorageDir, bucket.name);
      await fsPromises.mkdir(bucketDir, { recursive: true });

      task.message = `正在下载存储桶: ${bucket.name}`;
      task.progress = 10 + (i / buckets.length) * 80;
      backupTasks.set(taskId, task);

      try {
        console.log(`开始处理存储桶: ${bucket.name}`);
        
        // 递归获取所有文件（包括子目录）
        const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
        console.log(`存储桶 ${bucket.name} 中找到 ${allFiles.length} 个文件`);
        
        // 调试信息：显示前10个要下载的文件
        if (incremental && allFiles.length > 0) {
          const sampleFiles = allFiles.slice(0, 10);
          console.log(`增量备份：要下载的文件示例:`, sampleFiles);
          
          // 显示现有文件列表用于对比
          if (existingBackupFiles.size > 0) {
            const sampleExisting = Array.from(existingBackupFiles).slice(0, 10);
            console.log(`增量备份：现有文件示例:`, sampleExisting);
            
            // 检查是否有匹配的文件
            let matchCount = 0;
            for (const file of sampleFiles) {
              const normalizedFile = normalizeFilePath(file);
              if (existingBackupFiles.has(normalizedFile)) {
                matchCount++;
              }
            }
            console.log(`增量备份：示例文件中有 ${matchCount}/${sampleFiles.length} 个匹配现有文件`);
          }
        }

        if (allFiles.length > 0) {
          for (const filePath of allFiles) {
            try {
              // 如果是增量备份，检查文件是否已存在
              if (incremental) {
                // 使用统一的路径标准化函数
                const normalizedPath = normalizeFilePath(filePath);
                let isFound = false;
                
                // 方式1：直接匹配
                if (existingBackupFiles.has(normalizedPath)) {
                  isFound = true;
                }
                
                // 方式2：尝试添加存储桶名称前缀
                if (!isFound) {
                  const withBucketPrefix = `${bucket.name}/${normalizedPath}`;
                  if (existingBackupFiles.has(withBucketPrefix)) {
                    isFound = true;
                  }
                }
                
                // 方式3：尝试从现有文件中查找包含此路径的文件
                if (!isFound) {
                  for (const existingFile of existingBackupFiles) {
                    if (existingFile.endsWith(`/${normalizedPath}`) || existingFile === normalizedPath) {
                      isFound = true;
                      break;
                    }
                  }
                }
                
                if (isFound) {
                  skippedFiles++;
                  console.log(`增量备份：跳过已存在文件 ${filePath} (标准化: ${normalizedPath})`);
                  continue;
                } else {
                  // 调试信息：显示为什么文件没有被跳过
                  console.log(`增量备份：文件不在现有列表中 ${filePath} (标准化: ${normalizedPath})`);
                  // 调试信息：显示现有文件列表中的一些示例
                  if (existingBackupFiles.size > 0) {
                    const sampleExisting = Array.from(existingBackupFiles).slice(0, 5);
                    console.log(`增量备份：现有文件示例:`, sampleExisting);
                  }
                }
              }

              const { data, error: downloadError } = await supabase.storage
                .from(bucket.name)
                .download(filePath);

              if (downloadError) {
                console.error(`下载文件 ${filePath} 失败:`, downloadError);
                continue;
              }

              const localFilePath = path.join(bucketDir, filePath);
              const localDir = path.dirname(localFilePath);
              await fsPromises.mkdir(localDir, { recursive: true });
              
              const buffer = await data.arrayBuffer();
              await fsPromises.writeFile(localFilePath, Buffer.from(buffer));

              downloadedFiles++;
              const progressPercent = Math.round(10 + (downloadedFiles / totalFiles) * downloadProgressMax);
              task.message = `正在下载存储桶: ${bucket.name} (${downloadedFiles}/${totalFiles})${incremental ? `, 跳过 ${skippedFiles} 个` : ''}`;
              task.progress = progressPercent;
              backupTasks.set(taskId, task);
              
              console.log(`成功下载文件: ${filePath}`);
            } catch (err) {
              console.error(`处理文件 ${filePath} 时出错:`, err);
            }
          }
        } else {
          console.log(`存储桶 ${bucket.name} 中没有文件`);
        }
      } catch (err) {
        console.error(`处理存储桶 ${bucket.name} 时出错:`, err);
      }
    }

    // 增量备份只保存新文件，不需要合并现有文件
    if (incremental) {
      task.message = '增量备份：只保存新下载的文件...';
      task.progress = downloadProgressMax + 5;
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

