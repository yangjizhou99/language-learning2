export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// 获取主题列表
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const supabase = auth.supabase;

    const sp = new URL(req.url).searchParams;
    const lang = sp.get("lang") as ("en"|"ja"|"zh"|null);
    const level = sp.get("level");
    const genre = sp.get("genre");
    const active = sp.get("active");

    let query = supabase
      .from("shadowing_themes")
      .select(`
        id, title_cn, title_en, description, lang, level, genre, register, 
        is_active, created_at, updated_at, created_by
      `)
      .order("created_at", { ascending: false });

    if (lang) query = query.eq("lang", lang);
    if (level) query = query.eq("level", Number(level));
    if (genre) query = query.eq("genre", genre);
    if (active !== null) query = query.eq("is_active", active === "true");

    const { data, error } = await query;
    if (error) {
      console.error("获取主题列表失败:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.log("查询参数:", { lang, level, genre, active });
    console.log("查询结果:", data?.length || 0, "个主题");
    console.log("主题详情:", data);

    return NextResponse.json({ ok: true, themes: data || [] });
  } catch (error) {
    console.error("主题API错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

// 创建新主题
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const supabase = auth.supabase;

    const body = await req.json();
    const { title_cn, title_en, description, lang, level, genre, register = "neutral" } = body;

    // 验证必填字段
    if (!title_cn || !title_en || !lang || !level || !genre) {
      return NextResponse.json({ 
        error: "缺少必填字段", 
        required: ["title_cn", "title_en", "lang", "level", "genre"] 
      }, { status: 400 });
    }

    // 验证语言
    if (!["en", "ja", "zh"].includes(lang)) {
      return NextResponse.json({ error: "无效的语言参数" }, { status: 400 });
    }

    // 验证等级
    if (level < 1 || level > 6) {
      return NextResponse.json({ error: "等级必须在1-6之间" }, { status: 400 });
    }

    // 验证体裁
    if (!["dialogue", "monologue", "news", "lecture"].includes(genre)) {
      return NextResponse.json({ error: "无效的体裁参数" }, { status: 400 });
    }

    // 验证语域
    if (!["casual", "neutral", "formal"].includes(register)) {
      return NextResponse.json({ error: "无效的语域参数" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("shadowing_themes")
      .insert({
        title_cn,
        title_en,
        description,
        lang,
        level: Number(level),
        genre,
        register,
        created_by: auth.user.id
      })
      .select()
      .single();

    if (error) {
      console.error("创建主题失败:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, theme: data });
  } catch (error) {
    console.error("创建主题API错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
