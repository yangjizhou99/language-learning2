// =====================================================
// 发音评测记录上报 API
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { parseAzureResult, aggregateToUnits, getOrCreateUnitId } from '@/lib/pronunciation/parser';
import { welfordUpdate, welfordRemove, ci95, isValidSample } from '@/lib/pronunciation/stats';
import type { AttemptRequest, AttemptResponse } from '@/types/pronunciation';

// 每句最多保留的评测记录数
const MAX_ATTEMPTS_PER_SENTENCE = 3;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 更新用户句子进度表
 */
async function updateSentenceProgress(
  supabaseAdmin: SupabaseClient,
  userId: string,
  sentenceId: number,
  score: number,
  isValid: boolean
) {
  try {
    // 查询现有进度
    const { data: existing } = await supabaseAdmin
      .from('user_sentence_progress')
      .select('attempts_count, best_score, first_attempt_at')
      .eq('user_id', userId)
      .eq('sentence_id', sentenceId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // 更新现有记录
      await supabaseAdmin
        .from('user_sentence_progress')
        .update({
          attempts_count: (existing.attempts_count || 0) + 1,
          best_score: Math.max(existing.best_score || 0, score),
          latest_score: score,
          last_attempt_at: now,
          status: isValid ? 'completed' : 'pending',
        })
        .eq('user_id', userId)
        .eq('sentence_id', sentenceId);
    } else {
      // 创建新记录
      await supabaseAdmin
        .from('user_sentence_progress')
        .insert({
          user_id: userId,
          sentence_id: sentenceId,
          attempts_count: 1,
          best_score: score,
          latest_score: score,
          first_attempt_at: now,
          last_attempt_at: now,
          status: isValid ? 'completed' : 'pending',
        });
    }
  } catch (error) {
    console.error('更新句子进度失败:', error);
  }
}

/**
 * 清理旧的评测记录（保留最多 MAX_ATTEMPTS_PER_SENTENCE 次）
 * 删除最旧的记录、音频文件，并从统计中移除
 */
type PronAttemptRow = {
  attempt_id: string;
  azure_raw_json: unknown;
  audio_path: string | null;
  valid_flag: boolean | null;
  created_at: string;
};

async function cleanupOldAttempts(
  supabaseAdmin: SupabaseClient,
  userId: string,
  sentenceId: number,
  lang: string
) {
  // 1. 查询该句子的所有评测记录，按时间倒序
  const { data: existingAttempts, error: queryError } = await supabaseAdmin
    .from('user_pron_attempts')
    .select('attempt_id, azure_raw_json, audio_path, valid_flag, created_at')
    .eq('user_id', userId)
    .eq('sentence_id', sentenceId)
    .eq('lang', lang)
    .order('created_at', { ascending: false });

  if (queryError || !existingAttempts || existingAttempts.length < MAX_ATTEMPTS_PER_SENTENCE) {
    return; // 不需要清理
  }

  // 2. 删除最旧的记录（保留前 MAX_ATTEMPTS_PER_SENTENCE - 1 条）
  const toDelete = (existingAttempts as PronAttemptRow[]).slice(
    MAX_ATTEMPTS_PER_SENTENCE - 1,
  );

  for (const oldAttempt of toDelete) {
    try {
      // 2.1 如果是有效样本，需要从统计中移除
      if (oldAttempt.valid_flag && oldAttempt.azure_raw_json) {
        const parsed = parseAzureResult(oldAttempt.azure_raw_json);
        const bySymbol = aggregateToUnits(parsed.units, lang);

        for (const [symbol, agg] of bySymbol.entries()) {
          const unit_id = await getOrCreateUnitId(lang, symbol);
          const oldScore = agg.sum / Math.max(1, agg.cnt);

          // 读取当前统计
          const { data: curStat } = await supabaseAdmin
            .from('user_unit_stats')
            .select('n, mean, m2')
            .eq('user_id', userId)
            .eq('lang', lang)
            .eq('unit_id', unit_id)
            .maybeSingle();

          if (curStat && curStat.n > 0) {
            // 从统计中移除这个样本
            const nextStat = welfordRemove(curStat, oldScore);
            const ci = ci95(nextStat);

            if (nextStat.n > 0) {
              // 更新统计
              await supabaseAdmin
                .from('user_unit_stats')
                .update({
                  n: nextStat.n,
                  mean: nextStat.mean,
                  m2: nextStat.m2,
                  ci_low: ci.low,
                  ci_high: ci.high,
                  last_updated: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .eq('lang', lang)
                .eq('unit_id', unit_id);
            } else {
              // 如果没有样本了，删除统计记录
              await supabaseAdmin
                .from('user_unit_stats')
                .delete()
                .eq('user_id', userId)
                .eq('lang', lang)
                .eq('unit_id', unit_id);
            }
          }
        }
      }

      // 2.2 删除音频文件
      if (oldAttempt.audio_path) {
        try {
          await supabaseAdmin.storage
            .from('pronunciation-audio')
            .remove([oldAttempt.audio_path]);
        } catch (err) {
          console.error('删除音频文件失败:', err);
        }
      }

      // 2.3 删除评测记录
      await supabaseAdmin
        .from('user_pron_attempts')
        .delete()
        .eq('attempt_id', oldAttempt.attempt_id);

      console.log(`已清理旧记录: sentence_id=${sentenceId}, attempt_id=${oldAttempt.attempt_id}`);
    } catch (err) {
      console.error('清理旧记录失败:', err);
    }
  }
}

/**
 * POST /api/pronunciation/attempts
 * 上报评测记录并更新统计
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份（使用项目标准认证方式）
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

    // 2. 解析请求
    const body: AttemptRequest = await req.json();
    const { sentence_id, lang, azure_json, audio_path } = body;

    if (!lang || !azure_json) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 3. 解析 Azure 结果
    const parsed = parseAzureResult(azure_json);
    const valid = isValidSample(parsed.completeness);

    // 4. 使用 service role 插入数据
    const supabaseAdmin = getServiceSupabase();

    // 4.1 清理旧记录（如果该句子已有 >= MAX_ATTEMPTS_PER_SENTENCE 次记录）
    if (sentence_id) {
      await cleanupOldAttempts(supabaseAdmin, user.id, sentence_id, lang);
    }

    // 4.2 插入评测记录
    const { data: attempt, error: insertError } = await supabaseAdmin
      .from('user_pron_attempts')
      .insert({
        user_id: user.id,
        lang,
        sentence_id: sentence_id ?? null,
        azure_raw_json: azure_json,
        accuracy: parsed.accuracy,
        fluency: parsed.fluency,
        completeness: parsed.completeness,
        prosody: parsed.prosody ?? null,
        pron_score: parsed.pronScore,
        valid_flag: valid,
        audio_path: audio_path ?? null,
      })
      .select('attempt_id')
      .single();

    if (insertError) {
      throw new Error(`插入评测记录失败: ${insertError.message}`);
    }

    // 4.3 更新 user_sentence_progress 表
    if (sentence_id) {
      await updateSentenceProgress(supabaseAdmin, user.id, sentence_id, parsed.pronScore, valid);
    }

    // 5. 如果是有效样本，更新 Unit 统计
    const updated_units: Array<{
      unit_id: number;
      n: number;
      mean: number;
      ci_low?: number;
      ci_high?: number;
    }> = [];

    if (valid && parsed.units.length > 0) {
      // 将同一符号的多次出现求平均
      const bySymbol = aggregateToUnits(parsed.units, lang);

      for (const [symbol, agg] of bySymbol.entries()) {
        try {
          // 获取或创建 Unit ID
          const unit_id = await getOrCreateUnitId(lang, symbol);
          const score = agg.sum / Math.max(1, agg.cnt);

          // 读取当前统计
          const { data: curStat, error: fetchError } = await supabaseAdmin
            .from('user_unit_stats')
            .select('n, mean, m2')
            .eq('user_id', user.id)
            .eq('lang', lang)
            .eq('unit_id', unit_id)
            .maybeSingle();

          if (fetchError) {
            console.error(`读取 Unit 统计失败 (${symbol}):`, fetchError);
            continue;
          }

          // Welford 更新
          const currentStat = curStat ?? { n: 0, mean: 0, m2: 0 };
          const nextStat = welfordUpdate(currentStat, score);
          const ci = ci95(nextStat);

          // 更新或插入统计
          const { error: upsertError } = await supabaseAdmin
            .from('user_unit_stats')
            .upsert({
              user_id: user.id,
              lang,
              unit_id,
              n: nextStat.n,
              mean: nextStat.mean,
              m2: nextStat.m2,
              ci_low: ci.low,
              ci_high: ci.high,
              last_updated: new Date().toISOString(),
            });

          if (upsertError) {
            console.error(`更新 Unit 统计失败 (${symbol}):`, upsertError);
            continue;
          }

          updated_units.push({
            unit_id,
            n: nextStat.n,
            mean: nextStat.mean,
            ci_low: ci.low,
            ci_high: ci.high,
          });
        } catch (err) {
          console.error(`处理 Unit ${symbol} 失败:`, err);
        }
      }
    }

    // 6. 返回结果
    const response: AttemptResponse = {
      attempt_id: attempt.attempt_id,
      valid,
      updated_units,
    };

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('[pronunciation/attempts] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

