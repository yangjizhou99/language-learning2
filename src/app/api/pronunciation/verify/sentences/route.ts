// =====================================================
// 二次验证 - 获取验证句子
// GET /api/pronunciation/verify/sentences?unit_id=123
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { needsSecondaryVerification } from '@/lib/pronunciation/verification';
import type { Stat } from '@/types/pronunciation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/verify/sentences?unit_id=123&lang=zh-CN&count=6
 * 获取用于二次验证的句子列表
 */
export async function GET(req: NextRequest) {
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
        const cookieStore = await cookies();
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
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
    const { searchParams } = new URL(req.url);
    const unitId = parseInt(searchParams.get('unit_id') || '0');
    const lang = searchParams.get('lang') || 'zh-CN';
    const count = parseInt(searchParams.get('count') || '6');

    if (!unitId) {
      return NextResponse.json(
        { success: false, error: '缺少 unit_id 参数' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();

    // 3. 查询该 Unit 的统计数据
    const { data: unitStat, error: statError } = await supabaseAdmin
      .from('user_unit_stats')
      .select('n, mean, m2, ci_low, ci_high')
      .eq('user_id', user.id)
      .eq('lang', lang)
      .eq('unit_id', unitId)
      .maybeSingle();

    if (statError) {
      throw new Error(`查询统计数据失败: ${statError.message}`);
    }

    if (!unitStat) {
      return NextResponse.json(
        { success: false, error: '该音节暂无统计数据' },
        { status: 404 }
      );
    }

    // 4. 检查是否需要验证
    const stat: Stat = {
      n: unitStat.n,
      mean: Number(unitStat.mean),
      m2: Number(unitStat.m2),
    };

    const needsVerification = needsSecondaryVerification(stat);

    // 5. 查询包含该 Unit 的句子（通过 sentence_units 表）
    const { data: sentenceUnits, error: suError } = await supabaseAdmin
      .from('sentence_units')
      .select(`
        sentence_id,
        count,
        pron_sentences!inner(sentence_id, text, level)
      `)
      .eq('unit_id', unitId)
      .order('count', { ascending: false }) // 包含该音节次数多的优先
      .limit(count * 2); // 多查一些备选

    if (suError) {
      throw new Error(`查询句子失败: ${suError.message}`);
    }

    // 6. 筛选句子（难度适中，优先选择 level 2-3）
    const candidateSentences = (sentenceUnits || []).map((su: any) => ({
      sentence_id: su.pron_sentences.sentence_id,
      text: su.pron_sentences.text,
      level: su.pron_sentences.level || 2,
      unit_count: su.count,
    }));

    // 按 level 接近 2-3 排序
    candidateSentences.sort((a, b) => {
      const aScore = Math.abs(a.level - 2.5);
      const bScore = Math.abs(b.level - 2.5);
      return aScore - bScore;
    });

    const selectedSentences = candidateSentences.slice(0, count);

    // 7. 如果句子不够，补充其他句子（优先选择未练过的）
    if (selectedSentences.length < count) {
      // 7.1 获取用户已练过的句子ID
      const { data: practiced } = await supabaseAdmin
        .from('user_sentence_progress')
        .select('sentence_id')
        .eq('user_id', user.id);
      
      const practicedIds = new Set((practiced || []).map((p: any) => p.sentence_id));
      const selectedIds = selectedSentences.map(s => s.sentence_id);
      
      // 7.2 先尝试获取未练过的句子
      const { data: unpracticedSentences } = await supabaseAdmin
        .from('pron_sentences')
        .select('sentence_id, text, level')
        .eq('lang', lang)
        .not('sentence_id', 'in', `(${selectedIds.join(',')})`)
        .gte('level', 2)
        .lte('level', 3)
        .limit(count * 2);  // 多查一些
      
      // 过滤掉已练过的，优先选未练过的
      const unpracticed = (unpracticedSentences || [])
        .filter((s: any) => !practicedIds.has(s.sentence_id))
        .slice(0, count - selectedSentences.length);
      
      selectedSentences.push(...unpracticed.map((s: any) => ({
        sentence_id: s.sentence_id,
        text: s.text,
        level: s.level,
        unit_count: 0,
      })));
      
      // 7.3 如果未练过的还不够，再补充已练过的
      if (selectedSentences.length < count) {
        const practiced = (unpracticedSentences || [])
          .filter((s: any) => practicedIds.has(s.sentence_id))
          .slice(0, count - selectedSentences.length);
        
        selectedSentences.push(...practiced.map((s: any) => ({
          sentence_id: s.sentence_id,
          text: s.text,
          level: s.level,
          unit_count: 0,
        })));
      }
    }

    // 8. 获取音节符号
    const { data: unitInfo } = await supabaseAdmin
      .from('unit_catalog')
      .select('symbol')
      .eq('unit_id', unitId)
      .single();

    return NextResponse.json({
      success: true,
      unit: {
        unit_id: unitId,
        symbol: unitInfo?.symbol || '',
        current_mean: Number(unitStat.mean.toFixed(1)),
        current_count: unitStat.n,
        needs_verification: needsVerification,
      },
      sentences: selectedSentences.map(s => ({
        sentence_id: s.sentence_id,
        text: s.text,
        level: s.level,
      })),
      total: selectedSentences.length,
    });
  } catch (error) {
    console.error('[pronunciation/verify/sentences] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

