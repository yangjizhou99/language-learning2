import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { chatJSON } from "@/lib/ai/client";
import { cookies } from "next/headers";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";

function buildPrompt(l: "en"|"ja"|"zh", d: number, t: "monologue"|"dialogue"|"news") {
  const LEN = l === "en" ? [60, 90, 150, 200, 260][d - 1] : [160, 220, 300, 420, 520][d - 1];
  const STYLE = t === "dialogue" ? (l === "en" ? "a natural two-person dialogue" : "自然な二人会話") :
              t === "news" ? (l === "en" ? "concise news brief" : "簡潔なニュース要約") :
              (l === "en" ? "a clear monologue" : "わかりやすいモノローグ");
  const RULE = l === "en"
    ? "Use mostly high-frequency words. L1-A1; L3-B1; L5-B2/C1."
    : l === "ja" ? "基本語彙中心。L1=やさしい日本語、L3=一般、L5=やや高度。"
    : "以高频词为主。L1=基础，L3=中级，L5=偏高级。";
  
  return `Write ${STYLE} in ${l.toUpperCase()} about a practical topic for shadowing.
Target length ≈ ${LEN} ${l === "en" ? "words" : "characters"} (±15%).
Constraints: 1) short sentences; 2) clear punctuation; 3) no lists; 4) spoken style.
${RULE}
Return JSON only: {"title":"...","script":"..."}`;
}

export async function POST(req: NextRequest) {
  try {
    console.log("🔍 [DEBUG] Starting shadowing generate API call");
    
    // 调试：检查cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log("🔍 [DEBUG] Available cookies:", allCookies.map(c => c.name));
    const authz = req.headers.get("authorization") || req.headers.get("Authorization");
    console.log("🔍 [DEBUG] Authorization header present:", !!authz, authz ? `${authz.slice(0, 16)}...` : "");
    
    const auth = await requireUser(req);
    console.log("🔍 [DEBUG] Auth result:", auth ? `User ID: ${auth.user.id}` : "No auth");
    
    if (!auth) {
      console.log("❌ [DEBUG] Authentication failed - returning 401");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    
    const { supabase, user } = auth;
    console.log("✅ [DEBUG] Authentication successful for user:", user.id);
    
    const b = await req.json();
    const lang = (b.lang || "en") as "en"|"ja"|"zh";
    const difficulty = Math.min(5, Math.max(1, Number(b.difficulty || 3)));
    const type = (b.type || "monologue") as "monologue"|"dialogue"|"news";
    const provider = (b.provider || process.env.AI_PROVIDER || "openrouter");
    const model = b.model || process.env.AI_DEFAULT_MODEL || "openai/gpt-4o-mini";
    const temperature = b.temperature ?? 0.5;

    console.log("🔍 [DEBUG] Request parameters:", { lang, difficulty, type, model });

    const { content } = await chatJSON({
      provider,
      model,
      temperature,
      response_json: true,
      messages: [
        { role: "system", content: "You are a JSON-only writing assistant." },
        { role: "user", content: buildPrompt(lang, difficulty, type) }
      ]
    });

    let j;
    try {
      j = JSON.parse(content);
      if (!j.title || !j.script) {
        throw new Error("Missing title or script in response");
      }
    } catch {
      return NextResponse.json({ error: "LLM JSON parse error" }, { status: 400 });
    }

    // （可选）调用你已有的 /api/tts/speak 合成音频，得到 audioUrl
    // 这里留空位：
    const audioUrl = null;

    // 入库一条"created"会话
    const { data: row, error } = await supabase.from("shadowing_sessions").insert([{
      user_id: user.id,
      lang,
      difficulty,
      recommended: !!b.recommended,
      type,
      title: j.title?.slice(0, 120) || null,
      script: j.script,
      tts_audio_url: audioUrl,
      tts_rate: [0.9, 0.95, 1.0, 1.05, 1.1][difficulty - 1]
    }]).select("id").single();

    if (error) {
      console.error("Database insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("✅ [DEBUG] Successfully created shadowing session:", row.id);

    return NextResponse.json({
      session_id: row.id,
      title: j.title,
      script: j.script,
      tts_audio_url: audioUrl
    });
  } catch (error) {
    console.error("❌ [DEBUG] Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    );
  }
}
