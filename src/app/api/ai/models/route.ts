import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const provider = (sp.get("provider") || "openrouter") as "openrouter"|"deepseek"|"openai";

  if (provider === "openrouter") {
    const r = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY!}` }
    });
    if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: r.status });
    const j = await r.json(); // 结构：{ data: [ { id, name, context_length, ... } ] }
    // 只返回基础字段并做一点点筛选（可按语言/功能自定义）
    const list = (j.data || []).map((m:any)=>({ id:m.id, name:m.name || m.id, context:m.context_length }));
    return NextResponse.json(list);
  }

  // DeepSeek / OpenAI：如果你需要，也可写静态列表或从自方文档中维护
  if (provider === "deepseek") {
    return NextResponse.json([
      { id: "deepseek-chat", name: "deepseek-chat" },
      { id: "deepseek-reasoner", name: "deepseek-reasoner" }
    ]);
  }
  if (provider === "openai") {
    return NextResponse.json([
      { id: "gpt-4o-mini", name: "gpt-4o-mini" }
    ]);
  }
}
