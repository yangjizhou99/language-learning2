import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import yauzl from 'yauzl';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const contentType = req.headers.get('content-type');
    let restoreType: string;
    let file: File | null = null;
    let backupPath: string | null = null;

    if (contentType?.includes('multipart/form-data')) {
      // 上传文件方式
      const formData = await req.formData();
      file = formData.get('file') as File;
      restoreType = formData.get('restoreType') as string || 'upload';
    } else {
      // JSON方式（历史备份）
      const body = await req.json();
      restoreType = body.restoreType || 'history';
      backupPath = body.backupPath;
    }

    if (restoreType === 'upload' && !file) {
      return NextResponse.json({ error: '请选择要恢复的备份文件' }, { status: 400 });
    }

    if (restoreType === 'history' && !backupPath) {
      return NextResponse.json({ error: '请选择要恢复的历史备份' }, { status: 400 });
    }

    // 创建临时目录
    const tempDir = path.join(process.cwd(), 'temp', 'restore', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    try {
      if (restoreType === 'upload') {
        // 上传文件方式
        const tempFilePath = path.join(tempDir, file!.name);
        const fileBuffer = await file!.arrayBuffer();
        await fs.writeFile(tempFilePath, Buffer.from(fileBuffer));

        // 解压ZIP文件
        await extractZip(tempFilePath, tempDir);
      } else {
        // 历史备份方式
        await copyBackupFromHistory(backupPath!, tempDir);
      }

      // 恢复数据库
      const sqlFiles = await findSqlFiles(tempDir);
      console.log('找到SQL文件:', sqlFiles);
      
      if (sqlFiles.length > 0) {
        console.log('开始恢复数据库...');
        await restoreDatabase(sqlFiles[0]);
        console.log('数据库恢复完成');
      } else {
        console.log('未找到SQL文件，跳过数据库恢复');
      }

      // 恢复存储桶文件
      const storageDir = path.join(tempDir, 'storage');
      try {
        await fs.access(storageDir);
        console.log('开始恢复存储桶文件...');
        await restoreStorage(storageDir);
        console.log('存储桶恢复完成');
      } catch {
        console.log('存储目录不存在，跳过存储桶恢复');
      }

      return NextResponse.json({
        message: '恢复完成',
        details: {
          databaseFiles: sqlFiles.length,
          storageRestored: true,
          restoreType: restoreType,
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
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { 
        error: '恢复备份失败',
        details: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  console.log('开始解压ZIP文件:', zipPath);
  console.log('解压到目录:', extractDir);
  
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        console.error('打开ZIP文件失败:', err);
        reject(err);
        return;
      }

      if (!zipfile) {
        console.error('ZIP文件对象为空');
        reject(new Error('ZIP文件对象为空'));
        return;
      }

      console.log('ZIP文件打开成功，开始读取条目...');
      let entryCount = 0;
      
      zipfile.readEntry();
      zipfile.on('entry', (entry) => {
        entryCount++;
        console.log(`处理条目 ${entryCount}: ${entry.fileName}`);
        
        if (/\/$/.test(entry.fileName)) {
          // 目录
          const dirPath = path.join(extractDir, entry.fileName);
          fs.mkdir(dirPath, { recursive: true })
            .then(() => {
              console.log(`创建目录: ${dirPath}`);
              zipfile.readEntry();
            })
            .catch((err) => {
              console.error(`创建目录失败: ${dirPath}`, err);
              reject(err);
            });
        } else {
          // 文件
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`打开文件流失败: ${entry.fileName}`, err);
              reject(err);
              return;
            }

            const filePath = path.join(extractDir, entry.fileName);
            const dirPath = path.dirname(filePath);
            
            // 确保目录存在
            fs.mkdir(dirPath, { recursive: true })
              .then(() => {
                const writeStream = createWriteStream(filePath);
                
                pipeline(readStream, writeStream)
                  .then(() => {
                    console.log(`解压文件完成: ${entry.fileName}`);
                    zipfile.readEntry();
                  })
                  .catch((err) => {
                    console.error(`解压文件失败: ${entry.fileName}`, err);
                    reject(err);
                  });
              })
              .catch((err) => {
                console.error(`创建文件目录失败: ${dirPath}`, err);
                reject(err);
              });
          });
        }
      });

      zipfile.on('end', () => {
        console.log(`ZIP解压完成，共处理 ${entryCount} 个条目`);
        resolve();
      });

      zipfile.on('error', (err) => {
        console.error('ZIP文件处理错误:', err);
        reject(err);
      });
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
    console.log('开始恢复数据库，SQL文件:', sqlFilePath);
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    console.log('SQL文件大小:', sqlContent.length, '字符');
    
    // 分割SQL语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log('找到', statements.length, '个SQL语句');

    // 执行每个SQL语句
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`执行SQL语句 ${i + 1}/${statements.length}:`, statement.substring(0, 100) + '...');
          
          // 直接执行SQL语句
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error('执行SQL语句失败:', error, 'Statement:', statement);
            // 对于某些错误（如表已存在），我们继续执行
            if (!error.message.includes('already exists') && 
                !error.message.includes('does not exist') &&
                !error.message.includes('duplicate key')) {
              throw error;
            } else {
              console.log('跳过非致命错误:', error.message);
            }
          } else {
            console.log(`SQL语句 ${i + 1} 执行成功`);
          }
        } catch (err) {
          console.error('执行SQL语句时出错:', err, 'Statement:', statement);
          // 对于非致命错误，继续执行
          if (err instanceof Error && 
              !err.message.includes('already exists') && 
              !err.message.includes('does not exist') &&
              !err.message.includes('duplicate key')) {
            throw err;
          } else {
            console.log('跳过非致命错误:', err instanceof Error ? err.message : '未知错误');
          }
        }
      }
    }
    
    console.log('数据库恢复完成');
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

async function copyBackupFromHistory(backupPath: string, tempDir: string): Promise<void> {
  try {
    console.log('开始从历史备份复制:', backupPath);
    console.log('复制到临时目录:', tempDir);
    
    // 检查备份路径是否存在
    await fs.access(backupPath);
    console.log('备份路径存在，获取文件信息...');
    
    const stats = await fs.stat(backupPath);
    console.log('文件信息:', {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime
    });
    
    if (stats.isFile()) {
      // 如果是文件，直接复制
      const fileName = path.basename(backupPath);
      const destPath = path.join(tempDir, fileName);
      console.log(`复制文件: ${backupPath} -> ${destPath}`);
      
      await fs.copyFile(backupPath, destPath);
      console.log('文件复制完成');
      
      // 如果是ZIP文件，解压
      if (fileName.endsWith('.zip')) {
        console.log('检测到ZIP文件，开始解压...');
        await extractZip(destPath, tempDir);
        console.log('ZIP文件解压完成');
      } else {
        console.log('非ZIP文件，跳过解压');
      }
    } else if (stats.isDirectory()) {
      // 如果是目录，复制整个目录
      console.log('检测到目录，开始复制整个目录...');
      await copyDirectory(backupPath, tempDir);
      console.log('目录复制完成');
    } else {
      throw new Error('不支持的备份文件类型');
    }
    
    console.log('从历史备份复制完成');
  } catch (err) {
    console.error('从历史备份复制失败:', err);
    if (err instanceof Error) {
      console.error('错误详情:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
    }
    throw new Error(`从历史备份复制失败: ${err instanceof Error ? err.message : '未知错误'}`);
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  try {
    await fs.mkdir(dest, { recursive: true });
    
    const items = await fs.readdir(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stats = await fs.stat(srcPath);
      
      if (stats.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error('复制目录失败:', err);
    throw err;
  }
}

async function uploadDirectoryToBucket(
  supabase: { storage: { from: (bucket: string) => { upload: (path: string, file: Buffer) => Promise<{ error: unknown }> } } },
  dirPath: string,
  bucketName: string,
  prefix: string = ''
): Promise<void> {
  try {
    console.log(`开始批量检查存储桶 ${bucketName} 中的现有文件...`);
    
    // 先获取存储桶中所有现有文件的列表
    const existingFiles = await getAllFilesFromBucket(supabase, bucketName, prefix);
    const existingFileSet = new Set(existingFiles);
    
    console.log(`存储桶 ${bucketName} 中现有文件数量: ${existingFiles.length}`);
    
    const items = await fs.readdir(dirPath);
    let uploadedCount = 0;
    let skippedCount = 0;
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        // 递归处理子目录
        await uploadDirectoryToBucket(supabase, itemPath, bucketName, `${prefix}${item}/`);
      } else {
        // 检查文件是否已存在
        const filePath = `${prefix}${item}`;
        
        if (existingFileSet.has(filePath)) {
          skippedCount++;
          console.log(`跳过已存在文件: ${filePath}`);
          continue;
        }
        
        // 文件不存在，进行上传
        const fileBuffer = await fs.readFile(itemPath);
        
        const { error } = await supabase.storage
          .from(bucketName)
          .upload(filePath, fileBuffer);
        
        if (error) {
          console.error(`上传文件 ${filePath} 失败:`, error);
        } else {
          uploadedCount++;
          console.log(`上传文件成功: ${filePath}`);
        }
      }
    }
    
    console.log(`存储桶 ${bucketName} 上传完成: 成功 ${uploadedCount} 个，跳过 ${skippedCount} 个`);
  } catch (err) {
    console.error('上传目录到存储桶失败:', err);
    throw err;
  }
}

// 获取存储桶中所有文件的递归函数
async function getAllFilesFromBucket(
  supabase: { storage: { from: (bucket: string) => { list: (path: string, options?: any) => Promise<{ data: any[] }> } } },
  bucketName: string,
  prefix: string = ''
): Promise<string[]> {
  const allFiles: string[] = [];
  
  try {
    const { data: files } = await supabase.storage
      .from(bucketName)
      .list(prefix, { 
        limit: 1000, 
        sortBy: { column: 'name', order: 'asc' },
        offset: 0
      });

    if (files) {
      for (const file of files) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;
        
        if (file.metadata && file.metadata.size !== undefined) {
          // 这是一个文件
          allFiles.push(fullPath);
        } else {
          // 这是一个目录，递归获取
          const subFiles = await getAllFilesFromBucket(supabase, bucketName, fullPath);
          allFiles.push(...subFiles);
        }
      }
    }
  } catch (err) {
    console.error(`获取存储桶 ${bucketName} 文件列表失败:`, err);
  }
  
  return allFiles;
}
