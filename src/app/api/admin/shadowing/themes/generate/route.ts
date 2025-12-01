import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 大主题生成的系统提示词
const CURRICULUM_SYS = `You are a curriculum designer for language shadowing. 
Produce CEFR-appropriate, teachable and diverse THEMES.
- Keep scope coherent and generative (each theme can spawn many subtopics).
- Adapt difficulty by LEVEL (L1≈A1/A2 … L6≈C1).
- Return STRICT JSON only. No extra text.
- Avoid duplicates; avoid niche proper nouns unless L5+.`;

// 大主题生成的用户提示词模板（按语言输出标题/说明）
function buildThemePrompt({
  lang,
  level,
  genre,
  count,
  dialogueType,
}: {
  lang: string;
  level: number;
  genre: string;
  count: number;
  dialogueType?: string;
}) {
  const langNameMap = { en: 'English', ja: '日本語', zh: '简体中文', ko: '한국어' } as const;
  const L = langNameMap[lang as keyof typeof langNameMap] || 'English';

  // 针对不同学习语言，要求主题标题与说明用对应语言输出
  const titleGuidance =
    lang === 'en'
      ? 'Each theme title should be concise in English (≤ 8 words).'
      : lang === 'ja'
        ? '各テーマのタイトルは日本語で簡潔に（全角14字以内）。'
        : lang === 'ko'
          ? '각 테마 제목은 한국어로 간결하게 (14자 이내).'
          : '每个主题标题使用简体中文，简洁清晰（≤ 14 个汉字）。';
  const rationaleGuidance =
    lang === 'en'
      ? 'Provide 1–2 sentences of rationale in English.'
      : lang === 'ja'
        ? '適合レベル／ジャンルの理由を日本語で1–2文記述。'
        : lang === 'ko'
          ? '해당 레벨/장르에 적합한 이유를 한국어로 1–2문장으로 설명.'
          : '用中文写1–2句说明其为何适配该等级和体裁。';
  const coverageLabel1 = lang === 'ja' ? '要点1' : lang === 'ko' ? '포인트1' : lang === 'en' ? 'Point 1' : '要点1';
  const coverageLabel2 = lang === 'ja' ? '要点2' : lang === 'ko' ? '포인트2' : lang === 'en' ? 'Point 2' : '要点2';
  const coverageLabel3 = lang === 'ja' ? '要点3' : lang === 'ko' ? '포인트3' : lang === 'en' ? 'Point 3' : '要点3';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
${dialogueType ? `DIALOGUE_TYPE=${dialogueType}` : ''}
COUNT=${count}

Constraints:
- Themes must match the GENRE use-cases and the LEVEL difficulty.
- Prefer everyday domains for L1–L2; allow abstract/specialized for L5–L6.
- ${titleGuidance}
- ${rationaleGuidance}

Return JSON ONLY:
{
  "themes": [
    {
      "title_cn": "……",          // 标题：按 LANG 输出；字段名保持不变供后端使用
      "title_en": "……",          // 对译（可留空）；若 LANG=en 可与标题相同
      "rationale": "……",         // 1–2句：按 LANG 输出
      "coverage": ["${coverageLabel1}","${coverageLabel2}","${coverageLabel3}"],
      "level": "L${level}",
      "genre": "${genre}"
    }
  ]
}
Make sure themes.length = ${count}. If you produce more or fewer, self-correct before returning.`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const body = await req.json();
    const {
      lang,
      level,
      genre,
      dialogue_type,
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7,
    } = body;

    if (!lang || !level || !genre) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 获取现有主题信息
    const { data: existingThemes } = await supabase
      .from('shadowing_themes')
      .select('title, desc')
      .eq('lang', lang)
      .eq('level', level)
      .eq('genre', genre);

    const existingTitles = existingThemes?.map((t) => t.title) || [];

    // 构建包含现有主题信息的提示词（一次性生成所有主题）
    const enhancedPrompt =
      buildThemePrompt({ lang, level, genre, count, dialogueType: dialogue_type }) +
      `\n\n现有主题列表（请避免重复）：\n${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n请生成与上述主题不同的新主题。`;

    // 只调用一次 AI 生成，设置90秒超时
    const result = await chatJSON({
      provider: provider as 'openrouter' | 'deepseek' | 'openai',
      model,
      temperature: Math.min(temperature + 0.1, 1.0), // 稍微增加创造性
      timeoutMs: 90000, // 90秒超时
      messages: [
        { role: 'system', content: CURRICULUM_SYS },
        { role: 'user', content: enhancedPrompt },
      ],
    });

    // 解析 AI 响应
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch (e) {
      // 尝试提取 JSON
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    if (!parsed.themes || !Array.isArray(parsed.themes)) {
      throw new Error('Invalid response format');
    }

    // 处理生成的主题
    const nowIso = new Date().toISOString();
    type ThemeInsert = {
      id: string;
      created_at: string;
      lang: string;
      level: number;
      genre: string;
      dialogue_type?: string;
      title: string;
      title_en: string;
      desc: string;
      coverage: unknown[];
      ai_provider: string;
      ai_model: string;
      ai_usage: Record<string, unknown>;
      status: string;
      created_by?: string | null;
    };

    const themesToProcess: ThemeInsert[] = parsed.themes.map((theme: any): ThemeInsert => ({
      id: randomUUID(), // 兼容数据库未设置默认值的环境
      created_at: nowIso, // 兼容数据库未设置默认值的环境
      lang,
      level,
      genre,
      dialogue_type,
      title: theme.title_cn,
      title_en: theme.title_en || '',
      desc: theme.rationale || '',
      coverage: theme.coverage || [],
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      status: 'active',
      created_by: auth.user?.id,
    }));

    let insertedData: Array<Pick<ThemeInsert, 'id' | 'title'>> = [];
    if (themesToProcess.length > 0) {
      // 优先尝试插入完整字段集合
      const attemptInsert = async (rows: Array<Partial<ThemeInsert>>) =>
        await supabase.from('shadowing_themes').insert(rows).select('id, title');

      const { data, error } = await attemptInsert(themesToProcess);

      if (error) {
        // 记录详细错误，便于排查
        console.error('shadowing_themes insert error:', error);

        // 如果是列不存在（数据库未升级到最新结构），降级仅插入基础字段
        const errMsg = (error as any)?.message || '';
        const errCode = (error as any)?.code || '';
        const likelyUnknownColumn = /column .* does not exist/i.test(errMsg) || errCode === '42703';

        if (likelyUnknownColumn) {
          const minimalRows = themesToProcess.map((t: ThemeInsert) => ({
            id: t.id,
            created_at: t.created_at,
            lang: t.lang,
            level: t.level,
            genre: t.genre,
            dialogue_type: t.dialogue_type,
            title: t.title,
            desc: t.desc,
            status: t.status,
            created_by: t.created_by,
          }));

          const { data: data2, error: error2 } = await attemptInsert(minimalRows);
          if (error2) {
            console.error('shadowing_themes minimal insert error:', error2);
            const formatted = {
              message: (error2 as any)?.message || String(error2),
              details: (error2 as any)?.details,
              hint: (error2 as any)?.hint,
              code: (error2 as any)?.code,
            };
            return NextResponse.json(
              { error: `Database error: ${formatted.message}`, error_detail: formatted },
              { status: 500 },
            );
          }
          insertedData = data2 || [];
        } else {
          const formatted = {
            message: (error as any)?.message || String(error),
            details: (error as any)?.details,
            hint: (error as any)?.hint,
            code: (error as any)?.code,
          };
          return NextResponse.json(
            { error: `Database error: ${formatted.message}`, error_detail: formatted },
            { status: 500 },
          );
        }
      } else {
        insertedData = data || [];
      }
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedData.length,
      inserted_themes: insertedData,
      message: `成功生成 ${insertedData.length} 个新主题（已避免与现有主题重复）`,
    });
  } catch (error) {
    console.error('Theme generation error:', error);
    const errObj: any = error as any;
    const formatted = {
      message: errObj?.message || String(error),
      details: errObj?.details,
      hint: errObj?.hint,
      code: errObj?.code,
    };
    return NextResponse.json(
      { error: formatted.message, error_detail: formatted },
      { status: 500 },
    );
  }
}
