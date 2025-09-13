export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";

// 为主题生成小题目
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const supabase = auth.supabase;

    const body = await req.json();
    const { theme_id, count = 5, provider = "openrouter", model = "openai/gpt-4o-mini", temperature = 0.7 } = body;

    // 获取主题信息
    const { data: theme, error: themeError } = await supabase
      .from("shadowing_themes")
      .select("*")
      .eq("id", theme_id)
      .single();

    if (themeError || !theme) {
      return NextResponse.json({ error: "主题不存在" }, { status: 404 });
    }

    // 构建AI提示词
    const prompt = buildTopicGenerationPrompt(theme, count);
    
    // 调用AI生成题目
    const result = await chatJSON({
      provider,
      model,
      temperature,
      messages: [
        { role: "system", content: "你是一个语言学习课程设计师，专门为主题生成具体的学习题目。" },
        { role: "user", content: prompt }
      ]
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { topics } = result.data;
    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json({ error: "AI未生成有效题目" }, { status: 400 });
    }

    // 保存生成的题目到数据库
    const topicData = topics.map((topic: any) => ({
      theme_id,
      title_cn: topic.title_cn || topic.title,
      seed_en: topic.seed_en || topic.seed || "",
      one_line_cn: topic.one_line_cn || topic.description || "",
      is_generated: true,
      ai_provider: provider,
      ai_model: model,
      ai_usage: result.usage || {},
      created_by: auth.user.id
    }));

    const { data: savedTopics, error: saveError } = await supabase
      .from("shadowing_topics")
      .insert(topicData)
      .select();

    if (saveError) {
      console.error("保存题目失败:", saveError);
      return NextResponse.json({ error: saveError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      ok: true, 
      topics: savedTopics,
      usage: result.usage 
    });
  } catch (error) {
    console.error("生成题目API错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

function buildTopicGenerationPrompt(theme: any, count: number): string {
  const { title_cn, title_en, description, lang, level, genre, register } = theme;
  
  const langMap = {
    'en': 'English',
    'ja': '日本語', 
    'zh': '简体中文'
  };
  
  const genreMap = {
    'dialogue': '对话形式',
    'monologue': '独白形式',
    'news': '新闻播报形式',
    'lecture': '讲座/解说形式'
  };
  
  const registerMap = {
    'casual': '非正式',
    'neutral': '中性',
    'formal': '正式'
  };

  return `请为主题"${title_cn} (${title_en})"生成${count}个具体的shadowing练习题目。

主题信息：
- 语言：${langMap[lang as keyof typeof langMap]}
- 等级：L${level}
- 体裁：${genreMap[genre as keyof typeof genreMap]}
- 语域：${registerMap[register as keyof typeof registerMap]}
- 描述：${description || '无'}

要求：
1. 每个题目都应该围绕"${title_cn}"这个大主题
2. 题目要适合L${level}等级的学习者
3. 体裁必须是${genreMap[genre as keyof typeof genreMap]}
4. 语域要符合${registerMap[register as keyof typeof registerMap]}的要求
5. 题目要具体、实用、有趣

请严格按照以下JSON格式返回：
{
  "topics": [
    {
      "title_cn": "题目的中文标题",
      "seed_en": "English keywords for content generation",
      "one_line_cn": "一句话描述这个题目的内容"
    }
  ]
}`;
}
