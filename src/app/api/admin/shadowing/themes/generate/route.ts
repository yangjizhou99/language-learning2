import { NextRequest, NextResponse } from 'next/server';
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

// 大主题生成的用户提示词模板
function buildThemePrompt({ lang, level, genre, count }: {
  lang: string;
  level: number;
  genre: string;
  count: number;
}) {
  const langMap = { en: 'English', ja: '日本語', zh: '简体中文' };
  const L = langMap[lang as keyof typeof langMap] || 'English';
  
  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
COUNT=${count}

Constraints:
- Themes must match the GENRE use-cases and the LEVEL difficulty.
- Prefer everyday domains for L1–L2; allow abstract/specialized for L5–L6.
- Each theme title_cn ≤ 14 个汉字，清晰可读；给出英文 seed 关键词引导后续生成。

Return JSON ONLY:
{
  "themes": [
    {
      "title_cn": "……",          // 中文大主题（用于后台显示/筛选）
      "title_en": "……",          // 英文对译（便于多语言展示，可留空）
      "rationale": "……",         // 为什么适配该 Level & Genre（1–2 句）
      "coverage": ["要点1","要点2","要点3"],  // 该主题可覆盖的子话题面
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
      count = 5,
      provider = 'deepseek',
      model = 'deepseek-chat',
      temperature = 0.7
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

    const existingTitles = existingThemes?.map(t => t.title) || [];
    
    // 构建包含现有主题信息的提示词（一次性生成所有主题）
    const enhancedPrompt = buildThemePrompt({ lang, level, genre, count }) + 
      `\n\n现有主题列表（请避免重复）：\n${existingTitles.map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n请生成与上述主题不同的新主题。`;

    // 只调用一次 AI 生成，设置90秒超时
    const result = await chatJSON({
      provider: provider as 'openrouter' | 'deepseek' | 'openai',
      model,
      temperature: Math.min(temperature + 0.1, 1.0), // 稍微增加创造性
      timeoutMs: 90000, // 90秒超时
      messages: [
        { role: 'system', content: CURRICULUM_SYS },
        { role: 'user', content: enhancedPrompt }
      ]
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
    const themesToProcess = parsed.themes.map((theme: any) => ({
      lang,
      level,
      genre,
      title: theme.title_cn,
      title_en: theme.title_en || '',
      desc: theme.rationale || '',
      coverage: theme.coverage || [],
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      status: 'active'
    }));

    let insertedData: any[] = [];
    if (themesToProcess.length > 0) {
      const { data, error } = await supabase
        .from('shadowing_themes')
        .insert(themesToProcess)
        .select('id, title');
      
      if (error) {
        throw new Error(`Database error: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      insertedData = data || [];
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedData.length,
      inserted_themes: insertedData,
      message: `成功生成 ${insertedData.length} 个新主题（已避免与现有主题重复）`
    });

  } catch (error) {
    console.error('Theme generation error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Generation failed'
    }, { status: 500 });
  }
}
