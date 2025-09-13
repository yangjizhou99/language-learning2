export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";

// 根据等级和体裁生成主题提议的提示词
function buildTopicSuggestPrompt(level: number, genre: string, count: number) {
  const genreMap: Record<string, string> = {
    dialogue: "对话形式的shadowing练习",
    monologue: "独白形式的shadowing练习", 
    news: "新闻播报形式的练习",
    lecture: "讲座/解说形式的练习"
  };

  const levelDesc: Record<number, string> = {
    1: "初级：日常生活、问路、点餐、打招呼、校园办事等基础话题",
    2: "入门：购物、预约、住户问题、课程安排等日常任务",
    3: "中级：校园新闻、社交媒体、科技入门、健康科普等泛新闻话题",
    4: "中高级：科技、教育、健康政策、经济基础等专题话题",
    5: "高级：国际关系、AI伦理、产业趋势等深度议题",
    6: "专家级：复杂的学术、商业、政策分析等高难度话题"
  };

  return `你是一个语言学习课程设计师。请为${genreMap[genre] || genre}设计一个大主题，并提供${count}个具体的小题目。

等级：L${level} - ${levelDesc[level] || levelDesc[3]}
体裁：${genreMap[genre] || genre}
需要数量：${count}个具体题目

要求：
1. 首先提供一个适合该等级和体裁的大主题
2. 然后提供${count}个相关的具体小题目
3. 每个小题目都应该：
   - 有吸引力且实用
   - 适合该等级的学习者
   - 符合所选体裁的特点
   - 内容丰富enough to generate good shadowing material

请严格按照以下JSON格式返回：
{
  "theme": {
    "title_cn": "大主题的中文名称",
    "title_en": "大主题的英文名称", 
    "rationale": "为什么选择这个主题的简短说明"
  },
  "topics": [
    {
      "title_cn": "小题目的中文标题",
      "seed_en": "English keywords/seed for content generation",
      "one_line_cn": "一句话描述这个小题目的内容"
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      console.error('主题提议API权限验证失败:', auth.reason);
      return NextResponse.json({ 
        error: "forbidden", 
        reason: auth.reason,
        message: auth.reason === "unauthorized" ? "用户未登录" : "用户无管理员权限"
      }, { status: 403 });
    }

    const body = await req.json();
    const level = Math.max(1, Math.min(6, Number(body.level) || 3));
    const genre = body.genre || "dialogue";
    const count = Math.max(1, Math.min(30, Number(body.count) || 5));
    const provider = (body.provider || "openrouter") as "openrouter" | "deepseek" | "openai";
    const model = body.model || "openai/gpt-4o-mini";
    const temperature = body.temperature ?? 0.7;

    // 验证体裁参数
    if (!["dialogue", "monologue", "news", "lecture"].includes(genre)) {
      return NextResponse.json({ error: "无效的体裁参数" }, { status: 400 });
    }

    const { content, usage } = await chatJSON({
      provider,
      model,
      temperature,
      response_json: true,
      messages: [
        { role: "system", content: "你是专业的语言学习课程设计师。只返回有效的JSON格式。" },
        { role: "user", content: buildTopicSuggestPrompt(level, genre, count) }
      ]
    });

    let parsed: { theme?: any; topics?: Array<any> };
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: "AI未返回有效JSON" }, { status: 400 });
    }

    const theme = parsed.theme || { title_cn: "通用主题", title_en: "General Topic", rationale: "系统生成" };
    const topics = Array.isArray(parsed.topics) ? parsed.topics : [];

    // 清洗数据
    const cleanTopics = topics
      .slice(0, count)
      .map((topic: any, i: number) => ({
        title_cn: String(topic.title_cn || `题目${i+1}`).slice(0, 100),
        seed_en: String(topic.seed_en || "general topic").slice(0, 200),
        one_line_cn: String(topic.one_line_cn || "").slice(0, 200)
      }));

    return NextResponse.json({
      ok: true,
      level,
      genre, 
      count: cleanTopics.length,
      theme: {
        title_cn: String(theme.title_cn).slice(0, 100),
        title_en: String(theme.title_en || "").slice(0, 100),
        rationale: String(theme.rationale || "").slice(0, 300)
      },
      topics: cleanTopics,
      usage
    });

  } catch (error) {
    console.error("主题提议失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
