// =====================================================
// 生成英语句子的sentence_units关联
// POST /api/pronunciation/generate-sentence-units-en
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { batchGenerateEnglishSentenceUnits } from '@/lib/pronunciation/english-phoneme-extractor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/pronunciation/generate-sentence-units-en
 * 为英语句子生成sentence_units关联
 * 
 * 请求体:
 * {
 *   sentence_ids?: number[],  // 指定句子ID，为空则处理所有英语句子
 *   batch_size?: number       // 批处理大小，默认50
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      if (cookieHeader) {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(';').forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k.trim();
          const value = rest.join('=').trim();
          if (key) cookieMap.set(key, value);
        });
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      } else {
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get() { return null; },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 2. 解析参数
    const body = await req.json();
    const targetSentenceIds = body.sentence_ids || [];
    const batchSize = body.batch_size || 50;

    // 3. 获取需要处理的句子
    const supabaseAdmin = getServiceSupabase();
    let sentenceIds: number[];

    if (targetSentenceIds.length > 0) {
      // 验证指定的句子ID是否存在且为英语
      const { data: sentences, error: fetchError } = await supabaseAdmin
        .from('pron_sentences')
        .select('sentence_id')
        .in('sentence_id', targetSentenceIds)
        .eq('lang', 'en-US');

      if (fetchError) {
        throw new Error(`获取句子失败: ${fetchError.message}`);
      }

      sentenceIds = sentences?.map(s => s.sentence_id) || [];
      
      if (sentenceIds.length !== targetSentenceIds.length) {
        return NextResponse.json(
          { success: false, error: '部分句子ID不存在或不是英语句子' },
          { status: 400 }
        );
      }
    } else {
      // 获取所有英语句子
      const { data: sentences, error: fetchError } = await supabaseAdmin
        .from('pron_sentences')
        .select('sentence_id')
        .eq('lang', 'en-US')
        .order('sentence_id', { ascending: true });

      if (fetchError) {
        throw new Error(`获取英语句子失败: ${fetchError.message}`);
      }

      sentenceIds = sentences?.map(s => s.sentence_id) || [];
    }

    if (sentenceIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: '没有需要处理的英语句子',
        stats: {
          total_sentences: 0,
          processed: 0,
          success: 0,
          failed: 0,
          errors: []
        }
      });
    }

    // 4. 分批处理
    const results = {
      total_sentences: sentenceIds.length,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < sentenceIds.length; i += batchSize) {
      const batch = sentenceIds.slice(i, i + batchSize);
      const batchResult = await batchGenerateEnglishSentenceUnits(batch);
      
      results.processed += batch.length;
      results.success += batchResult.success;
      results.failed += batchResult.failed;
      results.errors.push(...batchResult.errors);

      // 添加进度日志
      console.log(`处理进度: ${results.processed}/${results.total_sentences}`);
    }

    // 5. 返回结果
    return NextResponse.json({
      success: true,
      message: `完成英语sentence_units生成: 成功${results.success}个，失败${results.failed}个`,
      stats: results
    });

  } catch (error) {
    console.error('[pronunciation/generate-sentence-units-en] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
