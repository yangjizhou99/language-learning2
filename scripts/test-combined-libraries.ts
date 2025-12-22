
/**
 * Comprehensive test of the combined libraries
 * Run: npx tsx scripts/test-combined-libraries.ts
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
    console.log('🏆 最佳组合综合测试报告 (Combined Libraries)');
    console.log('='.repeat(80));
    console.log('测试时间:', new Date().toISOString());
    console.log('');

    // Fetch test data (limit 50 as requested in the prompt example, or stick to 300 for better stats? 
    // The prompt says "(50个日语题目)", so I will use 50 to match the user's expectation, 
    // but maybe 300 is better for accuracy. I'll stick to 50 for speed and matching the prompt style, 
    // or maybe 100. Let's use 50 to be safe and fast.)
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, title')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .neq('text', '')
        .limit(50);

    if (error || !items?.length) {
        console.error('Error:', error);
        return;
    }

    console.log(`测试样本: ${items.length} 个日语跟读题目\n`);

    // Configuration
    const config = {
        tokenizer: 'kuromoji' as const,
        vocabDict: 'combined' as const,
        grammarDict: 'combined' as const
    };

    console.log('测试配置:');
    console.log(`  分词器: ${config.tokenizer}`);
    // @ts-ignore - dynamic access
    console.log(`  词汇库: ${config.vocabDict} (${JA_VOCAB_DICT_INFO[config.vocabDict].size} 词)`);
    // @ts-ignore - dynamic access
    console.log(`  语法库: ${config.grammarDict} (${JA_GRAMMAR_DICT_INFO[config.grammarDict].size} 模式)`);
    console.log('');

    // Run analysis
    let totalVocabCoverage = 0;
    let totalGrammarMatches = 0;
    let totalUnknownRate = 0;
    const vocabLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    const grammarLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
    let successCount = 0;

    console.log('正在分析...');
    const startTime = Date.now();

    for (let i = 0; i < items.length; i++) {
        process.stdout.write(`\r  进度: ${i + 1}/${items.length}`);

        try {
            const result = await analyzeLexProfileAsync(
                items[i].text,
                'ja',
                config.tokenizer,
                // @ts-ignore
                config.vocabDict,
                // @ts-ignore
                config.grammarDict
            );

            if (result) {
                totalVocabCoverage += result.details?.coverage || 0;
                totalUnknownRate += result.details?.unknownTokens?.length / (result.uniqueTokens || 1);

                // Count vocab levels
                result.details?.tokenList?.forEach(t => {
                    if (t.isContentWord && t.originalLevel?.startsWith('N')) {
                        const level = t.originalLevel as keyof typeof vocabLevelCounts;
                        if (vocabLevelCounts[level] !== undefined) {
                            vocabLevelCounts[level]++;
                        }
                    }
                });

                // Count grammar levels
                if (result.grammarProfile) {
                    totalGrammarMatches += result.grammarProfile.total;
                    for (const [level, count] of Object.entries(result.grammarProfile.byLevel)) {
                        if (grammarLevelCounts[level as keyof typeof grammarLevelCounts] !== undefined) {
                            grammarLevelCounts[level as keyof typeof grammarLevelCounts] += count;
                        }
                    }
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

    // Print report
    console.log('='.repeat(80));
    console.log('🏆 最佳组合综合测试报告 (Combined Libraries)');
    console.log(`(${items.length}个日语题目)`);
    console.log('='.repeat(80));
    console.log('');

    console.log(`${(avgVocabCoverage * 100).toFixed(2)}%`);
    console.log('词汇覆盖率');
    console.log('');

    console.log(`${avgGrammarMatches.toFixed(2)}`);
    console.log('语法匹配/文本');
    console.log('');

    console.log(`${(avgUnknownRate * 100).toFixed(2)}%`);
    console.log('词汇未知率');
    console.log('');

    console.log('📚 词汇等级分布');
    const totalVocab = Object.values(vocabLevelCounts).reduce((a, b) => a + b, 0);
    for (const [level, count] of Object.entries(vocabLevelCounts)) {
        const pct = totalVocab > 0 ? (count / totalVocab * 100).toFixed(1) : '0';
        console.log(`${level}`);
        console.log(`${count} (${pct}%)`);
    }
    console.log('');

    console.log('📖 语法等级分布');
    const totalGrammar = Object.values(grammarLevelCounts).reduce((a, b) => a + b, 0);
    for (const [level, count] of Object.entries(grammarLevelCounts)) {
        const pct = totalGrammar > 0 ? (count / totalGrammar * 100).toFixed(1) : '0';
        console.log(`${level}`);
        console.log(`${count} (${pct}%)`);
    }
    console.log('');

    console.log('✅ 最终推荐配置');
    console.log(`分词器: ${config.tokenizer}`);
    // @ts-ignore
    console.log(`词汇库: ${config.vocabDict} (${JA_VOCAB_DICT_INFO[config.vocabDict].size}词)`);
    // @ts-ignore
    console.log(`语法库: ${config.grammarDict} (${JA_GRAMMAR_DICT_INFO[config.grammarDict].size}模式)`);
}

runTest().catch(console.error);
