'use client';
import { useState, useEffect, useCallback } from 'react';
import path from 'path';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Download, Database, FolderOpen, AlertCircle, Clock, Upload } from 'lucide-react';

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

type BackupType = 'all' | 'database' | 'storage';
type DatabaseType = 'local' | 'prod' | 'supabase';

export default function AdminBackupPage() {
  const [backupPath, setBackupPath] = useState('');
  const [backupType, setBackupType] = useState<BackupType>('all');
  const [databaseType, setDatabaseType] = useState<DatabaseType>('supabase');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [incremental, setIncremental] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [compareWith, setCompareWith] = useState<string>('auto');
  const [compareOptions, setCompareOptions] = useState<Array<{
    filename: string;
    filepath: string;
    size: number;
    createdAt: Date;
    type: 'database' | 'storage';
  }>>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restoreType, setRestoreType] = useState<'upload' | 'history'>('upload');
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [testResult, setTestResult] = useState<{ error?: string; tableCount?: number; tables?: string[]; details?: unknown; message?: string; databaseType?: string } | null>(null);
  const [functionCheck, setFunctionCheck] = useState<{ error?: string; hasGetTableList?: boolean; functionTest?: unknown; details?: unknown } | null>(null);
  const [diagnostics, setDiagnostics] = useState<{ error?: string; success?: boolean; summary?: { passed: number; total: number }; diagnostics?: { status: string; test: string; message: string; details?: unknown }[] } | null>(null);
  const [storageTest, setStorageTest] = useState<{ error?: string; success?: boolean; totalBuckets?: number; summary?: { totalFiles: number }; buckets?: { name: string; error?: string; simpleFileCount?: number; recursiveFileCount?: number; allFiles?: string[] }[] } | null>(null);
  const [backupHistory, setBackupHistory] = useState<{ error?: string; total?: number; totalSize?: number; backups?: { name: string; type: string; backupType?: string; size: number; createdAt: string; path: string }[] } | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [envConfig, setEnvConfig] = useState<{
    success?: boolean;
    config?: {
      local: { available: boolean; url: string | null; name: string };
      prod: { available: boolean; url: string | null; name: string };
      supabase: { available: boolean; url: string | null; name: string };
    };
    summary?: {
      localAvailable: boolean;
      prodAvailable: boolean;
      supabaseAvailable: boolean;
      totalAvailable: number;
    };
  } | null>(null);
  const [incrementalPreview, setIncrementalPreview] = useState<{
    compareBackupInfo?: { filename: string; size: number; createdAt: Date };
    totalFiles: number;
    filesToDownload: number;
    filesToSkip: number;
    bucketAnalysis: Array<{
      bucketName: string;
      totalFiles: number;
      filesToDownload: number;
      filesToSkip: number;
      filesToDownloadList: string[];
      filesToSkipList: string[];
    }>;
    summary: {
      totalFiles: number;
      filesToDownload: number;
      filesToSkip: number;
      skipPercentage: number;
      downloadPercentage: number;
    };
  } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [databaseFunctions, setDatabaseFunctions] = useState<{
    hasGetTableList?: boolean;
    hasGetTableColumns?: boolean;
    hasExecSql?: boolean;
    createScript?: string;
    message?: string;
    error?: string;
    suggestion?: string;
  } | null>(null);
  const [isCreatingFunctions, setIsCreatingFunctions] = useState(false);
  const [backupList, setBackupList] = useState<{
    backups: Array<{
      filename: string;
      filepath: string;
      size: number;
      createdAt: Date;
      type: 'full' | 'incremental';
      category: 'database' | 'storage';
    }>;
    fullBackups: Array<{
      filename: string;
      filepath: string;
      size: number;
      createdAt: Date;
      type: 'full' | 'incremental';
      category: 'database' | 'storage';
    }>;
    incrementalBackups: Array<{
      filename: string;
      filepath: string;
      size: number;
      createdAt: Date;
      type: 'full' | 'incremental';
      category: 'database' | 'storage';
    }>;
    summary: {
      total: number;
      full: number;
      incremental: number;
      database: number;
      storage: number;
    };
  } | null>(null);
  const [selectedBaseBackup, setSelectedBaseBackup] = useState<string>('');
  const [selectedIncrementalBackups, setSelectedIncrementalBackups] = useState<string[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{
    success?: boolean;
    message?: string;
    outputPath?: string;
    fileSize?: number;
    fileCount?: number;
    error?: string;
  } | null>(null);
  const [restorePreview, setRestorePreview] = useState<{
    restoreType: 'full' | 'incremental';
    backupPath: string;
    currentFiles: number;
    backupFiles: number;
    filesToRestore: number;
    filesToSkip: number;
    filesToOverwrite: number;
    bucketAnalysis: Array<{
      bucketName: string;
      currentFiles: number;
      backupFiles: number;
      filesToRestore: number;
      filesToSkip: number;
      filesToOverwrite: number;
      filesToRestoreList: string[];
      filesToOverwriteList: string[];
    }>;
    summary: {
      currentFiles: number;
      backupFiles: number;
      filesToRestore: number;
      filesToSkip: number;
      filesToOverwrite: number;
      restorePercentage: number;
      overwritePercentage: number;
    };
  } | null>(null);
  const [isPreviewingRestore, setIsPreviewingRestore] = useState(false);
  const [showRestorePreview, setShowRestorePreview] = useState(false);
  const [selectedRestoreBackup, setSelectedRestoreBackup] = useState<string>('');
  const [restoreResult, setRestoreResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // 获取对比选项
  const fetchCompareOptions = useCallback(async () => {
    if (!backupPath.trim()) return;
    
    try {
      const response = await fetch(`/api/admin/backup/compare-list?backupPath=${encodeURIComponent(backupPath)}&backupType=${backupType}`);
      if (response.ok) {
        const data = await response.json();
        setCompareOptions(data.backups || []);
      }
    } catch (err) {
      console.error('获取对比选项失败:', err);
    }
  }, [backupPath, backupType]);

  const loadEnvConfig = async () => {
    try {
      const response = await fetch('/api/admin/backup/env-config');
      if (response.ok) {
        const data = await response.json();
        setEnvConfig(data);
      }
    } catch (err) {
      console.error('加载环境配置失败:', err);
    }
  };

  useEffect(() => {
    // 设置默认备份路径
    const defaultPath = 'D:\\backups\\language-learning';
    setBackupPath(defaultPath);
    
    // 加载环境配置
    loadEnvConfig();
  }, []);

  // 当备份路径或类型变化时，获取对比选项
  useEffect(() => {
    if (backupPath.trim() && incremental) {
      fetchCompareOptions();
    }
  }, [backupPath, backupType, incremental, fetchCompareOptions]);

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
          backupType: backupType,
          incremental: incremental,
          overwriteExisting: overwriteExisting,
          compareWith: compareWith === 'auto' ? null : compareWith,
          databaseType: databaseType,
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
          setLastUpdate(new Date());

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
    // 直接在新窗口中打开下载链接，让浏览器处理下载
    const downloadUrl = `/api/admin/backup/download/${taskId}`;
    window.open(downloadUrl, '_blank');
  };

  const autoSetBackupPath = async () => {
    setError(null);
    
    // 常见的服务器备份路径列表
    const commonPaths = [
      '/tmp/backups',
      '/var/backups',
      '/opt/backups',
      './backups',
      '../backups',
      '/home/backups',
      './data/backups'
    ];

    for (const testPath of commonPaths) {
      try {
        const response = await fetch('/api/admin/backup/check-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            backupPath: testPath
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setBackupPath(testPath);
            setError(null);
            return; // 找到可用路径，退出
          }
        }
      } catch {
        // 继续尝试下一个路径
        continue;
      }
    }

    // 如果所有路径都不可用，显示错误
    setError('无法找到可用的备份路径，请手动设置');
  };

  const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setRestoreFile(file);
    }
  };

  const startRestore = async () => {
    if (restoreType === 'upload' && !restoreFile) {
      setError('请选择要恢复的备份文件');
      return;
    }

    if (restoreType === 'history' && !selectedBackup) {
      setError('请选择要恢复的历史备份');
      return;
    }

    setIsRestoringBackup(true);
    setError(null);
    setRestoreProgress(0);
    setRestoreMessage('开始恢复...');

    try {
      let response: Response;

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev < 90) {
            setRestoreMessage(prev < 30 ? '正在准备恢复...' : 
                            prev < 60 ? '正在恢复数据库...' : 
                            '正在恢复存储桶...');
            return prev + Math.random() * 10;
          }
          return prev;
        });
      }, 500);

      if (restoreType === 'upload') {
        const formData = new FormData();
        formData.append('file', restoreFile!);
        formData.append('restoreType', 'upload');
        formData.append('databaseType', databaseType);

        response = await fetch('/api/admin/backup/restore', {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch('/api/admin/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            restoreType: 'history',
            backupPath: selectedBackup,
            databaseType,
          }),
        });
      }

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '恢复失败');
      }

      const data = await response.json();
      setRestoreProgress(100);
      setRestoreMessage('恢复完成');
      
      // 显示成功消息
      setTimeout(() => {
        alert(`恢复完成: ${data.message}`);
        // 重置状态
        setRestoreFile(null);
        setSelectedBackup(null);
        setRestoreProgress(0);
        setRestoreMessage('');
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复失败');
      setRestoreMessage('恢复失败');
      setRestoreProgress(0);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const testBackupConnection = async () => {
    try {
      const response = await fetch(`/api/admin/backup/test?databaseType=${databaseType}`);
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ error: '测试失败' });
    }
  };

  const checkFunctions = async () => {
    try {
      const response = await fetch(`/api/admin/backup/check-functions?databaseType=${databaseType}`);
      const data = await response.json();
      setFunctionCheck(data);
    } catch {
      setFunctionCheck({ error: '检查失败' });
    }
  };

  const runDiagnostics = async () => {
    try {
      const response = await fetch(`/api/admin/backup/diagnose?databaseType=${databaseType}`);
      const data = await response.json();
      setDiagnostics(data);
    } catch {
      setDiagnostics({ error: '诊断失败' });
    }
  };

  const testStorage = async () => {
    try {
      const response = await fetch(`/api/admin/backup/test-storage?databaseType=${databaseType}`);
      const data = await response.json();
      setStorageTest(data);
    } catch {
      setStorageTest({ error: '存储桶测试失败' });
    }
  };

  const loadBackupHistory = async () => {
    try {
      const response = await fetch(`/api/admin/backup/history?backupPath=${encodeURIComponent(backupPath)}`);
      const data = await response.json();
      setBackupHistory(data);
    } catch {
      setBackupHistory({ error: '加载备份历史失败' });
    }
  };

  const previewIncrementalBackup = async () => {
    if (!backupPath.trim()) {
      setError('请输入备份路径');
      return;
    }

    if (!incremental) {
      setError('请先启用增量备份选项');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    setIncrementalPreview(null);
    setShowPreview(false);

    try {
      const response = await fetch('/api/admin/backup/preview-incremental', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupPath: backupPath.trim(),
          backupType: backupType,
          compareWith: compareWith === 'auto' ? null : compareWith,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '预览失败');
      }

      const data = await response.json();
      setIncrementalPreview(data);
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览失败');
    } finally {
      setIsPreviewing(false);
    }
  };

  const confirmIncrementalBackup = () => {
    setShowPreview(false);
    startBackup();
  };

  const loadBackupList = async () => {
    if (!backupPath.trim()) {
      setError('请输入备份路径');
      return;
    }

    try {
      const response = await fetch(`/api/admin/backup/list?backupPath=${encodeURIComponent(backupPath)}`);
      const data = await response.json();
      setBackupList(data);
    } catch {
      setBackupList(null);
    }
  };

  const mergeBackups = async () => {
    if (!selectedBaseBackup) {
      setError('请选择基础备份文件');
      return;
    }

    if (selectedIncrementalBackups.length === 0) {
      setError('请选择至少一个增量备份文件');
      return;
    }

    setIsMerging(true);
    setMergeResult(null);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('_');
      const outputPath = path.join(backupPath, `merged-backup-${timestamp}.zip`);

      const response = await fetch('/api/admin/backup/merge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseBackupPath: selectedBaseBackup,
          incrementalBackupPaths: selectedIncrementalBackups,
          outputPath
        }),
      });

      const data = await response.json();
      setMergeResult(data);

      if (data.success) {
        // 重新加载备份列表
        loadBackupList();
      }
    } catch (err) {
      setMergeResult({
        success: false,
        error: err instanceof Error ? err.message : '合并失败'
      });
    } finally {
      setIsMerging(false);
    }
  };

  const previewRestore = async (restoreType: 'full' | 'incremental' = 'full') => {
    if (!selectedRestoreBackup) {
      setError('请选择要恢复的备份文件');
      return;
    }

    setIsPreviewingRestore(true);
    setRestorePreview(null);

    try {
      const response = await fetch('/api/admin/backup/preview-restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupPath: selectedRestoreBackup,
          restoreType
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setRestorePreview(data);
        setShowRestorePreview(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览恢复失败');
    } finally {
      setIsPreviewingRestore(false);
    }
  };

  const confirmRestore = async () => {
    if (!selectedRestoreBackup) {
      setError('请选择要恢复的备份文件');
      return;
    }

    setIsRestoringBackup(true);
    setRestoreResult(null);
    setShowRestorePreview(false);

    try {
      const mode = (document.querySelector('input[name="restoreMode"]:checked') as HTMLInputElement)?.value as 'full' | 'incremental';
      const restoreType = mode === 'incremental' ? 'incremental' : 'history';
      
      const response = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          restoreType,
          backupPath: selectedRestoreBackup
        }),
      });

      const data = await response.json();
      setRestoreResult(data);

      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      setRestoreResult({
        success: false,
        error: err instanceof Error ? err.message : '恢复失败'
      });
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const checkDatabaseFunctions = async () => {
    try {
      const response = await fetch('/api/admin/backup/check-database-functions');
      const data = await response.json();
      setDatabaseFunctions(data);
    } catch {
      setDatabaseFunctions({ error: '检查数据库函数失败' });
    }
  };

  const createDatabaseFunctions = async () => {
    setIsCreatingFunctions(true);
    try {
      const response = await fetch('/api/admin/backup/create-functions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setDatabaseFunctions(prev => ({
          ...prev,
          ...data,
          message: data.message
        }));
        
        // 重新检查函数状态
        setTimeout(() => {
          checkDatabaseFunctions();
        }, 1000);
      } else {
        setDatabaseFunctions(prev => ({
          ...prev,
          error: data.error || '创建函数失败',
          createScript: data.sql,
          suggestion: data.suggestion
        }));
      }
    } catch (err) {
      setDatabaseFunctions(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : '创建函数失败'
      }));
    } finally {
      setIsCreatingFunctions(false);
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
                  {testResult.details ? (
                    <div className="mt-2">
                      <pre className="text-xs bg-gray-100 p-2 rounded">
                        {JSON.stringify(testResult.details, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  <p>测试成功！{testResult.message || `找到 ${testResult.tableCount} 个表`}</p>
                  {testResult.tables && (
                    <div className="mt-2">
                      <p className="text-sm font-medium">表列表:</p>
                      <ul className="text-sm text-gray-600 mt-1">
                        {testResult.tables.map((table: string, index: number) => (
                          <li key={index}>• {table}</li>
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
                  {functionCheck.details ? (
                    <div className="mt-2">
                      <pre className="text-xs bg-gray-100 p-2 rounded">
                        {JSON.stringify(functionCheck.details, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ) : functionCheck.hasGetTableList ? (
                <div>
                  <p>✅ RPC函数已存在，可以正常备份</p>
                  {functionCheck.functionTest ? (
                    <div className="mt-2">
                      <p className="text-sm">函数测试结果:</p>
                      <div className="mt-1">
                        <pre className="text-xs bg-gray-100 p-2 rounded">
                          {JSON.stringify(functionCheck.functionTest, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : null}
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

        {databaseFunctions && (
          <Alert variant={databaseFunctions.error ? "destructive" : databaseFunctions.hasGetTableList ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {databaseFunctions.error ? (
                <div>
                  <p>数据库函数检查失败: {databaseFunctions.error}</p>
                </div>
              ) : databaseFunctions.hasGetTableList ? (
                <div>
                  <p>✅ 数据库函数已存在，可以正常备份</p>
                  <p className="text-sm text-gray-600 mt-1">
                    get_table_list: ✅ | get_table_columns: ✅ | exec_sql: ✅
                  </p>
                </div>
              ) : (
                <div>
                  <p>❌ 数据库函数不存在，需要创建</p>
                  <p className="text-sm mt-2">
                    {databaseFunctions.message}
                  </p>
                  <div className="mt-3 space-y-2">
                    <Button
                      onClick={createDatabaseFunctions}
                      disabled={isCreatingFunctions}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isCreatingFunctions ? '正在创建...' : '自动创建函数'}
                    </Button>
                    {databaseFunctions.createScript && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                          查看创建脚本（手动执行）
                        </summary>
                        <div className="mt-2 space-y-2">
                          {databaseFunctions.suggestion && (
                            <p className="text-sm text-orange-600 font-medium">
                              {databaseFunctions.suggestion}
                            </p>
                          )}
                          <div className="relative">
                            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-60">
                              {databaseFunctions.createScript}
                            </pre>
                            <Button
                              onClick={() => {
                                navigator.clipboard.writeText(databaseFunctions.createScript || '');
                                alert('SQL脚本已复制到剪贴板');
                              }}
                              size="sm"
                              variant="outline"
                              className="absolute top-2 right-2"
                            >
                              复制
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            请将上述SQL脚本复制到Supabase控制台的SQL Editor中执行
                          </p>
                        </div>
                      </details>
                    )}
                  </div>
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
                  {diagnostics.diagnostics?.map((diag: { status: string; test: string; message: string; details?: unknown }, index: number) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-center space-x-2">
                        <span className={diag.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                          {diag.status === 'success' ? '✅' : '❌'}
                        </span>
                        <span className="font-medium">{diag.test}</span>
                      </div>
                      <p className="text-gray-600 ml-6">{diag.message}</p>
                      {diag.details ? (
                        <details className="ml-6 mt-1">
                          <summary className="cursor-pointer text-xs text-gray-500">查看详情</summary>
                          <div className="mt-1">
                            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                              {JSON.stringify(diag.details, null, 2)}
                            </pre>
                          </div>
                        </details>
                      ) : null}
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
                    {storageTest.buckets?.map((bucket: { name: string; error?: string; simpleFileCount?: number; recursiveFileCount?: number; allFiles?: string[] }, index: number) => (
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

        {showPreview && incrementalPreview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>增量备份预览</span>
                <div className="flex space-x-2">
                  <Button
                    onClick={confirmIncrementalBackup}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    确认执行备份
                  </Button>
                  <Button
                    onClick={() => setShowPreview(false)}
                    size="sm"
                    variant="outline"
                  >
                    取消
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                基于对比文件分析需要下载的文件数量
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 对比文件信息 */}
                {incrementalPreview.compareBackupInfo && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">对比基准文件</h4>
                    <div className="text-sm text-blue-700">
                      <p><strong>文件名:</strong> {incrementalPreview.compareBackupInfo.filename}</p>
                      <p><strong>文件大小:</strong> {formatFileSize(incrementalPreview.compareBackupInfo.size)}</p>
                      <p><strong>创建时间:</strong> {new Date(incrementalPreview.compareBackupInfo.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                )}

                {/* 总体统计 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-gray-800">{incrementalPreview.summary.totalFiles}</div>
                    <div className="text-sm text-gray-600">总文件数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{incrementalPreview.summary.filesToDownload}</div>
                    <div className="text-sm text-green-600">需要下载</div>
                    <div className="text-xs text-green-500">({incrementalPreview.summary.downloadPercentage}%)</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{incrementalPreview.summary.filesToSkip}</div>
                    <div className="text-sm text-blue-600">跳过文件</div>
                    <div className="text-xs text-blue-500">({incrementalPreview.summary.skipPercentage}%)</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {incrementalPreview.summary.filesToSkip > 0 ? 
                        Math.round((incrementalPreview.summary.filesToSkip / incrementalPreview.summary.totalFiles) * 100) : 0}%
                    </div>
                    <div className="text-sm text-orange-600">节省比例</div>
                  </div>
                </div>

                {/* 存储桶详细分析 */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">存储桶详细分析</h4>
                  {incrementalPreview.bucketAnalysis.map((bucket, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-gray-800">{bucket.bucketName}</h5>
                        <div className="text-sm text-gray-600">
                          共 {bucket.totalFiles} 个文件
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">{bucket.filesToDownload}</div>
                          <div className="text-xs text-green-600">需要下载</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">{bucket.filesToSkip}</div>
                          <div className="text-xs text-blue-600">跳过文件</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-orange-600">
                            {bucket.totalFiles > 0 ? Math.round((bucket.filesToSkip / bucket.totalFiles) * 100) : 0}%
                          </div>
                          <div className="text-xs text-orange-600">节省比例</div>
                        </div>
                      </div>

                      {/* 文件示例 */}
                      {bucket.filesToDownload > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            查看需要下载的文件示例 ({bucket.filesToDownload} 个)
                          </summary>
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <ul className="text-xs text-gray-600 space-y-1">
                              {bucket.filesToDownloadList.map((file, fileIndex) => (
                                <li key={fileIndex} className="truncate">• {file}</li>
                              ))}
                              {bucket.filesToDownload > 10 && (
                                <li className="text-gray-500 italic">... 还有 {bucket.filesToDownload - 10} 个文件</li>
                              )}
                            </ul>
                          </div>
                        </details>
                      )}

                      {bucket.filesToSkip > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                            查看跳过的文件示例 ({bucket.filesToSkip} 个)
                          </summary>
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <ul className="text-xs text-gray-600 space-y-1">
                              {bucket.filesToSkipList.map((file, fileIndex) => (
                                <li key={fileIndex} className="truncate">• {file}</li>
                              ))}
                              {bucket.filesToSkip > 10 && (
                                <li className="text-gray-500 italic">... 还有 {bucket.filesToSkip - 10} 个文件</li>
                              )}
                            </ul>
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>

                {/* 操作提示 */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">确认执行增量备份？</p>
                      <p className="mt-1">
                        增量备份将：
                      </p>
                      <ul className="mt-2 ml-4 space-y-1">
                        <li>• 下载 {incrementalPreview.summary.filesToDownload} 个新文件</li>
                        <li>• 跳过 {incrementalPreview.summary.filesToSkip} 个已存在的文件</li>
                        <li>• 将新文件与现有文件合并，创建包含所有 {incrementalPreview.summary.totalFiles} 个文件的完整备份</li>
                        <li>• 预计可节省 {incrementalPreview.summary.skipPercentage}% 的下载时间</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {/* 按类型分组显示 */}
                      {['database', 'storage'].map((type) => {
                        const typeBackups = backupHistory.backups?.filter((backup: { type: string }) => backup.type === type) || [];
                        if (typeBackups.length === 0) return null;
                        
                        return (
                          <div key={type} className="space-y-2">
                            <div className="flex items-center space-x-2 border-b pb-2">
                              {type === 'database' ? (
                                <Database className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FolderOpen className="h-4 w-4 text-green-500" />
                              )}
                              <h4 className="font-medium text-sm">
                                {type === 'database' ? '数据库备份' : '存储桶备份'} ({typeBackups.length} 个)
                              </h4>
                            </div>
                            <div className="space-y-2">
                              {typeBackups.map((backup: { name: string; type: string; size: number; createdAt: string; path: string }, index: number) => (
                                <div key={`${type}-${index}`} className="border rounded-lg p-3 ml-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium text-sm">{backup.name}</span>
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        {backup.type}
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
                          </div>
                        );
                      })}
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

              <div className="space-y-3">
                <Label>备份类型</Label>
                <Select
                  value={backupType}
                  onValueChange={(value: BackupType) => setBackupType(value)}
                  disabled={isBackingUp}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择备份类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <FolderOpen className="h-4 w-4" />
                        <span>全部备份（数据库 + 存储桶）</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="database">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>仅数据库备份</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="storage">
                      <div className="flex items-center space-x-2">
                        <FolderOpen className="h-4 w-4" />
                        <span>仅存储桶备份</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  选择要备份的内容类型
                </p>
              </div>

              <div className="space-y-3">
                <Label>数据库类型</Label>
                <Select
                  value={databaseType}
                  onValueChange={(value: DatabaseType) => setDatabaseType(value)}
                  disabled={isBackingUp}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择数据库类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supabase" disabled={!envConfig?.config?.supabase?.available}>
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>Supabase 数据库</span>
                        {!envConfig?.config?.supabase?.available && (
                          <span className="text-red-500 text-xs">(不可用)</span>
                        )}
                      </div>
                    </SelectItem>
                    <SelectItem value="local" disabled={!envConfig?.config?.local?.available}>
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>本地数据库</span>
                        {!envConfig?.config?.local?.available && (
                          <span className="text-red-500 text-xs">(不可用)</span>
                        )}
                      </div>
                    </SelectItem>
                    <SelectItem value="prod" disabled={!envConfig?.config?.prod?.available}>
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>生产环境数据库</span>
                        {!envConfig?.config?.prod?.available && (
                          <span className="text-red-500 text-xs">(不可用)</span>
                        )}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  选择要备份的数据库类型
                  {envConfig?.summary && (
                    <span className="ml-2">
                      (可用: {envConfig.summary.totalAvailable}/3)
                    </span>
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <Label>备份选项</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="incremental"
                      checked={incremental}
                      onChange={(e) => {
                        setIncremental(e.target.checked);
                        if (!e.target.checked) {
                          setCompareWith('auto');
                        }
                      }}
                      disabled={isBackingUp}
                      className="rounded"
                    />
                    <Label htmlFor="incremental" className="text-sm">
                      增量备份（只备份新增或修改的文件）
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="overwriteExisting"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      disabled={isBackingUp}
                      className="rounded"
                    />
                    <Label htmlFor="overwriteExisting" className="text-sm">
                      覆盖现有文件（恢复时覆盖已存在的文件）
                    </Label>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  增量备份可以节省时间和流量，只备份新增或修改的文件
                </p>
              </div>

              {incremental && (
                <div className="space-y-3">
                  <Label>对比基准</Label>
                  <Select
                    value={compareWith}
                    onValueChange={setCompareWith}
                    disabled={isBackingUp}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择对比的备份文件（留空则自动选择最新）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <div className="flex items-center space-x-2">
                          <span>自动选择最新备份</span>
                        </div>
                      </SelectItem>
                      {compareOptions.map((backup) => (
                        <SelectItem key={backup.filename} value={backup.filename}>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs">
                              {backup.filename}
                            </span>
                            <span className="text-xs text-gray-500">
                              ({Math.round(backup.size / 1024 / 1024)}MB)
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(backup.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    选择要与当前备份进行对比的基准文件。留空则自动选择最新的备份文件。
                  </p>
                  {compareOptions.length === 0 && (
                    <p className="text-sm text-orange-500">
                      未找到可对比的备份文件，将进行完整备份
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {incremental ? (
                  <div className="space-y-2">
                    <Button
                      onClick={previewIncrementalBackup}
                      disabled={isPreviewing || !backupPath.trim()}
                      className="w-full"
                      variant="outline"
                    >
                      {isPreviewing ? '正在预览...' : '预览增量备份'}
                    </Button>
                    <Button
                      onClick={startBackup}
                      disabled={isBackingUp || !backupPath.trim()}
                      className="w-full"
                    >
                      {isBackingUp ? '备份进行中...' : '直接开始备份'}
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={startBackup}
                    disabled={isBackingUp || !backupPath.trim()}
                    className="w-full"
                  >
                    {isBackingUp ? '备份进行中...' : '开始备份'}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={testBackupConnection}
                    variant="outline"
                    className="w-full"
                    disabled={isBackingUp}
                  >
                    测试数据库连接
                  </Button>
                  <Button
                    onClick={autoSetBackupPath}
                    variant="outline"
                    className="w-full"
                  >
                    一键设置路径
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={checkFunctions}
                    variant="outline"
                    className="w-full"
                  >
                    检查函数
                  </Button>
                  <Button
                    onClick={checkDatabaseFunctions}
                    variant="outline"
                    className="w-full"
                  >
                    检查数据库函数
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
                    className="w-full"
                  >
                    查看备份历史
                  </Button>
                  <Button
                    onClick={loadBackupList}
                    variant="outline"
                    className="w-full"
                  >
                    备份管理
                  </Button>
                  <Button
                    onClick={() => {
                      setShowRestorePreview(true);
                      loadBackupHistory();
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    恢复预览
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
              <div className="space-y-3">
                <Label>恢复方式</Label>
                <Select
                  value={restoreType}
                  onValueChange={(value: 'upload' | 'history') => setRestoreType(value)}
                  disabled={isRestoringBackup}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择恢复方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upload">
                      <div className="flex items-center space-x-2">
                        <Upload className="h-4 w-4" />
                        <span>上传备份文件</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="history">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4" />
                        <span>从历史备份选择</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {restoreType === 'upload' && (
                <div className="space-y-2">
                  <Label htmlFor="restoreFile">选择备份文件</Label>
                  <Input
                    id="restoreFile"
                    type="file"
                    accept=".zip"
                    onChange={handleRestoreFile}
                    disabled={isRestoringBackup}
                  />
                  <p className="text-sm text-gray-500">
                    支持ZIP格式的备份文件
                  </p>
                </div>
              )}

              {restoreType === 'history' && (
                <div className="space-y-2">
                  <Label>选择历史备份</Label>
                  {backupHistory && backupHistory.backups && backupHistory.backups.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-2">
                      {backupHistory.backups.map((backup, index) => (
                        <div
                          key={index}
                          className={`p-2 border rounded cursor-pointer transition-colors ${
                            selectedBackup === backup.path
                              ? 'bg-blue-50 border-blue-300'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedBackup(backup.path)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              {backup.type === 'database' ? (
                                <Database className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FolderOpen className="h-4 w-4 text-green-500" />
                              )}
                              <span className="font-medium text-sm">{backup.name}</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
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
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <p>暂无历史备份</p>
                      <p className="text-sm">请先创建备份或点击&ldquo;查看备份历史&rdquo;加载</p>
                    </div>
                  )}
                </div>
              )}

              {isRestoringBackup && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{restoreMessage}</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <Progress value={restoreProgress} className="w-full" />
                </div>
              )}

              <Button
                onClick={startRestore}
                disabled={isRestoringBackup || (restoreType === 'upload' ? !restoreFile : !selectedBackup)}
                className="w-full"
                variant="outline"
              >
                {isRestoringBackup ? '恢复进行中...' : '开始恢复'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {backupStatus.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>备份状态</span>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span>共 {backupStatus.length} 个任务</span>
                  {backupStatus.some(task => task.status === 'running') && (
                    <span className="flex items-center space-x-1 text-blue-600">
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>进行中</span>
                    </span>
                  )}
                </div>
              </CardTitle>
              <CardDescription className="flex items-center justify-between">
                <span>当前备份任务的执行状态和详细进度</span>
                {lastUpdate && (
                  <span className="text-xs text-gray-500">
                    最后更新: {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* 进度概览 */}
              {backupStatus.length > 1 && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-sm mb-3">备份进度概览</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {backupStatus.filter(task => task.status === 'completed').length}
                      </div>
                      <div className="text-xs text-gray-600">已完成</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {backupStatus.filter(task => task.status === 'running').length}
                      </div>
                      <div className="text-xs text-gray-600">进行中</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>总体进度</span>
                      <span>{Math.round(backupStatus.reduce((sum, task) => sum + task.progress, 0) / backupStatus.length)}%</span>
                    </div>
                    <Progress 
                      value={backupStatus.reduce((sum, task) => sum + task.progress, 0) / backupStatus.length} 
                      className="w-full h-2" 
                    />
                  </div>
                </div>
              )}
              
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
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {task.id}
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">进度</span>
                          <span className="text-gray-600">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="w-full" />
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">{task.message}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>⏱️ 运行中...</span>
                            <span>🔄 实时更新</span>
                          </div>
                        </div>
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

        {backupList && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>备份管理</span>
                <div className="flex space-x-2">
                  <Button
                    onClick={loadBackupList}
                    variant="outline"
                    size="sm"
                  >
                    刷新
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                管理备份文件，支持增量备份合并
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 备份统计 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-xl font-bold text-blue-600">{backupList.summary.total}</div>
                    <div className="text-sm text-blue-600">总备份</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-xl font-bold text-green-600">{backupList.summary.full}</div>
                    <div className="text-sm text-green-600">完整备份</div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-xl font-bold text-orange-600">{backupList.summary.incremental}</div>
                    <div className="text-sm text-orange-600">增量备份</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600">{backupList.summary.storage}</div>
                    <div className="text-sm text-purple-600">存储桶备份</div>
                  </div>
                </div>

                {/* 增量备份合并 */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">增量备份合并</h4>
                  
                  {/* 选择基础备份 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">选择基础备份（完整备份）</label>
                    <select
                      value={selectedBaseBackup}
                      onChange={(e) => setSelectedBaseBackup(e.target.value)}
                      className="w-full p-2 border rounded-lg"
                    >
                      <option value="">请选择基础备份</option>
                      {backupList.fullBackups
                        .filter(backup => backup.category === 'storage')
                        .map((backup) => (
                          <option key={backup.filename} value={backup.filepath}>
                            {backup.filename} ({formatFileSize(backup.size)})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 选择增量备份 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">选择增量备份（可多选）</label>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {backupList.incrementalBackups
                        .filter(backup => backup.category === 'storage')
                        .map((backup) => (
                          <label key={backup.filename} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={selectedIncrementalBackups.includes(backup.filepath)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIncrementalBackups([...selectedIncrementalBackups, backup.filepath]);
                                } else {
                                  setSelectedIncrementalBackups(selectedIncrementalBackups.filter(p => p !== backup.filepath));
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {backup.filename} ({formatFileSize(backup.size)})
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>

                  {/* 合并按钮 */}
                  <Button
                    onClick={mergeBackups}
                    disabled={isMerging || !selectedBaseBackup || selectedIncrementalBackups.length === 0}
                    className="w-full"
                  >
                    {isMerging ? '正在合并...' : '合并备份'}
                  </Button>

                  {/* 合并结果 */}
                  {mergeResult && (
                    <div className={`p-3 rounded-lg ${mergeResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <div className="flex items-start space-x-2">
                        {mergeResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div className="text-sm">
                          <p className={`font-medium ${mergeResult.success ? 'text-green-800' : 'text-red-800'}`}>
                            {mergeResult.success ? '合并成功' : '合并失败'}
                          </p>
                          <p className={`mt-1 ${mergeResult.success ? 'text-green-700' : 'text-red-700'}`}>
                            {mergeResult.message || mergeResult.error}
                          </p>
                          {mergeResult.success && mergeResult.fileSize && (
                            <p className="text-green-600 mt-1">
                              输出文件: {path.basename(mergeResult.outputPath || '')} ({formatFileSize(mergeResult.fileSize)})
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 备份文件列表 */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">所有备份文件</h4>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {backupList.backups.map((backup, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {backup.type === 'full' ? (
                            <Database className="h-5 w-5 text-green-500" />
                          ) : (
                            <Clock className="h-5 w-5 text-orange-500" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{backup.filename}</p>
                            <p className="text-xs text-gray-500">
                              {backup.type === 'full' ? '完整备份' : '增量备份'} • 
                              {backup.category === 'database' ? '数据库' : '存储桶'} • 
                              {formatFileSize(backup.size)} • 
                              {new Date(backup.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            const downloadUrl = `/api/admin/backup/download/${backup.filename}`;
                            window.open(downloadUrl, '_blank');
                          }}
                          size="sm"
                          variant="outline"
                        >
                          下载
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 恢复预览界面 */}
        {showRestorePreview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>恢复预览</span>
                <Button
                  onClick={() => setShowRestorePreview(false)}
                  variant="outline"
                  size="sm"
                >
                  关闭
                </Button>
              </CardTitle>
              <CardDescription>
                预览恢复操作，分析需要恢复的文件
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 选择备份文件 */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">选择要恢复的备份文件</label>
                    <div className="flex space-x-2">
                      <Button
                        onClick={loadBackupHistory}
                        variant="outline"
                        size="sm"
                      >
                        刷新备份列表
                      </Button>
                    </div>
                    
                    {backupHistory && backupHistory.backups && backupHistory.backups.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto border rounded-lg p-2 space-y-1">
                        {backupHistory.backups
                          .filter(backup => backup.type === 'storage')
                          .map((backup) => {
                            const backupType = backup.backupType || 'unknown';
                            const typeColor = backupType === 'full' ? 'text-green-600' : 
                                            backupType === 'incremental' ? 'text-orange-600' : 
                                            backupType === 'merged' ? 'text-blue-600' : 'text-gray-600';
                            const typeIcon = backupType === 'full' ? '📦' : 
                                           backupType === 'incremental' ? '📈' : 
                                           backupType === 'merged' ? '🔗' : '❓';
                            
                            return (
                              <label key={backup.name} className="flex items-center space-x-2 p-3 hover:bg-gray-50 rounded cursor-pointer border">
                                <input
                                  type="radio"
                                  name="selectedBackup"
                                  value={backup.path}
                                  checked={selectedRestoreBackup === backup.path}
                                  onChange={(e) => setSelectedRestoreBackup(e.target.value)}
                                  className="rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-lg">{typeIcon}</span>
                                      <span className="text-sm font-medium truncate">{backup.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">{formatFileSize(backup.size)}</span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    <span className={`font-medium ${typeColor}`}>
                                      {backupType === 'full' ? '完整备份' : 
                                       backupType === 'incremental' ? '增量备份' : 
                                       backupType === 'merged' ? '合并备份' : '未知类型'}
                                    </span>
                                    <span className="mx-2">•</span>
                                    <span>{new Date(backup.createdAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        {backupHistory ? '没有找到备份文件' : '点击"刷新备份列表"加载备份文件'}
                      </div>
                    )}
                  </div>

                  {/* 恢复模式选择 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">恢复模式</label>
                    <div className="flex space-x-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="incremental"
                          defaultChecked
                          className="rounded"
                        />
                        <span className="text-sm">增量恢复（只恢复数据库中缺失的文件）</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="restoreMode"
                          value="full"
                          className="rounded"
                        />
                        <span className="text-sm">完整恢复（恢复所有备份文件）</span>
                      </label>
                    </div>
                  </div>

                  {/* 预览按钮 */}
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        const mode = (document.querySelector('input[name="restoreMode"]:checked') as HTMLInputElement)?.value as 'full' | 'incremental';
                        previewRestore(mode);
                      }}
                      disabled={isPreviewingRestore || !selectedRestoreBackup}
                      className="flex-1"
                    >
                      {isPreviewingRestore ? '分析中...' : '预览恢复'}
                    </Button>
                  </div>
                </div>

                {/* 恢复预览结果 */}
                {restorePreview && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-800">恢复分析结果</h4>
                    
                    {/* 总体统计 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">{restorePreview.currentFiles}</div>
                        <div className="text-sm text-blue-600">数据库文件</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">{restorePreview.backupFiles}</div>
                        <div className="text-sm text-green-600">备份文件</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-xl font-bold text-orange-600">{restorePreview.filesToRestore}</div>
                        <div className="text-sm text-orange-600">{restorePreview.restoreType === 'incremental' ? '需要恢复' : '需要恢复'}</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-xl font-bold text-gray-600">{restorePreview.filesToSkip}</div>
                        <div className="text-sm text-gray-600">{restorePreview.restoreType === 'incremental' ? '已存在跳过' : '跳过文件'}</div>
                      </div>
                    </div>

                    {/* 详细分析 */}
                    <div className="space-y-4">
                      <h5 className="font-medium text-gray-700">存储桶分析</h5>
                      {restorePreview.bucketAnalysis.map((bucket, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h6 className="font-medium">{bucket.bucketName}</h6>
                            <div className="text-sm text-gray-500">
                              {restorePreview.restoreType === 'incremental' 
                                ? `恢复 ${bucket.filesToRestore} 个，跳过 ${bucket.filesToSkip} 个`
                                : `恢复 ${bucket.filesToRestore} 个，覆盖 ${bucket.filesToOverwrite} 个`
                              }
                            </div>
                          </div>
                          
                          {bucket.filesToRestore > 0 && (
                            <div className="mb-2">
                              <p className="text-sm text-gray-600 mb-1">需要恢复的文件示例：</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                {bucket.filesToRestoreList.map((file, i) => (
                                  <div key={i} className="truncate">• {file}</div>
                                ))}
                                {bucket.filesToRestore > 10 && (
                                  <div>... 还有 {bucket.filesToRestore - 10} 个文件</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {restorePreview.restoreType === 'full' && bucket.filesToOverwrite > 0 && (
                            <div>
                              <p className="text-sm text-gray-600 mb-1">将被覆盖的文件示例：</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                {bucket.filesToOverwriteList.map((file, i) => (
                                  <div key={i} className="truncate">• {file}</div>
                                ))}
                                {bucket.filesToOverwrite > 10 && (
                                  <div>... 还有 {bucket.filesToOverwrite - 10} 个文件</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {restorePreview.restoreType === 'incremental' && bucket.filesToSkip > 0 && (
                            <div>
                              <p className="text-sm text-gray-600 mb-1">已存在跳过的文件示例：</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                {bucket.filesToOverwriteList.slice(0, 5).map((file, i) => (
                                  <div key={i} className="truncate">• {file}</div>
                                ))}
                                {bucket.filesToSkip > 5 && (
                                  <div>... 还有 {bucket.filesToSkip - 5} 个文件</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 确认恢复按钮 */}
                    <div className="flex space-x-2">
                      <Button
                        onClick={confirmRestore}
                        disabled={isRestoringBackup}
                        className="flex-1"
                      >
                        {isRestoringBackup ? '正在恢复...' : '确认恢复'}
                      </Button>
                      <Button
                        onClick={() => setShowRestorePreview(false)}
                        variant="outline"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                )}

                {/* 恢复结果 */}
                {restoreResult && (
                  <div className={`p-3 rounded-lg ${restoreResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-start space-x-2">
                      {restoreResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="text-sm">
                        <p className={`font-medium ${restoreResult.success ? 'text-green-800' : 'text-red-800'}`}>
                          {restoreResult.success ? '恢复成功' : '恢复失败'}
                        </p>
                        <p className={`mt-1 ${restoreResult.success ? 'text-green-700' : 'text-red-700'}`}>
                          {restoreResult.message || restoreResult.error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>备份与恢复说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-800 mb-2">备份功能：</h4>
              <p>• <strong>完整备份</strong>：备份所有数据，文件名包含&ldquo;backup&rdquo;</p>
              <p>• <strong>增量备份</strong>：只备份新增或修改的文件，文件名包含&ldquo;incremental&rdquo;</p>
              <p>• <strong>数据库备份</strong>：导出所有表结构和数据为SQL文件</p>
              <p>• <strong>存储桶备份</strong>：下载所有存储桶中的文件</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">备份管理：</h4>
              <p>• <strong>增量合并</strong>：将增量备份与基础备份合并成完整备份</p>
              <p>• <strong>备份列表</strong>：查看所有备份文件，支持按类型筛选</p>
              <p>• <strong>文件下载</strong>：直接下载备份文件</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">恢复功能：</h4>
              <p>• <strong>上传文件恢复</strong>：上传ZIP格式的备份文件进行恢复</p>
              <p>• <strong>历史备份恢复</strong>：从已创建的备份历史中选择恢复</p>
              <p>• 支持恢复数据库表结构和数据</p>
              <p>• 支持恢复存储桶中的文件</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-800 mb-2">注意事项：</h4>
              <p>• 建议定期进行完整备份，使用增量备份节省空间</p>
              <p>• 增量备份需要与基础备份合并才能完整恢复</p>
              <p>• 备份和恢复过程中请勿关闭浏览器或刷新页面</p>
              <p>• 恢复操作会覆盖现有数据，请谨慎操作</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
