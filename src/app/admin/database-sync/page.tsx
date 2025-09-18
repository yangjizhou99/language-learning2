'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface SyncResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  message: string;
  duration: number;
  errors?: string[];
  localRows?: number;
  remoteRows?: number;
  progress?: number;
}

interface SyncSummary {
  total: number;
  successful: number;
  failed: number;
  totalRows: number;
  duration?: number;
}

interface SyncResponse {
  success: boolean;
  action: string;
  tables: string[];
  results: SyncResult[];
  summary: SyncSummary;
  error?: string;
  details?: string;
}

interface ConnectionTestResult {
  name: string;
  success: boolean;
  version?: string;
  tableCount?: number;
  error?: string;
  duration: number;
}

interface TableComparison {
  localTables: string[];
  prodTables: string[];
  common: string[];
  onlyInLocal: string[];
  onlyInProd: string[];
}

interface ConnectionTestResponse {
  success: boolean;
  connections: ConnectionTestResult[];
  tableComparison?: TableComparison;
  summary: {
    allConnected: boolean;
    localConnected: boolean;
    prodConnected: boolean;
    totalTables: number;
    prodTables: number;
  };
  error?: string;
  details?: string;
}

export default function DatabaseSyncPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [envConfig, setEnvConfig] = useState<any>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResponse | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [useAdvancedSync, setUseAdvancedSync] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ [tableName: string]: number }>({});
  const [currentSyncTable, setCurrentSyncTable] = useState<string | null>(null);

  // 检查环境变量配置
  useEffect(() => {
    checkEnvConfig();
    checkUserAuth();
  }, []);

  // 检查用户认证状态
  const checkUserAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        // 检查用户是否为管理员
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();
        
        setIsAdmin(profile?.role === 'admin');
      }
    } catch (error) {
      console.error('检查用户认证失败:', error);
    }
  };

  // 获取认证头
  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    return headers;
  };

  const checkEnvConfig = async () => {
    try {
      const response = await fetch('/api/admin/question-bank/env-config');
      const data = await response.json();
      setEnvConfig(data.config);
      
      if (data.config.localDbUrl && data.config.prodDbUrl) {
        loadTables();
      }
    } catch (err) {
      console.error('检查环境配置失败:', err);
    }
  };

  const loadTables = async () => {
    try {
      const response = await fetch('/api/admin/database/sync?action=preview');
      const data = await response.json();
      
      if (data.success) {
        setTables(data.tables);
        setSelectedTables(data.tables); // 默认选择所有表
      } else {
        setError(data.details || '加载表列表失败');
      }
    } catch (err) {
      console.error('加载表列表失败:', err);
      setError('加载表列表失败');
    }
  };

  const handleTableToggle = (tableName: string) => {
    setSelectedTables(prev => 
      prev.includes(tableName) 
        ? prev.filter(t => t !== tableName)
        : [...prev, tableName]
    );
  };

  const handleSelectAll = () => {
    setSelectedTables(tables);
  };

  const handleSelectNone = () => {
    setSelectedTables([]);
  };

  const previewSync = async () => {
    if (!isAdmin) {
      setError('需要管理员权限才能执行此操作');
      return;
    }

    if (selectedTables.length === 0) {
      setError('请选择要同步的表');
      return;
    }

    setLoading(true);
    setError(null);
    setSyncResults(null);

    try {
      const headers = await getAuthHeaders();
      const apiEndpoint = useAdvancedSync ? '/api/admin/database/sync-advanced' : '/api/admin/database/sync';
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'preview',
          tables: selectedTables
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSyncResults(data);
      } else {
        setError(data.details || '预览失败');
      }
    } catch (err) {
      console.error('预览失败:', err);
      setError('预览失败');
    } finally {
      setLoading(false);
    }
  };

  const executeSync = async () => {
    if (!isAdmin) {
      setError('需要管理员权限才能执行此操作');
      return;
    }

    if (selectedTables.length === 0) {
      setError('请选择要同步的表');
      return;
    }

    const confirmMessage = useAdvancedSync 
      ? '⚠️ 警告: 这将使用高级同步模式清空云端数据库中的选定表并覆盖为本地数据!\n\n高级模式会：\n- 自动处理外键约束\n- 修复JSON数据格式\n- 跳过有问题的数据行\n\n请确保您已经备份了云端数据库的重要数据。\n\n确定要继续吗？'
      : '⚠️ 警告: 这将清空云端数据库中的选定表并覆盖为本地数据!\n\n请确保您已经备份了云端数据库的重要数据。\n\n确定要继续吗？';

    if (!confirm(confirmMessage)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSyncResults(null);
    setSyncProgress({});
    setCurrentSyncTable(null);

    try {
      const headers = await getAuthHeaders();
      const apiEndpoint = useAdvancedSync ? '/api/admin/database/sync-advanced' : '/api/admin/database/sync';
      
      // 模拟进度更新（因为API不支持实时进度回调）
      let currentTableIndex = 0;
      const progressInterval = setInterval(() => {
        if (currentTableIndex < selectedTables.length) {
          const currentTable = selectedTables[currentTableIndex];
          setCurrentSyncTable(currentTable);
          setSyncProgress(prev => ({
            ...prev,
            [currentTable]: Math.min(100, (currentTableIndex + 1) * 100 / selectedTables.length)
          }));
          currentTableIndex++;
        } else {
          clearInterval(progressInterval);
        }
      }, 1000);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'sync',
          tables: selectedTables
        }),
      });

      const data = await response.json();
      
      // 清除进度更新
      clearInterval(progressInterval);
      setCurrentSyncTable(null);
      setSyncProgress({});
      
      if (data.success) {
        setSyncResults(data);
      } else {
        setError(data.details || '同步失败');
      }
    } catch (err) {
      console.error('同步失败:', err);
      setError('同步失败');
    } finally {
      setLoading(false);
    }
  };

  const testConnections = async () => {
    if (!isAdmin) {
      setError('需要管理员权限才能执行此操作');
      return;
    }

    setTestingConnection(true);
    setError(null);
    setConnectionTest(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/database/test-connection', {
        method: 'GET',
        headers,
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionTest(data);
        // 如果连接成功，更新表列表
        if (data.summary.allConnected && data.tableComparison) {
          setTables(data.tableComparison.localTables);
          setSelectedTables(data.tableComparison.localTables);
        }
      } else {
        setError(data.details || '连接测试失败');
      }
    } catch (err) {
      console.error('连接测试失败:', err);
      setError('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  // 进度条组件
  const ProgressBar = ({ progress, label }: { progress: number; label: string }) => (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">数据库同步管理</h1>
            <p className="mt-1 text-sm text-gray-600">
              将本地数据库数据覆盖到云端数据库
            </p>
          </div>

          <div className="p-6">
            {/* 权限检查 */}
            {!isAdmin && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-red-400">❌</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">权限不足</h3>
                    <div className="mt-2 text-sm text-red-700">
                      您需要管理员权限才能使用数据库同步功能。请使用管理员账户登录。
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 环境配置检查 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium text-gray-900">环境配置检查</h2>
                <button
                  onClick={testConnections}
                  disabled={testingConnection || !envConfig?.localDbUrl || !envConfig?.prodDbUrl || !isAdmin}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingConnection ? '🔍 测试中...' : '🔍 检查连接'}
                </button>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">本地数据库</label>
                    <div className={`mt-1 text-sm ${envConfig?.localDbUrl ? 'text-green-600' : 'text-red-600'}`}>
                      {envConfig?.localDbUrl ? '✅ 已配置' : '❌ 未配置'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">云端数据库</label>
                    <div className={`mt-1 text-sm ${envConfig?.prodDbUrl ? 'text-green-600' : 'text-red-600'}`}>
                      {envConfig?.prodDbUrl ? '✅ 已配置' : '❌ 未配置'}
                    </div>
                  </div>
                </div>
                {(!envConfig?.localDbUrl || !envConfig?.prodDbUrl) && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      请在 .env.local 文件中设置 LOCAL_DB_URL 和 PROD_DB_URL 环境变量
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 表选择 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium text-gray-900">选择要同步的表</h2>
                <div className="space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    全选
                  </button>
                  <button
                    onClick={handleSelectNone}
                    className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    全不选
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                {tables.map(tableName => (
                  <label key={tableName} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTables.includes(tableName)}
                      onChange={() => handleTableToggle(tableName)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{tableName}</span>
                  </label>
                ))}
              </div>
              
              <div className="mt-2 text-sm text-gray-600">
                已选择 {selectedTables.length} 个表
              </div>
            </div>

            {/* 同步选项 */}
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-3">同步选项</h2>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={useAdvancedSync}
                      onChange={(e) => setUseAdvancedSync(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">使用高级同步模式</span>
                  </label>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {useAdvancedSync ? (
                    <div>
                      <p className="text-green-700">✅ 高级模式已启用</p>
                      <ul className="mt-1 list-disc list-inside text-green-600">
                        <li>自动处理外键约束问题</li>
                        <li>修复JSON数据格式错误</li>
                        <li>跳过有问题的数据行</li>
                        <li>按依赖关系排序同步表</li>
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <p className="text-yellow-700">⚠️ 标准模式</p>
                      <p>如果遇到外键约束或JSON格式错误，建议启用高级模式</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={previewSync}
                  disabled={loading || selectedTables.length === 0 || !isAdmin}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '预览中...' : '🔍 预览同步'}
                </button>
                <button
                  onClick={executeSync}
                  disabled={loading || selectedTables.length === 0 || !isAdmin}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '同步中...' : '🚀 执行同步'}
                </button>
                <button
                  onClick={() => router.back()}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  返回
                </button>
              </div>
            </div>

            {/* 错误信息 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-red-400">❌</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">错误</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 连接测试结果 */}
            {connectionTest && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-3">连接测试结果</h2>
                
                {/* 连接状态摘要 */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className={`text-2xl font-bold ${connectionTest.summary.allConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {connectionTest.summary.allConnected ? '✅' : '❌'}
                      </div>
                      <div className="text-sm text-gray-600">总体状态</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${connectionTest.summary.localConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {connectionTest.summary.localConnected ? '✅' : '❌'}
                      </div>
                      <div className="text-sm text-gray-600">本地连接</div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${connectionTest.summary.prodConnected ? 'text-green-600' : 'text-red-600'}`}>
                        {connectionTest.summary.prodConnected ? '✅' : '❌'}
                      </div>
                      <div className="text-sm text-gray-600">云端连接</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{connectionTest.summary.totalTables}</div>
                      <div className="text-sm text-gray-600">本地表数</div>
                    </div>
                  </div>
                </div>

                {/* 详细连接信息 */}
                <div className="space-y-4">
                  {connectionTest.connections.map((conn, index) => (
                    <div key={index} className={`p-4 rounded-lg border ${
                      conn.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium ${conn.success ? 'text-green-800' : 'text-red-800'}`}>
                          {conn.name} 数据库
                        </h3>
                        <span className={`text-sm ${conn.success ? 'text-green-600' : 'text-red-600'}`}>
                          {conn.success ? '✅ 连接成功' : '❌ 连接失败'}
                        </span>
                      </div>
                      
                      {conn.success ? (
                        <div className="mt-2 space-y-1 text-sm text-green-700">
                          <div>版本: {conn.version}</div>
                          <div>表数量: {conn.tableCount}</div>
                          <div>响应时间: {formatDuration(conn.duration)}</div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-red-700">
                          错误: {conn.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 表结构比较 */}
                {connectionTest.tableComparison && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">表结构比较</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-medium text-blue-800 mb-2">共同表 ({connectionTest.tableComparison.common.length})</h4>
                        <div className="text-sm text-blue-700 max-h-32 overflow-y-auto">
                          {connectionTest.tableComparison.common.map(table => (
                            <div key={table}>• {table}</div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">仅在本地 ({connectionTest.tableComparison.onlyInLocal.length})</h4>
                        <div className="text-sm text-yellow-700 max-h-32 overflow-y-auto">
                          {connectionTest.tableComparison.onlyInLocal.map(table => (
                            <div key={table}>• {table}</div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="font-medium text-orange-800 mb-2">仅在云端 ({connectionTest.tableComparison.onlyInProd.length})</h4>
                        <div className="text-sm text-orange-700 max-h-32 overflow-y-auto">
                          {connectionTest.tableComparison.onlyInProd.map(table => (
                            <div key={table}>• {table}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 同步进度 */}
            {loading && currentSyncTable && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-3">同步进度</h2>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">正在同步表: </span>
                    <span className="font-medium text-blue-900">{currentSyncTable}</span>
                  </div>
                  <ProgressBar 
                    progress={syncProgress[currentSyncTable] || 0} 
                    label="同步进度" 
                  />
                </div>
              </div>
            )}

            {/* 同步结果 */}
            {syncResults && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-gray-900 mb-3">
                  {syncResults.action === 'preview' ? '预览结果' : '同步结果'}
                </h2>
                
                {/* 摘要信息 */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{syncResults.summary.total}</div>
                      <div className="text-sm text-gray-600">总表数</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{syncResults.summary.successful}</div>
                      <div className="text-sm text-gray-600">成功</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-600">{syncResults.summary.failed}</div>
                      <div className="text-sm text-gray-600">失败</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{formatNumber(syncResults.summary.totalRows)}</div>
                      <div className="text-sm text-gray-600">总行数</div>
                    </div>
                  </div>
                  {syncResults.summary.duration && (
                    <div className="mt-4 text-sm text-gray-600">
                      总耗时: {formatDuration(syncResults.summary.duration)}
                    </div>
                  )}
                </div>

                {/* 详细结果 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          表名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          状态
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          行数对比
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          耗时
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          消息
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          错误详情
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {syncResults.results.map((result, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {result.table}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              result.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.success ? '✅ 成功' : '❌ 失败'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {result.localRows !== undefined && result.remoteRows !== undefined ? (
                              <div className="flex flex-col">
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-600">本地:</span>
                                  <span className="font-medium">{formatNumber(result.localRows)}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-600">远程:</span>
                                  <span className={`font-medium ${result.localRows === result.remoteRows ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatNumber(result.remoteRows)}
                                  </span>
                                </div>
                                {result.localRows !== result.remoteRows && (
                                  <div className="text-xs text-red-500 mt-1">
                                    行数不匹配
                                  </div>
                                )}
                              </div>
                            ) : (
                              formatNumber(result.rowsProcessed)
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDuration(result.duration)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {result.message}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {result.errors && result.errors.length > 0 ? (
                              <div className="max-w-xs">
                                <details className="cursor-pointer">
                                  <summary className="text-red-600 hover:text-red-800">
                                    查看错误 ({result.errors.length})
                                  </summary>
                                  <div className="mt-2 text-xs text-red-700 bg-red-50 p-2 rounded">
                                    {result.errors.map((error, i) => (
                                      <div key={i} className="mb-1">{error}</div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
