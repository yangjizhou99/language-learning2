export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { splitSentencesWithIndex } from '@/lib/nlp/segment';
import { chatJSON } from '@/lib/ai/client';

type Lang = 'en' | 'ja' | 'zh';

function sse(obj: any) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt({ lang, sentence, seed }: { lang: Lang; sentence: string; seed: string }) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  return `You are creating a single-blank cloze question from a short passage (one or two sentences).
LANG=${L}
SEED=${seed}  // use deterministically, avoid randomness beyond seed

INPUT_PASSAGE:
"""
${sentence}
"""

Rules:
- Select exactly ONE span suitable for testing; it can be a single word, a phrase, or the ENTIRE sentence.
- Avoid trivial spans: proper nouns, numbers, dates, URLs, brand/person/place names, pure punctuation.
- Prefer grammar-bearing tokens, fixed expressions, or a whole sentence that is meaningful to test.
- Keep the passage otherwise unchanged.
IMPORTANT: Do NOT return character positions. Return ONLY the exact blank string as it appears in the passage.
The blank string MUST be a contiguous substring of the input passage, without extra quotes or surrounding punctuation.

Return STRICT JSON:
{
  "blank_text": string
}`.trim();
}

function splitDialogueTurns(text: string) {
  const joined = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');

  const re = /([A-Za-z]{1,10}|[Ａ-Ｚ])\s*[:：]\s*/g;
  const matches: Array<{ speaker: string; labelStart: number; contentStart: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(joined))) {
    const speaker = String(m[1] || '').trim();
    matches.push({ speaker, labelStart: m.index, contentStart: re.lastIndex });
  }

  const turns: Array<{ text: string }> = [];
  if (matches.length === 0) {
    const t = joined.trim();
    return t ? [{ text: t }] : [];
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].labelStart : joined.length;
    const content = joined.slice(cur.contentStart, nextStart).trim();
    if (content) {
      turns.push({ text: `${cur.speaker}: ${content}` });
    }
  }

  return turns;
}

function buildFixedDistractorsPrompt({
  lang,
  maskedText,
  referenceAnswer,
}: {
  lang: Lang;
  maskedText: string;
  referenceAnswer: string;
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const lenRule = lang === 'en' ? 'each option ≤ 20 characters' : '每个选项长度≤12字符';
  return `You are given a short passage with a single blank marked as [[BLANK]].
LANG=${L}

PASSAGE_WITH_BLANK:
"""
${maskedText}
"""

REFERENCE_ANSWER (the ONLY correct answer, exactly as in the original passage):
"""
${referenceAnswer}
"""

Task:
- Propose EXACTLY 3 distractors for [[BLANK]] that are CLEARLY incorrect in THIS context.
- Avoid borderline/arguably acceptable items; avoid near-synonyms or spelling variants of the reference; avoid duplicates; ${lenRule}.
- Return ONLY JSON.

Return JSON strictly:
{ "distractors": ["...", "...", "..."] }`;
}

function findBlankIndex(haystack: string, needle: string): number {
  if (!haystack || !needle) return -1;
  const n = needle.trim();
  if (!n) return -1;
  let idx = haystack.indexOf(n);
  if (idx !== -1) return idx;
  const stripped = n.replace(/^[\'\"“”‘’]/, '').replace(/[\'\"“”‘’]$/, '').trim();
  if (stripped && stripped !== n) {
    idx = haystack.indexOf(stripped);
    if (idx !== -1) return idx;
  }
  const idxLower = haystack.toLowerCase().indexOf(n.toLowerCase());
  return idxLower;
}

async function getItems(
  params: {
    item_ids?: string[];
    theme_id?: string;
    subtopic_id?: string;
    lang?: Lang;
    level?: number;
    limit?: number;
    onlyMissing?: boolean;
  },
  supabase: any,
) {
  type ItemRow = {
    id: string;
    lang: Lang;
    level: number;
    title: string;
    text: string;
    audio_url: string | null;
    translations: Record<string, string> | null;
    status: string | null;
    theme_id?: string | null;
    subtopic_id?: string | null;
    genre?: string | null;
  };

  let items: ItemRow[] | null = null;

  if (Array.isArray(params.item_ids) && params.item_ids.length > 0) {
    const { data, error } = await supabase
      .from('shadowing_items')
      .select('id, lang, level, title, text, audio_url, translations, status, theme_id, subtopic_id, genre')
      .in('id', params.item_ids)
      .eq('status', 'approved')
      .not('audio_url', 'is', null);
    if (error) throw new Error(error.message);
    items = (data || []) as ItemRow[];
  } else {
    let query = supabase
      .from('shadowing_items')
      .select('id, lang, level, title, text, audio_url, translations, status, theme_id, subtopic_id, genre')
      .eq('status', 'approved')
      .not('audio_url', 'is', null);

    if (params.lang) query = query.eq('lang', params.lang);
    if (params.level) query = query.eq('level', params.level);
    if (params.theme_id) query = query.eq('theme_id', params.theme_id);
    if (params.subtopic_id) query = query.eq('subtopic_id', params.subtopic_id);

    const { data, error } = await query.limit(Math.max(1, Math.min(1000, params.limit || 20)));
    if (error) throw new Error(error.message);
    items = (data || []) as ItemRow[];
  }

  const base = (items || []).filter(
    (it: ItemRow) => !!it && !!it.translations && Object.keys(it.translations || {}).length > 0,
  );

  if (!params.onlyMissing || base.length === 0) return base;

  // 仅未生成题目的文章：过滤掉已经在 cloze_shadowing_items 中出现过的 source_item_id
  const ids = base.map((i) => i.id);
  const { data: existed } = await supabase
    .from('cloze_shadowing_items')
    .select('source_item_id')
    .in('source_item_id', ids);
  const existSet = new Set((existed || []).map((r: any) => r.source_item_id));
  return base.filter((it) => !existSet.has(it.id));
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const body = (await req.json().catch(() => ({}))) as any;
    const {
      theme_id,
      subtopic_id,
      lang,
      level,
      provider = 'deepseek',
      model,
      limit = 20,
      item_ids,
      concurrency = 20,
      retries = 2,
      throttle = 100,
      only_missing = false,
      only_unclozed = false,
    } = body || {};

    const items = await getItems(
      {
        item_ids,
        theme_id,
        subtopic_id,
        lang,
        level,
        limit,
        onlyMissing: Boolean(only_missing || only_unclozed),
      },
      supabase,
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const total = items.length;
          controller.enqueue(encoder.encode(sse({ type: 'start', total })));

          let done = 0;
          const details: Array<{ source_item_id: string; sentences: number; created: number }> = [];

          async function withRetry<T>(fn: () => Promise<T>, retryTimes: number) {
            let lastErr: any;
            for (let i = 0; i <= retryTimes; i++) {
              try {
                return await fn();
              } catch (err) {
                lastErr = err;
                if (i < retryTimes) await sleep(200 + i * 400);
              }
            }
            throw lastErr;
          }

          let idx = 0;
          const workerCount = Math.max(1, Number(concurrency) || 1);
          const workers = Array.from({ length: workerCount }, async () => {
            while (idx < items.length) {
              const i = idx++;
              const it = items[i];
              controller.enqueue(encoder.encode(sse({ type: 'progress', idx: i, id: it.id, title: it.title })));
              try {
                const res = await withRetry(async () => {
                  // 清空旧记录
                  await supabase.from('cloze_shadowing_items').delete().eq('source_item_id', it.id);

                  const isDialogue = it.genre === 'dialogue' || /^(dialogue|conversation)$/i.test(String(it.genre || ''));
                  const sents = isDialogue
                    ? splitDialogueTurns(it.text)
                    : splitSentencesWithIndex(it.text, (it.lang || 'en') as Lang);

                  let createdForItem = 0;
                  const used = new Set<number>();
                  const covered = new Set<number>();
                  const singleSentenceRatioCache: Record<number, number> = {};

                  const callAI = async (text: string, seed: string) => {
                    const prompt = buildPrompt({ lang: (it.lang || 'en') as Lang, sentence: text, seed });
                    const resp = await chatJSON({
                      provider,
                      model:
                        model ||
                        (provider === 'openrouter'
                          ? 'anthropic/claude-3.5-sonnet'
                          : provider === 'openai'
                            ? 'gpt-4o'
                            : 'deepseek-chat'),
                      temperature: 0.2,
                      response_json: true,
                      messages: [
                        { role: 'system', content: 'Return VALID JSON only. Follow instructions strictly.' },
                        { role: 'user', content: prompt },
                      ],
                    });
                    const content = resp.content || '';
                    let parsed: { blank_text?: unknown } = {};
                    try { parsed = JSON.parse(content); } catch {}
                    const blankText = typeof parsed?.blank_text === 'string' ? (parsed.blank_text as string).trim() : '';
                    return { blankText } as const;
                  };

                  const getBlankForText = async (
                    text: string,
                    seed: string,
                  ): Promise<
                    | { ok: true; blankText: string; blankStart: number; blankLength: number; ratio: number }
                    | { ok: false }
                  > => {
                    const attempt = await callAI(text, seed);
                    const idx0 = attempt.blankText ? findBlankIndex(text, attempt.blankText) : -1;
                    const ok = typeof attempt.blankText === 'string' && attempt.blankText.length > 0 && idx0 >= 0;
                    if (!ok) return { ok: false };
                    const blankLength = (attempt.blankText || '').length;
                    if (blankLength <= 0 || idx0 < 0 || idx0 + blankLength > text.length) return { ok: false };
                    const ratio = blankLength / Math.max(1, text.length);
                    return { ok: true, blankText: attempt.blankText, blankStart: idx0, blankLength, ratio };
                  };

                  const measureSingleSentenceRatio = async (j: number) => {
                    if (j < 0 || j >= sents.length) return -1;
                    if (singleSentenceRatioCache[j] !== undefined) return singleSentenceRatioCache[j];
                    const text = sents[j].text;
                    const seed = `${it.id}:${j}`;
                    const res = await getBlankForText(text, seed);
                    const r = res.ok ? res.ratio : 0;
                    singleSentenceRatioCache[j] = r;
                    return r;
                  };

                  for (let j = 0; j < sents.length; j++) {
                    if (used.has(j)) continue;
                    let unitStart = j;
                    let unitEnd = j;

                    const { data: existing } = await supabase
                      .from('cloze_shadowing_items')
                      .select('id')
                      .eq('source_item_id', it.id)
                      .eq('sentence_index', unitStart)
                      .maybeSingle?.() ?? { data: null };
                    if (existing?.id) { used.add(j); continue; }

                    const initialSeed = `${it.id}:${unitStart}-${unitEnd}`;
                    let current = await getBlankForText(sents[j].text, initialSeed);
                    if (!current.ok) { used.add(j); continue; }

                    while (current.ok && current.ratio > 0.5) {
                      const leftIdx = unitStart - 1;
                      const rightIdx = unitEnd + 1;

                      let leftRatio = -1;
                      let rightRatio = -1;
                      if (leftIdx >= 0 && !used.has(leftIdx)) leftRatio = await measureSingleSentenceRatio(leftIdx);
                      if (rightIdx < sents.length && !used.has(rightIdx)) rightRatio = await measureSingleSentenceRatio(rightIdx);

                      if (leftRatio < 0 && rightRatio < 0) break;
                      const chooseRight = rightRatio >= leftRatio;
                      if (chooseRight) unitEnd = rightIdx; else unitStart = leftIdx;

                      const mergedText = sents.slice(unitStart, unitEnd + 1).map((s) => s.text).join(' ');
                      const mergedSeed = `${it.id}:${unitStart}-${unitEnd}`;
                      const mergedRes = await getBlankForText(mergedText, mergedSeed);
                      if (!mergedRes.ok) break;
                      current = mergedRes;
                    }

                    if (!current.ok || current.ratio > 0.5) { used.add(j); continue; }

                    const unitText = sents.slice(unitStart, unitEnd + 1).map((s) => s.text).join(' ');
                    const blankStart = current.blankStart;
                    const blankLength = current.blankLength;

                    const referenceAnswer = unitText.slice(blankStart, blankStart + blankLength);
                    const masked = unitText.slice(0, blankStart) + '[[BLANK]]' + unitText.slice(blankStart + blankLength);
                    try {
                      const preferredModel = model || 'deepseek-chat';
                      const disPrompt = buildFixedDistractorsPrompt({
                        lang: (it.lang || 'en') as Lang,
                        maskedText: masked,
                        referenceAnswer,
                      });
                      const disResp = await chatJSON({
                        provider,
                        model: preferredModel,
                        temperature: 0.3,
                        response_json: true,
                        messages: [
                          { role: 'system', content: 'Return VALID JSON only. Follow instructions strictly.' },
                          { role: 'user', content: disPrompt },
                        ],
                      });
                      const disRaw = disResp.content || '{}';
                      let disParsed: { distractors?: unknown } = {};
                      try { disParsed = JSON.parse(disRaw); } catch {}
                      const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean);
                      const parsedDistractors = uniq(
                        Array.isArray(disParsed.distractors)
                          ? (disParsed.distractors as unknown[])
                              .filter((s) => typeof s === 'string' && (s as string).trim())
                              .map((s) => (s as string).trim())
                          : [],
                      );
                      let finalDistr = parsedDistractors.filter((d) => d.toLowerCase() !== referenceAnswer.trim().toLowerCase());
                      if (finalDistr.length < 3) { used.add(j); continue; }
                      finalDistr = finalDistr.slice(0, 3);

                      const insertPayload = {
                        source_item_id: it.id,
                        theme_id: it.theme_id || null,
                        subtopic_id: it.subtopic_id || null,
                        lang: it.lang,
                        level: it.level,
                        sentence_index: unitStart,
                        sentence_text: unitText,
                        blank_start: blankStart,
                        blank_length: blankLength,
                        correct_options: [referenceAnswer],
                        distractor_options: finalDistr,
                        gen_seed: `${it.id}:${unitStart}-${unitEnd}`,
                        is_published: false,
                      } as const;

                      const { error: insErr } = await supabase.from('cloze_shadowing_items').insert(insertPayload);
                      if (!insErr) {
                        for (let k = unitStart; k <= unitEnd; k++) { used.add(k); covered.add(k); }
                        createdForItem += 1;
                      } else {
                        used.add(j);
                      }
                    } catch {
                      used.add(j);
                    }
                  }

                  for (let j = 0; j < sents.length; j++) {
                    if (covered.has(j)) continue;
                    const unitText = sents[j].text;
                    const placeholderPayload = {
                      source_item_id: it.id,
                      theme_id: it.theme_id || null,
                      subtopic_id: it.subtopic_id || null,
                      lang: it.lang,
                      level: it.level,
                      sentence_index: j,
                      sentence_text: unitText,
                      blank_start: 0,
                      blank_length: 0,
                      correct_options: [],
                      distractor_options: [],
                      gen_seed: `${it.id}:${j}-${j}`,
                      is_published: false,
                    } as const;
                    try { await supabase.from('cloze_shadowing_items').insert(placeholderPayload); } catch {}
                  }

                  return { createdForItem, sentences: sents.length } as const;
                }, retries);

                details.push({ source_item_id: it.id, sentences: res.sentences, created: res.createdForItem });
                done++;
                controller.enqueue(
                  encoder.encode(
                    sse({ type: 'saved', idx: i, done, total: items.length, id: it.id, created: res.createdForItem, sentences: res.sentences }),
                  ),
                );
              } catch (err: any) {
                done++;
                controller.enqueue(
                  encoder.encode(
                    sse({ type: 'error', idx: i, done, total: items.length, id: it.id, message: String(err?.message || err) }),
                  ),
                );
              }

              if (throttle) await sleep(Number(throttle) || 0);
            }
          });

          await Promise.all(workers);
          controller.enqueue(encoder.encode(sse({ type: 'done', done, total: items.length, details })));
          controller.close();
        } catch (e: any) {
          controller.enqueue(encoder.encode(sse({ type: 'error', message: String(e?.message || e) })));
          controller.close();
        }
      },
    });

    return new Response(stream as any, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


