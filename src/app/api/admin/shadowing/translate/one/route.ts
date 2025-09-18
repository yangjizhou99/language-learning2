export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

// 翻译配置
const TRANSLATION_CONFIG = {
  providers: {
    openrouter: {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      defaultModel: 'openai/gpt-4o-mini',
    },
    deepseek: {
      url: 'https://api.deepseek.com/v1/chat/completions',
      defaultModel: 'deepseek-chat',
    },
    openai: {
      url: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4o-mini',
    },
  },
};

// 构建翻译提示词
function buildTranslationPrompt(
  sourceText: string,
  sourceLang: string,
  targetLangs: string[],
): string {
  const langNames = {
    en: 'English',
    ja: '日本語',
    zh: '简体中文',
  };

  const sourceLangName = langNames[sourceLang as keyof typeof langNames];
  const targetLangNames = targetLangs
    .map((lang) => langNames[lang as keyof typeof langNames])
    .join('、');

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
  temperature: number = 0.3,
): Promise<Record<string, string>> {
  const config =
    TRANSLATION_CONFIG.providers[provider as keyof typeof TRANSLATION_CONFIG.providers];
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
      Authorization: `Bearer ${apiKey}`,
      ...(provider === 'openrouter' && {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      }),
    },
    body: JSON.stringify({
      model: model || config.defaultModel,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: 2000,
    }),
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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      id,
      scope = 'drafts', // 'drafts' | 'items'
      provider = 'deepseek',
      model,
      temperature = 0.3,
      force = false, // 是否强制重新翻译
    } = body;

    if (!id) {
      return NextResponse.json({ error: '缺少id参数' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const tableName = scope === 'drafts' ? 'shadowing_drafts' : 'shadowing_items';

    // 获取草稿或题目详情
    const { data: item, error: fetchError } = await supabase
      .from(tableName)
      .select('id, lang, text, translations, trans_updated_at')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: '未找到指定项目' }, { status: 404 });
    }

    // 检查是否需要翻译
    if (!force && item.translations && Object.keys(item.translations).length > 0) {
      const targetLangs = getTargetLanguages(item.lang);
      const hasAllTranslations = targetLangs.every((lang) => item.translations[lang]);

      if (hasAllTranslations) {
        return NextResponse.json({
          success: true,
          message: '翻译已存在',
          translations: item.translations,
          trans_updated_at: item.trans_updated_at,
        });
      }
    }

    // 执行翻译
    const targetLangs = getTargetLanguages(item.lang);
    const translations = await callTranslationAPI(
      item.text,
      item.lang,
      targetLangs,
      provider,
      model,
      temperature,
    );

    // 更新数据库
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        translations,
        trans_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`更新翻译失败: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      message: '翻译完成',
      translations,
      trans_updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('翻译失败:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : '翻译失败',
      },
      { status: 500 },
    );
  }
}
