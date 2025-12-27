/**
 * 直接测试 LLM 语法模式类型识别
 * 测试 5 种模式类型：literal, split, optional, pos_prefix, pos_suffix
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chatJSON } from '../src/lib/ai/client';

const systemPrompt = `你是日语JLPT分级专家。任务：为未识别等级的词汇和语法项分配JLPT等级。
只输出 JSON，必须符合 schema。

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

Schema: {
  "grammar_chunks": [
    {
      "surface": "string (语法模式的surface形式)",
      "canonical": "string (标准形式)",
      "jlpt": "N1"|"N2"|"N3"|"N4"|"N5",
      "definition": "string",
      "patternType": "literal"|"split"|"optional"|"pos_prefix"|"pos_suffix" (必填),
      "prefix": "string (仅split类型需要)",
      "suffix": "string (仅split类型需要)",
      "posRequirement": "V"|"N"|"A"|"イA"|"ナA" (仅pos_prefix/pos_suffix类型需要)
    }
  ],
  "confidence": number
}

注意：
- patternType 字段必填，默认为 "literal"
- 对于 split 类型，必须提供 prefix 和 suffix
- 对于 pos_prefix/pos_suffix 类型，必须提供 posRequirement`;

// 测试用例 - 覆盖所有5种类型
const testCases = [
    {
        name: "Split 模式 (ば～ほど)",
        grammar: "ば食べるほど",
        context: "食べれば食べるほど太る",
        expected: { patternType: "split", prefix: "ば", suffix: "ほど" }
    },
    {
        name: "Split 模式 (ほかに～ない)",
        grammar: "ほかにない",
        context: "勉強するほかにない",
        expected: { patternType: "split", prefix: "ほかに", suffix: "ない" }
    },
    {
        name: "Optional 模式 (のもと（で）)",
        grammar: "のもとで",
        context: "先生のもとで学ぶ",
        expected: { patternType: "optional" }
    },
    {
        name: "POS Prefix 模式 (Vてやまない)",
        grammar: "てやまない",
        context: "願ってやまない夢",
        expected: { patternType: "pos_prefix", posRequirement: "V" }
    },
    {
        name: "POS Prefix 模式 (Nずくめ)",
        grammar: "ずくめ",
        context: "黒ずくめの服",
        expected: { patternType: "pos_prefix", posRequirement: "N" }
    },
    {
        name: "Literal 模式 (においては)",
        grammar: "においては",
        context: "この場合においては問題ない",
        expected: { patternType: "literal" }
    }
];

async function runTests() {
    console.log("=== LLM 语法模式类型识别测试 ===\n");

    const results: any[] = [];

    for (const testCase of testCases) {
        console.log(`\n--- 测试: ${testCase.name} ---`);
        console.log(`语法: ${testCase.grammar}`);
        console.log(`上下文: ${testCase.context}`);

        const userPrompt = `需要分配JLPT等级的语法项（附上下文）：
- 「${testCase.grammar}」 上下文: "${testCase.context}"

请识别这个语法模式的类型并返回正确的 patternType 字段。`;

        try {
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

            const result = JSON.parse(response.content);
            console.log("\nLLM 返回:");
            console.log(JSON.stringify(result.grammar_chunks, null, 2));

            const chunk = result.grammar_chunks?.[0];
            const passed = chunk?.patternType === testCase.expected.patternType;

            console.log(`\n预期 patternType: ${testCase.expected.patternType}`);
            console.log(`实际 patternType: ${chunk?.patternType || 'undefined'}`);
            console.log(`结果: ${passed ? '✅ PASS' : '❌ FAIL'}`);

            results.push({
                name: testCase.name,
                expected: testCase.expected,
                actual: chunk,
                passed
            });

        } catch (error) {
            console.error("Error:", error);
            results.push({
                name: testCase.name,
                expected: testCase.expected,
                actual: null,
                passed: false,
                error: String(error)
            });
        }

        // Rate limit protection
        await new Promise(r => setTimeout(r, 1000));
    }

    // Summary
    console.log("\n\n=== 测试总结 ===");
    const passCount = results.filter(r => r.passed).length;
    console.log(`通过: ${passCount}/${results.length}`);

    console.log("\n详细结果:");
    results.forEach(r => {
        console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.actual?.patternType || 'N/A'}`);
        if (r.actual?.prefix) console.log(`   prefix: ${r.actual.prefix}, suffix: ${r.actual.suffix}`);
        if (r.actual?.posRequirement) console.log(`   posRequirement: ${r.actual.posRequirement}`);
    });
}

runTests().catch(console.error);
