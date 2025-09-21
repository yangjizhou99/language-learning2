import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { createZipFile, collectFilesFromDirectory } from '@/lib/zip-utils';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { 
      backupType = 'all',
      incremental = false
    } = await req.json();

    if (!['all', 'database', 'storage'].includes(backupType)) {
      return NextResponse.json({ error: '无效的备份类型' }, { status: 400 });
    }

    // 使用系统临时目录
    const tempDir = os.tmpdir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const backupDir = path.join(tempDir, `backup-${timestamp}`);
    
    // 创建临时备份目录
    await fsPromises.mkdir(backupDir, { recursive: true });

    const results = {
      database: null as any,
      storage: null as any,
      combined: null as any
    };

    // 执行数据库备份
    if (backupType === 'all' || backupType === 'database') {
      try {
        results.database = await executeDatabaseBackup(backupDir, incremental);
      } catch (err) {
        console.error('数据库备份失败:', err);
        results.database = { error: err instanceof Error ? err.message : '未知错误' };
      }
    }

    // 执行存储桶备份
    if (backupType === 'all' || backupType === 'storage') {
      try {
        results.storage = await executeStorageBackup(backupDir, incremental);
      } catch (err) {
        console.error('存储桶备份失败:', err);
        results.storage = { error: err instanceof Error ? err.message : '未知错误' };
      }
    }

    // 创建最终的ZIP文件
    const zipFiles = [];
    if (results.database && !results.database.error) {
      zipFiles.push({
        path: results.database.filePath,
        name: `database-backup-${timestamp}.sql`
      });
    }
    if (results.storage && !results.storage.error) {
      zipFiles.push({
        path: results.storage.filePath,
        name: `storage-backup-${timestamp}.zip`
      });
    }

    if (zipFiles.length === 0) {
      // 清理临时目录
      await fsPromises.rm(backupDir, { recursive: true, force: true });
      return NextResponse.json({ 
        error: '备份失败',
        details: results
      }, { status: 500 });
    }

    // 创建最终ZIP文件
    const finalZipPath = path.join(tempDir, `language-learning-backup-${timestamp}.zip`);
    await createZipFile(zipFiles, finalZipPath);

    // 读取ZIP文件
    const zipBuffer = await fsPromises.readFile(finalZipPath);
    const zipStats = await fsPromises.stat(finalZipPath);

    // 清理临时文件
    await fsPromises.rm(backupDir, { recursive: true, force: true });
    await fsPromises.unlink(finalZipPath);

    // 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="language-learning-backup-${timestamp}.zip"`);
    headers.set('Content-Length', zipStats.size.toString());

    return new NextResponse(zipBuffer as BodyInit, { headers });

  } catch (error) {
    console.error('直接下载备份失败:', error);
    return NextResponse.json(
      { 
        error: `备份下载失败: ${error instanceof Error ? error.message : '未知错误'}`,
        suggestions: [
          '请检查服务器临时目录权限',
          '确保有足够的磁盘空间',
          '重试备份操作'
        ]
      },
      { status: 500 }
    );
  }
}

async function executeDatabaseBackup(backupDir: string, incremental: boolean = false) {
  const supabase = getServiceSupabase();

  // 获取所有表名
  const { data: tables, error: tablesError } = await supabase.rpc('get_table_list');
  if (tablesError) {
    throw new Error(`获取表列表失败: ${tablesError.message}`);
  }

  const sqlContent = [];
  sqlContent.push('-- 数据库备份');
  sqlContent.push(`-- 创建时间: ${new Date().toISOString()}`);
  sqlContent.push('');

  let totalRows = 0;
  let totalColumns = 0;

  // 导出每个表
  for (const table of tables) {
    const tableName = table.table_name;
    
    // 获取表结构
    const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
      table_name_param: tableName
    });

    if (columnsError) {
      console.error(`获取表 ${tableName} 列信息失败:`, columnsError);
      continue;
    }

    // 创建表结构
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

    // 导出数据
    const { data: rows, error: rowsError } = await supabase
      .from(tableName)
      .select('*');

    if (rowsError) {
      console.error(`导出表 ${tableName} 数据失败:`, rowsError);
      continue;
    }

    if (rows && rows.length > 0) {
      sqlContent.push(`-- 数据: ${tableName}`);
      
      // 批量插入数据
      const batchSize = 1000;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const columns = Object.keys(batch[0]);
        const values = batch.map(row => 
          `(${columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return `'${String(value).replace(/'/g, "''")}'`;
          }).join(', ')})`
        );
        
        sqlContent.push(`INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES`);
        sqlContent.push(values.join(',\n') + ';');
        sqlContent.push('');
      }
      
      totalRows += rows.length;
    }
    
    totalColumns += columns.length;
  }

  // 写入SQL文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
  const sqlFilePath = path.join(backupDir, `database-backup-${timestamp}.sql`);
  await fsPromises.writeFile(sqlFilePath, sqlContent.join('\n'), 'utf8');

  const stats = await fsPromises.stat(sqlFilePath);
  
  return {
    filePath: sqlFilePath,
    size: stats.size,
    tableCount: tables.length,
    totalRows,
    totalColumns
  };
}

async function executeStorageBackup(backupDir: string, incremental: boolean = false) {
  const supabase = getServiceSupabase();

  // 获取所有存储桶
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) {
    throw new Error(`获取存储桶列表失败: ${bucketsError.message}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
  const storageDir = path.join(backupDir, `storage-backup-${timestamp}`);
  await fsPromises.mkdir(storageDir, { recursive: true });

  let totalFiles = 0;
  let downloadedFiles = 0;

  // 处理每个存储桶
  for (const bucket of buckets) {
    const bucketDir = path.join(storageDir, bucket.name);
    await fsPromises.mkdir(bucketDir, { recursive: true });

    // 获取存储桶中的所有文件
    const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
    
    for (const filePath of allFiles) {
      try {
        const { data, error } = await supabase.storage
          .from(bucket.name)
          .download(filePath);

        if (error) {
          console.error(`下载文件失败 ${bucket.name}/${filePath}:`, error);
          continue;
        }

        const localFilePath = path.join(bucketDir, filePath);
        const localDir = path.dirname(localFilePath);
        await fsPromises.mkdir(localDir, { recursive: true });

        const arrayBuffer = await data.arrayBuffer();
        await fsPromises.writeFile(localFilePath, Buffer.from(arrayBuffer));
        
        downloadedFiles++;
      } catch (err) {
        console.error(`处理文件失败 ${bucket.name}/${filePath}:`, err);
      }
    }
    
    totalFiles += allFiles.length;
  }

  // 创建存储桶ZIP文件
  const zipFilePath = path.join(backupDir, `storage-backup-${timestamp}.zip`);
  await createZipFile([{ path: storageDir, name: `storage-backup-${timestamp}` }], zipFilePath);

  const stats = await fsPromises.stat(zipFilePath);
  
  return {
    filePath: zipFilePath,
    size: stats.size,
    bucketCount: buckets.length,
    totalFiles,
    downloadedFiles
  };
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
