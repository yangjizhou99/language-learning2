export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type VocabUpdate = {
  id: string;
  srs_reps: number;
  srs_lapses: number;
  srs_interval: number;
  srs_ease: number;
  srs_due: string;
  srs_last: string;
  srs_state: 'review';
  updated_at: string;
};

const ReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.enum(['again', 'hard', 'good', 'easy']),
});

const BodySchema = z.object({
  reviews: z.array(ReviewSchema),
});

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function POST(req: NextRequest) {
  try {
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
          set() {},
          remove() {},
        },
      });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await req.json();
    const { reviews } = BodySchema.parse(body);

    if (reviews.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    // 获取所有需要更新的生词
    const entryIds = reviews.map(r => r.id);
    // 先尝试包含 SRS 列
    let { data: entries, error: fetchErr } = await supabase
      .from('vocab_entries')
      .select('id,srs_due,srs_interval,srs_ease,srs_reps,srs_lapses,status')
      .in('id', entryIds)
      .eq('user_id', user.id);

    // 若列不存在，降级只取基础列
    if (fetchErr && (fetchErr as any)?.code === '42703') {
      const fb = await supabase
        .from('vocab_entries')
        .select('id,status')
        .in('id', entryIds)
        .eq('user_id', user.id);
      if (fb.error) {
        return NextResponse.json({ error: '获取生词失败' }, { status: 500 });
      }
      entries = fb.data as any[];
      fetchErr = null as any;
    }

    if (fetchErr || !entries) {
      return NextResponse.json({ error: '获取生词失败' }, { status: 500 });
    }

    // 创建更新数据映射
    const entryMap = new Map(entries.map((entry: any) => [entry.id, entry]));
    const now = new Date();
  const updates: VocabUpdate[] = [];

    for (const review of reviews) {
      const entry: any = entryMap.get(review.id);
      if (!entry) continue;

      // SM-2 算法计算
      let reps: number = entry.srs_reps ?? 0;
      let lapses: number = entry.srs_lapses ?? 0;
      let interval: number = entry.srs_interval ?? 0;
      let ease: number = typeof entry.srs_ease === 'number' ? entry.srs_ease : 2.5;

      const qMap: Record<string, number> = { again: 1, hard: 3, good: 4, easy: 5 };
      const q = qMap[review.rating];

      if (q < 3) {
        reps = 0;
        lapses += 1;
        interval = 1; // 明天
        ease = Math.max(1.3, ease - 0.2);
      } else {
        reps += 1;
        if (reps === 1) {
          interval = 1;
        } else if (reps === 2) {
          interval = 6;
        } else {
          interval = Math.max(1, Math.round(interval * ease));
        }
        const newEase = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        ease = Math.max(1.3, Number(newEase.toFixed(2)));
      }

      const due = addDays(now, interval);

      updates.push({
        id: review.id,
        srs_reps: reps,
        srs_lapses: lapses,
        srs_interval: interval,
        srs_ease: ease,
        srs_due: due.toISOString(),
        srs_last: now.toISOString(),
        srs_state: 'review',
        updated_at: now.toISOString(),
      });
    }

    // 批量更新：若缺少 SRS 列则降级仅更新 updated_at
    let updateErr: any = null;
    const doUpsert = async (useDegrade: boolean) => {
      if (useDegrade) {
        const minimal = updates.map(u => ({ id: u.id, updated_at: u.updated_at }));
        return supabase
          .from('vocab_entries')
          .upsert(minimal, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });
      }
      return supabase
        .from('vocab_entries')
        .upsert(updates, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });
    };

    const upRes = await doUpsert(false);
    updateErr = upRes.error;
    if (updateErr && (updateErr as any)?.code === '42703') {
      const fbUp = await doUpsert(true);
      updateErr = fbUp.error;
    }

    if (updateErr) {
      console.error('批量更新复习结果失败:', updateErr);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      processed: updates.length 
    });
  } catch (e) {
    console.error('batch review route error:', e);
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: '请求格式错误', details: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
