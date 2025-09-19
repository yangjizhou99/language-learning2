import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import fsPromises from 'fs/promises';
import path from 'path';

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
        
        // 调试：显示前几个文件的路径处理
        if (files.size <= 5) {
          console.log(`现有文件路径处理 - 原始路径: ${fullPath}`);
          console.log(`现有文件路径处理 - 标准化路径: ${normalizedPath}`);
        }
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
    // 使用系统命令解压ZIP文件
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

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { 
      backupPath, 
      backupType = 'storage',
      compareWith = null
    } = await req.json();

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    if (backupType !== 'storage') {
      return NextResponse.json({ error: '预览功能目前仅支持存储桶备份' }, { status: 400 });
    }

    // 检查备份路径是否存在
    try {
      await fsPromises.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: '备份目录不存在' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // 获取所有存储桶
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      throw new Error(`获取存储桶列表失败: ${bucketsError.message}`);
    }

    // 获取现有备份文件列表
    let existingBackupFiles = new Set<string>();
    let compareBackupInfo = null;

    if (compareWith && compareWith !== 'auto') {
      // 使用指定的对比备份文件
      const compareBackupPath = path.join(backupPath, compareWith);
      console.log(`增量备份预览：使用指定对比文件 ${compareWith}`);
      
      try {
        const stats = await fsPromises.stat(compareBackupPath);
        compareBackupInfo = {
          filename: compareWith,
          size: stats.size,
          createdAt: stats.birthtime
        };
      } catch (err) {
        return NextResponse.json({ error: '指定的对比备份文件不存在' }, { status: 400 });
      }
    } else {
      // 自动选择最新的备份文件
      const existingBackups = await fsPromises.readdir(backupPath);
      const storageBackups = existingBackups.filter(file => 
        file.startsWith('storage-backup-') && file.endsWith('.zip')
      );
      
      if (storageBackups.length > 0) {
        const latestBackup = storageBackups.sort().pop();
        if (latestBackup) {
          const compareBackupPath = path.join(backupPath, latestBackup);
          const stats = await fsPromises.stat(compareBackupPath);
          compareBackupInfo = {
            filename: latestBackup,
            size: stats.size,
            createdAt: stats.birthtime
          };
          console.log(`增量备份预览：自动选择最新备份文件 ${latestBackup}`);
        }
      }
    }

    // 如果有对比文件，解压并获取现有文件列表
    if (compareBackupInfo) {
      const compareBackupPath = path.join(backupPath, compareBackupInfo.filename);
      const tempExtractDir = path.join(backupPath, `temp-preview-${Date.now()}`);
      
      try {
        await fsPromises.mkdir(tempExtractDir, { recursive: true });
        await extractZip(compareBackupPath, tempExtractDir);
        
        // 查找storage目录
        const storageDir = path.join(tempExtractDir, 'storage');
        let extractDirToProcess = tempExtractDir;
        
        try {
          const storageDirStats = await fsPromises.stat(storageDir);
          if (storageDirStats.isDirectory()) {
            extractDirToProcess = storageDir;
            console.log(`增量备份预览：找到storage目录，使用 ${storageDir}`);
          }
        } catch (err) {
          console.log(`增量备份预览：未找到storage目录，使用根目录 ${tempExtractDir}`);
        }
        
        // 检查ZIP文件的实际结构
        try {
          const rootItems = await fsPromises.readdir(tempExtractDir);
          console.log(`增量备份预览：ZIP根目录内容:`, rootItems);
          
          // 如果根目录直接包含存储桶名称，则使用根目录
          const bucketNames = ['tts', 'recordings', 'articles_tts'];
          const hasBucketDirs = bucketNames.some(bucket => rootItems.includes(bucket));
          
          if (hasBucketDirs && !rootItems.includes('storage')) {
            extractDirToProcess = tempExtractDir;
            console.log(`增量备份预览：ZIP根目录直接包含存储桶，使用根目录 ${tempExtractDir}`);
          }
        } catch (err) {
          console.log(`增量备份预览：检查ZIP结构失败:`, err);
        }
        
        // 调试：显示解压目录的内容
        try {
          const extractItems = await fsPromises.readdir(extractDirToProcess);
          console.log(`增量备份预览：解压目录内容:`, extractItems);
        } catch (err) {
          console.log(`增量备份预览：无法读取解压目录内容:`, err);
        }
        
        existingBackupFiles = await getExistingFilesFromExtractedDir(extractDirToProcess);
        console.log(`增量备份预览：找到 ${existingBackupFiles.size} 个现有文件`);
        
        // 调试：显示现有文件的前几个
        if (existingBackupFiles.size > 0) {
          const sampleExisting = Array.from(existingBackupFiles).slice(0, 5);
          console.log(`增量备份预览：现有文件示例:`, sampleExisting);
        }
        
        // 清理临时目录
        await fsPromises.rm(tempExtractDir, { recursive: true, force: true });
      } catch (err) {
        console.error('解压对比备份失败:', err);
        return NextResponse.json({ error: '解压对比备份失败，请检查备份文件是否完整' }, { status: 400 });
      }
    }

    // 统计所有存储桶的文件
    let totalFiles = 0;
    let filesToDownload = 0;
    let filesToSkip = 0;
    const bucketAnalysis = [];

    for (const bucket of buckets) {
      const allFiles = await getAllFilesFromBucket(supabase, bucket.name, '');
      totalFiles += allFiles.length;
      
      let bucketFilesToDownload = 0;
      let bucketFilesToSkip = 0;
      const filesToDownloadList = [];
      const filesToSkipList = [];

      for (const filePath of allFiles) {
        const normalizedPath = normalizeFilePath(filePath);
        
        // 尝试多种路径匹配方式
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
        
        // 调试信息：显示前几个文件的对比情况
        if (bucketFilesToDownload + bucketFilesToSkip < 5) {
          console.log(`文件对比调试 - 存储桶: ${bucket.name}`);
          console.log(`文件对比调试 - 原始路径: ${filePath}`);
          console.log(`文件对比调试 - 标准化路径: ${normalizedPath}`);
          console.log(`文件对比调试 - 带存储桶前缀: ${bucket.name}/${normalizedPath}`);
          console.log(`文件对比调试 - 是否找到匹配: ${isFound}`);
          if (existingBackupFiles.size > 0) {
            const sampleExisting = Array.from(existingBackupFiles).slice(0, 3);
            console.log(`文件对比调试 - 现有文件示例:`, sampleExisting);
          }
        }
        
        if (isFound) {
          bucketFilesToSkip++;
          filesToSkipList.push(filePath);
        } else {
          bucketFilesToDownload++;
          filesToDownloadList.push(filePath);
        }
      }

      filesToDownload += bucketFilesToDownload;
      filesToSkip += bucketFilesToSkip;

      bucketAnalysis.push({
        bucketName: bucket.name,
        totalFiles: allFiles.length,
        filesToDownload: bucketFilesToDownload,
        filesToSkip: bucketFilesToSkip,
        filesToDownloadList: filesToDownloadList.slice(0, 10), // 只返回前10个作为示例
        filesToSkipList: filesToSkipList.slice(0, 10) // 只返回前10个作为示例
      });
    }

    const analysis = {
      compareBackupInfo,
      totalFiles,
      filesToDownload,
      filesToSkip,
      bucketAnalysis,
      summary: {
        totalFiles,
        filesToDownload,
        filesToSkip,
        skipPercentage: totalFiles > 0 ? Math.round((filesToSkip / totalFiles) * 100) : 0,
        downloadPercentage: totalFiles > 0 ? Math.round((filesToDownload / totalFiles) * 100) : 0,
        finalFileCount: totalFiles // 最终备份将包含所有文件
      }
    };

    return NextResponse.json(analysis);

  } catch (error) {
    console.error('增量备份预览失败:', error);
    return NextResponse.json(
      { error: `增量备份预览失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
