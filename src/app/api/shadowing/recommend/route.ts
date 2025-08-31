import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("🔍 [AUTH DEBUG] /recommend Authorization header present:", !!authz, authz ? `${authz.slice(0, 16)}...` : "");
    const auth = await requireUser(req);
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });
    const { supabase, user } = auth;
    const lang = new URL(req.url).searchParams.get("lang") as "en"|"ja"|"zh" || "en";
    
    // 最近 5 次
    const { data: rows } = await supabase.from("shadowing_sessions")
      .select("difficulty,metrics,created_at")
      .eq("user_id", user.id)
      .eq("lang", lang)
      .order("created_at", { ascending: false })
      .limit(5);

    const target = { minWpm: lang === "en" ? 110 : undefined, minCpm: lang !== "en" ? 260 : undefined };
    let err = 0, n = 0, wpm = 0, cpm = 0;
    
    for (const r of (rows || [])) {
      const m = r.metrics || {};
      if (lang === "en" && m.wer != null) { err += m.wer; n++; }
      if (lang !== "en" && m.cer != null) { err += m.cer; n++; }
      if (m.wpm) wpm += m.wpm; 
      if (m.cpm) cpm += m.cpm;
    }
    
    const avgErr = n ? err / n : 0.25;
    const avgWpm = wpm && rows?.length ? wpm / rows.length : 0;
    const avgCpm = cpm && rows?.length ? cpm / rows.length : 0;

    // 取最近一次的 level 当当前基线，否则 2/3
    const base = rows?.[0]?.difficulty ?? (lang === "en" ? 2 : 3);
    let rec = base; 
    let why = `基于最近${rows?.length || 0}次：平均错误率 ${(avgErr * 100).toFixed(1)}%`;
    
    if (avgErr <= 0.12 && ((lang === "en" && avgWpm >= (target.minWpm || 100) * 0.9) || (lang !== "en" && avgCpm >= (target.minCpm || 240) * 0.9))) {
      rec = Math.min(5, base + 1); 
      why += "；稳定偏低，建议升一级";
    } else if (avgErr >= 0.28) {
      rec = Math.max(1, base - 1); 
      why += "；错误率偏高，建议降一级";
    } else {
      why += "；维持当前难度";
    }

    // 写入缓存表
    await supabase.from("shadowing_recommend")
      .upsert({ 
        user_id: user.id, 
        lang, 
        recommended_level: rec, 
        reason: why,
        updated_at: new Date().toISOString()
      });

    return NextResponse.json({ lang, level: rec, reason: why });
  } catch (error) {
    console.error("Recommend error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
