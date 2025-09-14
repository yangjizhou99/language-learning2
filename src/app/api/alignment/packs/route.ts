export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getUserPermissions, checkAccessPermission } from '@/lib/user-permissions-server';

// 公共列表接口：返回已发布的训练包
export async function GET(req: NextRequest) {
  try {
    // 检查用户认证
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    
    let authSupabase: any;
    if (hasBearer) {
      authSupabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      authSupabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }

    const { data: { user } } = await authSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查权限
    const permissions = await getUserPermissions(user.id);
    if (!checkAccessPermission(permissions, 'can_access_alignment')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("alignment_packs")
      .select("id, lang, topic, tags, status, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("alignment packs list error:", error);
      return NextResponse.json({ error: "failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, packs: data || [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}


