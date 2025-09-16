export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10分钟超时，支持更多并发处理

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

// 修复JSON结构问题的函数
function fixJSONStructure(jsonText: string): string {
  let fixed = jsonText;
  
  // 修复缺少逗号的问题
  // 查找 "value" "key" 模式并添加逗号
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');
  
  // 修复 "value" } 模式，在value后添加逗号
  fixed = fixed.replace(/"\s*\n\s*}/g, '"\n}');
  
  // 修复属性值后缺少逗号的情况
  fixed = fixed.replace(/"\s*\n\s*"([^"]+)"\s*:/g, '",\n"$1":');
  
  // 确保最后一个属性后没有多余的逗号
  fixed = fixed.replace(/,(\s*})/g, '$1');
  
  // 确保JSON结构完整
  if (!fixed.endsWith('}')) {
    fixed += '}';
  }
  
  return fixed;
}

// 重新构造翻译结果的函数
function reconstructTranslations(text: string, targetLangs: string[]): Record<string, string> | null {
  try {
    const translations: Record<string, string> = {};
    
    // 尝试从文本中提取所有可能的翻译内容
    for (const lang of targetLangs) {
      // 查找该语言的所有可能翻译
      const patterns = [
        new RegExp(`${lang}[\\s:]*["']([^"']*?)["']`, 'gi'),
        new RegExp(`"${lang}"[\\s:]*["']([^"']*?)["']`, 'gi'),
        new RegExp(`${lang}[\\s:]*([^\\n\\r]+)`, 'gi')
      ];
      
      let found = false;
      for (const pattern of patterns) {
        const matches = [...text.matchAll(pattern)];
        if (matches.length > 0) {
          // 选择最长的匹配作为翻译
          const longestMatch = matches.reduce((longest, match) => 
            match[1] && match[1].length > (longest[1]?.length || 0) ? match : longest
          );
          
          if (longestMatch[1]) {
            translations[lang] = longestMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .trim();
            found = true;
            break;
          }
        }
      }
      
      if (!found) {
        console.warn(`无法为${lang}找到翻译内容`);
      }
    }
    
    // 检查是否找到了所有语言的翻译
    if (Object.keys(translations).length === targetLangs.length) {
      return translations;
    }
    
    return null;
  } catch (error) {
    console.error('重新构造翻译失败:', error);
    return null;
  }
}

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
function buildTranslationPrompt(sourceText: string, sourceLang: string, targetLangs: string[], itemData?: any): string {
  const langNames = {
    'en': 'English',
    'ja': '日本語',
    'zh': '简体中文'
  };

  const sourceLangName = langNames[sourceLang as keyof typeof langNames];
  const targetLangNames = targetLangs.map(lang => langNames[lang as keyof typeof langNames]).join('、');

  // 检测文本类型和难度级别
  const isNewsGenre = itemData?.genre === 'news';
  const level = itemData?.level || 3;
  const isHighLevel = level >= 3;
  
  // 翻译时不需要调整字数，保持原文长度

  // 根据体裁调整翻译要求
  let genreSpecificInstructions = '';
  const isDialogueGenre = itemData?.genre === 'dialogue';
  
    if (isNewsGenre) {
      genreSpecificInstructions = `
4. 这是新闻报道体裁，翻译时请：
   - 保持新闻的客观性和时效性
   - 确保语言正式、准确、流畅
   - 保持新闻的结构和逻辑性
   - 重要：新闻翻译必须使用完整句子，绝对不要使用A: B: 对话格式`;
    } else if (isDialogueGenre) {
      genreSpecificInstructions = `
4. 这是对话体裁，翻译时请：
   - 保持说话者的身份和语调
   - 保持对话的自然流畅性
   - 保持A: B: 对话格式`;
    } else {
      genreSpecificInstructions = `
4. 对于非对话体裁，翻译时请：
   - 保持原文的文体特征和语言风格
   - 确保翻译准确自然
   - 不要使用A: B: 对话格式`;
    }

  return `请将以下${sourceLangName}文本翻译成${targetLangNames}。

要求：
1. 保持原文的语气、风格和语境
2. 确保翻译准确、自然、流畅
3. 严格按照JSON格式返回，不要添加任何其他内容${genreSpecificInstructions}

重要：返回的JSON必须完整且格式正确，所有字符串必须正确闭合，不能有未终止的引号。

原文：
${sourceText}

请返回完整的JSON格式（确保所有引号都正确闭合）：
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
  temperature: number = 0.3,
  itemData?: any
): Promise<Record<string, string>> {
  const config = TRANSLATION_CONFIG.providers[provider as keyof typeof TRANSLATION_CONFIG.providers];
  if (!config) {
    throw new Error(`不支持的翻译提供商: ${provider}`);
  }

  const apiKey = getAPIKey(provider);
  if (!apiKey) {
    throw new Error(`未配置${provider}的API密钥`);
  }

  const prompt = buildTranslationPrompt(text, sourceLang, targetLangs, itemData);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时，增加稳定性

  try {
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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`翻译API调用失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim();
    
    if (!translatedText) {
      throw new Error('翻译API返回空内容');
    }

    // 添加调试日志
    console.log('原始翻译结果长度:', translatedText.length);
    console.log('原始翻译结果前500字符:', translatedText.substring(0, 500));
    console.log('原始翻译结果后500字符:', translatedText.substring(Math.max(0, translatedText.length - 500)));

    try {
      // 尝试修复常见的JSON格式问题
      let cleanedText = translatedText;
      
      // 首先尝试提取JSON部分
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // 尝试修复JSON结构问题
      cleanedText = fixJSONStructure(cleanedText);
      
      // 修复未终止的字符串 - 更智能的修复
      // 查找所有未闭合的字符串并尝试修复
      const lines = cleanedText.split('\n');
      const fixedLines = lines.map((line: string) => {
        // 如果行以未闭合的引号结尾，尝试修复
        if (line.match(/"[^"]*$/)) {
          // 检查是否在JSON对象内部
          const openBraces = (line.match(/\{/g) || []).length;
          const closeBraces = (line.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            // 在JSON对象内部，添加闭合引号
            return line + '"';
          }
        }
        return line;
      });
      cleanedText = fixedLines.join('\n');
      
      // 尝试修复常见的JSON问题
      cleanedText = cleanedText
        .replace(/,\s*}/g, '}')  // 移除多余的逗号
        .replace(/,\s*]/g, ']')  // 移除多余的逗号
        .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2') // 修复转义字符
        .replace(/\n\s*\n/g, '\n') // 移除多余的空行
        .replace(/"\s*\n\s*"/g, '",\n"') // 修复缺少逗号的情况
        .replace(/"\s*\n\s*}/g, '"\n}') // 修复最后一个属性后缺少逗号的情况
        .replace(/"\s*}\s*$/g, '"\n}') // 确保最后一个属性后有换行
        .trim();
      
      // 尝试修复缺少逗号的问题
      // 查找 "value" "key" 模式并添加逗号
      cleanedText = cleanedText.replace(/"\s*\n\s*"/g, '",\n"');
      
      // 确保JSON结构完整
      if (!cleanedText.endsWith('}')) {
        cleanedText += '}';
      }
      
      console.log('修复后的JSON长度:', cleanedText.length);
      console.log('修复后的JSON前500字符:', cleanedText.substring(0, 500));
      
      const translations = JSON.parse(cleanedText);
      
      // 验证返回的翻译格式
      for (const targetLang of targetLangs) {
        if (!translations[targetLang] || typeof translations[targetLang] !== 'string') {
          throw new Error(`翻译结果缺少${targetLang}语言的内容`);
        }
      }
      
      return translations;
    } catch (parseError) {
      // 如果JSON解析失败，尝试手动提取翻译内容
      console.warn('JSON解析失败，尝试手动提取:', parseError);
      console.log('尝试手动提取的原始文本:', translatedText.substring(0, 1000));
      
      const manualTranslations: Record<string, string> = {};
      
      for (const targetLang of targetLangs) {
        // 尝试多种模式提取翻译内容
        const patterns = [
          // 标准JSON格式
          new RegExp(`"${targetLang}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 'g'),
          // 可能包含换行的格式
          new RegExp(`"${targetLang}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 'gs'),
          // 更宽松的格式
          new RegExp(`${targetLang}\\s*:\\s*"([^"]*)"`, 'g'),
          // 包含未闭合引号的情况
          new RegExp(`"${targetLang}"\\s*:\\s*"([^"]*?)(?:"|$|\\n)`, 'g'),
          // 处理缺少逗号的情况
          new RegExp(`"${targetLang}"\\s*:\\s*"([^"]*?)"\\s*"`, 'g'),
          // 处理换行分隔的情况
          new RegExp(`"${targetLang}"\\s*:\\s*"([^"]*?)\\n`, 'g'),
          // 最宽松的匹配
          new RegExp(`${targetLang}[\\s:]*["']([^"']*?)["']`, 'g')
        ];
        
        let extracted = false;
        for (const pattern of patterns) {
          const match = pattern.exec(translatedText);
          if (match && match[1]) {
            manualTranslations[targetLang] = match[1]
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\n\s*\n/g, '\n') // 清理多余换行
              .trim();
            extracted = true;
            console.log(`成功提取${targetLang}翻译，长度:`, manualTranslations[targetLang].length);
            break;
          }
        }
        
        if (!extracted) {
          console.warn(`无法提取${targetLang}的翻译内容`);
        }
      }
      
      // 检查是否成功提取了所有语言的翻译
      const missingLangs = targetLangs.filter(lang => !manualTranslations[lang]);
      if (missingLangs.length > 0) {
        console.error('缺失的翻译语言:', missingLangs);
        console.error('原始翻译文本:', translatedText);
        
        // 尝试最后的备用方案：重新构造JSON
        console.log('尝试重新构造JSON...');
        const reconstructedTranslations = reconstructTranslations(translatedText, targetLangs);
        if (reconstructedTranslations && Object.keys(reconstructedTranslations).length === targetLangs.length) {
          console.log('重新构造成功，翻译结果:', Object.keys(reconstructedTranslations));
          return reconstructedTranslations;
        }
        
        throw new Error(`翻译结果解析失败: ${parseError}。无法提取语言: ${missingLangs.join(', ')}`);
      }
      
      console.log('手动提取成功，翻译结果:', Object.keys(manualTranslations));
      return manualTranslations;
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('翻译请求超时（60秒）');
    }
    throw error;
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
      .select('id, lang, text, translations, trans_updated_at, title, genre, level')
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
                    temperature,
                    item
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
