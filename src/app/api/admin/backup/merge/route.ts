import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
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
      baseBackupPath,
      incrementalBackupPaths,
      outputPath
    } = await req.json();

    if (!baseBackupPath || !incrementalBackupPaths || !Array.isArray(incrementalBackupPaths) || incrementalBackupPaths.length === 0) {
      return NextResponse.json({ 
        error: '缺少必要参数：baseBackupPath, incrementalBackupPaths' 
      }, { status: 400 });
    }

    // 检查基础备份文件是否存在
    try {
      await fsPromises.access(baseBackupPath);
    } catch {
      return NextResponse.json({ 
        error: '基础备份文件不存在' 
      }, { status: 400 });
    }

    // 检查增量备份文件是否存在
    for (const incrementalPath of incrementalBackupPaths) {
      try {
        await fsPromises.access(incrementalPath);
      } catch {
        return NextResponse.json({ 
          error: `增量备份文件不存在: ${incrementalPath}` 
        }, { status: 400 });
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
    const tempMergeDir = path.join(path.dirname(outputPath), `temp-merge-${timestamp}`);
    await fsPromises.mkdir(tempMergeDir, { recursive: true });

    try {
      // 1. 解压基础备份文件
      console.log('解压基础备份文件:', baseBackupPath);
      await extractZip(baseBackupPath, tempMergeDir);

      // 2. 解压所有增量备份文件
      for (let i = 0; i < incrementalBackupPaths.length; i++) {
        const incrementalPath = incrementalBackupPaths[i];
        console.log(`解压增量备份文件 ${i + 1}/${incrementalBackupPaths.length}:`, incrementalPath);
        
        const tempIncrementalDir = path.join(tempMergeDir, `incremental-${i}`);
        await fsPromises.mkdir(tempIncrementalDir, { recursive: true });
        await extractZip(incrementalPath, tempIncrementalDir);

        // 将增量文件合并到基础备份中
        const incrementalStorageDir = path.join(tempIncrementalDir, 'storage');
        const baseStorageDir = path.join(tempMergeDir, 'storage');
        
        if (await fsPromises.access(incrementalStorageDir).then(() => true).catch(() => false)) {
          // 如果增量备份有storage目录，复制其内容
          const incrementalFiles = await fsPromises.readdir(incrementalStorageDir);
          for (const file of incrementalFiles) {
            const srcPath = path.join(incrementalStorageDir, file);
            const destPath = path.join(baseStorageDir, file);
            const stats = await fsPromises.stat(srcPath);
            
            if (stats.isDirectory()) {
              await fsPromises.cp(srcPath, destPath, { recursive: true });
            } else {
              await fsPromises.copyFile(srcPath, destPath);
            }
          }
          console.log(`合并了 ${incrementalFiles.length} 个增量文件/目录`);
        } else {
          // 如果增量备份没有storage目录，直接复制根目录内容
          const incrementalFiles = await fsPromises.readdir(tempIncrementalDir);
          for (const file of incrementalFiles) {
            if (file.startsWith('incremental-')) continue; // 跳过其他增量目录
            
            const srcPath = path.join(tempIncrementalDir, file);
            const destPath = path.join(baseStorageDir, file);
            const stats = await fsPromises.stat(srcPath);
            
            if (stats.isDirectory()) {
              await fsPromises.cp(srcPath, destPath, { recursive: true });
            } else {
              await fsPromises.copyFile(srcPath, destPath);
            }
          }
          console.log(`合并了 ${incrementalFiles.length} 个增量文件/目录`);
        }

        // 清理临时增量目录
        await fsPromises.rm(tempIncrementalDir, { recursive: true, force: true });
      }

      // 3. 创建合并后的完整备份
      console.log('创建合并后的完整备份...');
      const files = await collectFilesFromDirectory(path.join(tempMergeDir, 'storage'), 'storage');
      await createZipFile(files, outputPath);

      // 4. 清理临时目录
      await fsPromises.rm(tempMergeDir, { recursive: true, force: true });

      const stats = await fsPromises.stat(outputPath);

      return NextResponse.json({
        success: true,
        message: `合并完成！共合并 ${incrementalBackupPaths.length} 个增量备份`,
        outputPath,
        fileSize: stats.size,
        fileCount: files.length
      });

    } catch (error) {
      // 清理临时目录
      try {
        await fsPromises.rm(tempMergeDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('清理临时目录失败:', cleanupErr);
      }
      throw error;
    }

  } catch (error) {
    console.error('合并备份失败:', error);
    return NextResponse.json(
      { error: `合并备份失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
