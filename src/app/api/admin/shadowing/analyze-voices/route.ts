import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";

/**
 * AI音色分析API
 * 分析对话内容，推荐适合的音色分配
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { text, language, candidateVoices } = body;

    if (!text || !language || !candidateVoices) {
      return NextResponse.json({ 
        error: "缺少必要参数: text, language, candidateVoices" 
      }, { status: 400 });
    }

    // 构建备选音色信息字符串
    const voiceInfo = candidateVoices.map((voice: any) => 
      `- ${voice.name}: ${voice.useCase || '通用场景'}, ${voice.ssml_gender}, ${voice.provider || 'google'}`
    ).join('\n');

    // 构建分析提示词
    const systemPrompt = `你是一个专业的音色分析师。请分析给定的文本内容，从备选音色中选择最合适的1-2种音色。

分析要求：
1. 识别文本中的说话者数量
2. 分析每个说话者的特征（性别、年龄、性格、职业等）
3. 从备选音色中选择最合适的音色
4. 如果是独白，选择1个音色
5. 如果是对话，选择1-2个不同的音色
6. 只能从提供的备选音色中选择，不能选择其他音色

请返回JSON格式：
{
  "speakers": [
    {
      "name": "说话者名称",
      "description": "说话者特征描述",
      "selectedVoice": "选择的音色名称",
      "reason": "选择理由"
    }
  ],
  "isDialogue": true/false,
  "analysis": "整体分析说明",
  "selectedVoices": ["选择的音色名称列表"]
}`;

    const userPrompt = `请分析以下${language === 'zh' ? '中文' : language === 'en' ? '英文' : '日文'}文本内容：

文本内容：
${text}

备选音色（只能从这些音色中选择）：
${voiceInfo}

请从备选音色中选择最合适的1-2种音色。`;

    const { content, usage } = await chatJSON({
      provider: "deepseek",
      model: "deepseek-chat",
      temperature: 0.3,
      response_json: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return NextResponse.json({ 
        error: "AI分析结果格式错误", 
        details: content 
      }, { status: 400 });
    }

    // 验证分析结果
    if (!parsed.speakers || !Array.isArray(parsed.speakers)) {
      return NextResponse.json({ 
        error: "AI分析结果缺少speakers字段" 
      }, { status: 400 });
    }

    // 验证选择的音色是否在备选音色列表中
    const candidateVoiceNames = candidateVoices.map((v: any) => v.name);
    const validatedSpeakers = parsed.speakers.map((speaker: any) => {
      if (!candidateVoiceNames.includes(speaker.selectedVoice)) {
        // 如果选择的音色不在备选中，选择第一个备选音色
        speaker.selectedVoice = candidateVoiceNames[0];
        speaker.reason = `原选择音色不在备选中，已调整为备选音色`;
      }
      return speaker;
    });

    // 验证selectedVoices列表
    const validatedSelectedVoices = (parsed.selectedVoices || []).filter((voiceName: string) => 
      candidateVoiceNames.includes(voiceName)
    );

    return NextResponse.json({
      success: true,
      speakers: validatedSpeakers,
      isDialogue: parsed.isDialogue || false,
      analysis: parsed.analysis || "AI音色分析完成",
      selectedVoices: validatedSelectedVoices,
      usage
    });

  } catch (error) {
    console.error('AI音色分析失败:', error);
    return NextResponse.json({ 
      success: false,
      error: 'AI音色分析失败', 
      details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error)
    }, { status: 500 });
  }
}
