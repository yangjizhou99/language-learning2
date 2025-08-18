import { NextRequest, NextResponse } from "next/server";
import { fetchFromWikipedia, fetchFromWikinews, fetchFromGutenberg, fetchFromTatoeba, sha256 } from "@/lib/ingest/fetchers";
import { pass1, pass2, pass3, makeCloze } from "@/lib/answerkey/generate";
import { createClient } from "@supabase/supabase-js";

function detect(url: string) {
  const u = new URL(url);
  if (u.hostname.endsWith("wikipedia.org")) return "wikipedia";
  if (u.hostname.endsWith("wikinews.org")) return "wikinews";
  if (u.hostname.endsWith("gutenberg.org")) return "gutenberg";
  if (u.hostname.includes("tatoeba")) return "tatoeba";
  throw new Error("不支持的来源");
}

export async function POST(req: NextRequest) {
  try {
    const { url, lang, genre, difficulty = 3 } = await req.json();
    if (!url || !lang || !genre) return NextResponse.json({ error: "缺少参数" }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: "服务端缺少 Supabase 环境变量：请设置 NEXT_PUBLIC_SUPABASE_URL 与 NEXT_PUBLIC_SUPABASE_ANON_KEY" }, { status: 500 });
    }

    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(
      supabaseUrl,
      supabaseAnon,
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
    );

    // 抓取 & 清洗
    let fr;
    const src = detect(url);
    if (src === "wikipedia") fr = await fetchFromWikipedia(url, lang);
    else if (src === "wikinews") fr = await fetchFromWikinews(url, lang);
    else if (src === "gutenberg") fr = await fetchFromGutenberg(url, lang);
    else fr = await fetchFromTatoeba(url, lang);

    if (!fr?.text || fr.text.trim().length === 0) {
      return NextResponse.json({ error: "抓取到的正文为空" }, { status: 400 });
    }

    // 生成答案键 & Cloze
    const p1 = pass1(fr.text, lang);
    const p2 = pass2(fr.text, lang);
    const p3 = pass3(fr.text, lang);
    const shortCloze = makeCloze(fr.text, lang, "short");
    const longCloze = makeCloze(fr.text, lang, "long");

    // 入库（需要 admin 权限；RLS 会拦截非管理员）
    const checksum = sha256(fr.text);
    const { data: art, error: e1 } = await supabase
      .from("articles")
      .insert([
        {
          lang,
          genre,
          difficulty,
          title: fr.title,
          source_url: fr.source_url,
          license: fr.license,
          text: fr.text,
          checksum,
          meta: { attribution: fr.attribution },
        },
      ])
      .select("id")
      .single();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

    const { error: e2 } = await supabase
      .from("article_keys")
      .insert([{ article_id: art.id, pass1: p1, pass2: p2, pass3: p3 }]);
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

    const { error: e3 } = await supabase.from("article_cloze").insert([
      { article_id: art.id, version: "short", items: shortCloze },
      { article_id: art.id, version: "long", items: longCloze },
    ]);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

    return NextResponse.json({ ok: true, article_id: art.id, title: fr.title });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `服务器异常：${message}` }, { status: 500 });
  }
}
