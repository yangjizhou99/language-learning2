"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Span = [number,number];
type KeyP1 = { span:Span; tag:"connective"|"time"; surface?:string };
type KeyP2 = { pron:Span; antecedents:Span[] };
type KeyP3 = { s:Span; v:Span; o:Span };
type Cloze = { start:number; end:number; answer:string; hint:string; type:string };

export default function DraftDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<any>(null);
  const [log, setLog] = useState("");
  const [saving, setSaving] = useState(false);

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

  const update = async (patch:any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/drafts/${id}`, { method:"PATCH", headers:{ "Content-Type":"application/json", ...(token?{ Authorization:`Bearer ${token}` }:{}) }, body: JSON.stringify(patch) });
      if (!r.ok) { const j = await r.json(); setLog(`更新失败: ${j.error}`); return; }
      await load();
      setLog("更新成功");
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
    } catch (e:any) { setLog(`发布失败: ${e.message||e}`); }
  };

  if (!d) return <main className="p-6">加载中…</main>;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">草稿详情（可视化校对）</h1>

      {/* 顶部基础信息 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <input className="border rounded px-2 py-1 w-full font-medium text-lg" value={d.title}
          onChange={e=>setD({...d,title:e.target.value})} />
        <div className="text-xs text-gray-500">
          {d.lang} · {d.genre}/L{d.difficulty} · 状态：{d.status} · AI:{d.ai_provider||"-"} {d.ai_model||""}
        </div>
        <div className="flex gap-2">
          <button onClick={()=>update({ title:d.title })} className="px-3 py-1 rounded border">保存标题</button>
          <button onClick={()=>update({ status:"approved" })} className="px-3 py-1 rounded border">标记为已审</button>
          <button onClick={()=>update({ status:"needs_fix" })} className="px-3 py-1 rounded border">需要修改</button>
          <button onClick={()=>update({ status:"rejected" })} className="px-3 py-1 rounded border">拒绝</button>
          <button onClick={publish} className="px-3 py-1 rounded bg-black text-white">发布 → 正式题库</button>
        </div>
        {log && <pre className="text-sm p-2 bg-gray-50 rounded">{log}</pre>}
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
        <textarea className="border rounded px-2 py-1 w-full h-72" value={d.text} onChange={e=>setD({...d,text:e.target.value})}/>
        <div className="flex gap-2">
          <button onClick={()=>update({ text:d.text })} className="px-3 py-1 rounded border">保存正文</button>
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
  p1:KeyP1[]; setP1:(v:KeyP1[])=>void;
  p2:KeyP2[]; setP2:(v:KeyP2[])=>void;
  p3:KeyP3[]; setP3:(v:KeyP3[])=>void;
  czShort:Cloze[]; setCzShort:(v:Cloze[])=>void;
  czLong:Cloze[]; setCzLong:(v:Cloze[])=>void;
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
