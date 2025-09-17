export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';
import { getUserPermissions, checkLevelPermission, checkLanguagePermission, checkAccessPermission } from '@/lib/user-permissions-server';

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

    // 获取用户权限
    const permissions = await getUserPermissions(user.id);
    console.log('User permissions:', permissions);

    // 检查是否有访问Cloze的权限
    if (!checkAccessPermission(permissions, 'can_access_cloze')) {
      console.log('User does not have cloze access permission');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 检查等级权限
    if (!checkLevelPermission(permissions, levelNum)) {
      console.log('User does not have permission for level:', levelNum);
      return NextResponse.json({ error: 'Access denied for this level' }, { status: 403 });
    }

    // 检查语言权限
    if (!checkLanguagePermission(permissions, lang)) {
      console.log('User does not have permission for language:', lang);
      return NextResponse.json({ error: 'Access denied for this language' }, { status: 403 });
    }

    // 生成缓存键
    const cacheKey = CacheManager.generateKey("cloze:next", { lang, level: levelNum });
    
    // 尝试从缓存获取
    const cached = await CacheManager.get(cacheKey);
    if (cached) {
      const body = JSON.stringify(cached);
      const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
      const inm = req.headers.get('if-none-match');
      if (inm && inm === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            'ETag': etag,
            'Cache-Control': 'public, s-maxage=300, max-age=60'
          }
        });
      }
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'ETag': etag,
          'Cache-Control': 'public, s-maxage=300, max-age=60'
        }
      });
    }

    // 使用请求去重防止并发请求
    const result = await CacheManager.dedupe(cacheKey, async () => {
      // 随机获取一道题目
      const { data: items, error } = await supabase
        .from('cloze_items')
        .select('id,lang,level,topic,title,passage,blanks')
        .eq('lang', lang)
        .eq('level', levelNum);

      if (error) {
        throw new Error(`Failed to get item: ${error instanceof Error ? error.message : String(error)}`);
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

    const responseBody = JSON.stringify({
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

    const etag2 = '"' + crypto.createHash('sha1').update(responseBody).digest('hex') + '"';
    const inm2 = req.headers.get('if-none-match');
    if (inm2 && inm2 === etag2) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag2,
          'Cache-Control': 'public, s-maxage=300, max-age=60'
        }
      });
    }

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag2,
        'Cache-Control': 'public, s-maxage=300, max-age=60'
      }
    });

  } catch (error) {
    console.error('Get cloze item error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Internal server error' 
    }, { status: 500 });
  }
}
