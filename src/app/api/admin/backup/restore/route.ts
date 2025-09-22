import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { createDatabaseConnection, DatabaseType } from '@/lib/backup-db';
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
    let databaseType: DatabaseType = 'supabase';

    if (contentType?.includes('multipart/form-data')) {
      // 上传文件方式
      const formData = await req.formData();
      file = formData.get('file') as File;
      restoreType = (formData.get('restoreType') as string) || 'upload';
      const dt = formData.get('databaseType') as string | null;
      if (dt && (['local','prod','supabase'] as const).includes(dt as DatabaseType)) {
        databaseType = dt as DatabaseType;
      }
    } else {
      // JSON方式（历史备份或增量恢复）
      const body = await req.json();
      restoreType = body.restoreType || 'history';
      backupPath = body.backupPath;
      if (body.databaseType && (['local','prod','supabase'] as const).includes(body.databaseType)) {
        databaseType = body.databaseType as DatabaseType;
      }
    }
    // 校验数据库类型
    if (!(['local','prod','supabase'] as const).includes(databaseType)) {
      return NextResponse.json({ error: '无效的数据库类型' }, { status: 400 });
    }

    if (restoreType === 'upload' && !file) {
      return NextResponse.json({ error: '请选择要恢复的备份文件' }, { status: 400 });
    }

    if (restoreType === 'history' && !backupPath) {
      return NextResponse.json({ error: '请选择要恢复的历史备份' }, { status: 400 });
    }

    if (restoreType === 'incremental' && !backupPath) {
      return NextResponse.json({ error: '增量恢复需要选择备份文件' }, { status: 400 });
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
      } else if (restoreType === 'incremental') {
        // 增量恢复方式：直接使用单个备份文件
        await copyBackupFromHistory(backupPath!, tempDir);
      } else {
        // 历史备份方式
        await copyBackupFromHistory(backupPath!, tempDir);
      }

      // 恢复数据库
      const sqlFiles = await findSqlFiles(tempDir);
      console.log('找到SQL文件:', sqlFiles);
      
      if (sqlFiles.length > 0) {
        console.log('开始恢复数据库...');
        await restoreDatabase(sqlFiles[0], databaseType);
        console.log('数据库恢复完成');
      } else {
        console.log('未找到SQL文件，跳过数据库恢复');
      }

      // 恢复存储桶文件
      const storageDir = path.join(tempDir, 'storage');
      try {
        await fs.access(storageDir);
        console.log('开始恢复存储桶文件...');
        const isIncremental = restoreType === 'incremental';
        await restoreStorage(storageDir, isIncremental, databaseType);
        console.log(`存储桶恢复完成 (${isIncremental ? '增量' : '完整'}模式)`);
      } catch {
        console.log('存储目录不存在，跳过存储桶恢复');
      }

      return NextResponse.json({
        message: restoreType === 'incremental' ? '增量恢复完成（并行处理）' : '恢复完成（并行处理）',
        details: {
          databaseFiles: sqlFiles.length,
          storageRestored: true,
          restoreType: restoreType,
          mode: restoreType === 'incremental' ? '增量模式（只恢复数据库中缺失的文件）' : '完整模式（恢复所有备份文件）',
          parallelProcessing: true,
          performance: '使用并行处理提高恢复速度',
          databaseType
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

async function restoreDatabase(sqlFilePath: string, databaseType: DatabaseType): Promise<void> {
  const supabase = databaseType === 'supabase' ? getServiceSupabase() : null;
  
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

    // 高性能并行执行SQL语句 - 优化批处理
    const BATCH_SIZE = databaseType === 'supabase' ? 10 : 20; // Supabase RPC限制较严，PostgreSQL直连可以更高并发
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    console.log(`开始批处理执行 ${statements.length} 个SQL语句，批处理大小: ${BATCH_SIZE}`);
    
    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (statement, batchIndex) => {
        const globalIndex = i + batchIndex;
        if (!statement.trim()) return { success: true, index: globalIndex };
        
        try {
          console.log(`执行SQL语句 ${globalIndex + 1}/${statements.length}:`, statement.substring(0, 100) + '...');
          
          if (databaseType === 'supabase') {
            // 使用 Supabase RPC 执行
            const { error } = await (supabase as any).rpc('exec_sql', { sql: statement });
            if (error) {
              console.error('执行SQL语句失败:', error, 'Statement:', statement);
              if (
                !error.message.includes('already exists') &&
                !error.message.includes('does not exist') &&
                !error.message.includes('duplicate key')
              ) {
                throw error;
              } else {
                console.log('跳过非致命错误:', error.message);
                return { success: true, index: globalIndex, skipped: true };
              }
            } else {
              console.log(`SQL语句 ${globalIndex + 1} 执行成功`);
              return { success: true, index: globalIndex };
            }
          } else {
            // 使用 pg 客户端执行（local/prod）- 优化连接复用
            const { client } = createDatabaseConnection(databaseType);
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
              try {
                await (client as any).connect();
                try {
                  await (client as any).query(statement);
                  console.log(`SQL语句 ${globalIndex + 1} 执行成功 (尝试 ${retries + 1})`);
                  return { success: true, index: globalIndex };
                } finally {
                  await (client as any).end();
                }
                break; // 成功执行，跳出重试循环
              } catch (retryErr) {
                retries++;
                if (retries >= maxRetries) {
                  throw retryErr;
                }
                console.warn(`SQL语句 ${globalIndex + 1} 执行失败，重试 ${retries}/${maxRetries}:`, retryErr);
                // 短暂延迟后重试
                await new Promise(resolve => setTimeout(resolve, 100 * retries));
              }
            }
          }
        } catch (err) {
          console.error('执行SQL语句时出错:', err, 'Statement:', statement);
          // 对于非致命错误，继续执行
          if (err instanceof Error && 
              !err.message.includes('already exists') && 
              !err.message.includes('does not exist') &&
              !err.message.includes('duplicate key')) {
            return { success: false, index: globalIndex, error: err.message };
          } else {
            console.log('跳过非致命错误:', err instanceof Error ? err.message : '未知错误');
            return { success: true, index: globalIndex, skipped: true };
          }
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // 统计批次结果
      batchResults.forEach(result => {
        if (result.success) {
          if (result.skipped) {
            skippedCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
        }
      });
      
      const progress = Math.round(((i + batch.length) / statements.length) * 100);
      console.log(`批次 ${Math.floor(i / BATCH_SIZE) + 1} 完成 (${progress}%): 成功 ${batchResults.filter(r => r.success && !r.skipped).length}，跳过 ${batchResults.filter(r => r.skipped).length}，失败 ${batchResults.filter(r => !r.success).length}`);
    }
    
    console.log(`数据库恢复完成: 成功 ${successCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个语句`);
  } catch (err) {
    console.error('恢复数据库失败:', err);
    throw err;
  }
}

async function restoreStorage(storageDir: string, incrementalMode: boolean = false, databaseType: DatabaseType = 'supabase'): Promise<void> {
  const { getSupabaseFor } = await import('@/lib/supabaseEnv');
  const supabase = getSupabaseFor(databaseType);
  
  try {
    const items = await fs.readdir(storageDir);
    const bucketDirs = [];
    
    // 收集所有存储桶目录
    for (const item of items) {
      const itemPath = path.join(storageDir, item);
      const stats = await fs.stat(itemPath);
      
      if (stats.isDirectory()) {
        bucketDirs.push({
          name: item,
          path: itemPath
        });
      }
    }
    
    console.log(`找到 ${bucketDirs.length} 个存储桶目录，开始并行处理...`);
    
    // 并行处理所有存储桶
    const bucketPromises = bucketDirs.map(async (bucketDir) => {
      const bucketName = bucketDir.name;
      
      try {
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
            return { bucketName, success: false, error: createError.message };
          }
          console.log(`创建存储桶 ${bucketName} 成功`);
        }
        
        // 上传文件
        await uploadDirectoryToBucket(supabase, bucketDir.path, bucketName, '', incrementalMode);
        
        return { bucketName, success: true };
      } catch (err) {
        console.error(`处理存储桶 ${bucketName} 失败:`, err);
        return { bucketName, success: false, error: err instanceof Error ? err.message : '未知错误' };
      }
    });
    
    // 等待所有存储桶处理完成
    const results = await Promise.all(bucketPromises);
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`存储桶恢复完成: 成功 ${successCount} 个，失败 ${failureCount} 个`);
    
    if (failureCount > 0) {
      const failedBuckets = results.filter(r => !r.success).map(r => `${r.bucketName}(${r.error})`);
      console.warn(`失败的存储桶: ${failedBuckets.join(', ')}`);
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
  supabase: any,
  dirPath: string,
  bucketName: string,
  prefix: string = '',
  incrementalMode: boolean = false
): Promise<void> {
  try {
    console.log(`开始批量检查存储桶 ${bucketName} 中的现有文件...`);
    
    // 先获取存储桶中所有现有文件的列表
    const existingFiles = await getAllFilesFromBucket(supabase, bucketName, prefix);
    const existingFileSet = new Set(existingFiles);
    
    console.log(`存储桶 ${bucketName} 中现有文件数量: ${existingFiles.length}`);
    
    // 收集所有需要上传的文件
    const filesToUpload = await collectFilesToUpload(dirPath, prefix, existingFileSet, incrementalMode);
    
    console.log(`存储桶 ${bucketName} 需要上传 ${filesToUpload.length} 个文件`);
    
    if (filesToUpload.length === 0) {
      console.log(`存储桶 ${bucketName} 没有需要上传的文件`);
      return;
    }
    
    // 高性能并行上传文件 - 优化
    const CONCURRENT_UPLOADS = 30; // 提高并发上传数量
    let uploadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    console.log(`开始批量上传 ${filesToUpload.length} 个文件，并发数: ${CONCURRENT_UPLOADS}`);
    
    for (let i = 0; i < filesToUpload.length; i += CONCURRENT_UPLOADS) {
      const batch = filesToUpload.slice(i, i + CONCURRENT_UPLOADS);
      
      const uploadPromises = batch.map(async (fileInfo) => {
        const maxRetries = 3;
        let retries = 0;
        
        while (retries < maxRetries) {
          try {
            const fileBuffer = await fs.readFile(fileInfo.filePath);
            
            const { error } = await supabase.storage
              .from(bucketName)
              .upload(fileInfo.relativePath, fileBuffer, {
                upsert: !incrementalMode // 非增量模式覆盖现有文件
              });
            
            if (error) {
              if (retries < maxRetries - 1) {
                retries++;
                console.warn(`上传文件 ${fileInfo.relativePath} 失败，重试 ${retries}/${maxRetries}:`, error.message);
                await new Promise(resolve => setTimeout(resolve, 200 * retries)); // 递增延迟
                continue;
              } else {
                console.error(`上传文件 ${fileInfo.relativePath} 最终失败:`, error);
                return { success: false, file: fileInfo.relativePath, error: error.message };
              }
            } else {
              return { success: true, file: fileInfo.relativePath, retries };
            }
          } catch (err) {
            if (retries < maxRetries - 1) {
              retries++;
              console.warn(`处理文件 ${fileInfo.relativePath} 失败，重试 ${retries}/${maxRetries}:`, err);
              await new Promise(resolve => setTimeout(resolve, 200 * retries));
              continue;
            } else {
              console.error(`处理文件 ${fileInfo.relativePath} 最终失败:`, err);
              return { success: false, file: fileInfo.relativePath, error: err instanceof Error ? err.message : '未知错误' };
            }
          }
        }
        
        return { success: false, file: fileInfo.relativePath, error: '达到最大重试次数' };
      });
      
      const results = await Promise.all(uploadPromises);
      
      // 统计结果
      results.forEach(result => {
        if (result.success) {
          uploadedCount++;
        } else {
          errorCount++;
        }
      });
      
      const batchSuccess = results.filter(r => r.success).length;
      const batchFailure = results.filter(r => !r.success).length;
      const progress = Math.round(((i + CONCURRENT_UPLOADS) / filesToUpload.length) * 100);
      console.log(`批次 ${Math.floor(i / CONCURRENT_UPLOADS) + 1} 完成: 成功 ${batchSuccess} 个，失败 ${batchFailure} 个，进度 ${Math.min(progress, 100)}%`);
    }
    
    skippedCount = filesToUpload.length - uploadedCount - errorCount;
    console.log(`存储桶 ${bucketName} 上传完成: 成功 ${uploadedCount} 个，跳过 ${skippedCount} 个，失败 ${errorCount} 个`);
  } catch (err) {
    console.error('上传目录到存储桶失败:', err);
    throw err;
  }
}

// 收集需要上传的文件
async function collectFilesToUpload(
  dirPath: string,
  prefix: string,
  existingFileSet: Set<string>,
  incrementalMode: boolean
): Promise<Array<{ filePath: string; relativePath: string }>> {
  const filesToUpload: Array<{ filePath: string; relativePath: string }> = [];
  
  const items = await fs.readdir(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stats = await fs.stat(itemPath);
    
    if (stats.isDirectory()) {
      // 递归处理子目录
      const subFiles = await collectFilesToUpload(itemPath, `${prefix}${item}/`, existingFileSet, incrementalMode);
      filesToUpload.push(...subFiles);
    } else {
      // 检查文件是否已存在
      const filePath = `${prefix}${item}`;
      
      if (incrementalMode) {
        // 增量模式：只上传数据库中不存在的文件
        if (existingFileSet.has(filePath)) {
          continue; // 跳过已存在的文件
        }
      } else {
        // 完整模式：检查文件是否已存在
        if (existingFileSet.has(filePath)) {
          continue; // 跳过已存在的文件
        }
      }
      
      // 添加到上传列表
      filesToUpload.push({
        filePath: itemPath,
        relativePath: filePath
      });
    }
  }
  
  return filesToUpload;
}

// 获取存储桶中所有文件的递归函数
async function getAllFilesFromBucket(
  supabase: any,
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
      for (const file of files as any[]) {
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

