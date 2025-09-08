export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { chatJSON } from '@/lib/ai/client';

const ExplainVocabSchema = z.object({
  entry_ids: z.array(z.string().uuid()),
  native_lang: z.enum(['zh', 'en', 'ja']),
  provider: z.string().default('openrouter'),
  model: z.string().default('anthropic/claude-3.5-sonnet'),
  temperature: z.number().min(0).max(2).default(0.7),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');
    
    let supabase: any;
    
    if (hasBearer) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } }
        }
      );
    } else {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {
              // no-op for Route Handler
            },
            remove() {
              // no-op for Route Handler
            },
          }
        }
      );
    }
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { entry_ids, native_lang, provider, model, temperature } = ExplainVocabSchema.parse(body);

    // 获取要解释的生词
    const { data: entries, error: fetchError } = await supabase
      .from('vocab_entries')
      .select('*')
      .in('id', entry_ids)
      .eq('user_id', user.id);

    if (fetchError || !entries || entries.length === 0) {
      return NextResponse.json({ error: '未找到生词' }, { status: 404 });
    }

    // 构建AI提示词
    const nativeLangNames = {
      zh: '中文',
      en: 'English',
      ja: '日本語'
    };

    const targetLangNames = {
      en: 'English',
      ja: '日本語',
      zh: '中文'
    };

    const prompt = `你是一个专业的语言学习助手。请为以下生词生成详细的解释和例句。

⚠️ 重要规则：
1. 解释部分用${nativeLangNames[native_lang]}（用户的母语）
2. 例句部分用生词本身的语言（如日语词用日语例句，英语词用英语例句）
3. 例句的翻译/说明用${nativeLangNames[native_lang]}

具体要求：
- 词性: 用${nativeLangNames[native_lang]}表示
- 解释(gloss_native): 用${nativeLangNames[native_lang]}
- 例句(example_target): 用生词的原语言
- 例句说明(example_native): 用${nativeLangNames[native_lang]}解释例句含义
- 搭配: 用生词的原语言

示例说明：
如果生词是日语"尽力"：
✅ gloss_native: "努力做到最好，竭尽全力"（中文解释）
✅ example_target: "私はこの問題を解決するために尽力します"（日语例句）
✅ example_native: "我会尽力解决这个问题"（中文翻译/说明）

如果生词是英语"effort"：
✅ gloss_native: "努力，尝试"（中文解释）
✅ example_target: "I will make every effort to solve this problem"（英语例句）
✅ example_native: "我会尽一切努力解决这个问题"（中文翻译/说明）

JSON格式要求：

{
  "pos": "词性（${nativeLangNames[native_lang]}）",
  "pronunciation": "发音（音标或假名）", 
  "gloss_native": "${nativeLangNames[native_lang]}解释",
  "senses": [
    {
      "example_target": "生词原语言的例句",
      "example_native": "${nativeLangNames[native_lang]}翻译或解释",
      "collocations": ["原语言搭配1", "原语言搭配2"]
    }
  ],
  "register": "语域（formal/informal/neutral）",
  "variants": ["变体形式1", "变体形式2"],
  "see_also": ["相关词汇1", "相关词汇2"]
}

生词列表：
${entries.map((entry: any) => `
词条: ${entry.term}
语言: ${targetLangNames[entry.lang as keyof typeof targetLangNames]}
上下文: ${entry.context || '无'}
`).join('\n')}

⚠️ 最终提醒：
- 确保所有 gloss_native 都是${nativeLangNames[native_lang]}（解释用母语）
- 确保所有 example_target 都用生词的原语言（例句用原语言）
- 确保所有 example_native 都是${nativeLangNames[native_lang]}（例句翻译用母语）
- 确保 collocations 用生词的原语言

请返回JSON数组，每个元素对应一个词条的解释。`;

    // 调用AI生成解释
    const response = await chatJSON({
      provider: provider as "openrouter" | "deepseek" | "openai",
      model,
      messages: [
        { 
          role: 'system', 
          content: `你是一个专业的语言学习助手。用户希望用${nativeLangNames[native_lang]}学习外语词汇。解释要用${nativeLangNames[native_lang]}，但例句要用生词的原语言，然后提供${nativeLangNames[native_lang]}翻译。`
        },
        { role: 'user', content: prompt }
      ],
      temperature: Math.min(temperature, 0.3), // 降低温度以提高准确性
      response_json: true,
      timeoutMs: 30000
    });

    let explanations;
    try {
      explanations = JSON.parse(response.content);
      if (!Array.isArray(explanations)) {
        explanations = [explanations];
      }
    } catch (parseError) {
      console.error('解析AI响应失败:', parseError);
      return NextResponse.json({ error: 'AI响应格式错误' }, { status: 500 });
    }

    // 更新数据库
    const updatePromises = entries.map((entry: any, index: number) => {
      const explanation = explanations[index] || null;
      return supabase
        .from('vocab_entries')
        .update({ 
          explanation,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)
        .eq('user_id', user.id);
    });

    const updateResults = await Promise.all(updatePromises);
    const updateErrors = updateResults.filter((result: any) => result.error);

    if (updateErrors.length > 0) {
      console.error('更新解释失败:', updateErrors);
      return NextResponse.json({ error: '部分更新失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: entries.length,
      usage: response.usage,
      explanations
    });

  } catch (error) {
    console.error('生成生词解释API错误:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: '请求格式错误', 
        details: error.issues?.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ') || '未知验证错误'
      }, { status: 400 });
    }
    return NextResponse.json({ 
      error: '服务器错误', 
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 });
  }
}
