export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { pass1, pass2, pass3, makeCloze } from "@/lib/answerkey/generate";
import { sha256 } from "@/lib/ingest/fetchers";

type Body = {
  lang: "en"|"ja"|"zh";
  genre: string;            // news/science/essay/dialogue/literature
  difficulty: number;       // 1..5
  title: string;
  text: string;
  source_url?: string|null;
  license?: string|null;    // 默认 User-Provided
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const code = auth.reason === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: auth.reason }, { status: code });
  }
  const supabase = auth.supabase;

  const body = (await req.json()) as Body;
  const { lang, genre, difficulty, title, source_url=null, license="User-Provided" } = body;
  let { text } = body;

  if (!lang || !genre || !difficulty || !title || !text)
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });

  text = (text || "").toString().trim();
  if (text.length < 200)
    return NextResponse.json({ error: "文本过短（<200）" }, { status: 400 });

  // 生成答案键 & Cloze
  const p1 = pass1(text, lang);
  const p2 = pass2(text, lang);
  const p3 = pass3(text, lang);
  const shortCloze = makeCloze(text, lang, "short");
  const longCloze  = makeCloze(text, lang, "long");

  const checksum = sha256(`${lang}|${title}|${text}`);

  // 入库（受 RLS 保护：仅 admin 可写）
  const { data: art, error: e1 } = await supabase
    .from("articles")
    .insert([{
      lang, genre, difficulty, title, source_url, license, text, checksum,
      meta: { attribution: "User provided" }
    }])
    .select("id")
    .single();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const { error: e2 } = await supabase
    .from("article_keys")
    .insert([{ article_id: art.id, pass1: p1, pass2: p2, pass3: p3 }]);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  const { error: e3 } = await supabase
    .from("article_cloze")
    .insert([
      { article_id: art.id, version: "short", items: shortCloze },
      { article_id: art.id, version: "long",  items: longCloze  },
    ]);
  if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

  return NextResponse.json({ ok: true, article_id: art.id });
}
