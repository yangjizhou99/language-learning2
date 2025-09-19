import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getBackupTasks } from '@/lib/backup-tasks';
import fs from 'fs/promises';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await requireAdmin(req);

    const { taskId } = await params;
    
    // 首先尝试从内存中获取任务
    const backupTasks = getBackupTasks();
    let task = backupTasks.get(taskId);
    
    // 如果内存中没有任务，尝试从文件系统查找
    if (!task) {
      const backupPath = 'D:\\backups\\language-learning'; // 默认备份路径
      
      try {
        // 查找匹配的备份文件 - 根据taskId精确匹配
        const files = await fs.readdir(backupPath);
        const matchingFile = files.find(file => {
          // 首先尝试精确匹配taskId
          if (file.includes(taskId)) {
            return true;
          }
          
          // 如果taskId包含时间戳，尝试匹配文件名中的时间戳
          const timestampMatch = taskId.match(/(\d{4}-\d{2}-\d{2}[T_]\d{2}-\d{2}-\d{2})/);
          if (timestampMatch) {
            const timestamp = timestampMatch[1];
            return file.includes(timestamp);
          }
          
          return false;
        });
        
        if (matchingFile) {
          const filePath = path.join(backupPath, matchingFile);
          const stats = await fs.stat(filePath);
          
          console.log(`找到匹配的备份文件: ${matchingFile} (taskId: ${taskId})`);
          
          task = {
            id: taskId,
            type: matchingFile.startsWith('database-backup-') ? 'database' : 'storage',
            status: 'completed',
            filePath: filePath,
            fileSize: stats.size
          };
        } else {
          console.log(`未找到匹配的备份文件 (taskId: ${taskId})`);
          console.log('可用文件:', files.filter(f => f.endsWith('.zip')));
        }
      } catch (err) {
        console.error('查找备份文件失败:', err);
      }
    }

    if (!task) {
      return NextResponse.json({ error: '备份任务不存在' }, { status: 404 });
    }

    if (task.status !== 'completed' || !task.filePath) {
      return NextResponse.json({ error: '备份未完成或文件不存在' }, { status: 400 });
    }

    // 检查文件是否存在
    try {
      await fs.access(task.filePath);
    } catch {
      return NextResponse.json({ error: '备份文件不存在' }, { status: 404 });
    }

    // 直接返回文件内容
    const fileBuffer = await fs.readFile(task.filePath);
    const fileStats = await fs.stat(task.filePath);
    
    // 设置响应头
    const headers = new Headers();
    if (task.filePath.endsWith('.zip')) {
      headers.set('Content-Type', 'application/zip');
    } else if (task.filePath.endsWith('.sql')) {
      headers.set('Content-Type', 'application/sql');
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }
    headers.set('Content-Disposition', `attachment; filename="${path.basename(task.filePath)}"`);
    headers.set('Content-Length', fileStats.size.toString());

    return new NextResponse(fileBuffer as BodyInit, { headers });
  } catch (error) {
    console.error('下载备份失败:', error);
    return NextResponse.json(
      { error: '下载备份失败' },
      { status: 500 }
    );
  }
}
