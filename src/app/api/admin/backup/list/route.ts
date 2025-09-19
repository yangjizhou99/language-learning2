import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import fsPromises from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const backupPath = searchParams.get('backupPath');

    if (!backupPath) {
      return NextResponse.json({ error: '备份路径不能为空' }, { status: 400 });
    }

    try {
      const files = await fsPromises.readdir(backupPath);
      
      const backups: Array<{
        filename: string;
        filepath: string;
        size: number;
        createdAt: Date;
        type: 'full' | 'incremental';
        category: 'database' | 'storage';
      }> = [];

      for (const file of files) {
        const filePath = path.join(backupPath, file);
        const stats = await fsPromises.stat(filePath);
        
        if (stats.isFile() && file.endsWith('.zip')) {
          let type: 'full' | 'incremental' = 'full';
          let category: 'database' | 'storage' = 'storage';
          
          if (file.startsWith('database-backup-')) {
            category = 'database';
          } else if (file.startsWith('storage-backup-')) {
            category = 'storage';
          } else if (file.startsWith('database-incremental-')) {
            category = 'database';
            type = 'incremental';
          } else if (file.startsWith('storage-incremental-')) {
            category = 'storage';
            type = 'incremental';
          }
          
          backups.push({
            filename: file,
            filepath: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            type,
            category
          });
        }
      }

      // 按创建时间倒序排列（最新的在前）
      backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // 按类型分组
      const fullBackups = backups.filter(b => b.type === 'full');
      const incrementalBackups = backups.filter(b => b.type === 'incremental');

      return NextResponse.json({ 
        backups,
        fullBackups,
        incrementalBackups,
        total: backups.length,
        summary: {
          total: backups.length,
          full: fullBackups.length,
          incremental: incrementalBackups.length,
          database: backups.filter(b => b.category === 'database').length,
          storage: backups.filter(b => b.category === 'storage').length
        }
      });

    } catch (err) {
      console.error('读取备份目录失败:', err);
      return NextResponse.json({ 
        backups: [],
        fullBackups: [],
        incrementalBackups: [],
        total: 0,
        summary: { total: 0, full: 0, incremental: 0, database: 0, storage: 0 },
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
