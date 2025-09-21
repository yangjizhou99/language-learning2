'use client';
import { useEffect, useState } from 'react';

async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  // @ts-ignore
  if (!window.showDirectoryPicker) { 
    alert('当前浏览器不支持选择文件夹'); 
    return null; 
  }
  // @ts-ignore
  const dir = await window.showDirectoryPicker();
  return dir;
}

export default function BackupPage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [log, setLog] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function loadTables(preset: 'prod'|'dev' = 'prod') {
    setBusy(true);
    setLog('加载表清单...');
    try {
      const r = await fetch(`/api/backup/db/tables?connPreset=${preset}`);
      const j = await r.json();
      setTables(j.tables || []);
      setSelected([]);
      setLog('已加载 ' + (j.tables?.length || 0) + ' 张表');
    } catch (error) {
      setLog('加载失败: ' + error);
    }
    setBusy(false);
  }

  async function backupToNAS(preset: 'prod'|'dev' = 'prod') {
    setBusy(true);
    setLog('开始备份到 NAS...');
    try {
      const r = await fetch('/api/backup/db/backup', {
        method: 'POST', 
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          connPreset: preset, 
          tables: selected, 
          format: 'custom', 
          compress: 'zstd', 
          target: 'nas' 
        })
      });
      const j = await r.json();
      setJobId(j.jobId || '');
      setLog('已下发任务，Job ID: ' + (j.jobId || ''));
      pollStatus(j.jobId);
    } catch (error) {
      setLog('备份失败: ' + error);
      setBusy(false);
    }
  }

  async function backupToLocal(preset: 'prod'|'dev' = 'prod') {
    // @ts-ignore
    const dir = await pickDirectory(); 
    if (!dir) return;
    
    setBusy(true);
    setLog('NAS 生成备份中...');
    try {
      const r = await fetch('/api/backup/db/backup', {
        method: 'POST', 
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          connPreset: preset, 
          tables: selected, 
          format: 'custom', 
          compress: 'zstd', 
          target: 'download' 
        })
      });
      const j = await r.json();
      setJobId(j.jobId || '');

      let ok = false; 
      let tries = 0;
      while (tries++ < 240) {
        const s = await fetch(`/api/backup/jobs/${j.jobId}/status`);
        const sj = await s.json();
        setLog((sj.logTail||'').slice(-4000));
        if (sj.status === 'succeeded') { ok = true; break; }
        if (sj.status === 'failed') break;
        await new Promise(r => setTimeout(r, 5000));
      }
      if (!ok) { 
        setBusy(false); 
        alert('备份失败或超时'); 
        return; 
      }

      const resp = await fetch(`/api/backup/jobs/${j.jobId}/download`);
      // @ts-ignore
      const fileHandle = await dir.getFileHandle(
        `db_${new Date().toISOString().replace(/[:T]/g,'-').slice(0,19)}.dump.zst`, 
        { create: true }
      );
      // @ts-ignore
      const writable = await fileHandle.createWritable();
      // @ts-ignore
      const reader = resp.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        await writable.write(value);
      }
      await writable.close();
      setBusy(false);
      setLog('已保存到本地目录');
    } catch (error) {
      setLog('备份失败: ' + error);
      setBusy(false);
    }
  }

  async function restoreFromLocalToProd() {
    try {
      // @ts-ignore
      const [fh] = await window.showOpenFilePicker({ multiple: false });
      // @ts-ignore
      const file = await fh.getFile();
      const form = new FormData();
      form.append('file', file);
      form.append('conn', '');
      
      const r = await fetch('/api/backup/db/restore?connPreset=prod', { 
        method: 'POST', 
        body: form 
      });
      const j = await r.json();
      setJobId(j.jobId || '');
      setLog('已下发恢复任务，Job ID: ' + (j.jobId || ''));
      pollStatus(j.jobId);
    } catch (error) {
      setLog('恢复失败: ' + error);
    }
  }

  async function pollStatus(id: string) {
    if (!id) return;
    for (let i=0;i<360;i++) {
      try {
        const r = await fetch(`/api/backup/jobs/${id}/status`);
        const j = await r.json();
        setLog((j.logTail||'').slice(-4000));
        if (j.status === 'succeeded' || j.status === 'failed') break;
        await new Promise(r => setTimeout(r, 5000));
      } catch (error) {
        setLog('状态查询失败: ' + error);
        break;
      }
    }
    setBusy(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">备份中心</h1>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">数据库连接</h2>
          <div className="flex gap-2">
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" 
              onClick={() => loadTables('prod')} 
              disabled={busy}
            >
              加载生产库表
            </button>
            <button 
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50" 
              onClick={() => loadTables('dev')} 
              disabled={busy}
            >
              加载开发库表
            </button>
          </div>
        </div>

        {tables.length > 0 && (
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-semibold mb-4">表选择</h2>
            <p className="text-sm text-gray-600 mb-4">
              共 {tables.length} 张表，点击选择（再次点击取消）：
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-auto border p-2 rounded">
              {tables.map(t => (
                <button 
                  key={t}
                  className={`text-left px-2 py-1 rounded border ${
                    selected.includes(t) 
                      ? 'bg-blue-100 border-blue-400' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelected(s => 
                    s.includes(t) ? s.filter(x=>x!==t) : [...s, t]
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <button 
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setSelected(tables)}
              >
                全选
              </button>
              <span className="mx-2">|</span>
              <button 
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setSelected([])}
              >
                清空
              </button>
              <span className="ml-4 text-sm text-gray-600">
                已选择 {selected.length} 张表
              </span>
            </div>
          </div>
        )}

        {selected.length > 0 && (
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-semibold mb-4">备份操作</h2>
            <div className="flex flex-wrap gap-2">
              <button 
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50" 
                onClick={() => backupToNAS('prod')} 
                disabled={busy}
              >
                生产库 → NAS 备份
              </button>
              <button 
                className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50" 
                onClick={() => backupToLocal('prod')} 
                disabled={busy}
              >
                生产库 → 本地文件夹
              </button>
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50" 
                onClick={restoreFromLocalToProd} 
                disabled={busy}
              >
                从本地文件 → 恢复到生产
              </button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h2 className="text-xl font-semibold mb-4">日志 / 进度</h2>
          <div className="mb-2">
            <span className="text-sm text-gray-600">
              Job ID: {jobId || '-'}
            </span>
            {busy && <span className="ml-4 text-sm text-blue-600">🔄 处理中...</span>}
          </div>
          <pre className="text-xs bg-black text-green-200 p-3 rounded min-h-40 max-h-64 overflow-auto whitespace-pre-wrap">
            {log || '等待操作...'}
          </pre>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">💡 使用说明</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 首先点击"加载生产库表"或"加载开发库表"来获取数据库表列表</li>
            <li>• 选择需要备份的表（可以全选或手动选择）</li>
            <li>• 选择备份方式：NAS备份或本地下载</li>
            <li>• 恢复功能支持从本地备份文件恢复到生产数据库</li>
          </ul>
        </div>
      </div>
    </div>
  );
}