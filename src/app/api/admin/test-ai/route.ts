import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { chatJSON } from "@/lib/ai/client";

export const runtime = "nodejs"; 
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. 权限检查
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ 
        error: "权限检查失败", 
        reason: auth.reason,
        step: "auth_check"
      }, { status: 403 });
    }

    const body = await req.json();
    const provider = (body.provider || "deepseek") as "openrouter"|"deepseek"|"openai";
    const model = body.model || "deepseek-chat";
    const temperature = body.temperature ?? 0.6;

    // 2. 测试简单的AI调用
    const testPrompt = `请用中文写一段关于"基因"的简短科普文字，约100字。仅以JSON格式输出：{"title":"标题", "text":"正文内容"}`;
    
    let result;
    try {
      result = await chatJSON({ 
        provider, 
        model, 
        temperature, 
        messages: [
          { role: "system", content: "You are a helpful writing assistant." },
          { role: "user", content: testPrompt }
        ]
      });
    } catch (aiError) {
      return NextResponse.json({
        error: "AI调用失败",
        step: "ai_call",
        details: String(aiError),
        provider,
        model
      }, { status: 500 });
    }

    // 3. 解析AI响应
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch (parseError) {
      return NextResponse.json({
        error: "AI响应解析失败",
        step: "json_parse",
        ai_response: result.content,
        parse_error: String(parseError)
      }, { status: 500 });
    }

    // 4. 检查生成的内容
    const title = (parsed.title || "").trim();
    const text = (parsed.text || "").trim();
    
    if (!title || !text) {
      return NextResponse.json({
        error: "AI生成内容不完整",
        step: "content_validation",
        parsed_content: parsed,
        title_length: title.length,
        text_length: text.length
      }, { status: 400 });
    }

    // 5. 测试数据库写入（模拟）
    try {
      const { data, error } = await auth.supabase
        .from("article_drafts")
        .select("count")
        .limit(1);
      
      if (error) {
        return NextResponse.json({
          error: "数据库表访问失败",
          step: "db_test",
          db_error: error.message
        }, { status: 500 });
      }
    } catch (dbError) {
      return NextResponse.json({
        error: "数据库连接失败",
        step: "db_connection",
        db_error: String(dbError)
      }, { status: 500 });
    }

    // 6. 成功
    return NextResponse.json({
      success: true,
      message: "AI生成测试成功！",
      test_result: {
        provider,
        model,
        title,
        text_preview: text.slice(0, 50) + "...",
        text_length: text.length,
        usage: result.usage
      }
    });

  } catch (error) {
    return NextResponse.json({
      error: "测试过程中出现错误",
      step: "general_error",
      details: String(error)
    }, { status: 500 });
  }
}
