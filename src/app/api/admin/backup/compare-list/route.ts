import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const backupPath = searchParams.get('backupPath');
    const backupType = searchParams.get('backupType') || 'storage';

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    try {
      const files = await fs.readdir(backupPath);
      
      let backupFiles: Array<{
        filename: string;
        filepath: string;
        size: number;
        createdAt: Date;
        type: 'database' | 'storage';
      }> = [];

      for (const file of files) {
        const filePath = path.join(backupPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && file.endsWith('.zip')) {
          let type: 'database' | 'storage' = 'storage';
          
          if (file.startsWith('database-backup-')) {
            type = 'database';
          } else if (file.startsWith('storage-backup-')) {
            type = 'storage';
          }
          
          // 只返回指定类型的备份文件
          if (backupType === 'all' || type === backupType) {
            backupFiles.push({
              filename: file,
              filepath: filePath,
              size: stats.size,
              createdAt: stats.birthtime,
              type
            });
          }
        }
      }

      // 按创建时间倒序排列（最新的在前）
      backupFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return NextResponse.json({ 
        backups: backupFiles,
        total: backupFiles.length
      });

    } catch (err) {
      console.error('读取备份目录失败:', err);
      return NextResponse.json({ 
        backups: [],
        total: 0,
        error: '无法读取备份目录'
      });
    }

  } catch (error) {
    console.error('获取备份列表失败:', error);
    return NextResponse.json(
      { error: '获取备份列表失败' },
      { status: 500 }
    );
  }
}
