import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getBackupTasks } from '@/lib/backup-tasks';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const backupTasks = getBackupTasks();
    let tasks = Array.from(backupTasks.values()).map(({ backupPath, ...task }) => task);

    // 如果内存中没有任务，尝试从文件系统恢复
    if (tasks.length === 0) {
      const backupPath = 'D:\\backups\\language-learning';
      
      try {
        const files = await fs.readdir(backupPath);
        const backupFiles = files.filter(file => 
          (file.startsWith('database-backup-') && file.endsWith('.zip')) ||
          (file.startsWith('storage-backup-') && file.endsWith('.zip'))
        );

        tasks = await Promise.all(backupFiles.map(async (file) => {
          const filePath = path.join(backupPath, file);
          const stats = await fs.stat(filePath);
          const timestamp = file.replace(/^database-backup-|^storage-backup-/, '').replace('.zip', '');
          
          return {
            id: `${file.startsWith('database-backup-') ? 'db' : 'storage'}-${timestamp}`,
            type: file.startsWith('database-backup-') ? 'database' : 'storage',
            status: 'completed',
            progress: 100,
            message: '备份已完成',
            createdAt: stats.birthtime.toISOString(),
            filePath: filePath,
            fileSize: stats.size
          };
        }));
      } catch (err) {
        console.error('从文件系统恢复任务失败:', err);
      }
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('获取备份状态失败:', error);
    return NextResponse.json(
      { error: '获取备份状态失败' },
      { status: 500 }
    );
  }
}
