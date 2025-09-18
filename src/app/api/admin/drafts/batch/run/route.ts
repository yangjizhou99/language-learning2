export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { normUsage, sumUsage, type Usage } from '@/lib/ai/usage';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

function buildPrompt(b: any) {
  const L = b.lang === 'zh' ? '简体中文' : b.lang === 'ja' ? '日本語' : 'English';
  const len = Math.max(150, Math.min(1200, b.words || 300));
  const genreMap: any = {
    news: '新闻报道',
    science: '科普说明文',
    essay: '随笔/评论',
    dialogue: '对话体',
    literature: '叙事短文',
  };
  return `你是语言教学素材生成器。用 ${L} 写一篇 ${genreMap[b.genre]}，面向 L${b.difficulty} 学习者。
${b.topic ? `主题：${b.topic}\n` : ''}长度约 ${len} ${b.lang === 'en' ? 'words' : '字'}（±20%），原创、2–6 段，仅以 JSON 输出：{"title":"...","text":"..."}。`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = getServiceSupabase();
  const { id, limit = 3 } = await req.json();

  // 读批次
  const { data: batch, error: e0 } = await supabase
    .from('article_batches')
    .select('*')
    .eq('id', id)
    .single();
  if (e0 || !batch) return NextResponse.json({ error: 'batch not found' }, { status: 404 });
  if (batch.status === 'done' || batch.status === 'canceled') {
    return NextResponse.json({
      ok: true,
      processed: 0,
      remaining: 0,
      totals: batch.totals,
      note: 'batch finished',
    });
  }

  // 取若干 pending（先查，再逐条“原子认领”）
  const { data: candidates } = await supabase
    .from('article_batch_items')
    .select('id,topic,difficulty,status')
    .eq('batch_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(10, limit)));

  if (!candidates || candidates.length === 0) {
    // 没有待处理 → 置 done
    await supabase
      .from('article_batches')
      .update({ status: 'done', updated_at: new Date().toISOString() })
      .eq('id', id);
    return NextResponse.json({ ok: true, processed: 0, remaining: 0, totals: batch.totals });
  }

  // 标记批次为 running
  if (batch.status !== 'running') {
    await supabase.from('article_batches').update({ status: 'running' }).eq('id', id);
  }

  let processed = 0;
  let usageDelta: Usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const errors: any[] = [];

  for (const item of candidates) {
    // 原子认领（只把 pending 改为 processing，避免并发重复处理）
    const { data: claimed, error: eClaim } = await supabase
      .from('article_batch_items')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id')
      .single();
    if (eClaim || !claimed) continue;

    try {
      // 1) 调模型生成
      const prompt = buildPrompt({
        lang: batch.lang,
        genre: batch.genre,
        difficulty: item.difficulty,
        topic: item.topic,
        words: batch.words,
      });
      const { content, usage } = await chatJSON({
        provider: batch.provider,
        model: batch.model,
        temperature: batch.temperature,
        messages: [
          { role: 'system', content: 'You are a helpful writing assistant.' },
          { role: 'user', content: prompt },
        ],
        response_json: true,
      });
      const u = normUsage(usage);

      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('LLM 未返回 JSON');
      }
      const title = (parsed.title || 'Untitled').slice(0, 200);
      const text: string = String(parsed.text || '').trim();
      if (text.length < 200) throw new Error('文本过短');

      // 2) 写入草稿（不生成答案；keys/cloze 为空，后续在草稿详情页生成）
      const { data: draft, error: eDraft } = await supabase
        .from('article_drafts')
        .insert([
          {
            source: 'ai',
            lang: batch.lang,
            genre: batch.genre,
            difficulty: item.difficulty,
            title,
            text,
            license: 'AI-Generated',
            ai_provider: batch.provider,
            ai_model: batch.model,
            ai_params: { temperature: batch.temperature, topic: item.topic, words: batch.words },
            ai_usage: u,
            keys: { pass1: [], pass2: [], pass3: [] },
            cloze_short: [],
            cloze_long: [],
            validator_report: { len: text.length },
            status: 'pending',
            created_by: auth.user.id,
          },
        ])
        .select('id')
        .single();
      if (eDraft) throw new Error(eDraft.message);

      // 4) 更新队列项 & 批次用量
      await supabase
        .from('article_batch_items')
        .update({
          status: 'done',
          result_draft_id: draft.id,
          usage: u,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      const newTotals = sumUsage(batch.totals || {}, u);
      await supabase
        .from('article_batches')
        .update({
          totals: newTotals,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      // 本地累计
      usageDelta = sumUsage(usageDelta, u);
      (batch as any).totals = newTotals;
      processed++;
    } catch (err: any) {
      errors.push({ id: item.id, error: String(err?.message || err) });
      await supabase
        .from('article_batch_items')
        .update({
          status: 'failed',
          error: String(err?.message || err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    }
  }

  // 剩余数
  const { count } = await supabase
    .from('article_batch_items')
    .select('*', { head: true, count: 'exact' })
    .eq('batch_id', id)
    .eq('status', 'pending');

  if (!count || count === 0)
    await supabase.from('article_batches').update({ status: 'done' }).eq('id', id);

  return NextResponse.json({
    ok: true,
    batch_id: id,
    processed,
    remaining: count || 0,
    usage_delta: usageDelta,
    totals: batch.totals,
    errors,
  });
}
