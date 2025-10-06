export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { splitSentencesWithIndex } from '@/lib/nlp/segment';
import { chatJSON } from '@/lib/ai/client';

type Lang = 'en' | 'ja' | 'zh';

// 删除旧版 buildPrompt（带 correct/distractor 参数）的实现

function buildPrompt({
  lang,
  sentence,
  seed,
}: {
  lang: Lang;
  sentence: string;
  seed: string;
}) {
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

// 将对话文本按说话人轮次切分，去掉 "A:"/"B:" 等提示符
function splitDialogueTurns(text: string) {
  const joined = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ');

  // 全文范围内查找多次出现的 “A:”/“B:” 等标签
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

// (单次二阶段：同时产出正确项与干扰项；第三步已取消)

// 尝试在原文中定位挖空文本的位置
function findBlankIndex(haystack: string, needle: string): number {
  if (!haystack || !needle) return -1;
  const n = needle.trim();
  if (!n) return -1;
  // 直接匹配（区分大小写）
  let idx = haystack.indexOf(n);
  if (idx !== -1) return idx;
  // 去掉可能包裹的引号
  const stripped = n.replace(/^[\'\"“”‘’]/, '').replace(/[\'\"“”‘’]$/, '').trim();
  if (stripped && stripped !== n) {
    idx = haystack.indexOf(stripped);
    if (idx !== -1) return idx;
  }
  // 英文再试不区分大小写
  const idxLower = haystack.toLowerCase().indexOf(n.toLowerCase());
  return idxLower;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = getServiceSupabase();
    const body = await req.json().catch(() => ({}));
    const {
      theme_id,
      subtopic_id,
      lang,
      level,
      provider = 'deepseek',
      model,
      limit = 20,
      item_ids,
    }: {
      theme_id?: string;
      subtopic_id?: string;
      lang?: Lang;
      level?: number;
      provider?: 'deepseek' | 'openrouter' | 'openai';
      model?: string;
      limit?: number;
      item_ids?: string[];
    } = body;

    // 基于用户设定：只允许使用已有音频和翻译字段的 shadowing_items
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
    if (Array.isArray(item_ids) && item_ids.length > 0) {
      const { data, error } = await supabase
        .from('shadowing_items')
        .select('id, lang, level, title, text, audio_url, translations, status, theme_id, subtopic_id, genre')
        .in('id', item_ids)
        .eq('status', 'approved')
        .not('audio_url', 'is', null);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      items = (data || []) as ItemRow[];
    } else {
      let query = supabase
        .from('shadowing_items')
        .select('id, lang, level, title, text, audio_url, translations, status, theme_id, subtopic_id, genre')
        .eq('status', 'approved')
        .not('audio_url', 'is', null);

      if (lang) query = query.eq('lang', lang);
      if (level) query = query.eq('level', level);
      if (theme_id) query = query.eq('theme_id', theme_id);
      if (subtopic_id) query = query.eq('subtopic_id', subtopic_id);

      const { data, error } = await query.limit(Math.max(1, Math.min(100, limit)));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      items = (data || []) as ItemRow[];
    }

    type ShadowingItemRow = {
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
    const sourceItems: ShadowingItemRow[] = (items || []).filter(
      (it: ShadowingItemRow) => !!it && !!it.translations && Object.keys(it.translations || {}).length > 0,
    );
    if (sourceItems.length === 0) {
      return NextResponse.json({ success: true, created: 0, details: [] });
    }

    const createdDetails: Array<{ source_item_id: string; sentences: number; created: number }> = [];
    let totalCreated = 0;

    // 遍历每篇文章，采用“动态合并相邻句子直到挖空占比≤20%”策略
    for (const it of sourceItems) {
      // 二次生成：先清除该文章此前生成的所有句级 Cloze（会级联清理相关 attempts）
      await supabase.from('cloze_shadowing_items').delete().eq('source_item_id', it.id);

      // 对话体：按说话人轮次为最小单元；非对话体：按句子
      const isDialogue = it.genre === 'dialogue' || /^(dialogue|conversation)$/i.test(String(it.genre || ''));
      const sents = isDialogue
        ? splitDialogueTurns(it.text)
        : splitSentencesWithIndex(it.text, (it.lang || 'en') as Lang);
      let createdForItem = 0;
      const used = new Set<number>();
      const covered = new Set<number>();

      // 为单句测量“挖空占比”的缓存，避免重复调用
      const singleSentenceRatioCache: Record<number, number> = {};

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

      const measureSingleSentenceRatio = async (idx: number) => {
        if (idx < 0 || idx >= sents.length) return -1;
        if (singleSentenceRatioCache[idx] !== undefined) return singleSentenceRatioCache[idx];
        const text = sents[idx].text;
        const seed = `${it.id}:${idx}`;
        const res = await getBlankForText(text, seed);
        const r = res.ok ? res.ratio : 0;
        singleSentenceRatioCache[idx] = r;
        return r;
      };

      const callAI = async (text: string, seed: string) => {
        const prompt = buildPrompt({
          lang: (it.lang || 'en') as Lang,
          sentence: text,
          seed,
        });
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
        const blankText =
          typeof parsed?.blank_text === 'string' ? (parsed.blank_text as string).trim() : '';
        return { blankText } as const;
      };

      for (let i = 0; i < sents.length; i++) {
        if (used.has(i)) continue;

        // 初始单元为当前句
        let unitStart = i;
        let unitEnd = i;

        // 若已有以该起始句生成记录，则跳过
        const { data: existing } = await supabase
          .from('cloze_shadowing_items')
          .select('id')
          .eq('source_item_id', it.id)
          .eq('sentence_index', unitStart)
          .maybeSingle?.() ?? { data: null };
        if (existing?.id) { used.add(i); continue; }

        // 对当前单元挖空
        const initialSeed = `${it.id}:${unitStart}-${unitEnd}`;
        let current = await getBlankForText(sents[i].text, initialSeed);
        if (!current.ok) { used.add(i); continue; }

        // 若挖空占比>50%，则与相邻句（更高占比者）合并，随后重新挖空，直至≤50%或无法再合并
        while (current.ok && current.ratio > 0.5) {
          const leftIdx = unitStart - 1;
          const rightIdx = unitEnd + 1;

          let leftRatio = -1;
          let rightRatio = -1;
          if (leftIdx >= 0 && !used.has(leftIdx)) leftRatio = await measureSingleSentenceRatio(leftIdx);
          if (rightIdx < sents.length && !used.has(rightIdx)) rightRatio = await measureSingleSentenceRatio(rightIdx);

          if (leftRatio < 0 && rightRatio < 0) {
            // 无可合并的邻居
            break;
          }

          // 选择更高占比的邻居进行合并（相等时优先右侧）
          const chooseRight = rightRatio >= leftRatio;
          if (chooseRight) unitEnd = rightIdx; else unitStart = leftIdx;

          const mergedText = sents.slice(unitStart, unitEnd + 1).map((s) => s.text).join(' ');
          const mergedSeed = `${it.id}:${unitStart}-${unitEnd}`;
          const mergedRes = await getBlankForText(mergedText, mergedSeed);
          if (!mergedRes.ok) {
            // 合并后无法有效挖空
            break;
          }
          current = mergedRes;
        }

        // 校验占比限制
        if (!current.ok || current.ratio > 0.5) { used.add(i); continue; }

        const unitText = sents.slice(unitStart, unitEnd + 1).map((s) => s.text).join(' ');
        const blankStart = current.blankStart;
        const blankLength = current.blankLength;

        // 第二阶段：仅生成3个干扰项；正确项固定为原文挖空内容
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
          if (finalDistr.length < 3) { used.add(i); continue; }
          finalDistr = finalDistr.slice(0, 3);

          // 写入本单元结果
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
            totalCreated += 1;
          } else {
            used.add(i);
          }
        } catch {
          used.add(i);
        }
      }

      // 为未能挖空/被合并覆盖的句子补充占位记录，确保索引不缺失
      for (let idx = 0; idx < sents.length; idx++) {
        if (covered.has(idx)) continue;
        const unitText = sents[idx].text;
        const placeholderPayload = {
          source_item_id: it.id,
          theme_id: it.theme_id || null,
          subtopic_id: it.subtopic_id || null,
          lang: it.lang,
          level: it.level,
          sentence_index: idx,
          sentence_text: unitText,
          blank_start: 0,
          blank_length: 0,
          correct_options: [],
          distractor_options: [],
          gen_seed: `${it.id}:${idx}-${idx}`,
          is_published: false,
        } as const;
        try {
          await supabase.from('cloze_shadowing_items').insert(placeholderPayload);
        } catch {}
      }

      createdDetails.push({ source_item_id: it.id, sentences: sents.length, created: createdForItem });
    }

    return NextResponse.json({ success: true, created: totalCreated, details: createdDetails });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



