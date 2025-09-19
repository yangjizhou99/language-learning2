import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getBackupTasks } from '@/lib/backup-tasks';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const backupTasks = getBackupTasks();
    const tasks = Array.from(backupTasks.values()).map(({ backupPath, ...task }) => task);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('获取备份状态失败:', error);
    return NextResponse.json(
      { error: '获取备份状态失败' },
      { status: 500 }
    );
  }
}
