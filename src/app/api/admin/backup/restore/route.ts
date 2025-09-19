import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import yauzl from 'yauzl';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '请选择要恢复的备份文件' }, { status: 400 });
    }

    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', 'restore', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // 保存上传的文件
      const tempFilePath = path.join(tempDir, file.name);
      const fileBuffer = await file.arrayBuffer();
      await fs.writeFile(tempFilePath, Buffer.from(fileBuffer));

      // 解压ZIP文件
      await extractZip(tempFilePath, tempDir);

      // 恢复数据库
      const sqlFiles = await findSqlFiles(tempDir);
      if (sqlFiles.length > 0) {
        await restoreDatabase(sqlFiles[0]);
      }

      // 恢复存储桶文件
      const storageDir = path.join(tempDir, 'storage');
      try {
        await fs.access(storageDir);
        await restoreStorage(storageDir);
      } catch {
        // 存储目录不存在，跳过
      }

      return NextResponse.json({
        message: '恢复完成',
        details: {
          databaseFiles: sqlFiles.length,
          storageRestored: true,
        },
      });
    } finally {
      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('清理临时文件失败:', err);
      }
    }
  } catch (error) {
    console.error('恢复备份失败:', error);
    return NextResponse.json(
      { error: '恢复备份失败' },
      { status: 500 }
    );
  }
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // 目录
          const dirPath = path.join(extractDir, entry.fileName);
          fs.mkdir(dirPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(reject);
        } else {
          // 文件
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }

            const filePath = path.join(extractDir, entry.fileName);
            const writeStream = createWriteStream(filePath);
            
            pipeline(readStream, writeStream)
              .then(() => zipfile.readEntry())
              .catch(reject);
          });
        }
      });

      zipfile.on('end', () => resolve());
      zipfile.on('error', reject);
    });
  });
}

async function findSqlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const items = await fs.readdir(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        const subFiles = await findSqlFiles(itemPath);
        files.push(...subFiles);
      } else if (item.endsWith('.sql')) {
        files.push(itemPath);
      }
    }
  } catch (err) {
    console.error('查找SQL文件失败:', err);
  }
  
  return files;
}

async function restoreDatabase(sqlFilePath: string): Promise<void> {
  const supabase = getServiceSupabase();
  
  try {
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    
    // 分割SQL语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // 执行每个SQL语句
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // 直接执行SQL语句
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error('执行SQL语句失败:', error, 'Statement:', statement);
            // 对于某些错误（如表已存在），我们继续执行
            if (!error.message.includes('already exists') && 
                !error.message.includes('does not exist')) {
              throw error;
            }
          }
        } catch (err) {
          console.error('执行SQL语句时出错:', err, 'Statement:', statement);
          // 对于非致命错误，继续执行
          if (err instanceof Error && 
              !err.message.includes('already exists') && 
              !err.message.includes('does not exist')) {
            throw err;
          }
        }
      }
    }
  } catch (err) {
    console.error('恢复数据库失败:', err);
    throw err;
  }
}

async function restoreStorage(storageDir: string): Promise<void> {
  const supabase = getServiceSupabase();
  
  try {
    const items = await fs.readdir(storageDir);
    
    for (const item of items) {
      const itemPath = path.join(storageDir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        // 这是一个存储桶目录
        const bucketName = item;
        
        // 检查存储桶是否存在
        const { data: buckets } = await supabase.storage.listBuckets();
        const bucketExists = buckets?.some(b => b.name === bucketName);
        
        if (!bucketExists) {
          // 创建存储桶
          const { error: createError } = await supabase.storage.createBucket(bucketName, {
            public: false,
          });
          
          if (createError) {
            console.error(`创建存储桶 ${bucketName} 失败:`, createError);
            continue;
          }
        }
        
        // 上传文件
        await uploadDirectoryToBucket(supabase, itemPath, bucketName);
      }
    }
  } catch (err) {
    console.error('恢复存储桶失败:', err);
    throw err;
  }
}

async function uploadDirectoryToBucket(
  supabase: any,
  dirPath: string,
  bucketName: string,
  prefix: string = ''
): Promise<void> {
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        // 递归处理子目录
        await uploadDirectoryToBucket(supabase, itemPath, bucketName, `${prefix}${item}/`);
      } else {
        // 上传文件
        const filePath = `${prefix}${item}`;
        const fileBuffer = await fs.readFile(itemPath);
        
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, fileBuffer);
        
        if (error) {
          console.error(`上传文件 ${filePath} 失败:`, error);
        }
      }
    }
  } catch (err) {
    console.error('上传目录到存储桶失败:', err);
    throw err;
  }
}
