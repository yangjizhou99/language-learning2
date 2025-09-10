export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
});

// 可用的音色列表（从 voices API 获取）
const AVAILABLE_VOICES = {
  'en-US': [
    // 免费音色
    { name: 'Free-EN-Female-1', gender: 'FEMALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    { name: 'Free-EN-Male-1', gender: 'MALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    { name: 'Free-EN-Female-2', gender: 'FEMALE', quality: 'Free', tags: ['bright', 'friendly', 'free'], price: 0 },
    { name: 'Free-EN-Male-2', gender: 'MALE', quality: 'Free', tags: ['deep', 'serious', 'free'], price: 0 },
    // 付费音色
    { name: 'Kore', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['clear', 'news', 'calm'], price: 16 },
    { name: 'Orus', gender: 'MALE', quality: 'Chirp3-HD', tags: ['neutral', 'casual'], price: 16 },
    { name: 'Callirrhoe', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['bright', 'friendly'], price: 16 },
    { name: 'Puck', gender: 'MALE', quality: 'Chirp3-HD', tags: ['young', 'lively'], price: 16 },
    { name: 'Charon', gender: 'MALE', quality: 'Chirp3-HD', tags: ['deep', 'serious'], price: 16 },
    { name: 'Enceladus', gender: 'MALE', quality: 'Chirp3-HD', tags: ['formal'], price: 16 },
    { name: 'Pulcherrima', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['warm'], price: 16 },
    { name: 'Umbriel', gender: 'MALE', quality: 'Chirp3-HD', tags: ['mellow'], price: 16 },
    { name: 'Vindemiatrix', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['mature'], price: 16 }
  ],
  'cmn-CN': [
    // 免费音色
    { name: 'Free-CN-Female-1', gender: 'FEMALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    { name: 'Free-CN-Male-1', gender: 'MALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    { name: 'Free-CN-Female-2', gender: 'FEMALE', quality: 'Free', tags: ['bright', 'friendly', 'free'], price: 0 },
    { name: 'Free-CN-Male-2', gender: 'MALE', quality: 'Free', tags: ['deep', 'serious', 'free'], price: 0 },
    // 付费音色
    { name: 'cmn-CN-Chirp3-HD-Kore', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['clear', 'natural'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Orus', gender: 'MALE', quality: 'Chirp3-HD', tags: ['neutral', 'casual'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Callirrhoe', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['bright', 'friendly'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Puck', gender: 'MALE', quality: 'Chirp3-HD', tags: ['young', 'lively'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Charon', gender: 'MALE', quality: 'Chirp3-HD', tags: ['deep', 'serious'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Enceladus', gender: 'MALE', quality: 'Chirp3-HD', tags: ['formal'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Pulcherrima', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['warm'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Umbriel', gender: 'MALE', quality: 'Chirp3-HD', tags: ['mellow'], price: 16 },
    { name: 'cmn-CN-Chirp3-HD-Vindemiatrix', gender: 'FEMALE', quality: 'Chirp3-HD', tags: ['mature'], price: 16 }
  ],
  'ja-JP': [
    // 免费音色
    { name: 'Free-JA-Female-1', gender: 'FEMALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    { name: 'Free-JA-Male-1', gender: 'MALE', quality: 'Free', tags: ['clear', 'natural', 'free'], price: 0 },
    // 付费音色
    { name: 'ja-JP-Neural2-A', gender: 'FEMALE', quality: 'Neural2', tags: ['clear', 'natural'], price: 4 },
    { name: 'ja-JP-Neural2-B', gender: 'MALE', quality: 'Neural2', tags: ['neutral', 'casual'], price: 4 },
    { name: 'ja-JP-Neural2-C', gender: 'FEMALE', quality: 'Neural2', tags: ['bright', 'friendly'], price: 4 },
    { name: 'ja-JP-Neural2-D', gender: 'MALE', quality: 'Neural2', tags: ['young', 'lively'], price: 4 }
  ]
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      text, 
      language = 'zh', 
      speakers = [], 
      context = '',
      preferences = {} 
    } = body;

    if (!text) {
      return NextResponse.json({ 
        success: false, 
        error: "文本内容不能为空" 
      }, { status: 400 });
    }

    // 确定语言代码
    const langCode = language === 'zh' ? 'cmn-CN' : 
                    language === 'ja' ? 'ja-JP' : 'en-US';
    
    const availableVoices = AVAILABLE_VOICES[langCode as keyof typeof AVAILABLE_VOICES] || AVAILABLE_VOICES['en-US'];

    // 构建提示词
    const systemPrompt = `你是专业的音频导演。请根据对话内容和角色特点，为每个说话人推荐最合适的音色。

可用音色列表：
${availableVoices.map(v => `- ${v.name} (${v.gender}, ${v.quality}): ${v.tags.join(', ')} ${v.price === 0 ? '🆓 免费' : `$${v.price}/M字符`}`).join('\n')}

请考虑以下因素：
1. 角色性别和年龄
2. 对话内容和情感
3. 说话风格和个性
4. 成本考虑：优先推荐免费音色，除非有特殊质量要求
5. 音色质量等级（Free < Standard < Wavenet < Neural2 < Chirp3-HD）

推荐策略：
- 如果预算有限，优先选择免费音色
- 如果需要高质量，可以选择付费音色
- 免费音色质量良好，适合大多数场景

只返回 JSON 格式，包含每个说话人的推荐音色和理由。`;

    const userPrompt = `对话内容：${text}
语言：${language}
说话人：${speakers.length > 0 ? speakers.join(', ') : '自动识别'}
上下文：${context}
偏好设置：${JSON.stringify(preferences)}

请为每个说话人推荐最合适的音色，并说明推荐理由。`;

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const recommendations = JSON.parse(response.choices[0].message.content);

    return NextResponse.json({ 
      success: true,
      recommendations,
      availableVoices,
      language: langCode
    });

  } catch (error: unknown) {
    console.error("AI 音色推荐失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message
    }, { status: 500 });
  }
}
