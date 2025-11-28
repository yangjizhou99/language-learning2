export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: any;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() { },
          remove() { },
        },
      });
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { item_id, lang, level, metrics } = body;

    // 验证必需字段
    if (!item_id || !lang || !level || !metrics) {
      return NextResponse.json({ error: '缺少必需字段' }, { status: 400 });
    }

    // 验证语言和等级
    if (!['en', 'ja', 'zh', 'ko'].includes(lang)) {
      return NextResponse.json({ error: '无效的语言参数' }, { status: 400 });
    }

    if (level < 0 || level > 6) { // Relaxed level check
      return NextResponse.json({ error: '无效的等级参数' }, { status: 400 });
    }

    // 验证item_id是否存在
    const { data: item, error: itemError } = await supabase
      .from('shadowing_items')
      .select('id, lang, level')
      .eq('id', item_id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    // 验证语言和等级是否匹配 (Relaxed validation: Log warning instead of error)
    if (item.lang !== lang || item.level !== level) {
      console.warn(`[Attempts API] Item mismatch warning: ID=${item_id}, DB(lang=${item.lang}, level=${item.level}) vs Req(lang=${lang}, level=${level})`);
      // Continue anyway to ensure data is saved
    }

    // 插入练习记录
    const { data: attempt, error: insertError } = await supabase
      .from('shadowing_attempts')
      .insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        item_id,
        lang,
        level,
        metrics,
      })
      .select()
      .single();

    if (insertError) {
      console.error('插入练习记录失败:', insertError);
      return NextResponse.json({ error: '保存练习记录失败' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attempt_id: attempt.id,
    });
  } catch (error) {
    console.error('记录练习结果失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
