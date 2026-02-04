import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 理解题生成的系统提示词
const QUIZ_SYS = `你是一个语言学习助手，专门设计理解力测试题。
你需要根据给定的对话/文章内容，生成选择题来检测学习者对关键信息的理解。

题目设计原则：
1. 题目应聚焦于关键信息点（谁、什么、何时、何地、为什么、如何）
2. 避免过于细枝末节的问题
3. 干扰选项应合理但明确错误
4. 题目难度应与内容难度匹配

返回严格 JSON 格式。`;

// 构建用户提示词
function buildQuizPrompt({
    lang,
    level,
    text,
    translation,
    questionCount,
}: {
    lang: string;
    level: number;
    text: string;
    translation?: string;
    questionCount: number;
}) {
    const langMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
    const L = langMap[lang as keyof typeof langMap] || 'English';

    const difficultyGuide = {
        1: '问题应非常简单直接，聚焦于最明显的信息',
        2: '问题应简单，聚焦于主要信息点',
        3: '问题可涉及一些具体细节',
        4: '问题可包含需要推理的内容',
        5: '问题可涉及隐含信息和深层理解',
        6: '问题可涉及复杂推理和综合分析',
    } as Record<number, string>;

    // 语言特定的指导
    const langInstructions: Record<string, string> = {
        ja: '問題文と選択肢はすべて日本語で書いてください。',
        en: 'Write all questions and options in English.',
        zh: '题目和选项都用中文书写。',
        ko: '질문과 선택지는 모두 한국어로 작성하세요.',
    };

    return `语言: ${L}
难度等级: L${level}

原文内容:
"""
${text}
"""

${translation ? `参考翻译:\n"""\n${translation}\n"""\n` : ''}

要求:
- 生成 ${questionCount} 道选择题
- ${difficultyGuide[level] || difficultyGuide[3]}
- 每道题有4个选项（A/B/C/D），其中只有1个正确答案
- **重要: ${langInstructions[lang] || langInstructions['en']}**
- 题目内容应聚焦于原文的关键信息

选项设计要求（非常重要）:
- **正确选项**: 必须用不同的表达方式来描述原文的信息，不要直接复制原文中的原话。使用同义词、改变句子结构、或用其他方式paraphrase
- **错误选项**: 必须具有迷惑性，可以是:
  - 原文中提到但与问题无关的信息
  - 看起来合理但实际上与原文矛盾的内容
  - 部分正确但关键细节错误的表述
  - 容易混淆的相似表达

**极其重要 - 正确答案位置分布**: 
- 必须将正确答案**随机分布**在 A、B、C、D 四个选项中
- 不要总是把正确答案放在 A 位置
- 如果生成多道题，每道题的正确答案位置应该不同
- 在放置选项时，先决定正确答案放在哪个位置（随机选择A/B/C/D），然后再填充其他干扰选项

输出 JSON 格式:
{
  "questions": [
    {
      "question": "问题文本（用${L}书写）",
      "options": {
        "A": "选项A",
        "B": "选项B",
        "C": "选项C",
        "D": "选项D"
      },
      "answer": "B 或 C 或 D 或 A（随机选择，不要总是A）"
    }
  ]
}

确保 questions 数组长度为 ${questionCount}。`;
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const {
            item_id,
            provider = 'deepseek',
            model = 'deepseek-chat',
            temperature = 0.7,
        } = body;

        if (!item_id) {
            return NextResponse.json(
                { error: '缺少必要参数 item_id' },
                { status: 400 },
            );
        }

        // 使用 service role 获取 shadowing_items 数据
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );

        const { data: item, error: fetchError } = await supabaseAdmin
            .from('shadowing_items')
            .select('id, lang, level, title, text, translations')
            .eq('id', item_id)
            .single();

        if (fetchError || !item) {
            return NextResponse.json(
                { error: '未找到指定的 shadowing item', detail: fetchError?.message },
                { status: 404 },
            );
        }

        // 获取中文翻译（如果有）
        const translations = item.translations as Record<string, string> | null;
        const zhTranslation = translations?.zh || translations?.zh_CN || null;

        // 根据等级确定题目数量：L1-L2 → 1题，L3-L4 → 2题，L5-L6 → 3题
        const getQuestionCount = (level: number): number => {
            if (level <= 2) return 1;
            if (level <= 4) return 2;
            return 3;
        };
        const questionCount = getQuestionCount(item.level);

        // 调用 AI 生成题目
        const result = await chatJSON({
            provider: provider as 'openrouter' | 'deepseek' | 'openai',
            model,
            temperature,
            timeoutMs: 60000, // 60秒超时
            messages: [
                { role: 'system', content: QUIZ_SYS },
                {
                    role: 'user',
                    content: buildQuizPrompt({
                        lang: item.lang,
                        level: item.level,
                        text: item.text,
                        translation: zhTranslation ?? undefined,
                        questionCount,
                    }),
                },
            ],
        });

        // 解析 AI 响应
        let parsed;
        try {
            parsed = JSON.parse(result.content);
        } catch {
            // 尝试提取 JSON
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('AI 返回的内容不是有效 JSON');
            }
        }

        if (!parsed.questions || !Array.isArray(parsed.questions)) {
            throw new Error('AI 返回格式错误：缺少 questions 数组');
        }

        return NextResponse.json({
            success: true,
            item: {
                id: item.id,
                lang: item.lang,
                level: item.level,
                title: item.title,
                text: item.text,
            },
            questions: parsed.questions,
            usage: result.usage,
            ai_provider: provider,
            ai_model: model,
        });
    } catch (error) {
        console.error('Quiz generation error:', error);
        const errObj: any = error as any;
        return NextResponse.json(
            { error: errObj?.message || String(error) },
            { status: 500 },
        );
    }
}
