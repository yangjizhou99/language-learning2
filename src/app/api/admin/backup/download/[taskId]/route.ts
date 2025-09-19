import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getBackupTasks } from '@/lib/backup-tasks';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await requireAdmin(req);

    const { taskId } = await params;
    const backupTasks = getBackupTasks();
    const task = backupTasks.get(taskId);

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

    // 创建ZIP文件
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // 设置响应头
    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="backup-${taskId}.zip"`);

    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });

        archive.on('end', () => {
          controller.close();
        });

        archive.on('error', (err) => {
          console.error('创建ZIP文件失败:', err);
          controller.error(err);
        });

        // 添加文件到ZIP
        if (task.type === 'database') {
          archive.file(task.filePath, { name: path.basename(task.filePath) });
        } else {
          // 存储桶备份，添加整个目录
          archive.directory(task.filePath, 'storage');
        }

        archive.finalize();
      }
    });

    return new NextResponse(stream, { headers });
  } catch (error) {
    console.error('下载备份失败:', error);
    return NextResponse.json(
      { error: '下载备份失败' },
      { status: 500 }
    );
  }
}
