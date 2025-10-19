// =====================================================
// 获取用户评测记录 API
// 返回用户所有的评测记录（按句子分组）
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pronunciation/my-attempts?lang=zh-CN
 * 获取用户的评测记录（按句子分组，只返回最新的一次）
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
    const lang = searchParams.get('lang') || 'zh-CN';

    // 3. 获取用户的句子进度（从user_sentence_progress表）
    const supabaseAdmin = getServiceSupabase();

    const { data: progress, error: progressError } = await supabaseAdmin
      .from('user_sentence_progress')
      .select('sentence_id, status, attempts_count, best_score, latest_score, last_attempt_at')
      .eq('user_id', user.id)
      .order('last_attempt_at', { ascending: false });

    if (progressError) {
      throw new Error(`获取句子进度失败: ${progressError.message}`);
    }

    // 4. 获取最新的评测记录（用于音频路径）
    const { data: latestAttempts, error: attemptsError } = await supabaseAdmin
      .from('user_pron_attempts')
      .select('sentence_id, audio_path')
      .eq('user_id', user.id)
      .eq('lang', lang)
      .order('created_at', { ascending: false });

    if (attemptsError) {
      throw new Error(`获取评测记录失败: ${attemptsError.message}`);
    }

    // 5. 合并数据：进度 + 音频路径
    const audioPathMap = new Map<number, string>();
    for (const attempt of latestAttempts || []) {
      if (!attempt.sentence_id || audioPathMap.has(attempt.sentence_id)) continue;
      if (attempt.audio_path) {
        audioPathMap.set(attempt.sentence_id, attempt.audio_path);
      }
    }

    // 6. 转换为返回格式
    const result = (progress || []).map((prog) => ({
      sentence_id: prog.sentence_id,
      pron_score: Number(prog.latest_score || prog.best_score || 0),
      valid_flag: prog.status === 'completed',
      audio_path: audioPathMap.get(prog.sentence_id),
      created_at: prog.last_attempt_at,
      attempt_count: prog.attempts_count || 0,
      best_score: Number(prog.best_score || 0),
    }));

    return NextResponse.json({
      success: true,
      attempts: result,
      total: result.length,
    });
  } catch (error) {
    console.error('[pronunciation/my-attempts] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

