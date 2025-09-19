'use client';
import { useState, useEffect } from 'react';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Download, Database, FolderOpen, AlertCircle, Clock, Upload, RotateCcw } from 'lucide-react';

interface BackupStatus {
  id: string;
  type: 'database' | 'storage';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: string;
  filePath?: string;
  fileSize?: number;
}

export default function AdminBackupPage() {
  const [backupPath, setBackupPath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [functionCheck, setFunctionCheck] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [storageTest, setStorageTest] = useState<any>(null);
  const [backupHistory, setBackupHistory] = useState<any>(null);

  useEffect(() => {
    // 设置默认备份路径
    const defaultPath = 'D:\\backups\\language-learning';
    setBackupPath(defaultPath);
  }, []);

  const startBackup = async () => {
    if (!backupPath.trim()) {
      setError('请输入备份路径');
      return;
    }

    setIsBackingUp(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/backup/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupPath: backupPath.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '备份启动失败');
      }

      const data = await response.json();
      setBackupStatus(data.tasks);

      // 开始轮询状态
      pollBackupStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '备份启动失败');
      setIsBackingUp(false);
    }
  };

  const pollBackupStatus = async () => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/admin/backup/status');
        if (response.ok) {
          const data = await response.json();
          setBackupStatus(data.tasks);

          // 检查是否所有任务都完成
          const allCompleted = data.tasks.every(
            (task: BackupStatus) => task.status === 'completed' || task.status === 'failed'
          );

          if (allCompleted) {
            clearInterval(pollInterval);
            setIsBackingUp(false);
          }
        }
      } catch (err) {
        console.error('轮询备份状态失败:', err);
      }
    }, 2000);

    // 5分钟后停止轮询
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsBackingUp(false);
    }, 300000);
  };

  const downloadBackup = async (taskId: string) => {
    try {
      const response = await fetch(`/api/admin/backup/download/${taskId}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${taskId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('下载失败');
      }
    } catch (err) {
      setError('下载失败');
    }
  };

  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRestoreFile(file);
    }
  };

  const startRestore = async () => {
    if (!restoreFile) {
      setError('请选择要恢复的备份文件');
      return;
    }

    setIsRestoring(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', restoreFile);

      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '恢复失败');
      }

      const data = await response.json();
      alert(`恢复完成: ${data.message}`);
      setRestoreFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败');
    } finally {
      setIsRestoring(false);
    }
  };

  const testBackupConnection = async () => {
    try {
      const response = await fetch('/api/admin/backup/test');
      const data = await response.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ error: '测试失败' });
    }
  };

  const checkFunctions = async () => {
    try {
      const response = await fetch('/api/admin/backup/check-functions');
      const data = await response.json();
      setFunctionCheck(data);
    } catch (err) {
      setFunctionCheck({ error: '检查失败' });
    }
  };

  const runDiagnostics = async () => {
    try {
      const response = await fetch('/api/admin/backup/diagnose');
      const data = await response.json();
      setDiagnostics(data);
    } catch (err) {
      setDiagnostics({ error: '诊断失败' });
    }
  };

  const testStorage = async () => {
    try {
      const response = await fetch('/api/admin/backup/test-storage');
      const data = await response.json();
      setStorageTest(data);
    } catch (err) {
      setStorageTest({ error: '存储桶测试失败' });
    }
  };

  const loadBackupHistory = async () => {
    try {
      const response = await fetch(`/api/admin/backup/history?backupPath=${encodeURIComponent(backupPath)}`);
      const data = await response.json();
      setBackupHistory(data);
    } catch (err) {
      setBackupHistory({ error: '加载备份历史失败' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'running':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '未知';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <Container>
      <Breadcrumbs
        items={[
          { label: '管理员', href: '/admin' },
          { label: '数据备份', href: '/admin/backup' },
        ]}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">数据备份管理</h1>
          <p className="text-gray-600 mt-2">
            备份数据库和存储桶文件到本地文件夹
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {testResult && (
          <Alert variant={testResult.error ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {testResult.error ? (
                <div>
                  <p>测试失败: {testResult.error}</p>
                  {testResult.details && (
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
                      {JSON.stringify(testResult.details, null, 2)}
                    </pre>
                  )}
                </div>
              ) : (
                <div>
                  <p>测试成功！找到 {testResult.tableCount} 个表</p>
                  {testResult.tables && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">表列表:</p>
                      <ul className="text-sm text-gray-600 mt-1">
                        {testResult.tables.map((table: any, index: number) => (
                          <li key={index}>• {table.table_name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {functionCheck && (
          <Alert variant={functionCheck.error ? "destructive" : functionCheck.hasGetTableList ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {functionCheck.error ? (
                <div>
                  <p>检查失败: {functionCheck.error}</p>
                  {functionCheck.details && (
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">
                      {JSON.stringify(functionCheck.details, null, 2)}
                    </pre>
                  )}
                </div>
              ) : functionCheck.hasGetTableList ? (
                <div>
                  <p>✅ RPC函数已存在，可以正常备份</p>
                  {functionCheck.functionTest && (
                    <div className="mt-2">
                      <p className="text-sm">函数测试结果:</p>
                      <pre className="text-xs bg-gray-100 p-2 rounded mt-1">
                        {JSON.stringify(functionCheck.functionTest, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p>❌ RPC函数不存在，需要先执行数据库迁移</p>
                  <p className="text-sm mt-1">
                    请在 Supabase 控制台的 SQL Editor 中执行迁移文件：
                    <code className="bg-gray-100 px-1 rounded">supabase/migrations/20250120000009_backup_restore_function.sql</code>
                  </p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {diagnostics && (
          <Alert variant={diagnostics.success ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <p className="font-medium">
                  {diagnostics.success ? '✅ 诊断通过' : '❌ 诊断失败'}
                </p>
                <p className="text-sm mt-1">
                  通过 {diagnostics.summary?.passed || 0} / {diagnostics.summary?.total || 0} 项检查
                </p>
                <div className="mt-3 space-y-2">
                  {diagnostics.diagnostics?.map((diag: any, index: number) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-center space-x-2">
                        <span className={diag.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                          {diag.status === 'success' ? '✅' : '❌'}
                        </span>
                        <span className="font-medium">{diag.test}</span>
                      </div>
                      <p className="text-gray-600 ml-6">{diag.message}</p>
                      {diag.details && (
                        <details className="ml-6 mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500">查看详情</summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(diag.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {storageTest && (
          <Alert variant={storageTest.error ? "destructive" : "default"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {storageTest.error ? (
                <div>
                  <p>存储桶测试失败: {storageTest.error}</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">
                    {storageTest.success ? '✅ 存储桶测试完成' : '❌ 存储桶测试失败'}
                  </p>
                  <p className="text-sm mt-1">
                    找到 {storageTest.totalBuckets} 个存储桶，共 {storageTest.summary?.totalFiles || 0} 个文件
                  </p>
                  <div className="mt-3 space-y-2">
                    {storageTest.buckets?.map((bucket: any, index: number) => (
                      <div key={index} className="text-sm border rounded p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{bucket.name}</span>
                          <span className="text-gray-600">
                            {bucket.recursiveFileCount || 0} 个文件
                          </span>
                        </div>
                        {bucket.error ? (
                          <p className="text-red-600 text-xs mt-1">错误: {bucket.error}</p>
                        ) : (
                          <div className="mt-1">
                            <p className="text-xs text-gray-600">
                              简单方式: {bucket.simpleFileCount} 个文件 | 
                              递归方式: {bucket.recursiveFileCount} 个文件
                            </p>
                            {bucket.allFiles && bucket.allFiles.length > 0 && (
                              <details className="mt-1">
                                <summary className="cursor-pointer text-xs text-gray-500">查看文件列表</summary>
                                <ul className="text-xs text-gray-600 mt-1 max-h-32 overflow-y-auto">
                                  {bucket.allFiles.map((file: string, fileIndex: number) => (
                                    <li key={fileIndex}>• {file}</li>
                                  ))}
                                </ul>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {backupHistory && (
          <Card>
            <CardHeader>
              <CardTitle>备份历史</CardTitle>
              <CardDescription>
                查看所有备份记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              {backupHistory.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{backupHistory.error}</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600">
                      共 {backupHistory.total || 0} 个备份，总大小: {formatFileSize(backupHistory.totalSize || 0)}
                    </p>
                    <Button
                      onClick={loadBackupHistory}
                      variant="outline"
                      size="sm"
                    >
                      刷新
                    </Button>
                  </div>
                  
                  {backupHistory.backups && backupHistory.backups.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {backupHistory.backups.map((backup: any, index: number) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {backup.type === 'database' ? (
                                <Database className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FolderOpen className="h-4 w-4 text-green-500" />
                              )}
                              <span className="font-medium">{backup.name}</span>
                              <span className="text-xs text-gray-500">
                                {backup.type === 'database' ? '数据库' : '存储桶'}
                              </span>
                            </div>
                            <div className="text-right text-sm text-gray-600">
                              <p>{formatFileSize(backup.size)}</p>
                              <p className="text-xs">
                                {new Date(backup.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            路径: {backup.path}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">暂无备份记录</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>创建备份</CardTitle>
              <CardDescription>
                将数据库和存储桶文件备份到指定的本地文件夹
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="backupPath">备份路径</Label>
                <Input
                  id="backupPath"
                  value={backupPath}
                  onChange={(e) => setBackupPath(e.target.value)}
                  placeholder="例如: D:\backups\language-learning"
                  disabled={isBackingUp}
                />
                <p className="text-sm text-gray-500">
                  请确保路径存在且有写入权限
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={startBackup}
                  disabled={isBackingUp || !backupPath.trim()}
                  className="w-full"
                >
                  {isBackingUp ? '备份进行中...' : '开始备份'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={testBackupConnection}
                    variant="outline"
                    className="w-full"
                  >
                    测试连接
                  </Button>
                  <Button
                    onClick={checkFunctions}
                    variant="outline"
                    className="w-full"
                  >
                    检查函数
                  </Button>
                  <Button
                    onClick={runDiagnostics}
                    variant="outline"
                    className="w-full"
                  >
                    完整诊断
                  </Button>
                  <Button
                    onClick={testStorage}
                    variant="outline"
                    className="w-full"
                  >
                    测试存储桶
                  </Button>
                  <Button
                    onClick={loadBackupHistory}
                    variant="outline"
                    className="w-full col-span-2"
                  >
                    查看备份历史
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>恢复备份</CardTitle>
              <CardDescription>
                从备份文件恢复数据库和存储桶数据
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restoreFile">选择备份文件</Label>
                <Input
                  id="restoreFile"
                  type="file"
                  accept=".zip"
                  onChange={handleRestoreFile}
                  disabled={isRestoring}
                />
                <p className="text-sm text-gray-500">
                  支持ZIP格式的备份文件
                </p>
              </div>

              <Button
                onClick={startRestore}
                disabled={isRestoring || !restoreFile}
                className="w-full"
                variant="outline"
              >
                {isRestoring ? '恢复进行中...' : '开始恢复'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {backupStatus.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>备份状态</CardTitle>
              <CardDescription>
                当前备份任务的执行状态
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {backupStatus.map((task) => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {task.type === 'database' ? (
                          <Database className="h-5 w-5 text-blue-500" />
                        ) : (
                          <FolderOpen className="h-5 w-5 text-green-500" />
                        )}
                        <span className="font-medium">
                          {task.type === 'database' ? '数据库备份' : '存储桶备份'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(task.status)}
                        <span className="text-sm text-gray-600">
                          {getStatusText(task.status)}
                        </span>
                      </div>
                    </div>

                    {task.status === 'running' && (
                      <div className="space-y-2">
                        <Progress value={task.progress} className="w-full" />
                        <p className="text-sm text-gray-600">{task.message}</p>
                      </div>
                    )}

                    {task.status === 'completed' && (
                      <div className="space-y-2">
                        <p className="text-sm text-green-600">{task.message}</p>
                        {task.filePath && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                              <p>文件路径: {task.filePath}</p>
                              <p>文件大小: {formatFileSize(task.fileSize)}</p>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => downloadBackup(task.id)}
                              className="flex items-center space-x-1"
                            >
                              <Download className="h-4 w-4" />
                              <span>下载</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {task.status === 'failed' && (
                      <p className="text-sm text-red-600">{task.message}</p>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      创建时间: {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>备份说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• 数据库备份：导出所有表结构和数据为SQL文件</p>
            <p>• 存储桶备份：下载所有存储桶中的文件</p>
            <p>• 备份文件将保存到指定的本地文件夹中</p>
            <p>• 建议定期进行备份以确保数据安全</p>
            <p>• 备份过程中请勿关闭浏览器或刷新页面</p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
