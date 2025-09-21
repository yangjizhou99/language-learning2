// ZIP 文件处理工具函数

// 使用archiver创建ZIP文件 - 优化版本
export async function createZipFile(files: { path: string; name: string }[], outputPath: string): Promise<void> {
  const archiver = await import('archiver');
  const { createWriteStream } = await import('fs');
  
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    // 降低压缩级别以提高性能，减少内存使用
    const archive = archiver.default('zip', { 
      zlib: { level: 3 }, // 从9降低到3，平衡压缩率和性能
      forceLocalTime: true,
      forceZip64: false
    });

    let isResolved = false;

    const cleanup = () => {
      if (!isResolved) {
        isResolved = true;
        output.destroy();
      }
    };

    // 设置超时防止无限等待
    const timeout = setTimeout(() => {
      console.error('ZIP创建超时，强制结束');
      cleanup();
      reject(new Error('ZIP创建超时'));
    }, 300000); // 5分钟超时

    output.on('close', () => {
      if (!isResolved) {
        clearTimeout(timeout);
        console.log(`ZIP文件创建完成: ${archive.pointer()} bytes`);
        isResolved = true;
        resolve();
      }
    });

    output.on('error', (err) => {
      if (!isResolved) {
        clearTimeout(timeout);
        console.error('ZIP文件写入失败:', err);
        cleanup();
        isResolved = true;
        reject(err);
      }
    });

    archive.on('error', (err) => {
      if (!isResolved) {
        clearTimeout(timeout);
        console.error('创建ZIP文件失败:', err);
        cleanup();
        isResolved = true;
        reject(err);
      }
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('ZIP警告:', err);
      } else {
        console.error('ZIP错误:', err);
        if (!isResolved) {
          clearTimeout(timeout);
          cleanup();
          isResolved = true;
          reject(err);
        }
      }
    });

    archive.pipe(output);

    // 添加文件到ZIP，添加错误处理
    try {
      for (const file of files) {
        if (file.path && file.name) {
          archive.file(file.path, { name: file.name });
        }
      }
      archive.finalize();
    } catch (err) {
      if (!isResolved) {
        clearTimeout(timeout);
        cleanup();
        isResolved = true;
        reject(err);
      }
    }
  });
}

// 递归收集目录中的所有文件
export async function collectFilesFromDirectory(dirPath: string, basePath: string = ''): Promise<{ path: string; name: string }[]> {
  const files: { path: string; name: string }[] = [];
  
  try {
    const items = await import('fs/promises').then(fs => fs.readdir(dirPath));
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = await import('fs/promises').then(fs => fs.stat(itemPath));
      
      if (stats.isDirectory()) {
        // 递归处理子目录
        const subFiles = await collectFilesFromDirectory(itemPath, path.join(basePath, item));
        files.push(...subFiles);
      } else {
        // 添加文件
        files.push({
          path: itemPath,
          name: path.join(basePath, item)
        });
      }
    }
  } catch (err) {
    console.error(`收集目录文件失败 ${dirPath}:`, err);
  }
  
  return files;
}

// 导入 path 模块
import path from 'path';
