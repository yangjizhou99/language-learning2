import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getBackupTasks, setBackupTask } from '@/lib/backup-tasks';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { backupPath } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    // 检查备份路径是否存在
    try {
      await fs.access(backupPath);
    } catch {
      // 尝试创建目录
      try {
        await fs.mkdir(backupPath, { recursive: true });
      } catch (err) {
        return NextResponse.json(
          { error: '无法创建备份目录，请检查路径权限' },
          { status: 400 }
        );
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tasks = [
      {
        id: `db-${timestamp}`,
        type: 'database',
        status: 'pending',
        progress: 0,
        message: '等待开始',
        createdAt: new Date().toISOString(),
      },
      {
        id: `storage-${timestamp}`,
        type: 'storage',
        status: 'pending',
        progress: 0,
        message: '等待开始',
        createdAt: new Date().toISOString(),
      },
    ];

    // 存储任务状态
    const backupTasks = getBackupTasks();
    tasks.forEach((task) => {
      setBackupTask(task.id, { ...task, backupPath });
    });

    // 异步执行备份任务
    executeBackupTasks(tasks, backupPath);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('启动备份失败:', error);
    return NextResponse.json(
      { error: '启动备份失败' },
      { status: 500 }
    );
  }
}

async function executeBackupTasks(tasks: any[], backupPath: string) {
  // 执行数据库备份
  const dbTask = tasks.find((t) => t.type === 'database');
  if (dbTask) {
    await executeDatabaseBackup(dbTask.id, backupPath);
  }

  // 执行存储桶备份
  const storageTask = tasks.find((t) => t.type === 'storage');
  if (storageTask) {
    await executeStorageBackup(storageTask.id, backupPath);
  }
}

async function executeDatabaseBackup(taskId: string, backupPath: string) {
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

    // 导出每个表
    for (let i = 0; i < tables.length; i++) {
      const tableName = tables[i].table_name;
      const progressPercent = Math.round(10 + (i / tables.length) * 80);
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
          sqlContent.push(`-- 数据: ${tableName}`);
          
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
            const dataProgressPercent = Math.round(10 + (i / tables.length) * 80 + (j / rows.length) * (80 / tables.length));
            task.message = `正在导出表: ${tableName} (${i + 1}/${tables.length}) - 数据批次 ${Math.floor(j/batchSize) + 1}/${Math.ceil(rows.length/batchSize)}`;
            task.progress = dataProgressPercent;
            backupTasks.set(taskId, task);
          }
        }
      } catch (err) {
        console.error(`处理表 ${tableName} 时出错:`, err);
        sqlContent.push(`-- 错误: 无法导出表 ${tableName}`);
        sqlContent.push('');
      }
    }

    // 保存SQL文件 - 添加时间戳避免覆盖
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const fileName = `database-backup-${timestamp}.sql`;
    const filePath = path.join(backupPath, fileName);
    await fs.writeFile(filePath, sqlContent.join('\n'), 'utf8');

    const stats = await fs.stat(filePath);

    // 更新任务状态
    task.status = 'completed';
    task.message = `数据库备份完成，共导出 ${tables.length} 个表`;
    task.progress = 100;
    task.filePath = filePath;
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

async function executeStorageBackup(taskId: string, backupPath: string) {
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

    // 创建带时间戳的存储目录
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const storageDir = path.join(backupPath, `storage-${timestamp}`);
    await fs.mkdir(storageDir, { recursive: true });

    let totalFiles = 0;
    let downloadedFiles = 0;

    // 先统计总文件数（递归统计）
    for (const bucket of buckets) {
      const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
      totalFiles += allFiles.length;
      console.log(`存储桶 ${bucket.name} 中有 ${allFiles.length} 个文件`);
    }

    task.message = `找到 ${totalFiles} 个文件，开始下载...`;
    task.progress = 10;
    backupTasks.set(taskId, task);

    // 下载每个存储桶的文件
    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      const bucketDir = path.join(storageDir, bucket.name);
      await fs.mkdir(bucketDir, { recursive: true });

      task.message = `正在下载存储桶: ${bucket.name}`;
      task.progress = 10 + (i / buckets.length) * 80;
      backupTasks.set(taskId, task);

      try {
        console.log(`开始处理存储桶: ${bucket.name}`);
        
        // 递归获取所有文件（包括子目录）
        const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
        console.log(`存储桶 ${bucket.name} 中找到 ${allFiles.length} 个文件`);

        if (allFiles.length > 0) {
          for (const filePath of allFiles) {
            try {
              const { data, error: downloadError } = await supabase.storage
                .from(bucket.name)
                .download(filePath);

              if (downloadError) {
                console.error(`下载文件 ${filePath} 失败:`, downloadError);
                continue;
              }

              const localFilePath = path.join(bucketDir, filePath);
              const localDir = path.dirname(localFilePath);
              await fs.mkdir(localDir, { recursive: true });
              
              const buffer = await data.arrayBuffer();
              await fs.writeFile(localFilePath, Buffer.from(buffer));

              downloadedFiles++;
              const progressPercent = Math.round(10 + (downloadedFiles / totalFiles) * 80);
              task.message = `正在下载存储桶: ${bucket.name} (${downloadedFiles}/${totalFiles})`;
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

    // 计算存储目录大小
    const stats = await getDirectorySize(storageDir);

    // 更新任务状态
    task.status = 'completed';
    task.message = `存储桶备份完成，共下载 ${downloadedFiles} 个文件`;
    task.progress = 100;
    task.filePath = storageDir;
    task.fileSize = stats;
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

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
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

