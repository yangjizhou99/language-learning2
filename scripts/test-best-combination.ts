/**
 * Comprehensive test of the best combination
 * Run: npx tsx scripts/test-best-combination.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    const {
        analyzeLexProfileAsync,
        JA_VOCAB_DICT_INFO,
        JA_GRAMMAR_DICT_INFO
    } = await import('../src/lib/recommendation/lexProfileAnalyzer');

    console.log('='.repeat(80));
    console.log('🏆 最佳组合综合测试报告');
    console.log('='.repeat(80));
    console.log('测试时间:', new Date().toISOString());
    console.log('');

    // Fetch test data
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, title')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .neq('text', '')
        .limit(300);

    if (error || !items?.length) {
        console.error('Error:', error);
        return;
    }

    console.log(`测试样本: ${items.length} 个日语跟读题目\n`);

    // Configuration
    const config = {
        tokenizer: 'kuromoji' as const,
        vocabDict: 'default' as const,
        grammarDict: 'hagoromo' as const
    };

    console.log('最佳组合配置:');
    console.log(`  分词器: ${config.tokenizer}`);
    console.log(`  词汇库: ${config.vocabDict} (${JA_VOCAB_DICT_INFO[config.vocabDict].size} 词)`);
    console.log(`  语法库: ${config.grammarDict} (${JA_GRAMMAR_DICT_INFO[config.grammarDict].size} 模式)`);
    console.log('');

    // Run analysis
    let totalVocabCoverage = 0;
    let totalGrammarMatches = 0;
    let totalUnknownRate = 0;
    const vocabLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    const grammarLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    let successCount = 0;

    // New: Track grammar label coverage
    let totalGrammarTokens = 0;
    let grammarWithLevel = 0;
    let grammarWithoutLevel = 0;
    let totalContentTokens = 0;
    let contentWithLevel = 0;

    console.log('正在分析...');
    const startTime = Date.now();

    for (let i = 0; i < items.length; i++) {
        process.stdout.write(`\r  进度: ${i + 1}/${items.length}`);

        try {
            const result = await analyzeLexProfileAsync(
                items[i].text,
                'ja',
                config.tokenizer,
                config.vocabDict,
                config.grammarDict
            );

            if (result) {
                totalVocabCoverage += result.details?.coverage || 0;
                totalUnknownRate += result.details?.unknownTokens?.length / (result.uniqueTokens || 1);

                // Count vocab levels and track coverage from tokenList
                result.details?.tokenList?.forEach(t => {
                    if (t.isContentWord) {
                        totalContentTokens++;
                        if (t.originalLevel?.startsWith('N')) {
                            const level = t.originalLevel as keyof typeof vocabLevelCounts;
                            if (vocabLevelCounts[level] !== undefined) {
                                vocabLevelCounts[level]++;
                            }
                            contentWithLevel++;
                        }
                    } else {
                        // Grammar/function word
                        totalGrammarTokens++;
                        if (t.originalLevel?.startsWith('grammar (N')) {
                            grammarWithLevel++;
                            // Extract level from "grammar (N3)" format
                            const match = t.originalLevel.match(/grammar \((N\d)\)/);
                            if (match) {
                                const level = match[1] as keyof typeof grammarLevelCounts;
                                if (grammarLevelCounts[level] !== undefined) {
                                    grammarLevelCounts[level]++;
                                }
                            }
                        } else if (t.originalLevel === 'grammar') {
                            grammarWithoutLevel++;
                        }
                    }
                });

                // Count grammar pattern matches (from grammarProfile)
                if (result.grammarProfile) {
                    totalGrammarMatches += result.grammarProfile.total;
                }

                successCount++;
            }
        } catch (e) {
            // Skip errors
        }
    }

    const processingTime = Date.now() - startTime;
    console.log(`\n\n分析完成! 耗时: ${(processingTime / 1000).toFixed(1)}s\n`);

    // Calculate averages
    const avgVocabCoverage = successCount > 0 ? totalVocabCoverage / successCount : 0;
    const avgUnknownRate = successCount > 0 ? totalUnknownRate / successCount : 0;
    const avgGrammarMatches = successCount > 0 ? totalGrammarMatches / successCount : 0;

    // Calculate label coverage rates
    const contentLabelCoverage = totalContentTokens > 0 ? contentWithLevel / totalContentTokens : 0;
    const grammarLabelCoverage = totalGrammarTokens > 0 ? grammarWithLevel / totalGrammarTokens : 0;
    const overallLabelCoverage = (totalContentTokens + totalGrammarTokens) > 0
        ? (contentWithLevel + grammarWithLevel) / (totalContentTokens + totalGrammarTokens) : 0;

    // Print report
    console.log('='.repeat(80));
    console.log('📊 综合测试报告');
    console.log('='.repeat(80));
    console.log('');
    console.log('📚 词汇分析');
    console.log('-'.repeat(40));
    console.log(`  平均覆盖率: ${(avgVocabCoverage * 100).toFixed(2)}%`);
    console.log(`  平均未知率: ${(avgUnknownRate * 100).toFixed(2)}%`);
    console.log(`  词汇等级分布:`);
    const totalVocab = Object.values(vocabLevelCounts).reduce((a, b) => a + b, 0);
    for (const [level, count] of Object.entries(vocabLevelCounts)) {
        const pct = totalVocab > 0 ? (count / totalVocab * 100).toFixed(1) : '0';
        console.log(`    ${level}: ${count} (${pct}%)`);
    }
    console.log('');
    console.log('📖 语法分析');
    console.log('-'.repeat(40));
    console.log(`  平均匹配模式: ${avgGrammarMatches.toFixed(2)} 个/文本`);
    console.log(`  语法等级分布:`);
    const totalGrammar = Object.values(grammarLevelCounts).reduce((a, b) => a + b, 0);
    for (const [level, count] of Object.entries(grammarLevelCounts)) {
        const pct = totalGrammar > 0 ? (count / totalGrammar * 100).toFixed(1) : '0';
        console.log(`    ${level}: ${count} (${pct}%)`);
    }
    console.log('');
    console.log('🏷️ 等级标签覆盖率 (新增)');
    console.log('-'.repeat(40));
    console.log(`  内容词标签覆盖率: ${(contentLabelCoverage * 100).toFixed(2)}% (${contentWithLevel}/${totalContentTokens})`);
    console.log(`  语法词标签覆盖率: ${(grammarLabelCoverage * 100).toFixed(2)}% (${grammarWithLevel}/${totalGrammarTokens})`);
    console.log(`    - 有等级: ${grammarWithLevel}`);
    console.log(`    - 无等级: ${grammarWithoutLevel}`);
    console.log(`  总体等级标签覆盖率: ${(overallLabelCoverage * 100).toFixed(2)}%`);
    console.log('');
    console.log('='.repeat(80));
    console.log('🏆 最佳组合总结');
    console.log('='.repeat(80));
    console.log('');
    console.log('| 组件 | 选择 | 规模 |');
    console.log('|------|------|------|');
    console.log(`| 分词器 | kuromoji | - |`);
    console.log(`| 词汇库 | default | ${JA_VOCAB_DICT_INFO.default.size} 词 |`);
    console.log(`| 语法库 | Hagoromo 4.1 | ${JA_GRAMMAR_DICT_INFO.hagoromo.size} 模式 |`);
    console.log('');
    console.log('| 指标 | 数值 |');
    console.log('|------|------|');
    console.log(`| 词汇覆盖率 | ${(avgVocabCoverage * 100).toFixed(2)}% |`);
    console.log(`| 词汇未知率 | ${(avgUnknownRate * 100).toFixed(2)}% |`);
    console.log(`| 语法匹配数 | ${avgGrammarMatches.toFixed(2)} 个/文本 |`);
    console.log(`| 内容词标签覆盖 | ${(contentLabelCoverage * 100).toFixed(2)}% |`);
    console.log(`| 语法词标签覆盖 | ${(grammarLabelCoverage * 100).toFixed(2)}% |`);
    console.log(`| 总体标签覆盖 | ${(overallLabelCoverage * 100).toFixed(2)}% |`);
    console.log('='.repeat(80));

    // Save results for page display
    const reportData = {
        timestamp: new Date().toISOString(),
        testCount: items.length,
        config: {
            tokenizer: 'kuromoji',
            vocabDict: 'default',
            vocabDictSize: JA_VOCAB_DICT_INFO.default.size,
            grammarDict: 'hagoromo',
            grammarDictSize: JA_GRAMMAR_DICT_INFO.hagoromo.size
        },
        results: {
            vocabCoverage: (avgVocabCoverage * 100).toFixed(2),
            unknownRate: (avgUnknownRate * 100).toFixed(2),
            grammarMatchesPerText: avgGrammarMatches.toFixed(2),
            vocabLevelDistribution: vocabLevelCounts,
            grammarLevelDistribution: grammarLevelCounts
        },
        processingTimeMs: processingTime
    };

    const fs = await import('fs');
    const outputPath = path.join(__dirname, 'best-combination-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
    console.log(`\n✅ 报告已保存至: ${outputPath}`);
}

runTest().catch(console.error);
