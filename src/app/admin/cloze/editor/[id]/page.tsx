'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function ClozeEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState('');
  const [blanksText, setBlanksText] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const r = await fetch(`/api/admin/cloze/drafts/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const text = await r.text();
        let j: any = null;
        try {
          j = JSON.parse(text);
        } catch {}
        if (!r.ok) throw new Error(j?.error || text || r.statusText);
        const d = j?.draft ?? j;
        setDraft(d);
        try {
          setBlanksText(JSON.stringify(d?.blanks ?? [], null, 2));
        } catch {
          setBlanksText('[]');
        }
      } catch (e: any) {
        setLog(e.message || String(e));
      }
    })();
  }, [id]);

  async function save() {
    try {
      setSaving(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      let nextBlanks = draft.blanks;
      try {
        nextBlanks = JSON.parse(blanksText);
      } catch (e: any) {
        throw new Error('blanks 不是合法 JSON');
      }
      const r = await fetch('/api/admin/cloze/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
          ai_usage: draft.ai_usage,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);
      setLog('已保存');
    } catch (e: any) {
      setLog('保存失败：' + (e.message || String(e)));
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/cloze/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ draftId: id }),
      });
      if (!r.ok) throw new Error(await r.text());
      router.push('/admin/cloze/drafts');
    } catch (e: any) {
      setLog('发布失败：' + (e.message || String(e)));
    }
  }

  if (!draft)
    return <div className="p-6">加载中… {log && <span className="text-red-600">{log}</span>}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cloze 草稿编辑器</h1>
      <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>语言</Label>
            <Input disabled value={draft.lang} />
          </div>
          <div>
            <Label>难度</Label>
            <Input disabled value={`L${draft.level}`} />
          </div>
          <div>
            <Label>状态</Label>
            <Select
              value={draft.status || 'draft'}
              onValueChange={(v) => setDraft({ ...draft, status: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">draft</SelectItem>
                <SelectItem value="needs_fix">needs_fix</SelectItem>
                <SelectItem value="approved">approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>主题</Label>
            <Input
              value={draft.topic || ''}
              onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>标题</Label>
            <Input
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </div>
          <div>
            <Label>提供商/模型</Label>
            <Input
              value={`${draft.ai_provider || ''}${draft.ai_model ? ' / ' + draft.ai_model : ''}`}
              disabled
            />
          </div>
        </div>

        <div>
          <Label>正文（含 {'{{1}}'} 等占位）</Label>
          <Textarea
            className="font-mono"
            rows={10}
            value={draft.passage || ''}
            onChange={(e) => setDraft({ ...draft, passage: e.target.value })}
          />
        </div>

        <div>
          <Label>blanks JSON</Label>
          <Textarea
            className="font-mono"
            rows={16}
            value={blanksText}
            onChange={(e) => setBlanksText(e.target.value)}
          />
        </div>

        <div className="flex gap-2 items-center">
          <Button onClick={save} disabled={saving}>
            保存
          </Button>
          <Button variant="outline" onClick={publish}>
            发布
          </Button>
          <div className="text-sm text-muted-foreground">{log}</div>
        </div>
      </div>
    </div>
  );
}
