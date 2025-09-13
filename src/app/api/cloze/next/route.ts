export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function createSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: '', ...options });
      },
    },
  });
}

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
    let supabase: any;
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

    // 生成缓存键
    const cacheKey = CacheManager.generateKey("cloze:next", { lang, level: levelNum });
    
    // 尝试从缓存获取
    const cached = await CacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 使用请求去重防止并发请求
    const result = await CacheManager.dedupe(cacheKey, async () => {
      // 随机获取一道题目
      const { data: items, error } = await supabase
        .from('cloze_items')
        .select('*')
        .eq('lang', lang)
        .eq('level', levelNum);

      if (error) {
        throw new Error(`Failed to get item: ${error.message}`);
      }

      if (!items || items.length === 0) {
        throw new Error('No items available');
      }

      // 随机选择一道题目
      const randomIndex = Math.floor(Math.random() * items.length);
      const item = items[randomIndex];
      console.log(`Randomly selected item ${randomIndex + 1} of ${items.length}: ${item.title}`);

      return item;
    });

    // 缓存结果（5分钟）
    await CacheManager.set(cacheKey, result, 300);

    const item = result;

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
        
        // 尝试多种可能的字段名
        const answer = blank?.answer || blank?.correct_answer || blank?.text || blank?.value || blank?.content || blank?.reference || '';
        const explanation = blank?.explanation || blank?.hint || blank?.reason || blank?.description || '';
        
        return {
          id,
          type: blank?.type || 'mixed',
          answer,
          explanation
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
