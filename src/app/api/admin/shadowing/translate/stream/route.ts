export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

// 翻译配置
const TRANSLATION_CONFIG = {
  providers: {
    openrouter: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      defaultModel: "openai/gpt-4o-mini"
    },
    deepseek: {
      url: "https://api.deepseek.com/v1/chat/completions",
      defaultModel: "deepseek-chat"
    },
    openai: {
      url: "https://api.openai.com/v1/chat/completions",
      defaultModel: "gpt-4o-mini"
    }
  }
};

// 构建翻译提示词
function buildTranslationPrompt(sourceText: string, sourceLang: string, targetLangs: string[]): string {
  const langNames = {
    'en': 'English',
    'ja': '日本語',
    'zh': '简体中文'
  };

  const sourceLangName = langNames[sourceLang as keyof typeof langNames];
  const targetLangNames = targetLangs.map(lang => langNames[lang as keyof typeof langNames]).join('、');

  return `请将以下${sourceLangName}文本翻译成${targetLangNames}。

要求：
1. 保持原文的语气、风格和语境
2. 确保翻译准确、自然、流畅
3. 对于对话文本，保持说话者的身份和语调
4. 严格按照JSON格式返回，不要添加任何其他内容

原文：
${sourceText}

请返回JSON格式：
{
  "${targetLangs[0]}": "翻译文本1",
  "${targetLangs[1]}": "翻译文本2"
}`;
}

// 调用AI翻译API
async function callTranslationAPI(
  text: string, 
  sourceLang: string, 
  targetLangs: string[], 
  provider: string, 
  model: string, 
  temperature: number = 0.3
): Promise<Record<string, string>> {
  const config = TRANSLATION_CONFIG.providers[provider as keyof typeof TRANSLATION_CONFIG.providers];
  if (!config) {
    throw new Error(`不支持的翻译提供商: ${provider}`);
  }

  const apiKey = getAPIKey(provider);
  if (!apiKey) {
    throw new Error(`未配置${provider}的API密钥`);
  }

  const prompt = buildTranslationPrompt(text, sourceLang, targetLangs);

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(provider === 'openrouter' && { 'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000' })
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`翻译API调用失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const translatedText = data.choices?.[0]?.message?.content?.trim();
  
  if (!translatedText) {
    throw new Error('翻译API返回空内容');
  }

  try {
    const translations = JSON.parse(translatedText);
    
    // 验证返回的翻译格式
    for (const targetLang of targetLangs) {
      if (!translations[targetLang] || typeof translations[targetLang] !== 'string') {
        throw new Error(`翻译结果缺少${targetLang}语言的内容`);
      }
    }
    
    return translations;
  } catch (parseError) {
    throw new Error(`翻译结果解析失败: ${parseError}`);
  }
}

// 获取API密钥
function getAPIKey(provider: string): string | null {
  switch (provider) {
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY || null;
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY || null;
    case 'openai':
      return process.env.OPENAI_API_KEY || null;
    default:
      return null;
  }
}

// 确定目标语言
function getTargetLanguages(sourceLang: string): string[] {
  switch (sourceLang) {
    case 'zh':
      return ['en', 'ja'];
    case 'en':
      return ['ja', 'zh'];
    case 'ja':
      return ['en', 'zh'];
    default:
      throw new Error(`不支持的语言: ${sourceLang}`);
  }
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
async function retry<T>(
  fn: () => Promise<T>,
  retries: number,
  delayMs: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await delay(delayMs);
      return retry(fn, retries - 1, delayMs * 2); // 指数退避
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      scope = 'drafts', // 'drafts' | 'items'
      provider = 'deepseek',
      model,
      temperature = 0.3,
      concurrency = 4,
      retries = 2,
      throttle_ms = 200,
      onlyMissing = true, // 仅翻译缺失的项目
      selectedIds = [], // 选中的ID列表
      filters = {} // 筛选条件
    } = body;

    const supabase = getServiceSupabase();
    const tableName = scope === 'drafts' ? 'shadowing_drafts' : 'shadowing_items';

    // 构建查询条件
    let query = supabase
      .from(tableName)
      .select('id, lang, text, translations, trans_updated_at, title')
      .order('created_at', { ascending: false });

    // 如果有选中的ID，只查询这些ID
    if (selectedIds && selectedIds.length > 0) {
      query = query.in('id', selectedIds);
    } else {
      // 否则应用筛选条件
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.lang && filters.lang !== 'all') {
        query = query.eq('lang', filters.lang);
      }
      if (filters.level && filters.level !== 'all') {
        query = query.eq('level', Number(filters.level));
      }
      if (filters.genre && filters.genre !== 'all') {
        query = query.eq('genre', filters.genre);
      }
      if (filters.q && filters.q.trim()) {
        query = query.ilike('title', `%${filters.q.trim()}%`);
      }
    }

    const { data: items, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`查询失败: ${fetchError.message}`);
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有找到需要翻译的项目",
        total: 0,
        processed: 0,
        success_count: 0,
        failed_count: 0
      });
    }

    // 筛选需要翻译的项目
    let itemsToTranslate = items;
    if (onlyMissing) {
      itemsToTranslate = items.filter(item => {
        if (!item.translations || Object.keys(item.translations).length === 0) {
          return true;
        }
        const targetLangs = getTargetLanguages(item.lang);
        return !targetLangs.every(lang => item.translations[lang]);
      });
    }

    if (itemsToTranslate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "所有项目都已翻译完成",
        total: items.length,
        processed: 0,
        success_count: 0,
        failed_count: 0
      });
    }

    // 创建流式响应
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendProgress = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendProgress({
            type: 'start',
            message: `开始批量翻译，共${itemsToTranslate.length}个项目`,
            total: itemsToTranslate.length,
            processed: 0,
            success_count: 0,
            failed_count: 0
          });

          let processed = 0;
          let successCount = 0;
          let failedCount = 0;
          const failedItems: Array<{id: string, title: string, error: string}> = [];

          // 分批处理
          const batchSize = Math.max(1, Math.min(concurrency, itemsToTranslate.length));
          
          for (let i = 0; i < itemsToTranslate.length; i += batchSize) {
            const batch = itemsToTranslate.slice(i, i + batchSize);
            
            // 并发处理当前批次
            const batchPromises = batch.map(async (item) => {
              try {
                const targetLangs = getTargetLanguages(item.lang);
                
                // 使用重试机制
                const translations = await retry(
                  () => callTranslationAPI(
                    item.text,
                    item.lang,
                    targetLangs,
                    provider,
                    model,
                    temperature
                  ),
                  retries
                );

                // 更新数据库
                const { error: updateError } = await supabase
                  .from(tableName)
                  .update({
                    translations,
                    trans_updated_at: new Date().toISOString()
                  })
                  .eq('id', item.id);

                if (updateError) {
                  throw new Error(`更新失败: ${updateError.message}`);
                }

                processed++;
                successCount++;

                sendProgress({
                  type: 'progress',
                  message: `翻译完成: ${item.title}`,
                  total: itemsToTranslate.length,
                  processed,
                  success_count: successCount,
                  failed_count: failedCount,
                  current_item: {
                    id: item.id,
                    title: item.title,
                    status: 'success'
                  }
                });

                return { success: true, item };
              } catch (error) {
                processed++;
                failedCount++;
                const errorMessage = error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error);
                
                failedItems.push({
                  id: item.id,
                  title: item.title,
                  error: errorMessage
                });

                sendProgress({
                  type: 'progress',
                  message: `翻译失败: ${item.title} - ${errorMessage}`,
                  total: itemsToTranslate.length,
                  processed,
                  success_count: successCount,
                  failed_count: failedCount,
                  current_item: {
                    id: item.id,
                    title: item.title,
                    status: 'failed',
                    error: errorMessage
                  }
                });

                return { success: false, item, error: errorMessage };
              }
            });

            // 等待当前批次完成
            await Promise.all(batchPromises);

            // 批次间延迟
            if (throttle_ms > 0 && i + batchSize < itemsToTranslate.length) {
              await delay(throttle_ms);
            }
          }

          // 发送完成消息
          sendProgress({
            type: 'complete',
            message: `批量翻译完成: ${successCount}成功, ${failedCount}失败`,
            total: itemsToTranslate.length,
            processed,
            success_count: successCount,
            failed_count: failedCount,
            failed_items: failedItems
          });

        } catch (error) {
          sendProgress({
            type: 'error',
            message: `批量翻译失败: ${error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)}`,
            error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
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

  } catch (error) {
    console.error('批量翻译失败:', error);
    return NextResponse.json({
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : "批量翻译失败"
    }, { status: 500 });
  }
}
