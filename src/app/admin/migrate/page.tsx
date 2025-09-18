'use client';
import { useState } from 'react';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';

export default function MigratePage() {
  const [table, setTable] = useState('your_table');
  const [columns, setColumns] = useState('');      // 为空=全列
  const [where, setWhere] = useState('');          // e.g. "created_at >= '2025-09-01'"
  const [mode, setMode] = useState<'insert'|'upsert'>('insert');
  const [conflictKeys, setConflictKeys] = useState('id'); // upsert 时必填
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);

  async function preview() {
    setLoading(true);
    try {
      const url = `/api/migrate/preview?table=${encodeURIComponent(table)}&where=${encodeURIComponent(where)}&limit=20`;
      const r = await fetch(url);
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (error) {
      setLog(`预览失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  async function run() {
    setLoading(true);
    setLog('正在迁移...');
    try {
      const r = await fetch('/api/migrate', {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify({ table, columns, where, mode, conflictKeys })
      });
      const j = await r.json();
      setLog(JSON.stringify(j, null, 2));
    } catch (error) {
      setLog(`迁移失败: ${error}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container>
      <Breadcrumbs items={[
        { label: '管理后台', href: '/admin' },
        { label: '数据迁移', href: '/admin/migrate' }
      ]} />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">数据迁移</h1>
          <p className="text-gray-600">从本地数据库高速迁移数据到云端数据库</p>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">表名（public 下）</label>
              <input 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={table} 
                onChange={e=>setTable(e.target.value)} 
                placeholder="例如: users, articles, drafts"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">列（留空=全列，逗号分隔）</label>
              <input 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={columns} 
                onChange={e=>setColumns(e.target.value)} 
                placeholder="例如: id,name,created_at"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">本地筛选 WHERE（可空）</label>
              <input 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={where} 
                onChange={e=>setWhere(e.target.value)} 
                placeholder="例如: created_at >= '2025-01-01'"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">模式</label>
              <select 
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={mode} 
                onChange={e=>setMode(e.target.value as any)}
              >
                <option value="insert">insert（冲突报错）</option>
                <option value="upsert">upsert（需冲突键）</option>
              </select>
            </div>
            
            {mode === 'upsert' && (
              <div>
                <label className="block text-sm font-medium mb-2">冲突键（逗号分隔）</label>
                <input 
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={conflictKeys} 
                  onChange={e=>setConflictKeys(e.target.value)} 
                  placeholder="例如: id 或 id,code"
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={preview} 
              disabled={loading}
              variant="outline"
            >
              {loading ? '预览中...' : '预览前20行/总数'}
            </Button>
            <Button 
              onClick={run} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? '迁移中...' : '开始迁移'}
            </Button>
          </div>
        </div>

        {log && (
          <div className="bg-gray-50 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-2">执行结果</h3>
            <pre className="text-sm overflow-auto whitespace-pre-wrap bg-white p-3 rounded border">{log}</pre>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">重要提示</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>• 此功能仅建议在本地开发环境使用</p>
                <p>• Vercel Serverless 不适合长时间 COPY 流式迁移</p>
                <p>• 迁移前请确保已正确配置环境变量</p>
                <p>• 建议先使用预览功能确认数据正确性</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
