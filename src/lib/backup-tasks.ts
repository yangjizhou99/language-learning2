// 内存中存储备份任务状态（生产环境应使用Redis或数据库）
const backupTasks = new Map<string, any>();

export function getBackupTasks() {
  return backupTasks;
}

export function setBackupTask(taskId: string, task: any) {
  backupTasks.set(taskId, task);
}

export function getBackupTask(taskId: string) {
  return backupTasks.get(taskId);
}

export function deleteBackupTask(taskId: string) {
  backupTasks.delete(taskId);
}
