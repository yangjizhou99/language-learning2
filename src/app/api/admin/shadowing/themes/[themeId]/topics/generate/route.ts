export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// 为主题生成题目
export async function POST(
  req: NextRequest,
  { params }: { params: { themeId: string } }
) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const supabase = auth.supabase;

    const { themeId } = params;
    const body = await req.json();
    const { count, provider, model, temperature } = body;

    if (!themeId) {
      return NextResponse.json({ error: "主题ID不能为空" }, { status: 400 });
    }

    if (!count || count < 1 || count > 20) {
      return NextResponse.json({ error: "生成数量必须在1-20之间" }, { status: 400 });
    }

    // 获取主题信息
    const { data: theme, error: themeError } = await supabase
      .from("shadowing_themes")
      .select("*")
      .eq("id", themeId)
      .single();

    if (themeError || !theme) {
      return NextResponse.json({ error: "主题不存在" }, { status: 404 });
    }

    // 获取已存在的题目，避免重复生成
    const { data: existingTopics, error: topicsError } = await supabase
      .from("shadowing_topics")
      .select("title_cn")
      .eq("theme_id", themeId);

    if (topicsError) {
      console.error("获取已存在题目失败:", topicsError);
    }

    const existingTitles = existingTopics?.map(t => t.title_cn) || [];

    // 构建AI提示词
    const existingTitlesText = existingTitles.length > 0 
      ? `\n\n已存在的题目（请避免重复生成）：\n${existingTitles.map(title => `- ${title}`).join('\n')}`
      : '';

    const prompt = `请为"${theme.title_cn}"主题生成${count}个具体的shadowing学习题目。

主题信息：
- 主题名称：${theme.title_cn}
- 难度等级：L${theme.level}
- 目标语言：${theme.lang || '未指定'}
- 体裁：${theme.genre || '未指定'}
- 语域：${theme.register || '未指定'}${existingTitlesText}

请生成${count}个具体的题目，每个题目包含：
1. title_cn: 中文标题（必须与已存在题目不同）
2. seed_en: 英文关键词/种子词
3. one_line_cn: 一句话中文描述

要求：
- 题目标题要具体、有针对性
- 避免与已存在题目重复
- 题目内容要符合难度等级要求
- 每个题目都要有实际的学习价值

返回JSON格式：
{
  "topics": [
    {
      "title_cn": "题目中文标题",
      "seed_en": "英文关键词",
      "one_line_cn": "一句话描述"
    }
  ]
}`;

    // 调用AI生成
    let aiResponse;
    if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: temperature || 0.7,
          max_tokens: 2000
        })
      });
      aiResponse = await response.json();
    } else if (provider === 'openrouter') {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: temperature || 0.7,
          max_tokens: 2000
        })
      });
      aiResponse = await response.json();
    } else {
      return NextResponse.json({ error: "不支持的AI提供商" }, { status: 400 });
    }

    if (!aiResponse.choices || !aiResponse.choices[0]) {
      return NextResponse.json({ error: "AI生成失败" }, { status: 500 });
    }

    // 解析AI响应
    const content = aiResponse.choices[0].message.content;
    let topics;
    try {
      // 尝试提取JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        topics = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("无法找到JSON格式");
      }
    } catch (parseError) {
      console.error("解析AI响应失败:", parseError);
      return NextResponse.json({ error: "AI响应格式错误" }, { status: 500 });
    }

    // 过滤掉重复的题目
    const newTopics = topics.topics.filter((topic: any) => 
      !existingTitles.includes(topic.title_cn)
    );

    if (newTopics.length === 0) {
      return NextResponse.json({ 
        error: "所有生成的题目都已存在，请尝试生成更多数量或重新生成" 
      }, { status: 400 });
    }

    // 保存题目到数据库
    const topicsToInsert = newTopics.map((topic: any) => ({
      theme_id: themeId,
      title_cn: topic.title_cn,
      seed_en: topic.seed_en || "",
      one_line_cn: topic.one_line_cn || "",
      is_generated: true,
      ai_provider: provider,
      ai_model: model,
      ai_usage: aiResponse.usage || null,
      created_by: auth.user.id
    }));

    const { data: insertedTopics, error: insertError } = await supabase
      .from("shadowing_topics")
      .insert(topicsToInsert)
      .select();

    if (insertError) {
      console.error("保存题目失败:", insertError);
      return NextResponse.json({ error: "保存题目失败" }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      topics: insertedTopics,
      usage: aiResponse.usage,
      message: `成功生成 ${insertedTopics.length} 个新题目${newTopics.length < topics.topics.length ? `，过滤了 ${topics.topics.length - newTopics.length} 个重复题目` : ''}`
    });

  } catch (error) {
    console.error("生成题目API错误:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
