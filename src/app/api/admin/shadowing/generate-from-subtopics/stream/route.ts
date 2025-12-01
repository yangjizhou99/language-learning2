import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { buildShadowPrompt } from '@/lib/shadowing/prompt';
import { chatJSON } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = auth.supabase;
  const body = await req.json();
  const {
    subtopic_ids,
    lang,
    level,
    genre,
    dialogue_type,
    concurrency = 4,
    provider = 'deepseek',
    model = 'deepseek-chat',
    temperature = 0.7,
  } = body;

  if (!Array.isArray(subtopic_ids) || !subtopic_ids.length) {
    return new Response(JSON.stringify({ error: 'no subtopic_ids' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 获取小主题数据 (分批获取以避免 URI too long)
  const CHUNK_SIZE = 50;
  let subtopics: any[] = [];
  let fetchError: any = null;

  for (let i = 0; i < subtopic_ids.length; i += CHUNK_SIZE) {
    const chunk = subtopic_ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('shadowing_subtopics')
      .select('*')
      .in('id', chunk);

    if (error) {
      fetchError = error;
      break;
    }
    if (data) {
      subtopics = [...subtopics, ...data];
    }
  }

  if (fetchError || !subtopics?.length) {
    return new Response(JSON.stringify({ error: 'subtopics not found' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send({ type: 'start', total: subtopics.length });

        let completed = 0;
        let saved = 0;
        let errors = 0;
        let totalTokens = 0;

        // 并发处理
        const processBatch = async (batch: any[]) => {
          const promises = batch.map(async (subtopic) => {
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
              try {
                // 检查是否已存在
                const { data: existing } = await supabase
                  .from('shadowing_drafts')
                  .select('id')
                  .eq('source->>subtopic_id', subtopic.id)
                  .eq('status', 'draft')
                  .single();

                if (existing) {
                  send({
                    type: 'skip',
                    id: subtopic.id,
                    title: subtopic.title,
                    reason: 'already exists',
                  });
                  return;
                }

                // 构建提示词（使用统一字段）
                // 优先使用请求参数中的 dialogue_type，如果没有则尝试使用 subtopic 中的（如果有），最后默认为 casual
                const effectiveDialogueType = dialogue_type && dialogue_type !== 'all'
                  ? dialogue_type
                  : (subtopic.dialogue_type || 'casual');

                const prompt = buildShadowPrompt({
                  lang: subtopic.lang,
                  level: subtopic.level,
                  genre: subtopic.genre,
                  dialogueType: effectiveDialogueType,
                  title: subtopic.title,
                  seed: subtopic.seed,
                  one_line: subtopic.one_line,
                });

                // 调用AI生成
                const result = await chatJSON({
                  provider: provider as 'openrouter' | 'deepseek' | 'openai',
                  model,
                  temperature,
                  timeoutMs: 120000, // 2分钟超时
                  messages: [
                    { role: 'system', content: 'You are a helpful writing assistant.' },
                    { role: 'user', content: prompt },
                  ],
                });

                const content = result.content;

                // 解析JSON
                let parsed;
                try {
                  parsed = JSON.parse(content);
                } catch (e) {
                  // 尝试提取JSON
                  const jsonMatch = content.match(/\{[\s\S]*\}/);
                  if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                  } else {
                    throw new Error('Invalid JSON response');
                  }
                }

                // 获取小主题对应的大主题ID
                const { data: themeData } = await supabase
                  .from('shadowing_subtopics')
                  .select('theme_id')
                  .eq('id', subtopic.id)
                  .single();

                // 保存到数据库
                const { error: saveError } = await supabase.from('shadowing_drafts').insert({
                  id: crypto.randomUUID(),
                  lang: subtopic.lang,
                  level: subtopic.level,
                  topic: subtopic.title,
                  genre: subtopic.genre,
                  dialogue_type: effectiveDialogueType,
                  title: parsed.title || subtopic.title,
                  text: parsed.passage || content,
                  theme_id: themeData?.theme_id || null,
                  subtopic_id: subtopic.id,
                  notes: {
                    ...parsed.notes,
                    violations: parsed.violations || [],
                    source: {
                      kind: 'subtopic',
                      subtopic_id: subtopic.id,
                    },
                    meta: parsed.meta || {},
                  },
                  ai_provider: provider,
                  ai_model: model,
                  ai_usage: result.usage || {},
                  status: 'draft',
                });

                if (saveError) {
                  throw new Error(`Save failed: ${saveError.message}`);
                }

                // 发布时再写入 shadowing_items，此处不插入

                saved++;
                totalTokens += result.usage?.total_tokens || 0;

                send({
                  type: 'progress',
                  id: subtopic.id,
                  title: subtopic.title,
                  done: completed + 1,
                  total: subtopics.length,
                  saved,
                  errors,
                  tokens: totalTokens,
                });
              } catch (error) {
                retryCount++;
                if (retryCount > maxRetries) {
                  errors++;
                  send({
                    type: 'error',
                    id: subtopic.id,
                    title: subtopic.title,
                    error: `${error instanceof Error ? error.message : String(error)} (重试${maxRetries}次后失败)`,
                    done: completed + 1,
                    total: subtopics.length,
                    saved,
                    errors,
                    tokens: totalTokens,
                  });
                  completed++;
                  return;
                } else {
                  // 重试前等待一段时间
                  await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount));
                  continue;
                }
              }

              // 成功完成，跳出重试循环
              completed++;
              return;
            }
          });

          await Promise.all(promises);
        };

        // 分批处理
        for (let i = 0; i < subtopics.length; i += concurrency) {
          const batch = subtopics.slice(i, i + concurrency);
          await processBatch(batch);
        }

        send({
          type: 'complete',
          total: subtopics.length,
          saved,
          errors,
          tokens: totalTokens,
        });
      } catch (error) {
        send({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
