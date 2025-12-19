import { NextRequest, NextResponse } from 'next/server';
import { chatJSON } from '@/lib/ai/client';
import { RepairRequest, RepairResponse } from '@/lib/nlp/repair-service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as RepairRequest;
    const { task, text, tokens, unknownTokens, unrecognizedGrammar } = body;

    let systemPrompt = '';
    let userPrompt = '';

    switch (task) {
      case 'token_repair':
        systemPrompt = `你是日语文本的“最小修复器”。任务：修复分词/语法块识别失败的部分（粘连 Token）。
只输出 JSON，必须符合 schema。
Schema: {
  "normalized_text": "string (修复后的完整文本)",
  "repairs": [
    {
      "type": "split_token" | "map_colloquial" | "normalize_text",
      "original": "string (原片段)",
      "replacement_tokens": ["string", "string"] (仅 split_token 需要),
      "canonical": "string" (map/normalize 需要),
      "notes": "string"
    }
  ],
  "confidence": number
}`;
        userPrompt = `原文：${text}
疑似粘连 Token：
${unknownTokens.map(t => `- ${t}`).join('\n')}

目标：把 unknown token 拆分或规范化。
约束：
1. 不允许改写内容词
2. 重点修复粘连 Token (如 ゃいけないのそんなに -> なきゃいけない + の + そんなに)
3. 仅输出 repairs 数组，不需要 vocab/grammar 字段`;
        break;

      case 'vocab_definition':
        systemPrompt = `你是日语词汇专家。任务：为未识别的单词提供定义、读音和 JLPT 等级。
只输出 JSON，必须符合 schema。
Schema: {
  "vocab_entries": [
    {"surface": "string", "reading": "string", "definition": "string", "jlpt": "string"}
  ],
  "confidence": number
}`;
        userPrompt = `原文上下文：${text}
需要定义的单词：
${unknownTokens.map(t => `- ${t}`).join('\n')}

目标：
1. 仅针对确实是单词（非粘连片段）的项提供定义。
2. 如果是粘连片段（如 "ゃいけない"），请忽略，不要强行解释。`;
        break;

      case 'grammar_analysis':
        systemPrompt = `你是日语语法专家。任务：为未识别或未分级的语法块提供标准形式和 JLPT 等级。
只输出 JSON，必须符合 schema。
Schema: {
  "grammar_chunks": [
    {"surface": "string", "canonical": "string", "jlpt": "string"}
  ],
  "confidence": number
}`;
        userPrompt = `原文上下文：${text}
未识别/未分级语法块：
${unrecognizedGrammar?.map(g => `- ${g}`).join('\n') || '无'}

目标：
1. 提供标准形式（如 てる -> ている）。
2. 判定 JLPT 等级。`;
        break;

      case 'level_assignment':
        // Focused task for assigning JLPT levels to unknown tokens
        systemPrompt = `你是日语JLPT分级专家。任务：为未识别等级的词汇和语法项分配JLPT等级。
只输出 JSON，必须符合 schema。
Schema: {
  "vocab_entries": [
    {"surface": "string", "reading": "string", "definition": "string", "jlpt": "N1"|"N2"|"N3"|"N4"|"N5"}
  ],
  "grammar_chunks": [
    {"surface": "string", "canonical": "string", "jlpt": "N1"|"N2"|"N3"|"N4"|"N5", "definition": "string"}
  ],
  "confidence": number
}

注意：
- jlpt 字段必须是 N1, N2, N3, N4, N5 之一
- 如果词汇是复合词或派生词，根据其复杂度判断等级
- 如果是口语表达或俗语，通常为 N2 或 N3
- 如果无法确定，基于词汇的使用频率和复杂度进行合理推测`;
        userPrompt = `原文上下文：${text}

需要分配JLPT等级的词汇（目前标记为unknown）：
${unknownTokens.map(t => `- ${t}`).join('\n') || '无'}

需要分配JLPT等级的语法项（目前未分级）：
${unrecognizedGrammar?.map(g => `- ${g}`).join('\n') || '无'}

请为每个项目分配合适的JLPT等级（N1-N5），并提供简短定义。`;
        break;

      default:
        // Fallback to original "all-in-one" behavior if task is missing (backward compatibility)
        systemPrompt = `你是日语文本的“最小修复器”。任务：修复分词错误、定义生词、分析语法。
只输出 JSON，必须符合 schema。
Schema: {
  "normalized_text": "string",
  "repairs": [...],
  "grammar_chunks": [...],
  "vocab_entries": [...],
  "confidence": number
}`;
        userPrompt = `原文：${text}
Unknown Tokens: ${unknownTokens.join(', ')}
Unrecognized Grammar: ${unrecognizedGrammar?.join(', ')}`;
        break;
    }

    const response = await chatJSON({
      provider: 'deepseek',
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_json: true,
    });

    const result = JSON.parse(response.content) as RepairResponse;
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('LLM Repair Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
