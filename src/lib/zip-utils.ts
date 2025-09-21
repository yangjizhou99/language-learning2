// ZIP 文件处理工具函数

// 使用archiver创建ZIP文件
export async function createZipFile(files: { path: string; name: string }[], outputPath: string): Promise<void> {
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
