import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const backupPath = searchParams.get('backupPath') || 'D:\\backups\\language-learning';

    // 检查备份目录是否存在
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json({
        success: true,
        backups: [],
        message: '备份目录不存在'
      });
    }

    const backups = [];

    try {
      // 读取备份目录
      const items = await fs.readdir(backupPath);
      
      for (const item of items) {
        const itemPath = path.join(backupPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory() && item.startsWith('storage-')) {
          // 存储桶备份目录
          const timestamp = item.replace('storage-', '');
          const size = await getDirectorySize(itemPath);
          
          backups.push({
            type: 'storage',
            name: item,
            timestamp: timestamp,
            size: size,
            path: itemPath,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        } else if (item.endsWith('.sql') && item.startsWith('database-backup-')) {
          // 数据库备份文件
          const timestamp = item.replace('database-backup-', '').replace('.sql', '');
          
          backups.push({
            type: 'database',
            name: item,
            timestamp: timestamp,
            size: stats.size,
            path: itemPath,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      }
    } catch (err) {
      console.error('读取备份目录失败:', err);
      return NextResponse.json({
        success: false,
        error: '读取备份目录失败'
      }, { status: 500 });
    }

    // 按时间戳排序（最新的在前）
    backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      success: true,
      backups: backups,
      total: backups.length,
      totalSize: backups.reduce((sum, backup) => sum + backup.size, 0)
    });

  } catch (error) {
    console.error('获取备份历史失败:', error);
    return NextResponse.json(
      { error: '获取备份历史失败' },
      { status: 500 }
    );
  }
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

