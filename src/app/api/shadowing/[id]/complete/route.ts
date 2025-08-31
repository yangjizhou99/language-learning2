import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

function tokenizeEn(s: string) { return (s || "").toLowerCase().match(/[a-z']+/g) || []; }

function wer(ref: string, hyp: string) {
  const r = tokenizeEn(ref), h = tokenizeEn(hyp);
  const dp = Array(r.length + 1).fill(0).map(() => Array(h.length + 1).fill(0));
  for (let i = 0; i <= r.length; i++) dp[i][0] = i;
  for (let j = 0; j <= h.length; j++) dp[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return r.length ? dp[r.length][h.length] / r.length : 0;
}

function cer(ref: string, hyp: string) {
  const r = Array.from(ref.replace(/\s+/g, "")), h = Array.from(hyp.replace(/\s+/g, ""));
  const dp = Array(r.length + 1).fill(0).map(() => Array(h.length + 1).fill(0));
  for (let i = 0; i <= r.length; i++) dp[i][0] = i;
  for (let j = 0; j <= h.length; j++) dp[0][j] = j;
  for (let i = 1; i <= r.length; i++) {
    for (let j = 1; j <= h.length; j++) {
      const cost = r[i - 1] === h[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return r.length ? dp[r.length][h.length] / r.length : 0;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });
    const { supabase, user } = auth;
    const body = await req.json();
    const { id } = await params;

    const { data: s } = await supabase.from("shadowing_sessions").select("*")
      .eq("id", id).eq("user_id", user.id).single();
    
    if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

    const hyp = String(body.transcript || "");
    const ref = String(s.script || "");
    const duration = Number(body.duration_s || 0);
    const lang = s.lang as "en"|"ja"|"zh";

    const metric: Record<string, unknown> = { 
      duration_s: duration, 
      pauses: body.pauses || 0, 
      retries: body.retries || 0, 
      self_rating: body.self_rating || null 
    };
    
    if (lang === "en") {
      metric.wer = wer(ref, hyp);
      const words = tokenizeEn(ref).length;
      metric.wpm = duration > 0 ? (words / (duration / 60)) : null;
    } else {
      metric.cer = cer(ref, hyp);
      const chars = Array.from(ref.replace(/\s+/g, "")).length;
      metric.cpm = duration > 0 ? (chars / (duration / 60)) : null;
    }

    await supabase.from("shadowing_sessions").update({
      metrics: metric,
      status: "completed",
      completed_at: new Date().toISOString()
    }).eq("id", id);

    // 计算新推荐
    const rec = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/shadowing/recommend?lang=${lang}`, {
      headers: { cookie: req.headers.get('cookie') || '' }
    }).then(r => r.json());

    return NextResponse.json({ ok: true, metrics: metric, next_recommendation: rec });
  } catch (error) {
    console.error("Complete error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
