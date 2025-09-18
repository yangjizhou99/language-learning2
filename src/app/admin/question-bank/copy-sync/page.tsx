"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Database, 
  ArrowRight, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock,
  Zap
} from "lucide-react";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

interface SyncResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  duration: number;
  error?: string;
}

export default function CopySyncPage() {
  const [sourceConfig, setSourceConfig] = useState<DatabaseConfig>({
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl: true
  });

  const [targetConfig, setTargetConfig] = useState<DatabaseConfig>({
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl: true
  });

  const [selectedTables, setSelectedTables] = useState<Record<string, boolean>>({
    'shadowing_items': true,
    'cloze_items': true,
    'alignment_packs': true
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncSummary, setSyncSummary] = useState<any>(null);

  const tableOptions = [
    { name: 'shadowing_items', label: '跟读练习题库', description: '包含音频URL、文本内容等' },
    { name: 'cloze_items', label: '完形填空题库', description: '包含文章、空白位置等' },
    { name: 'alignment_packs', label: '对齐练习包', description: '包含多步骤训练内容' }
  ];

  const handleTableToggle = (tableName: string) => {
    setSelectedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  const handleSync = async () => {
    const selectedTableNames = Object.keys(selectedTables).filter(name => selectedTables[name]);
    
    if (selectedTableNames.length === 0) {
      toast.error('请至少选择一个表进行同步');
      return;
    }

    setIsSyncing(true);
    setSyncResults([]);
    setSyncSummary(null);

    try {
      const response = await fetch('/api/admin/question-bank/copy-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceConfig,
          targetConfig,
          tables: selectedTableNames,
          options: {
            batchSize: 1000
          }
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSyncResults(data.results);
        setSyncSummary(data.summary);
        toast.success(data.message);
      } else {
        toast.error(data.error || '同步失败');
      }
    } catch (error) {
      console.error('同步错误:', error);
      toast.error('同步失败，请检查网络连接');
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Zap className="w-6 h-6" />
          PostgreSQL COPY 流式同步
        </h1>
        <p className="text-gray-600">
          使用PostgreSQL COPY协议进行高效的数据流式传输，适合大量数据的同步
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 源数据库配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              源数据库 (本地)
            </CardTitle>
            <CardDescription>
              配置本地开发数据库连接信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="source-host">主机地址</Label>
                <Input
                  id="source-host"
                  placeholder="localhost"
                  value={sourceConfig.host}
                  onChange={(e) => setSourceConfig(prev => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="source-port">端口</Label>
                <Input
                  id="source-port"
                  type="number"
                  placeholder="5432"
                  value={sourceConfig.port}
                  onChange={(e) => setSourceConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 5432 }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="source-database">数据库名</Label>
              <Input
                id="source-database"
                placeholder="local_db"
                value={sourceConfig.database}
                onChange={(e) => setSourceConfig(prev => ({ ...prev, database: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="source-username">用户名</Label>
                <Input
                  id="source-username"
                  placeholder="postgres"
                  value={sourceConfig.username}
                  onChange={(e) => setSourceConfig(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="source-password">密码</Label>
                <Input
                  id="source-password"
                  type="password"
                  placeholder="password"
                  value={sourceConfig.password}
                  onChange={(e) => setSourceConfig(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="source-ssl"
                checked={sourceConfig.ssl}
                onCheckedChange={(checked) => setSourceConfig(prev => ({ ...prev, ssl: checked as boolean }))}
              />
              <Label htmlFor="source-ssl">启用SSL</Label>
            </div>
          </CardContent>
        </Card>

        {/* 目标数据库配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              目标数据库 (远程)
            </CardTitle>
            <CardDescription>
              配置远程生产数据库连接信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="target-host">主机地址</Label>
                <Input
                  id="target-host"
                  placeholder="db.example.com"
                  value={targetConfig.host}
                  onChange={(e) => setTargetConfig(prev => ({ ...prev, host: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="target-port">端口</Label>
                <Input
                  id="target-port"
                  type="number"
                  placeholder="5432"
                  value={targetConfig.port}
                  onChange={(e) => setTargetConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 5432 }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="target-database">数据库名</Label>
              <Input
                id="target-database"
                placeholder="production_db"
                value={targetConfig.database}
                onChange={(e) => setTargetConfig(prev => ({ ...prev, database: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="target-username">用户名</Label>
                <Input
                  id="target-username"
                  placeholder="postgres"
                  value={targetConfig.username}
                  onChange={(e) => setTargetConfig(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="target-password">密码</Label>
                <Input
                  id="target-password"
                  type="password"
                  placeholder="password"
                  value={targetConfig.password}
                  onChange={(e) => setTargetConfig(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="target-ssl"
                checked={targetConfig.ssl}
                onCheckedChange={(checked) => setTargetConfig(prev => ({ ...prev, ssl: checked as boolean }))}
              />
              <Label htmlFor="target-ssl">启用SSL</Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 表选择 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>选择要同步的表</CardTitle>
          <CardDescription>
            选择需要从源数据库同步到目标数据库的表
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tableOptions.map((table) => (
              <div key={table.name} className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox
                  id={table.name}
                  checked={selectedTables[table.name] || false}
                  onCheckedChange={() => handleTableToggle(table.name)}
                />
                <div className="flex-1">
                  <Label htmlFor={table.name} className="font-medium">
                    {table.label}
                  </Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {table.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 同步按钮 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">开始同步</h3>
              <p className="text-sm text-gray-600">
                将选中的表从源数据库同步到目标数据库
              </p>
            </div>
            <Button 
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSyncing ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  同步中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  开始同步
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 同步结果 */}
      {syncResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              同步结果
            </CardTitle>
            {syncSummary && (
              <CardDescription>
                总计处理 {formatNumber(syncSummary.totalRows)} 行数据，
                成功 {syncSummary.successTables} 个表，
                耗时 {syncSummary.totalDuration}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {syncResults.map((result) => (
                <div key={result.table} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <h4 className="font-medium">{result.table}</h4>
                      {result.error && (
                        <p className="text-sm text-red-600 mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "成功" : "失败"}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {formatNumber(result.rowsProcessed)} 行
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDuration(result.duration)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

