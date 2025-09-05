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

    // 随机获取一道题目
    const { data: items, error } = await supabase
      .from('cloze_items')
      .select('*')
      .eq('lang', lang)
      .eq('level', levelNum);

    if (error) {
      console.error('Get cloze item error:', error);
      return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items available' }, { status: 404 });
    }

    // 随机选择一道题目
    const randomIndex = Math.floor(Math.random() * items.length);
    const item = items[randomIndex];
    console.log(`Randomly selected item ${randomIndex + 1} of ${items.length}: ${item.title}`);

    // 兼容缺失 id 的 blanks（从 placeholder 提取或按顺序补齐）
    const blanksRaw = Array.isArray(item.blanks) ? item.blanks : [];
    const blanks = blanksRaw
      .map((blank: any, idx: number) => {
        let id: number | null = null;
        if (typeof blank?.id === 'number') id = blank.id;
        if (id === null && typeof blank?.placeholder === 'string') {
          const m = blank.placeholder.match(/\{\{(\d+)\}\}/);
          if (m) id = Number(m[1]);
        }
        if (id === null) id = idx + 1;
        return {
          id,
          type: blank?.type || 'mixed',
          answer: blank?.answer || '',
          explanation: blank?.explanation || ''
        };
      })
      .sort((a: any, b: any) => a.id - b.id);

    return NextResponse.json({
      success: true,
      item: {
        id: item.id,
        lang: item.lang,
        level: item.level,
        topic: item.topic,
        title: item.title,
        passage: item.passage,
        blanks
      }
    });

  } catch (error) {
    console.error('Get cloze item error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
