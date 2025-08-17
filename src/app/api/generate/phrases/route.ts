import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Phrase = { tag: string; text: string; example: string };

const tools: OpenAI.ChatCompletionTool[] = [{
  type: "function",
  function: {
    name: "generate_phrases",
    description: "生成语言学习短语列表",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tag: { type: "string", description: "功能标签如 EN-Softener/JA-敬語" },
              text: { type: "string", description: "短语内容(≤12词/字)" },
              example: { type: "string", description: "使用示例" }
            },
            required: ["tag", "text", "example"]
          }
        }
      },
      required: ["items"]
    }
  }
}];

export async function POST(req: NextRequest) {
  try {
    const { lang, topic, k = 10, model } = await req.json();
    if (!lang || !topic) return NextResponse.json({ error: "missing params: lang, topic" }, { status: 400 });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "DEEPSEEK_API_KEY missing" }, { status: 500 });

    const client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
    
    // 检查是否支持Function Calling
    const useFunctionCalling = model?.includes("chat") || !model;
    
    const resp = await client.chat.completions.create({
      model: model || "deepseek-chat",
      messages: [
        { 
          role: "system", 
          content: useFunctionCalling 
            ? `你是一名语言学习助手。根据用户提供的话题生成${k}条目标语言（${lang}）的学习短语，每条包含：功能标签（如 EN-Softener/JA-敬語/ZH-表达礼貌）、短语（≤12词/字）、以及使用示例。`
            : `请严格按照JSON格式输出: {"items":[{"tag":"标签","text":"短语","example":"示例"}]}`
        },
        { role: "user", content: `话题：${topic}。请用 ${lang} 生成 ${k} 条短语。` }
      ],
      ...(useFunctionCalling ? { tools, tool_choice: "required" } : { 
        response_format: { type: "json_object" } 
      }),
      temperature: 0.3,
      max_tokens: 2000
    });

    if (useFunctionCalling) {
      const toolCall = resp.choices[0]?.message?.tool_calls?.[0] as 
        OpenAI.ChatCompletionMessageToolCall | undefined;
      if (!toolCall || toolCall.type !== "function") {
        return NextResponse.json({
          error: "NO_TOOL_CALL",
          message: "API未返回有效的工具调用",
          details: resp
        }, { status: 502 });
      }

      try {
        const args = JSON.parse(toolCall.function.arguments);
        if (!args.items || !Array.isArray(args.items)) {
          throw new Error("Invalid items array");
        }
        return NextResponse.json(args.items.slice(0, Number(k) || 10));
      } catch (e: any) {
        return NextResponse.json({
          error: "INVALID_ARGUMENTS",
          message: "工具参数解析失败",
          details: e.message
        }, { status: 502 });
      }
    } else {
      // 普通JSON模式处理
      const raw = resp.choices[0]?.message?.content;
      if (!raw) {
        return NextResponse.json({
          error: "EMPTY_RESPONSE",
          message: "API返回了空内容",
          details: "请检查提示词或尝试降低temperature参数"
        }, { status: 502 });
      }

      try {
        const parsed = JSON.parse(raw);
        if (!parsed.items || !Array.isArray(parsed.items)) {
          throw new Error("Invalid items array");
        }
        return NextResponse.json(parsed.items.slice(0, Number(k) || 10));
      } catch (e: any) {
        return NextResponse.json({
          error: "INVALID_JSON",
          message: "无法解析JSON响应",
          details: e.message
        }, { status: 502 });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ 
      error: "API_ERROR",
      message: e?.message || "未知错误",
      details: e?.stack 
    }, { status: 500 });
  }
}
