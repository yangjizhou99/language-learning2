"use client";
export const dynamic = "force-dynamic";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Span = [number,number];
type KeyP1 = { span:Span; tag:"connective"|"time"; surface?:string };
type KeyP2 = { pron:Span; antecedents:Span[] };
type KeyP3 = { s:Span; v:Span; o:Span };
type Cloze = { start:number; end:number; answer:string; hint:string; type:string };

export default function DraftDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [d, setD] = useState<any>(null);
  const [log, setLog] = useState("");
  const [saving, setSaving] = useState(false);
  const [genMode, setGenMode] = useState<"ai"|"rule">("ai");
  const [provider, setProvider] = useState<"openrouter"|"deepseek"|"openai">("deepseek");
  const [models, setModels] = useState<{id:string;name:string}[]>([]);
  const [model, setModel] = useState<string>("");
  const [temp, setTemp] = useState(0.3);
  const [sug, setSug] = useState<any>(null);
  const [genLoading, setGenLoading] = useState(false);

  // 文本建议（不带索引）
  const [tProvider, setTProvider] = useState<"openrouter"|"deepseek"|"openai">("openrouter");
  const [tModels, setTModels] = useState<{id:string;name:string}[]>([]);
  const [tModel, setTModel] = useState<string>("");
  const [tTemp, setTTemp] = useState(0.3);
  const [textSug, setTextSug] = useState<any>(null);
  const [textGenLoading, setTextGenLoading] = useState(false);

  // 本地可编辑状态
  const [p1, setP1] = useState<KeyP1[]>([]);
  const [p2, setP2] = useState<KeyP2[]>([]);
  const [p3, setP3] = useState<KeyP3[]>([]);
  const [czShort, setCzShort] = useState<Cloze[]>([]);
  const [czLong, setCzLong] = useState<Cloze[]>([]);

  const load = async () => { 
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/drafts/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error((await r.json()).error||`HTTP ${r.status}`);
      const j = await r.json();
      setD(j);
      setP1(j?.keys?.pass1 || []);
      setP2(j?.keys?.pass2 || []);
      setP3(j?.keys?.pass3 || []);
      setCzShort(j?.cloze_short || []);
      setCzLong(j?.cloze_long || []);
    } catch (e:any) {
      setLog(`加载失败: ${e.message||e}`);
    }
  };
  useEffect(()=>{ load(); }, [id]);

  useEffect(()=>{ (async()=>{
    if (genMode!=="ai") { setModels([]); setModel(""); return; }
    if (provider==="openrouter") {
      try {
        const r = await fetch(`/api/ai/models?provider=${provider}`);
        const j = await r.json(); setModels(j||[]); setModel(j?.[0]?.id||"");
      } catch {}
    } else if (provider==="deepseek") {
      const j=[{id:"deepseek-chat",name:"deepseek-chat"},{id:"deepseek-reasoner",name:"deepseek-reasoner"}]; setModels(j); setModel(j[0].id);
    } else {
      const j=[{id:"gpt-4o-mini",name:"gpt-4o-mini"}]; setModels(j); setModel(j[0].id);
    }
  })(); }, [provider, genMode]);

  useEffect(()=>{ (async()=>{
    if (tProvider==="openrouter") {
      const r = await fetch(`/api/ai/models?provider=${tProvider}`); const j = await r.json();
      setTModels(j||[]); setTModel(j?.[0]?.id||"");
    } else if (tProvider==="deepseek") {
      const j=[{id:"deepseek-chat",name:"deepseek-chat"},{id:"deepseek-reasoner",name:"deepseek-reasoner"}];
      setTModels(j); setTModel(j[0].id);
    } else {
      const j=[{id:"gpt-4o-mini",name:"gpt-4o-mini"}];
      setTModels(j); setTModel(j[0].id);
    }
  })(); }, [tProvider]);

  const update = async (patch:any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/drafts/${id}`, { method:"PATCH", headers:{ "Content-Type":"application/json", ...(token?{ Authorization:`Bearer ${token}` }:{}) }, body: JSON.stringify(patch) });
      if (!r.ok) { const j = await r.json(); setLog(`更新失败: ${j.error}`); toast.error(`更新失败: ${j.error}`); return; }
      await load();
      setLog("更新成功");
      toast.success("更新成功");
    } catch (e:any) { setLog(`更新失败: ${e.message||e}`); }
  };

  const publish = async () => {
    try {
      setLog("发布中…");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/drafts/${id}/publish`, { method:"POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await r.json();
      setLog(r.ok ? `发布成功：article_id=${j.article_id}` : `失败：${j.error}`);
      if (r.ok) toast.success(`发布成功 (article_id=${j.article_id})`); else toast.error(`发布失败：${j.error}`);
    } catch (e:any) { setLog(`发布失败: ${e.message||e}`); }
  };

  if (!d) return (
    <main className="max-w-6xl mx-auto p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_,i)=>(<Skeleton key={i} className="h-24 w-full" />))}
      </div>
    </main>
  );

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">草稿详情（可视化校对）</h1>

      {/* 顶部基础信息 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <Input className="w-full font-medium text-lg" value={d.title}
          onChange={e=>setD({...d,title:e.target.value})} />
        <div className="text-xs text-gray-500">
          {d.lang} · {d.genre}/L{d.difficulty} · 状态：{d.status} · AI:{d.ai_provider||"-"} {d.ai_model||""}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>update({ title:d.title })}>保存标题</Button>
          <Button variant="outline" onClick={()=>update({ status:"approved" })}>标记为已审</Button>
          <Button variant="outline" onClick={()=>update({ status:"needs_fix" })}>需要修改</Button>
          <Button variant="outline" onClick={()=>update({ status:"rejected" })}>拒绝</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>发布 → 正式题库</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>确认发布</DialogTitle>
                <DialogDescription>发布后将进入正式题库，是否继续？</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">取消</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" onClick={publish}>确认发布</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {log && <pre className="text-sm p-2 bg-gray-50 rounded">{log}</pre>}
      </section>

      {/* 文本参考意见（不带索引） */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h3 className="font-medium">文本参考意见（AI 给文字提示，我来手工标注）</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={tProvider} onValueChange={(v: "openrouter"|"deepseek"|"openai")=>setTProvider(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="deepseek">DeepSeek</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tModel} onValueChange={(v)=>setTModel(v)}>
            <SelectTrigger className="min-w-[220px]"><SelectValue placeholder="选择模型" /></SelectTrigger>
            <SelectContent>
              {tModels.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label className="text-sm">温度</Label>
          <Input type="number" step={0.1} min={0} max={1} className="w-24" value={tTemp} onChange={e=>setTTemp(Number(e.target.value)||0.3)} />
          <Button
            onClick={async ()=>{
              setTextGenLoading(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const r = await fetch(`/api/admin/drafts/${id}/suggest-text`, {
                  method:"POST", headers:{ "Content-Type":"application/json", ...(token?{ Authorization:`Bearer ${token}` }:{} ) },
                  body: JSON.stringify({ provider: tProvider, model: tModel, temperature: tTemp })
                });
                const j = await r.json();
                setTextGenLoading(false);
                if (!r.ok) { setLog("文本建议失败：" + (j.error||r.statusText)); toast.error("文本建议失败：" + (j.error||r.statusText)); return; }
                setTextSug(j.suggestions);
                setLog(`AI 文本建议已生成。用量：PT=${j.usage.prompt_tokens}, CT=${j.usage.completion_tokens}, TT=${j.usage.total_tokens}`);
                toast.success("AI 文本建议已生成");
              } catch (e:any) {
                setTextGenLoading(false); setLog(`文本建议异常：${e.message||e}`); toast.error(`文本建议异常：${e.message||e}`);
              }
            }}
            >
            {textGenLoading ? "生成中…" : "生成文本建议"}
          </Button>
        </div>

        {textSug && (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Pass1（连接词/时间）</div>
              <div className="mb-2">
                <div className="text-xs text-gray-500">连接词</div>
                <ul className="list-disc pl-5">{(textSug.pass1_suggestions?.connectives||[]).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <div className="text-xs text-gray-500">时间表达</div>
                <ul className="list-disc pl-5">{(textSug.pass1_suggestions?.time||[]).map((s:string,i:number)=><li key={i}>{s}</li>)}</ul>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Pass2（指代→先行词 提示）</div>
              <ul className="list-disc pl-5">
                {(textSug.pass2_pairs||[]).map((p:any,i:number)=><li key={i}><b>{p.pronoun}</b> → {p.antecedent_hint}</li>)}
              </ul>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Pass3（三元组文字）</div>
              <ul className="list-disc pl-5">
                {(textSug.triples_text||[]).map((s:string,i:number)=><li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="p-3 bg-gray-50 rounded">
              <div className="font-medium mb-1">Cloze 候选短语</div>
              <ul className="list-disc pl-5">
                {(textSug.cloze_candidates||[]).map((c:any,i:number)=><li key={i}>{c.phrase} <span className="text-xs text-gray-500">({c.hint})</span></li>)}
              </ul>
            </div>
            <details className="md:col-span-2">
              <summary className="cursor-pointer">查看原始 JSON</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(textSug, null, 2)}</pre>
            </details>
          </div>
        )}
        {!textSug && <div className="text-xs text-gray-500">生成后，这里会显示一份“文字清单”。请参照清单，在下方的可视化标注器中手工框选标注。</div>}
      </section>

      {/* 生成答案（AI/规则） */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h3 className="font-medium">生成答案（在这里生成，再到下方编辑/合并）</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={genMode} onValueChange={(v: "ai"|"rule")=>setGenMode(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="生成方式" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ai">AI 建议</SelectItem>
              <SelectItem value="rule">规则提取（免费）</SelectItem>
            </SelectContent>
          </Select>
          {genMode==="ai" && (
            <>
              <Select value={provider} onValueChange={(v: "openrouter"|"deepseek"|"openai")=>setProvider(v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
              <Select value={model} onValueChange={(v)=>setModel(v)}>
                <SelectTrigger className="min-w-[220px]"><SelectValue placeholder="选择模型" /></SelectTrigger>
                <SelectContent>
                  {models.map(m=> <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Label className="text-sm">温度</Label>
              <Input type="number" step={0.1} min={0} max={1} className="w-24" value={temp} onChange={e=>setTemp(Number(e.target.value)||0.3)} />
            </>
          )}
          <Button
            onClick={async ()=>{
              setGenLoading(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const r = await fetch(`/api/admin/drafts/${id}/suggest-keys`, {
                  method:"POST", headers:{ "Content-Type":"application/json", ...(token?{ Authorization:`Bearer ${token}` }:{}) },
                  body: JSON.stringify(genMode==="ai" ? { mode:"ai", provider, model, temperature: temp } : { mode:"rule" })
                });
                const j = await r.json();
                setGenLoading(false);
                if (!r.ok) { setLog("生成失败：" + (j.error||r.statusText)); toast.error("生成失败：" + (j.error||r.statusText)); return; }
                setSug(j); setLog(genMode==="ai" ? `AI 用量：PT=${j.usage.prompt_tokens}, CT=${j.usage.completion_tokens}, TT=${j.usage.total_tokens}` : "规则生成完成");
                toast.success(genMode==="ai" ? "AI 建议生成完成" : "规则生成完成");
              } catch (e:any) {
                setGenLoading(false); setLog(`生成异常：${e.message||e}`); toast.error(`生成异常：${e.message||e}`);
              }
            }}
            >
            {genLoading? "生成中…" : "生成答案建议"}
          </Button>
          {sug && <span className="text-sm text-gray-600">已生成建议（未合并）</span>}
        </div>

        {sug && (
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm mb-2">建议摘要：P1={sug.suggestion.pass1.length} · P2={sug.suggestion.pass2.length} · P3={sug.suggestion.pass3.length} · ClozeS={sug.suggestion.cloze_short.length} · ClozeL={sug.suggestion.cloze_long.length}</div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={()=>{
                  setP1(sug.suggestion.pass1);
                  setP2(sug.suggestion.pass2);
                  setP3(sug.suggestion.pass3);
                  setCzShort(sug.suggestion.cloze_short);
                  setCzLong(sug.suggestion.cloze_long);
                  setLog("已把建议载入编辑区，请在下方继续修改，然后点“校验并保存”。");
                }}
              >
                将建议载入编辑区
              </Button>
              <Button variant="outline" onClick={()=> setSug(null)}>清除建议</Button>
            </div>
            <details className="mt-2 text-xs">
              <summary>查看原始建议 JSON</summary>
              <pre className="overflow-auto">{JSON.stringify(sug.suggestion, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>

      {/* 可视化标注器 */}
      <Annotator
        lang={d.lang as "en"|"ja"|"zh"}
        text={d.text}
        p1={p1} setP1={setP1}
        p2={p2} setP2={setP2}
        p3={p3} setP3={setP3}
        czShort={czShort} setCzShort={setCzShort}
        czLong={czLong} setCzLong={setCzLong}
        onValidateSave={async (payload)=>{
          try {
            setSaving(true); setLog("校验中…");
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const r = await fetch(`/api/admin/drafts/${id}/validate`, {
              method:"POST", headers:{ "Content-Type":"application/json", ...(token?{ Authorization:`Bearer ${token}` }:{}) },
              body: JSON.stringify({ lang:d.lang, text:d.text, ...payload })
            });
            const j = await r.json();
            if (!r.ok) { setSaving(false); setLog("校验失败：" + (j.error||r.statusText)); return; }
            setP1(j.keys.pass1); setP2(j.keys.pass2); setP3(j.keys.pass3);
            setCzShort(j.cloze_short); setCzLong(j.cloze_long);
            await update({ keys: j.keys, cloze_short: j.cloze_short, cloze_long: j.cloze_long, validator_report: j.report });
            setSaving(false); setLog(`已保存。摘要：P1=${j.report.pass1}, P2=${j.report.pass2}, P3=${j.report.pass3}, ClozeS=${j.report.cloze_short}, ClozeL=${j.report.cloze_long}`);
          } catch (e:any) {
            setSaving(false); setLog(`校验异常：${e.message||e}`);
          }
        }}
      />

      {/* 正文可编辑（如需改字） */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <div className="text-sm text-gray-500">若要改正文，这里编辑后点“保存正文”。（注意：改字会影响所有 span，改完请重新“校验并保存”。）</div>
        <Textarea className="w-full h-72" value={d.text} onChange={e=>setD({...d,text:e.target.value})}/>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>update({ text:d.text })}>保存正文</Button>
        </div>
      </section>

      {saving && <div className="text-sm text-gray-500">保存中…</div>}
    </main>
  );
}

/* ================= 标注器组件 ================= */

function Annotator({
  lang, text, p1, setP1, p2, setP2, p3, setP3, czShort, setCzShort, czLong, setCzLong, onValidateSave
}:{
  lang:"en"|"ja"|"zh"; text:string;
  p1:KeyP1[]; setP1: Dispatch<SetStateAction<KeyP1[]>>;
  p2:KeyP2[]; setP2: Dispatch<SetStateAction<KeyP2[]>>;
  p3:KeyP3[]; setP3: Dispatch<SetStateAction<KeyP3[]>>;
  czShort:Cloze[]; setCzShort: Dispatch<SetStateAction<Cloze[]>>;
  czLong:Cloze[]; setCzLong: Dispatch<SetStateAction<Cloze[]>>;
  onValidateSave:(payload:any)=>void;
}) {
  const [tab, setTab] = useState<"p1"|"p2"|"p3"|"cloze">("p1");
  const [p1Tag, setP1Tag] = useState<"connective"|"time">("connective");
  const [p2Mode, setP2Mode] = useState<"pron"|"ant">("pron");
  const [focusedPron, setFocusedPron] = useState<number|null>(null);
  const [czVer, setCzVer] = useState<"short"|"long">("short");
  const chars = useMemo(()=> Array.from(text), [text]);

  // 获取当前选区全局 span
  function getSelectionSpan(): Span | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const rng = sel.getRangeAt(0);
    const startEl = (rng.startContainer.parentElement ?? rng.startContainer as any) as HTMLElement;
    const endEl   = (rng.endContainer.parentElement   ?? rng.endContainer as any) as HTMLElement;
    const sAttr = (startEl as any)?.dataset?.idx, eAttr = (endEl as any)?.dataset?.idx;
    if (sAttr==null || eAttr==null) return null;
    let s = Number(sAttr) + rng.startOffset;
    let e = Number(eAttr) + rng.endOffset;
    if (s>e) [s,e] = [e,s];
    if (s===e) return null;
    return [s,e];
  }

  // 计算每个字符的高亮样式
  const charStyles = useMemo(() => {
    const highlights: { span: Span; className: string; title?: string }[] = [];
    if (tab === "p1") {
      highlights.push(...p1.map(k => ({ span: k.span, className: k.tag === "connective" ? "bg-yellow-200" : "bg-amber-200", title: k.tag })));
    } else if (tab === "p2") {
      highlights.push(...p2.map(k => ({ span: k.pron, className: "bg-blue-200", title: "pronoun" })));
      p2.forEach(k => k.antecedents.forEach(a => highlights.push({ span: a, className: "bg-green-200", title: "antecedent" })));
    } else if (tab === "p3") {
      highlights.push(...p3.flatMap(k => [
        { span: k.s, className: "bg-red-200", title: "S" },
        { span: k.v, className: "bg-orange-200", title: "V" },
        { span: k.o, className: "bg-red-200", title: "O" },
      ]));
    } else {
      const cz = czVer === "short" ? czShort : czLong;
      highlights.push(...cz.map(it => ({ span: [it.start, it.end] as Span, className: "bg-purple-200", title: it.hint || "blank" })));
    }

    const styles: { className?: string; title?: string }[] = Array(text.length).fill(null).map(() => ({}));
    for (const h of highlights) {
      const [s, e] = h.span;
      for (let i = Math.max(0, s); i < Math.min(text.length, e); i++) {
        styles[i] = { className: `${h.className} rounded px-0.5`, title: h.title };
      }
    }
    return styles;
  }, [tab, p1, p2, p3, czShort, czLong, czVer, text.length]);

  // 操作：添加/删除
  const addP1 = ()=>{
    const r = getSelectionSpan(); if (!r) return;
    setP1(prev => prev.some(x => !(r[1]<=x.span[0]||x.span[1]<=r[0])) ? prev : [...prev, { span:r, tag:p1Tag }]);
    window.getSelection()?.removeAllRanges();
  };
  const delP1 = (idx:number)=> setP1(prev=> prev.filter((_,i)=>i!==idx));

  const addP2 = ()=>{
    const r = getSelectionSpan(); if (!r) return;
    if (p2Mode==="pron") {
      setP2(prev => [...prev, { pron:r, antecedents:[] }]);
      setFocusedPron(p2.length);
    } else {
      if (focusedPron==null) return;
      setP2(prev => prev.map((x,i)=> i===focusedPron ? { ...x, antecedents: [...x.antecedents, r] } : x));
    }
    window.getSelection()?.removeAllRanges();
  };
  const delP2 = (i:number)=> setP2(prev=> prev.filter((_,idx)=> idx!==i));

  const [curTriple, setCurTriple] = useState<Partial<KeyP3>>({});
  const addSeg = (slot:"s"|"v"|"o")=>{
    const r = getSelectionSpan(); if (!r) return;
    setCurTriple(prev => ({ ...prev, [slot]: r }));
    window.getSelection()?.removeAllRanges();
  };
  const commitP3 = ()=>{
    if (!curTriple.s || !curTriple.v || !curTriple.o) return;
    setP3(prev => [...prev, curTriple as KeyP3]);
    setCurTriple({});
  };
  const delP3 = (i:number)=> setP3(prev=> prev.filter((_,idx)=> idx!==i));

  const addCloze = ()=>{
    const r = getSelectionSpan(); if (!r) return;
    const ans = text.slice(r[0], r[1]);
    const item = { start:r[0], end:r[1], answer:ans, hint:"blank", type:"collocation" } as Cloze;
    if (czVer==="short") setCzShort(prev => [...prev, item]); else setCzLong(prev => [...prev, item]);
    window.getSelection()?.removeAllRanges();
  };
  const delCloze = (i:number)=> (czVer==="short" ? setCzShort(prev=> prev.filter((_,idx)=> idx!==i)) : setCzLong(prev=> prev.filter((_,idx)=> idx!==i)));

  return (
    <section className="p-4 bg-white rounded-2xl shadow space-y-4">
      <h2 className="font-medium text-lg">可视化标注器</h2>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {(["p1","p2","p3","cloze"] as const).map(t =>
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1 rounded border ${tab===t?"bg-black text-white":""}`}>
            {t==="p1"?"Pass1":t==="p2"?"Pass2":t==="p3"?"Pass3":"Cloze"}
          </button>
        )}

        {tab==="p1" && (
          <>
            <label className="ml-2 text-sm">标注类别</label>
            <select value={p1Tag} onChange={e=>setP1Tag(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="connective">连接词</option>
              <option value="time">时间表达</option>
            </select>
            <button onClick={addP1} className="px-3 py-1 rounded border">添加选区</button>
          </>
        )}

        {tab==="p2" && (
          <>
            <label className="ml-2 text-sm">模式</label>
            <select value={p2Mode} onChange={e=>setP2Mode(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="pron">选“代词”</option>
              <option value="ant">选“先行词”</option>
            </select>
            <button onClick={addP2} className="px-3 py-1 rounded border">添加</button>
          </>
        )}

        {tab==="p3" && (
          <>
            <button onClick={()=>addSeg("s")} className="px-3 py-1 rounded border">选择 S</button>
            <button onClick={()=>addSeg("v")} className="px-3 py-1 rounded border">选择 V</button>
            <button onClick={()=>addSeg("o")} className="px-3 py-1 rounded border">选择 O</button>
            <button onClick={commitP3} className="px-3 py-1 rounded bg-black text-white">提交一条</button>
          </>
        )}

        {tab==="cloze" && (
          <>
            <label className="ml-2 text-sm">版本</label>
            <select value={czVer} onChange={e=>setCzVer(e.target.value as any)} className="border rounded px-2 py-1">
              <option value="short">短版</option>
              <option value="long">长版</option>
            </select>
            <button onClick={addCloze} className="px-3 py-1 rounded border">将选区设为空格</button>
          </>
        )}

        <div className="ml-auto flex gap-2">
          <button
            onClick={()=>onValidateSave({ keys:{ pass1:p1, pass2:p2, pass3:p3 }, cloze_short: czShort, cloze_long: czLong })}
            className="px-3 py-1 rounded bg-emerald-600 text-white">校验并保存
          </button>
        </div>
      </div>

      {/* 正文渲染 */}
      <div className="p-3 bg-gray-50 rounded leading-7 text-[15px]">
        {chars.map((ch, i) => (
          <span key={i} data-idx={i} className={charStyles[i]?.className} title={charStyles[i]?.title}>{ch}</span>
        ))}
      </div>

      {/* 右侧/下方：当前标注清单 */}
      <div className="grid md:grid-cols-2 gap-4">
        {tab==="p1" && (
          <div>
            <div className="text-sm font-medium mb-1">我的 Pass1 项（点击删除）</div>
            <ul className="text-sm space-y-1">
              {p1.map((it, i)=>(
                <li key={i} className="p-2 border rounded">
                  {it.tag} · [{it.span[0]}, {it.span[1]}] · “{text.slice(it.span[0], it.span[1]).slice(0,24)}”
                  <button onClick={()=>delP1(i)} className="ml-2 px-2 py-0.5 text-xs border rounded">删除</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab==="p2" && (
          <div>
            <div className="text-sm font-medium mb-1">我的 Pass2 项（点击删除整项）</div>
            <ul className="text-sm space-y-1">
              {p2.map((it, i)=>(
                <li key={i} className="p-2 border rounded">
                  代词[{it.pron[0]},{it.pron[1]}] “{text.slice(it.pron[0], it.pron[1])}”
                  <div className="text-xs text-gray-600">
                    先行词：{it.antecedents.map((a,j)=>(<span key={j} className="mr-1">[{a[0]},{a[1]}]</span>))}
                  </div>
                  <button onClick={()=>delP2(i)} className="mt-1 px-2 py-0.5 text-xs border rounded">删除</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {tab==="p3" && (
          <div>
            <div className="text-sm font-medium mb-1">我的 Pass3 三元组（点击删除）</div>
            <ul className="text-sm space-y-1">
              {p3.map((t, i)=>(
                <li key={i} className="p-2 border rounded">
                  <b>S</b>“{text.slice(t.s[0], t.s[1])}” · <b>V</b>“{text.slice(t.v[0], t.v[1])}” · <b>O</b>“{text.slice(t.o[0], t.o[1])}”
                  <button onClick={()=>delP3(i)} className="ml-2 px-2 py-0.5 text-xs border rounded">删除</button>
                </li>
              ))}
            </ul>
            <div className="text-xs text-gray-500 mt-1">当前未提交：S={"s" in (curTriple as any) && (curTriple as any).s ? `[${(curTriple as any).s[0]},${(curTriple as any).s[1]}]`:"—"} / V={"v" in (curTriple as any) && (curTriple as any).v ?`[${(curTriple as any).v[0]},${(curTriple as any).v[1]}]`:"—"} / O={"o" in (curTriple as any) && (curTriple as any).o ?`[${(curTriple as any).o[0]},${(curTriple as any).o[1]}]`:"—"}</div>
          </div>
        )}
        {tab==="cloze" && (
          <div>
            <div className="text-sm font-medium mb-1">Cloze 空格（{czVer==="short"?"短版":"长版"}）</div>
            <ul className="text-sm space-y-1">
              {(czVer==="short"?czShort:czLong).map((it, i)=>(
                <li key={i} className="p-2 border rounded">
                  [{it.start},{it.end}] “{text.slice(it.start, it.end).slice(0,36)}” · {it.hint||"blank"}
                  <button onClick={()=>delCloze(i)} className="ml-2 px-2 py-0.5 text-xs border rounded">删除</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
