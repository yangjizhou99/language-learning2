"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";

type SRow = {
  id: string;
  task_type: "cloze"|"sft"|"shadowing";
  topic: string | null;
  input: any;
  output: any;
  ai_feedback: any;
  score: number | null;
  duration_sec?: number | null;
  difficulty?: string | null;
  created_at: string;
};

export default function ReviewPage() {
  const [rows, setRows] = useState<SRow[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) { setErr("未登录"); return; }
      const from = new Date(Date.now() - 7*24*3600*1000).toISOString();
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .gte("created_at", from)
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      else setRows((data || []) as any);
    })();
  }, []);

  const stats = useMemo(() => {
    const byType: Record<string, { cnt: number; sum: number; has: number }> = {};
    for (const r of rows) {
      const t = r.task_type;
      byType[t] ||= { cnt: 0, sum: 0, has: 0 };
      byType[t].cnt++;
      if (typeof r.score === "number") { byType[t].sum += r.score; byType[t].has++; }
    }
    const avg = (t: string) => {
      const s = byType[t]; if (!s) return "-";
      return s.has ? Math.round((s.sum/s.has)*10)/10 : "-";
    };
    return {
      total: rows.length,
      avg: { cloze: avg("cloze"), sft: avg("sft"), shadowing: avg("shadowing") },
    };
  }, [rows]);

  // 辅助：把时间戳转日期键
  const dkey = (iso: string) => new Date(iso).toISOString().slice(0,10);

  // 生成导出 Markdown
  function buildWeeklyMarkdown(rows: SRow[], stats: any) {
    const today = new Date().toISOString().slice(0,10);
    const lines: string[] = [];
    lines.push(`# Weekly Report (${today})`);
    lines.push("");
    lines.push(`- Total sessions (7d): **${stats.total}**`);
    lines.push(`- Avg Cloze: **${String(stats.avg.cloze)}** | Avg SFT: **${String(stats.avg.sft)}** | Avg Shadowing: **${String(stats.avg.shadowing)}**`);
    lines.push("");
    lines.push("## Sessions (last 7 days)");
    rows.forEach(r => {
      const when = new Date(r.created_at).toLocaleString();
      const dur = r.duration_sec ? `${Math.round(Number(r.duration_sec))}s` : "-";
      const score = typeof r.score === "number" ? r.score : "-";
      const audio = r.task_type==="shadowing" && r.output?.audio_url ? ` [audio](${r.output.audio_url})` : "";
      lines.push(`- ${when} · **${r.task_type.toUpperCase()}** · topic: ${r.topic || "-"} · score: ${score} · duration: ${dur}${audio}`);
    });
    lines.push("");
    lines.push("> 注：Shadowing 音频链接为短期签名 URL，可能在数日后过期。");
    return lines.join("\n");
  }

  const daily = useMemo(() => {
    // 近 14 天
    const now = new Date();
    const days: string[] = [];
    for (let i=13;i>=0;i--) {
      const d = new Date(now.getTime() - i*24*3600*1000).toISOString().slice(0,10);
      days.push(d);
    }
    // 每日计数与平均分
    const map: Record<string, { cnt:number; sum:number; has:number }> = {};
    for (const d of days) map[d] = { cnt:0, sum:0, has:0 };
    for (const r of rows) {
      const k = dkey(r.created_at);
      if (!(k in map)) continue;
      map[k].cnt++;
      if (typeof r.score === "number") { map[k].sum += Number(r.score); map[k].has++; }
    }
    return days.map(d => ({
      date: d,
      count: map[d].cnt,
      avg: map[d].has ? Math.round((map[d].sum/map[d].has)*10)/10 : 0
    }));
  }, [rows]);

  const timeByType = useMemo(() => {
    const agg: Record<string,{ total:number; avg:number; cnt:number }> = {};
    for (const r of rows) {
      const t = r.task_type;
      const dur = Number(r.duration_sec || 0);
      if (!agg[t]) agg[t] = { total:0, avg:0, cnt:0 };
      agg[t].total += dur; agg[t].cnt += 1;
    }
    Object.keys(agg).forEach(k => {
      agg[k].avg = agg[k].cnt ? Math.round((agg[k].total/agg[k].cnt)*10)/10 : 0;
    });
    return [
      { type: "cloze", total: Math.round(agg["cloze"]?.total||0), avg: agg["cloze"]?.avg||0 },
      { type: "sft", total: Math.round(agg["sft"]?.total||0), avg: agg["sft"]?.avg||0 },
      { type: "shadowing", total: Math.round(agg["shadowing"]?.total||0), avg: agg["shadowing"]?.avg||0 },
    ];
  }, [rows]);

  const sftRadar = useMemo(() => {
    // 从 ai_feedback 聚合 rubrics 分项平均分
    const sums: Record<string,{sum:number; cnt:number}> = {};
    for (const r of rows) if (r.task_type==="sft" && r.ai_feedback?.scores) {
      const sc = r.ai_feedback.scores;
      Object.keys(sc).forEach(k=>{
        const v = Number(sc[k]);
        if (!Number.isFinite(v)) return;
        if (!sums[k]) sums[k] = { sum:0, cnt:0 };
        sums[k].sum += v; sums[k].cnt += 1;
      });
    }
    const keys = Object.keys(sums);
    if (keys.length===0) return [];
    return keys.map(k=>({ metric: k, score: Math.round((sums[k].sum/sums[k].cnt)*10)/10 }));
  }, [rows]);

  // 导出周报（以近 7 天 rows）
  const exportMd = () => {
    const from = Date.now() - 7*24*3600*1000;
    const weekRows = rows.filter(r => new Date(r.created_at).getTime() >= from);
    const md = buildWeeklyMarkdown(weekRows, stats);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date().toISOString().slice(0,10);
    a.href = url; a.download = `weekly-report-${d}.md`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">本周复盘</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <h1 className="text-2xl font-semibold">本周复盘</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      {/* 折线图：每日次数 & 平均分 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">近 14 天趋势</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="count" name="次数" />
              <Line yAxisId="right" type="monotone" dataKey="avg" name="平均分" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 柱状图：用时统计 */}
      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">用时统计（秒）</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="总时长(s)" />
              <Bar dataKey="avg" name="平均时长(s)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 雷达图：SFT rubrics 平均分 */}
      {sftRadar.length>0 && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-2">
          <h2 className="font-medium">SFT 维度平均分</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={sftRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis />
                <Radar name="平均分" dataKey="score" />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <button onClick={exportMd} className="px-4 py-2 rounded bg-black text-white">导出本周周报（.md）</button>
      </div>

      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <h2 className="font-medium">明细</h2>
        <ul className="space-y-2">
          {rows.map(r => (
            <li key={r.id} className="p-3 border rounded">
              <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</div>
              <div className="font-medium">{r.task_type.toUpperCase()} · {r.topic}</div>
              {r.task_type === "shadowing" && r.output?.audio_url && (
                <audio className="mt-2 w-full" controls src={r.output.audio_url}></audio>
              )}
              {typeof r.score === "number" && <div className="text-sm">分数：{r.score}</div>}
            </li>
          ))}
          {rows.length===0 && <li className="text-sm text-gray-500">近 7 天暂无记录。</li>}
        </ul>
      </section>
    </main>
  );
}
