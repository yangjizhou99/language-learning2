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
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const supabase = auth.supabase;
  const body = await req.json();
  const { 
    subtopic_ids, 
    lang, 
    level, 
    genre, 
    concurrency = 4,
    provider = 'gemini',
    model = 'gemini-1.5-flash',
    temperature = 0.7
  } = body;
  
  if (!Array.isArray(subtopic_ids) || !subtopic_ids.length) {
    return new Response(JSON.stringify({ error: 'no subtopic_ids' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 获取小主题数据
  const { data: subtopics, error: fetchError } = await supabase
    .from('shadowing_subtopics')
    .select('*')
    .in('id', subtopic_ids)
    .eq('status', 'active');
  
  if (fetchError || !subtopics?.length) {
    return new Response(JSON.stringify({ error: 'subtopics not found' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
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
                  title: subtopic.title_cn,
                  reason: 'already exists'
                });
                return;
              }
              
              // 构建提示词
              const prompt = buildShadowPrompt({
                lang: subtopic.lang,
                level: subtopic.level,
                genre: subtopic.genre,
                title_cn: subtopic.title_cn,
                seed_en: subtopic.seed_en,
                one_line_cn: subtopic.one_line_cn
              });
              
              // 调用AI生成
              const result = await chatJSON({
                provider: provider as 'openrouter' | 'deepseek' | 'openai',
                model,
                temperature,
                messages: [
                  { role: 'system', content: 'You are a helpful writing assistant.' },
                  { role: 'user', content: prompt }
                ]
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
              
              // 保存到数据库
              const { error: saveError } = await supabase
                .from('shadowing_drafts')
                .insert({
                  lang: subtopic.lang,
                  level: subtopic.level,
                  topic: subtopic.title_cn,
                  genre: subtopic.genre,
                  title: parsed.title || subtopic.title_cn,
                  text: parsed.passage || content,
                  notes: {
                    ...parsed.notes,
                    violations: parsed.violations || [],
                    source: {
                      kind: 'subtopic',
                      subtopic_id: subtopic.id
                    },
                    meta: parsed.meta || {}
                  },
                  ai_provider: provider,
                  ai_model: model,
                  ai_usage: result.usage || {},
                  status: 'draft'
                });
              
              if (saveError) {
                throw new Error(`Save failed: ${saveError.message}`);
              }
              
              saved++;
              totalTokens += result.usage?.total_tokens || 0;
              
              send({ 
                type: 'progress', 
                id: subtopic.id,
                title: subtopic.title_cn,
                done: completed + 1,
                total: subtopics.length,
                saved,
                errors,
                tokens: totalTokens
              });
              
            } catch (error) {
              errors++;
              send({ 
                type: 'error', 
                id: subtopic.id,
                title: subtopic.title_cn,
                error: error instanceof Error ? error.message : 'Unknown error',
                done: completed + 1,
                total: subtopics.length,
                saved,
                errors,
                tokens: totalTokens
              });
            }
            
            completed++;
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
          tokens: totalTokens
        });
        
      } catch (error) {
        send({ 
          type: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        controller.close();
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
