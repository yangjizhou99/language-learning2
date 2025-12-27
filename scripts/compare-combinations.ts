
/**
 * Comparative test of different dictionary combinations
 * Run: npx tsx scripts/compare-combinations.ts
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
    console.log('📊 词汇/语法库组合对比测试报告');
    console.log('='.repeat(80));
    console.log('测试时间:', new Date().toISOString());
    console.log('');

    // Fetch test data (limit 50)
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

    // Define configurations to test
    const configs = [
        { name: 'Baseline', vocab: 'default', grammar: 'yapan' },
        { name: 'Prev Best', vocab: 'default', grammar: 'hagoromo' },
        { name: 'Elzup/Hago', vocab: 'elzup', grammar: 'hagoromo' },
        { name: 'Tanos/Hago', vocab: 'tanos', grammar: 'hagoromo' },
        { name: 'Combined', vocab: 'combined', grammar: 'combined' }
    ] as const;

    const results: any[] = [];

    console.log('正在进行对比分析...\n');

    for (const config of configs) {
        process.stdout.write(`  Running ${config.name} (${config.vocab}/${config.grammar})... `);

        let totalVocabCoverage = 0;
        let totalGrammarMatches = 0;
        let totalUnknownRate = 0;
        let successCount = 0;
        const vocabLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
        const grammarLevelCounts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };

        for (const item of items) {
            try {
                const result = await analyzeLexProfileAsync(
                    item.text,
                    'ja',
                    'kuromoji',
                    config.vocab as any,
                    config.grammar as any
                );

                if (result) {
                    totalVocabCoverage += result.details?.coverage || 0;
                    totalUnknownRate += result.details?.unknownTokens?.length / (result.uniqueTokens || 1);

                    if (result.grammarProfile) {
                        totalGrammarMatches += result.grammarProfile.total;
                        // Count grammar levels
                        for (const [level, count] of Object.entries(result.grammarProfile.byLevel)) {
                            if (grammarLevelCounts[level as keyof typeof grammarLevelCounts] !== undefined) {
                                grammarLevelCounts[level as keyof typeof grammarLevelCounts] += count;
                            }
                        }
                    }

                    // Count vocab levels
                    result.details?.tokenList?.forEach(t => {
                        if (t.isContentWord && t.originalLevel?.startsWith('N')) {
                            const level = t.originalLevel as keyof typeof vocabLevelCounts;
                            if (vocabLevelCounts[level] !== undefined) {
                                vocabLevelCounts[level]++;
                            }
                        }
                    });

                    successCount++;
                }
            } catch (e) {
                // skip
            }
        }

        const avgVocabCoverage = successCount > 0 ? totalVocabCoverage / successCount : 0;
        const avgUnknownRate = successCount > 0 ? totalUnknownRate / successCount : 0;
        const avgGrammarMatches = successCount > 0 ? totalGrammarMatches / successCount : 0;

        const totalVocab = Object.values(vocabLevelCounts).reduce((a, b) => a + b, 0);
        const totalGrammar = Object.values(grammarLevelCounts).reduce((a, b) => a + b, 0);

        results.push({
            name: config.name,
            vocabDict: config.vocab,
            grammarDict: config.grammar,
            vocabCoverage: (avgVocabCoverage * 100).toFixed(2) + '%',
            unknownRate: (avgUnknownRate * 100).toFixed(2) + '%',
            grammarMatches: avgGrammarMatches.toFixed(2),
            vocabCount: totalVocab,
            grammarCount: totalGrammar
        });

        console.log('Done');
    }

    console.log('\n\n🏆 对比测试结果');
    console.log('='.repeat(100));
    console.log('| 配置名称 | 词汇库 | 语法库 | 词汇覆盖率 | 未知率 | 语法匹配/文 | 识别词汇总量 | 识别语法总量 |');
    console.log('|---|---|---|---|---|---|---|---|');

    for (const r of results) {
        console.log(`| ${r.name} | ${r.vocabDict} | ${r.grammarDict} | ${r.vocabCoverage} | ${r.unknownRate} | ${r.grammarMatches} | ${r.vocabCount} | ${r.grammarCount} |`);
    }
    console.log('='.repeat(100));

    console.log('\n分析结论:');
    const combined = results.find(r => r.name === 'Combined');
    const prevBest = results.find(r => r.name === 'Prev Best');

    if (combined && prevBest) {
        const vocabDiff = parseFloat(combined.vocabCoverage) - parseFloat(prevBest.vocabCoverage);
        const grammarDiff = parseFloat(combined.grammarMatches) - parseFloat(prevBest.grammarMatches);

        console.log(`1. 词汇覆盖率: Combined 比 Previous Best ${vocabDiff >= 0 ? '提高' : '降低'}了 ${Math.abs(vocabDiff).toFixed(2)}%`);
        console.log(`2. 语法匹配: Combined 比 Previous Best 每篇多识别 ${grammarDiff.toFixed(2)} 个模式`);
        console.log(`3. 未知率: Combined 为 ${combined.unknownRate}, Previous Best 为 ${prevBest.unknownRate}`);
    }
}

runTest().catch(console.error);
