import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // 从请求头获取用户认证
    const authHeader = req.headers.get("authorization") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
      global: { headers: authHeader ? { Authorization: authHeader } : {} }
    });

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 检查用户 profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    // 检查数据库表
    let dbStatus = "unknown";
    try {
      const { data, error: tableError } = await supabase
        .from("article_drafts")
        .select("count")
        .limit(1);
      
      if (tableError) {
        if (tableError.message.includes("relation") && tableError.message.includes("does not exist")) {
          dbStatus = "missing_table";
        } else {
          dbStatus = "error";
        }
      } else {
        dbStatus = "ok";
      }
    } catch (error) {
      dbStatus = "error";
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile: profile || { role: "user" },
      dbStatus,
      isAdmin: profile?.role === "admin"
    });

  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // 从请求头获取用户认证
    const authHeader = req.headers.get("authorization") || "";
    
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false },
      global: { headers: authHeader ? { Authorization: authHeader } : {} }
    });

    // 获取当前用户
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    
    if (body.action === "make_admin") {
      // 设置为管理员
      const { error } = await supabase
        .from("profiles")
        .upsert({ 
          id: user.id, 
          role: "admin" 
        }, { 
          onConflict: "id" 
        });
      
      if (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: "已设置为管理员" });
    }
    
    if (body.action === "create_table") {
      // 创建 article_drafts 表
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.article_drafts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source text NOT NULL,
          lang text NOT NULL,
          genre text NOT NULL,
          difficulty int NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
          title text NOT NULL,
          text text NOT NULL,
          license text DEFAULT NULL,
          ai_provider text DEFAULT NULL,
          ai_model text DEFAULT NULL,
          ai_params jsonb DEFAULT '{}'::jsonb,
          ai_usage jsonb DEFAULT '{}'::jsonb,
          keys jsonb DEFAULT '{}'::jsonb,
          cloze_short jsonb DEFAULT '[]'::jsonb,
          cloze_long jsonb DEFAULT '[]'::jsonb,
          validator_report jsonb DEFAULT '{}'::jsonb,
          status text NOT NULL DEFAULT 'pending',
          meta jsonb DEFAULT '{}'::jsonb,
          created_by uuid REFERENCES auth.users(id),
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          published_article_id uuid DEFAULT NULL
        );

        ALTER TABLE public.article_drafts ENABLE row level security;

        DROP POLICY IF EXISTS draft_select ON public.article_drafts;
        CREATE POLICY draft_select ON public.article_drafts FOR SELECT TO authenticated USING (true);

        DROP POLICY IF EXISTS draft_write ON public.article_drafts;
        CREATE POLICY draft_write ON public.article_drafts FOR ALL TO authenticated
          USING (public.is_admin()) WITH CHECK (public.is_admin());
      `;
      
      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (error) {
        return NextResponse.json({ 
          error: "无法通过 API 创建表，请在 Supabase 控制台手动执行 SQL",
          sql: createTableSQL
        }, { status: 400 });
      }
      
      return NextResponse.json({ success: true, message: "数据库表已创建" });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });

  } catch (error) {
    console.error("Setup action error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
