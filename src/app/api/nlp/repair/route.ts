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
        // Now uses contextual snippets instead of full text for better efficiency
        const { unknownTokensWithContext, unrecognizedGrammarWithContext } = body as any;

        systemPrompt = `你是日语JLPT分级专家。任务：为未识别等级的词汇和语法项分配JLPT等级。
只输出 JSON，必须符合 schema。

【重要】语法碎片检测：
如果你发现多个语法碎片可以组合成一个完整的复合语法模式，请识别并返回完整模式，而不是单独的碎片。
例如：
- 看到 "かかわら"、"ず" → 应该识别为 "にもかかわらず" (N3)
- 看到 "ざる"、"を"、"得ない" → 应该识别为 "ざるをえない" (N1)

【重要】模式类型识别：
请识别语法模式的类型，返回正确的 patternType 字段：

1. **split** - 分段模式，中间有可变内容：
   - "ば～ほど" → patternType: "split", prefix: "ば", suffix: "ほど"
   - "ほかに～ない" → patternType: "split", prefix: "ほかに", suffix: "ない"
   - "だの～だの" → patternType: "split", prefix: "だの", suffix: "だの"

2. **optional** - 可选部分模式（可省略部分用括号标记）：
   - "のもと（で）" → patternType: "optional", surface: "のもとで"
   - "とか（で）" → patternType: "optional"

3. **pos_prefix** - 需要特定词性前置：
   - "Vてやまない" → patternType: "pos_prefix", posRequirement: "V"
   - "Nずくめ" → patternType: "pos_prefix", posRequirement: "N"

4. **pos_suffix** - 需要特定词性后置：
   - "あまりV" → patternType: "pos_suffix", posRequirement: "V"

5. **literal** - 简单字面匹配（默认，无特殊符号）：
   - "においては" → patternType: "literal"

【重要】多形式返回：
如果一个语法模式有多种常见书写形式（如汉字和假名），请为每种形式返回一个独立的条目。

Schema: {
  "vocab_entries": [
    {"surface": "string", "reading": "string", "definition": "string", "jlpt": "N1"|"N2"|"N3"|"N4"|"N5"}
  ],
  "grammar_chunks": [
    {
      "surface": "string (语法模式的surface形式)",
      "canonical": "string (标准形式)",
      "jlpt": "N1"|"N2"|"N3"|"N4"|"N5",
      "definition": "string",
      "patternType": "literal"|"split"|"optional"|"pos_prefix"|"pos_suffix" (必填),
      "prefix": "string (仅split类型需要)",
      "suffix": "string (仅split类型需要)",
      "posRequirement": "V"|"N"|"A"|"イA"|"ナA" (仅pos_prefix/pos_suffix类型需要),
      "fragments": ["string"] (可选，如果是从多个碎片识别出的复合模式)
    }
  ],
  "confidence": number
}

注意：
- jlpt 字段必须是 N1, N2, N3, N4, N5 之一
- patternType 字段必填，默认为 "literal"
- 对于 split 类型，必须提供 prefix 和 suffix
- 对于 pos_prefix/pos_suffix 类型，必须提供 posRequirement
- 优先识别复合语法模式，而不是单独的碎片`;

        // Build focused prompt with context snippets
        const vocabLines = unknownTokensWithContext?.length > 0
          ? unknownTokensWithContext.map((item: { token: string; context: string }) =>
            `- 「${item.token}」 上下文: "${item.context}"`
          ).join('\n')
          : '无';

        const grammarLines = unrecognizedGrammarWithContext?.length > 0
          ? unrecognizedGrammarWithContext.map((item: { token: string; context: string }) =>
            `- 「${item.token}」 上下文: "${item.context}"`
          ).join('\n')
          : '无';

        userPrompt = `需要分配JLPT等级的词汇（附上下文）：
${vocabLines}

需要分配JLPT等级的语法项（附上下文）：
${grammarLines}

请根据上下文为每个项目分配合适的JLPT等级（N1-N5）。
【特别注意】如果发现语法碎片可以组成复合语法模式，请识别并返回完整模式。`;
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
