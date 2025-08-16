"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SRow = {
  id: string;
  task_type: "cloze"|"sft"|"shadowing";
  topic: string | null;
  input: any;
  output: any;
  ai_feedback: any;
  score: number | null;
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

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">本周复盘</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <section className="p-4 bg-white rounded-2xl shadow space-y-2">
        <div>近 7 天总练习次数：<b>{stats.total}</b></div>
        <div className="text-sm text-gray-600">平均分（有分数的项）：Cloze <b>{String(stats.avg.cloze)}</b> / SFT <b>{String(stats.avg.sft)}</b> / Shadowing <b>{String(stats.avg.shadowing)}</b></div>
      </section>

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
