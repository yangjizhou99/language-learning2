export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { CacheManager } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const lang = searchParams.get('lang') || 'en';
    const level = parseInt(searchParams.get('level') || '2');

    // 参数校验
    if (!['en', 'ja', 'zh'].includes(lang)) {
      return NextResponse.json(
        { error: '无效的语言参数', code: 'BAD_REQUEST_LANG' },
        { status: 400 },
      );
    }
    if (level < 1 || level > 5) {
      return NextResponse.json(
        { error: '无效的等级参数', code: 'BAD_REQUEST_LEVEL' },
        { status: 400 },
      );
    }

    // 环境检查（部署最常见问题）
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        {
          error:
            '服务未配置，请在部署环境设置 SUPABASE_SERVICE_ROLE_KEY 与 NEXT_PUBLIC_SUPABASE_URL',
          code: 'SERVICE_NOT_CONFIGURED',
        },
        { status: 500 },
      );
    }

    // 生成缓存键
    const cacheKey = CacheManager.generateKey('shadowing:next', { lang, level });

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
            ETag: etag,
            'Cache-Control': 'public, s-maxage=300, max-age=60',
          },
        });
      }
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: etag,
          'Cache-Control': 'public, s-maxage=300, max-age=60',
        },
      });
    }

    // 使用请求去重防止并发请求
    const result = await CacheManager.dedupe(cacheKey, async () => {
      // 使用服务端密钥客户端以绕过 RLS（只读查询）
      const supabase = getServiceSupabase();

      // 查询题库
      const { data: items, error } = await supabase
        .from('shadowing_items')
        .select(
          'id, lang, level, title, text, audio_url, duration_ms, tokens, cefr, meta, translations, trans_updated_at, created_at, sentence_timeline',
        )
        .eq('lang', lang)
        .eq('level', level)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw new Error(`查询题库失败: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (!items || items.length === 0) {
        throw new Error('该等级暂无题目');
      }

      // 随机选择一道题
      const randomIndex = Math.floor(Math.random() * items.length);
      const selectedItem = items[randomIndex];

      return {
        item: {
          id: selectedItem.id,
          title: selectedItem.title,
          text: selectedItem.text,
          audio_url: selectedItem.audio_url,
          level: selectedItem.level,
          lang: selectedItem.lang,
          duration_ms: selectedItem.duration_ms,
          tokens: selectedItem.tokens,
          cefr: selectedItem.cefr,
          meta: selectedItem.meta,
          sentence_timeline: (selectedItem as unknown as { sentence_timeline?: unknown }).sentence_timeline || null,
        },
      };
    });

    // 缓存结果（5分钟）
    await CacheManager.set(cacheKey, result, 300);

    const body = JSON.stringify(result);
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const inm = req.headers.get('if-none-match');
    if (inm && inm === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, s-maxage=300, max-age=60',
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: etag,
        'Cache-Control': 'public, s-maxage=300, max-age=60',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: '服务器错误',
        code: 'UNEXPECTED',
        detail: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e),
      },
      { status: 500 },
    );
  }
}
