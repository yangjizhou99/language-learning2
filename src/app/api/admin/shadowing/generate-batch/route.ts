import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chatJSON } from '@/lib/ai/client';
import { requireAdmin } from '@/lib/admin';

export const maxDuration = 300; // 5分钟超时，符合Vercel Hobby计划限制

// 保留但不直接使用全局 client，实际使用 auth 绑定的 supabase 实例
const supabaseGlobal = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const db = auth.supabase;

    const {
      subtopic_ids,
      lang,
      level,
      genre,
      provider,
      model,
      temperature,
      concurrency = 10,
      ignore_existing = false,
    } = await request.json();

    if (!subtopic_ids || !Array.isArray(subtopic_ids) || subtopic_ids.length === 0) {
      return NextResponse.json(
        { error: 'subtopic_ids is required and must be a non-empty array' },
        { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    // 批量获取小主题，避免 URL 过长
    const BATCH_SIZE = 200;
    const allSubtopics: any[] = [];
    for (let i = 0; i < subtopic_ids.length; i += BATCH_SIZE) {
      const batch = subtopic_ids.slice(i, i + BATCH_SIZE);
      const { data, error } = await db.from('shadowing_subtopics').select('*').in('id', batch);
      if (error) throw new Error(`Failed to fetch subtopics: ${error.message}`);
      if (Array.isArray(data)) allSubtopics.push(...data);
    }

    if (allSubtopics.length === 0) {
      return NextResponse.json(
        { success: true, total: 0, success_count: 0, skipped_count: 0, error_count: 0, results: [], info: { input_count: subtopic_ids.length } },
        { headers: { 'Access-Control-Allow-Origin': '*' } },
      );
    }

    // 预过滤：跳过已存在草稿（status=draft）或已发布 items 的小主题
    let toProcess = allSubtopics;
    let preSkippedDrafts = 0;
    let preSkippedItems = 0;
    if (!ignore_existing) {
      const [{ data: draftRows }, { data: itemRows }] = await Promise.all([
        db.from('shadowing_drafts').select('subtopic_id').eq('status', 'draft').in('subtopic_id', subtopic_ids),
        db.from('shadowing_items').select('subtopic_id').in('subtopic_id', subtopic_ids),
      ]);
      const draftSet = new Set((draftRows || []).map((r: any) => r.subtopic_id));
      const itemSet = new Set((itemRows || []).map((r: any) => r.subtopic_id));
      toProcess = allSubtopics.filter((s) => !draftSet.has(s.id) && !itemSet.has(s.id));
      preSkippedDrafts = allSubtopics.filter((s) => draftSet.has(s.id)).length;
      preSkippedItems = allSubtopics.filter((s) => itemSet.has(s.id)).length;
    }
    const preSkipped = allSubtopics.length - toProcess.length;

    const resultsArr: any[] = [];

    const processSubtopic = async (subtopic: any) => {
      try {
        // 根据级别设置字数要求（L1从50字开始，每级别两倍）
        const getWordCountRange = (levelStr: string, langCode: string) => {
          const levelNum = parseInt(levelStr);
          const baseRanges = { en: [25, 50, 100, 200, 400, 800], ja: [50, 100, 200, 400, 800, 1600], zh: [50, 100, 200, 400, 800, 1600] } as const;
          const ranges = (baseRanges as any)[langCode] || (baseRanges as any).zh;
          const min = ranges[levelNum - 1] || ranges[0];
          const max = ranges[levelNum] || ranges[1];
          return `${min}-${max}`;
        };

        const actualLevel = level === 'all' ? String(subtopic.level) : level;
        const actualGenre = genre === 'all' ? subtopic.genre : genre;
        const actualLang = lang === 'all' ? subtopic.lang : lang;
        const wordCountRange = getWordCountRange(String(actualLevel), String(actualLang));
        const formatInstruction = actualGenre === 'dialogue' ? '必须使用A: B: 对话格式，每行以A: 或B: 开头' : '使用完整句子，不要使用A/B对话格式';

        const prompt = `请为以下小主题生成一篇${actualLang}语言、${actualLevel}级、${actualGenre}类型的影子跟读文章：

小主题：${subtopic.title}
关键词：${subtopic.seed}
一句话描述：${subtopic.one_line}
标签：${subtopic.tags?.join(', ') || ''}

要求：
1. 文章长度必须达到${wordCountRange}个字符（这是硬性要求，绝对不能少于最小值，必须严格达到）
2. ${formatInstruction}
3. 请确保内容长度严格符合要求，生成后请检查字数
4. 如果内容不够长，请增加更多细节和描述
5. 字数要求是最高优先级，必须严格遵守

请返回JSON格式：
{ "title": "文章标题", "content": "文章内容" }`;

        let rawContent, usage;
        const actualProvider = provider; // 不再重映射，直接使用所选提供商
        const actualModel = model; // 直接使用选择的模型（如 deepseek-chat）

        let result;
        try {
          result = await chatJSON({ provider: actualProvider as any, model: actualModel, messages: [{ role: 'user', content: prompt }], temperature: temperature || 0.7, userId: auth.user.id });
        } catch (e: any) {
          const msg = String(e?.message || e || '');
          if (/AI权限|API使用限制|权限|limit/i.test(msg)) {
            // 当用户级权限/限额拦截时，使用全局密钥重试
            result = await chatJSON({ provider: actualProvider as any, model: actualModel, messages: [{ role: 'user', content: prompt }], temperature: temperature || 0.7 });
          } else {
            throw e;
          }
        }
        rawContent = result.content;
        usage = result.usage;

        let aiResponse;
        try {
          aiResponse = JSON.parse(rawContent);
        } catch {
          throw new Error('AI response is not valid JSON');
        }
        if (!aiResponse?.title || !aiResponse?.content) throw new Error('AI response is invalid');

        const { data: draft, error: draftError } = await db
          .from('shadowing_drafts')
          .insert({
            subtopic_id: subtopic.id,
            title: aiResponse.title,
            text: aiResponse.content,
            notes: {},
            lang: actualLang,
            level: parseInt(String(actualLevel)),
            genre: actualGenre,
            status: 'draft',
            created_by: auth.user.id,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (draftError) throw new Error(`Failed to save draft: ${draftError.message}`);

        return { subtopic_id: subtopic.id, status: 'success', draft_id: draft.id, title: aiResponse.title };
      } catch (error: any) {
        return { subtopic_id: subtopic.id, status: 'error', error: error.message };
      }
    };

    // 并发执行
    const pool: Promise<any>[] = [];
    let idx = 0;
    const enqueue = () => {
      while (idx < toProcess.length && pool.length < concurrency) {
        const p = processSubtopic(toProcess[idx++]).then((r) => {
          resultsArr.push(r);
          pool.splice(pool.indexOf(p), 1);
        });
        pool.push(p);
      }
    };
    enqueue();
    while (pool.length) {
      await Promise.race(pool);
      enqueue();
    }

    const successCount = resultsArr.filter((r) => r.status === 'success').length;
    const errorCount = resultsArr.filter((r) => r.status === 'error').length;
    const skippedCount = preSkipped; // 预过滤跳过数量

    return NextResponse.json(
      {
        success: true,
        total: toProcess.length,
        success_count: successCount,
        skipped_count: skippedCount,
        error_count: errorCount,
        results: resultsArr,
        info: { input_count: subtopic_ids.length, prefilter_drafts: preSkippedDrafts, prefilter_items: preSkippedItems, ignore_existing },
      },
      { headers: { 'Access-Control-Allow-Origin': '*' } },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
