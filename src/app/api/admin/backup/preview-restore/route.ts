import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import fsPromises from 'fs/promises';
import path from 'path';

// 标准化文件路径的辅助函数
function normalizeFilePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }
  return normalized;
}

// 递归获取存储桶中的所有文件
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
          allFiles.push(fullPath);
        } else {
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
        const subRelativePath = relativePath ? `${relativePath}/${item}` : item;
        const subFiles = await getExistingFilesFromExtractedDir(itemPath, subRelativePath);
        subFiles.forEach(file => files.add(file));
      } else {
        const fullPath = relativePath ? `${relativePath}/${item}` : item;
        const normalizedPath = normalizeFilePath(fullPath);
        files.add(normalizedPath);
      }
    }
  } catch (err) {
    console.error('获取现有文件列表失败:', err);
  }
  
  return files;
}

// 解压ZIP文件的辅助函数
async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      await execAsync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`);
    } else {
      await execAsync(`unzip -o '${zipPath}' -d '${extractDir}'`);
    }
    
    console.log(`ZIP文件解压成功: ${zipPath} -> ${extractDir}`);
  } catch (error) {
    console.error('ZIP解压失败:', error);
    throw new Error(`ZIP解压失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { 
      backupPath,
      restoreType = 'incremental' // 'full' | 'incremental'
    } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // 获取所有存储桶
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error(`获取存储桶列表失败: ${bucketsError.message}`);
    }

    // 获取当前存储桶中的文件
    const currentFiles = new Set<string>();
    let totalCurrentFiles = 0;

    for (const bucket of buckets) {
      const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
      totalCurrentFiles += allFiles.length;
      
      for (const filePath of allFiles) {
        const normalizedPath = normalizeFilePath(filePath);
        currentFiles.add(`${bucket.name}/${normalizedPath}`);
      }
    }

    // 分析备份文件
    const backupAnalysis = {
      currentFiles: totalCurrentFiles,
      backupFiles: 0,
      filesToRestore: 0,
      filesToSkip: 0,
      filesToOverwrite: 0,
      bucketAnalysis: [] as Array<{
        bucketName: string;
        currentFiles: number;
        backupFiles: number;
        filesToRestore: number;
        filesToSkip: number;
        filesToOverwrite: number;
        filesToRestoreList: string[];
        filesToOverwriteList: string[];
      }>
    };

    try {
      const stats = await fsPromises.stat(backupPath);
      const tempExtractDir = path.join(path.dirname(backupPath), `temp-restore-preview-${Date.now()}`);
      await fsPromises.mkdir(tempExtractDir, { recursive: true });

      try {
        await extractZip(backupPath, tempExtractDir);
        
        // 查找storage目录
        const storageDir = path.join(tempExtractDir, 'storage');
        let extractDirToProcess = tempExtractDir;
        
        try {
          const storageDirStats = await fsPromises.stat(storageDir);
          if (storageDirStats.isDirectory()) {
            extractDirToProcess = storageDir;
          }
        } catch (err) {
          // 检查ZIP文件的实际结构
          const rootItems = await fsPromises.readdir(tempExtractDir);
          const bucketNames = buckets.map(b => b.name);
          const hasBucketDirs = bucketNames.some(bucket => rootItems.includes(bucket));
          
          if (hasBucketDirs && !rootItems.includes('storage')) {
            extractDirToProcess = tempExtractDir;
          }
        }
        
        const backupFiles = await getExistingFilesFromExtractedDir(extractDirToProcess);
        backupAnalysis.backupFiles = backupFiles.size;

        // 分析每个存储桶
        for (const bucket of buckets) {
          const bucketCurrentFiles = new Set<string>();
          const bucketBackupFiles = new Set<string>();
          
          // 当前存储桶中的文件
          const currentBucketFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
          for (const filePath of currentBucketFiles) {
            const normalizedPath = normalizeFilePath(filePath);
            bucketCurrentFiles.add(normalizedPath);
          }
          
          // 备份中的文件
          for (const backupFile of backupFiles) {
            if (backupFile.startsWith(`${bucket.name}/`)) {
              const filePath = backupFile.substring(bucket.name.length + 1);
              bucketBackupFiles.add(filePath);
            }
          }
          
          const filesToRestore = [];
          const filesToOverwrite = [];
          let filesToSkip = 0;
          
          if (restoreType === 'incremental') {
            // 增量恢复：只恢复数据库中缺失的文件
            for (const backupFile of bucketBackupFiles) {
              if (bucketCurrentFiles.has(backupFile)) {
                // 数据库中已存在，跳过
                filesToSkip++;
              } else {
                // 数据库中不存在，需要恢复
                filesToRestore.push(backupFile);
              }
            }
            
            // 计算数据库中独有的文件（备份中没有的）
            for (const currentFile of bucketCurrentFiles) {
              if (!bucketBackupFiles.has(currentFile)) {
                // 这些文件在数据库中但备份中没有，保持不变
                filesToSkip++;
              }
            }
          } else {
            // 完整恢复：恢复所有备份文件
            for (const backupFile of bucketBackupFiles) {
              if (bucketCurrentFiles.has(backupFile)) {
                filesToOverwrite.push(backupFile);
              } else {
                filesToRestore.push(backupFile);
              }
            }
            
            // 计算跳过的文件（当前有但备份中没有的）
            for (const currentFile of bucketCurrentFiles) {
              if (!bucketBackupFiles.has(currentFile)) {
                filesToSkip++;
              }
            }
          }
          
          backupAnalysis.bucketAnalysis.push({
            bucketName: bucket.name,
            currentFiles: bucketCurrentFiles.size,
            backupFiles: bucketBackupFiles.size,
            filesToRestore: filesToRestore.length,
            filesToSkip,
            filesToOverwrite: filesToOverwrite.length,
            filesToRestoreList: filesToRestore.slice(0, 10),
            filesToOverwriteList: filesToOverwrite.slice(0, 10)
          });
          
          backupAnalysis.filesToRestore += filesToRestore.length;
          backupAnalysis.filesToSkip += filesToSkip;
          backupAnalysis.filesToOverwrite += filesToOverwrite.length;
        }
        
        // 清理临时目录
        await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
      } catch (err) {
        // 清理临时目录
        try {
          await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.error('清理临时目录失败:', cleanupErr);
        }
        throw err;
      }
    } catch (err) {
      return NextResponse.json({ 
        error: `分析备份文件失败: ${err instanceof Error ? err.message : '未知错误'}` 
      }, { status: 400 });
    }

    const analysis = {
      restoreType,
      backupPath,
      currentFiles: backupAnalysis.currentFiles,
      backupFiles: backupAnalysis.backupFiles,
      filesToRestore: backupAnalysis.filesToRestore,
      filesToSkip: backupAnalysis.filesToSkip,
      filesToOverwrite: backupAnalysis.filesToOverwrite,
      bucketAnalysis: backupAnalysis.bucketAnalysis,
      summary: {
        currentFiles: backupAnalysis.currentFiles,
        backupFiles: backupAnalysis.backupFiles,
        filesToRestore: backupAnalysis.filesToRestore,
        filesToSkip: backupAnalysis.filesToSkip,
        filesToOverwrite: backupAnalysis.filesToOverwrite,
        restorePercentage: backupAnalysis.backupFiles > 0 ? 
          Math.round((backupAnalysis.filesToRestore / backupAnalysis.backupFiles) * 100) : 0,
        overwritePercentage: backupAnalysis.currentFiles > 0 ? 
          Math.round((backupAnalysis.filesToOverwrite / backupAnalysis.currentFiles) * 100) : 0
      }
    };

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('恢复预览失败:', error);
    return NextResponse.json(
      { error: `恢复预览失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
