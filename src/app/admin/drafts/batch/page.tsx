"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function BatchPage() {
	const [provider, setProvider] = useState<"openrouter"|"deepseek"|"openai">("openrouter");
	const [models, setModels] = useState<{id:string;name:string}[]>([]);
	const [model, setModel] = useState<string>("");
	const [name, setName] = useState<string>("批次-" + new Date().toLocaleString());
	const [lang, setLang] = useState("en");
	const [genre, setGenre] = useState("news");
	const [words, setWords] = useState(300);
	const [temperature, setTemperature] = useState(0.6);
	const [topics, setTopics] = useState<string>("");
	const [diffs, setDiffs] = useState<string>("2,3,4");

	const [batchId, setBatchId] = useState<string>("");
	const [status, setStatus] = useState<any>(null);
	const [running, setRunning] = useState(false);

	useEffect(()=>{ (async()=>{
		if (provider==="openrouter") {
			const r = await fetch(`/api/ai/models?provider=${provider}`); const j = await r.json(); setModels(j||[]);
			setModel(j?.[0]?.id || "");
		} else if (provider==="deepseek") {
			const j = [{id:"deepseek-chat", name:"deepseek-chat"},{id:"deepseek-reasoner", name:"deepseek-reasoner"}];
			setModels(j); setModel(j[0].id);
		} else {
			const j = [{id:"gpt-4o-mini", name:"gpt-4o-mini"}];
			setModels(j); setModel(j[0].id);
		}
	})() }, [provider]);

	async function createBatch() {
		const t = topics.split("\n").map(s=>s.trim()).filter(Boolean);
		const ds = diffs.split(",").map(s=>Number(s.trim())).filter(n=>n>=1 && n<=5);
		const { data: { session } } = await supabase.auth.getSession();
		const token = session?.access_token;
		const r = await fetch("/api/admin/drafts/batch/create", {
			method:"POST", headers:{ "Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) },
			body: JSON.stringify({ name, provider, model, lang, genre, words, temperature, topics: t, difficulties: ds })
		});
		const j = await r.json();
		if (!r.ok) { toast.error("创建失败：" + j.error); return; }
		toast.success("批次已创建");
		setBatchId(j.batch_id); setStatus(null);
	}

	async function refresh() {
		if (!batchId) return;
		const { data: { session } } = await supabase.auth.getSession();
		const token = session?.access_token;
		const r = await fetch(`/api/admin/drafts/batch/status?id=${batchId}` , { headers: token? { Authorization: `Bearer ${token}` } : {} });
		const j = await r.json(); setStatus(j);
	}

	async function runOnce(limit=3) {
		if (!batchId) return;
		setRunning(true);
		const { data: { session } } = await supabase.auth.getSession();
		const token = session?.access_token;
		const r = await fetch("/api/admin/drafts/batch/run", {
			method:"POST", headers:{ "Content-Type":"application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) },
			body: JSON.stringify({ id: batchId, limit })
		});
		await r.json();
		setRunning(false);
		toast.success("已执行一轮");
		await refresh();
	}

	useEffect(()=> {
		let timer:any;
		if (batchId) {
			refresh();
			timer = setInterval(async ()=>{
				await runOnce(3);
			}, 3000);
		}
		return ()=> timer && clearInterval(timer);
	}, [batchId]);

	return (
		<main className="max-w-5xl mx-auto p-6 space-y-6">
			<h1 className="text-2xl font-semibold">批量 AI 生成草稿</h1>

			<section className="p-4 bg-white rounded-2xl shadow space-y-3">
				<div className="grid md:grid-cols-2 gap-3">
					<label className="text-sm">批次名称<input className="border rounded px-2 py-1 w-full" value={name} onChange={e=>setName(e.target.value)}/></label>
					<label className="text-sm">语言/体裁
						<div className="flex gap-2">
							<select className="border rounded px-2 py-1" value={lang} onChange={e=>setLang(e.target.value)}>
								<option value="en">英语</option><option value="ja">日语</option><option value="zh">中文</option>
							</select>
							<select className="border rounded px-2 py-1" value={genre} onChange={e=>setGenre(e.target.value)}>
								<option value="news">新闻</option><option value="science">科普</option><option value="essay">随笔</option>
								<option value="dialogue">对话</option><option value="literature">文学</option>
							</select>
						</div>
					</label>
					<label className="text-sm">Provider/Model
						<div className="flex gap-2">
							<select className="border rounded px-2 py-1" value={provider} onChange={e=>setProvider(e.target.value as any)}>
								<option value="openrouter">OpenRouter</option>
								<option value="deepseek">DeepSeek</option>
								<option value="openai">OpenAI</option>
							</select>
							<select className="border rounded px-2 py-1 flex-1" value={model} onChange={e=>setModel(e.target.value)}>
								{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
							</select>
						</div>
					</label>
					<label className="text-sm">长度/温度
						<div className="flex gap-2">
							<input type="number" className="border rounded px-2 py-1 w-28" value={words} onChange={e=>setWords(Number(e.target.value)||300)}/>
							<input type="number" step={0.1} min={0} max={1} className="border rounded px-2 py-1 w-28"
								value={temperature} onChange={e=>setTemperature(Number(e.target.value)||0.6)} />
						</div>
					</label>
				</div>
				<div className="grid md:grid-cols-2 gap-3">
					<label className="text-sm">主题（每行一个，可空）
						<textarea className="border rounded px-2 py-1 w-full h-28" value={topics} onChange={e=>setTopics(e.target.value)} placeholder="e.g.\nQuantum computing\nSushi culture\nRenewable energy"/>
					</label>
					<label className="text-sm">难度（逗号分隔）
						<input className="border rounded px-2 py-1 w-full" value={diffs} onChange={e=>setDiffs(e.target.value)} placeholder="2,3,4"/>
					</label>
				</div>
				<div className="flex gap-2">
					<Button onClick={createBatch}>创建批次</Button>
					{batchId && <Button variant="outline" onClick={refresh}>刷新状态</Button>}
					{batchId && <Button variant="outline" onClick={()=>runOnce(5)} disabled={running}>{running?"运行中…":"手动执行 5 条"}</Button>}
				</div>
				{batchId && <div className="text-sm text-gray-600">当前批次：{batchId}</div>}
			</section>

			{status && (
				<section className="p-4 bg-white rounded-2xl shadow space-y-3">
					<div className="text-lg font-medium">批次状态：{status.batch.status}</div>
					<div className="text-sm">模型：{status.batch.provider} / {status.batch.model} · {status.batch.lang} · {status.batch.genre}</div>
					<div className="text-sm">
						总用量：PT={status.batch.totals.prompt_tokens} · CT={status.batch.totals.completion_tokens} · TT={status.batch.totals.total_tokens}
					</div>
					<div className="text-sm">
						计数：pending {status.counts.pending} · processing {status.counts.processing} · done {status.counts.done} · failed {status.counts.failed}
					</div>
					<details>
						<summary className="cursor-pointer text-sm">按难度汇总</summary>
						<pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(status.perDifficulty, null, 2)}</pre>
					</details>
					<details>
						<summary className="cursor-pointer text-sm">最近 50 条项</summary>
						<pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(status.items, null, 2)}</pre>
					</details>
				</section>
			)}
		</main>
	);
}


