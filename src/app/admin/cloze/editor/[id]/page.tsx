"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ClozeEditorPage(){
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState('');
  const [blanksText, setBlanksText] = useState<string>('');

  useEffect(()=>{ (async()=>{
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/cloze/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      const text = await r.text();
      let j: any = null; try { j = JSON.parse(text); } catch {}
      if (!r.ok) throw new Error(j?.error || text || r.statusText);
      const d = j?.draft ?? j;
      setDraft(d);
      try { setBlanksText(JSON.stringify(d?.blanks ?? [], null, 2)); } catch { setBlanksText('[]'); }
    } catch (e:any) { setLog(e.message||String(e)); }
  })(); }, [id]);

  async function save(){
    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      let nextBlanks = draft.blanks;
      try { nextBlanks = JSON.parse(blanksText); } catch (e:any) { throw new Error('blanks 不是合法 JSON'); }
      const r = await fetch('/api/admin/cloze/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          id: draft.id,
          lang: draft.lang,
          level: draft.level,
          topic: draft.topic,
          title: draft.title,
          passage: draft.passage,
          blanks: nextBlanks,
          status: draft.status || 'draft',
          ai_provider: draft.ai_provider,
          ai_model: draft.ai_model,
          ai_usage: draft.ai_usage
        })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);
      setLog('已保存');
    } catch (e:any) {
      setLog('保存失败：' + (e.message||String(e)));
    } finally { setSaving(false); }
  }

  async function publish(){
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/cloze/publish', {
        method: 'POST', headers: { 'Content-Type':'application/json', ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ draftId: id })
      });
      if (!r.ok) throw new Error(await r.text());
      router.push('/admin/cloze/drafts');
    } catch (e:any) {
      setLog('发布失败：' + (e.message||String(e)));
    }
  }

  if (!draft) return <div className="p-6">加载中… {log && <span className="text-red-600">{log}</span>}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cloze 草稿编辑器</h1>
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-sm text-gray-600">语言</div>
            <input disabled className="w-full border rounded px-2 py-1 bg-gray-50" value={draft.lang} />
          </div>
          <div>
            <div className="text-sm text-gray-600">难度</div>
            <input disabled className="w-full border rounded px-2 py-1 bg-gray-50" value={`L${draft.level}`} />
          </div>
          <div>
            <div className="text-sm text-gray-600">状态</div>
            <select className="w-full border rounded px-2 py-1" value={draft.status||'draft'} onChange={e=> setDraft({ ...draft, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="needs_fix">needs_fix</option>
              <option value="approved">approved</option>
            </select>
          </div>
          <div>
            <div className="text-sm text-gray-600">主题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.topic||''} onChange={e=> setDraft({ ...draft, topic: e.target.value })} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-gray-600">标题</div>
            <input className="w-full border rounded px-2 py-1" value={draft.title||''} onChange={e=> setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <div className="text-sm text-gray-600">提供商/模型</div>
            <input className="w-full border rounded px-2 py-1" value={`${draft.ai_provider||''}${draft.ai_model? ' / '+draft.ai_model : ''}`} disabled />
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600">正文（含 {'{{1}}'} 等占位）</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono" rows={10} value={draft.passage||''} onChange={e=> setDraft({ ...draft, passage: e.target.value })} />
        </div>

        <div>
          <div className="text-sm text-gray-600">blanks JSON</div>
          <textarea className="w-full border rounded px-2 py-1 font-mono" rows={16} value={blanksText} onChange={e=> setBlanksText(e.target.value)} />
        </div>

        <div className="flex gap-2 items-center">
          <button className="px-4 py-2 rounded bg-blue-600 text-white" onClick={save} disabled={saving}>保存</button>
          <button className="px-4 py-2 rounded border" onClick={publish}>发布</button>
          <div className="text-sm text-gray-500">{log}</div>
        </div>
      </div>
    </div>
  );
}


