export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang');
    const level = searchParams.get('level');
    
    if (!lang || !level || !['en', 'ja', 'zh'].includes(lang)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const levelNum = parseInt(level);
    if (levelNum < 1 || levelNum > 5) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 });
    }

    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }

    // 先确认用户身份（RLS 需要已认证角色）
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 随机获取一道题目（按时间倒序取最新一条）
    const { data: items, error } = await supabase
      .from('cloze_items')
      .select('*')
      .eq('lang', lang)
      .eq('level', levelNum)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Get cloze item error:', error);
      return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items available' }, { status: 404 });
    }

    const item = items[0];

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        lang: item.lang,
        level: item.level,
        topic: item.topic,
        title: item.title,
        passage: item.passage,
        blanks: item.blanks.map((blank: any) => ({
          id: blank.id,
          type: blank.type,
          explanation: blank.explanation
        }))
      }
    });

  } catch (error) {
    console.error('Get cloze item error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
