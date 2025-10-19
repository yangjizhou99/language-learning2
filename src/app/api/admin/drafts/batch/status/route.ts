export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = getServiceSupabase();
  const sp = new URL(req.url).searchParams;
  const id = sp.get('id');
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  const { data: batch, error } = await supabase
    .from('article_batches')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });

  // 统计各状态数量 & 按模型/难度聚合用量
  const { data: items } = await supabase
    .from('article_batch_items')
    .select('status, difficulty, usage, result_draft_id, error')
    .eq('batch_id', id)
    .order('created_at', { ascending: true });

  const counts: Record<string, number> = {
    pending: 0,
    processing: 0,
    done: 0,
    failed: 0,
    skipped: 0,
  };
  const perDifficulty: Record<string, any> = {};
  const usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  (items || []).forEach((it: any) => {
    counts[it.status] = (counts[it.status] || 0) + 1;
    const u = it.usage || {};
    usage.prompt_tokens += Number(u.prompt_tokens || 0);
    usage.completion_tokens += Number(u.completion_tokens || 0);
    usage.total_tokens += Number(u.total_tokens || 0);
    const k = String(it.difficulty);
    perDifficulty[k] = perDifficulty[k] || {
      tasks: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    perDifficulty[k].tasks += 1;
    perDifficulty[k].prompt_tokens += Number(u.prompt_tokens || 0);
    perDifficulty[k].completion_tokens += Number(u.completion_tokens || 0);
    perDifficulty[k].total_tokens += Number(u.total_tokens || 0);
  });

  return NextResponse.json({
    ok: true,
    batch: {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      provider: batch.provider,
      model: batch.model,
      lang: batch.lang,
      genre: batch.genre,
      words: batch.words,
      temperature: batch.temperature,
      totals: batch.totals,
      created_at: batch.created_at,
    },
    counts,
    perDifficulty,
    items: (items || []).slice(0, 50),
  });
}
