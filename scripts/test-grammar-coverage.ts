/**
 * Test grammar dictionary coverage: YAPAN vs Hagoromo
 * Using best vocab combination: kuromoji + default
 * Run: npx tsx scripts/test-grammar-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
    const {
        analyzeLexProfileAsync,
        JA_GRAMMAR_DICT_INFO,
        JA_VOCAB_DICT_INFO
    } = await import('../src/lib/recommendation/lexProfileAnalyzer');

    type JaGrammarDict = 'yapan' | 'hagoromo';

    const GRAMMAR_DICTS: JaGrammarDict[] = ['yapan', 'hagoromo'];

    interface GrammarTestResult {
        grammarDict: JaGrammarDict;
        dictSize: number;
        avgPatternsMatched: number;
        avgByLevel: Record<string, number>;
        totalTexts: number;
        processingTime: number;
    }

    // Fetch Japanese items
    console.log('='.repeat(70));
    console.log('语法库覆盖率对比测试');
    console.log('='.repeat(70));
    console.log('使用最佳词汇组合: kuromoji + default');
    console.log('');

    console.log('Fetching Japanese items from database...');
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lang')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .neq('text', '')
        .limit(30);

    if (error || !items?.length) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log(`Found ${items.length} Japanese items\n`);

    // Show dictionary sizes
    console.log('语法库信息:');
    for (const dict of GRAMMAR_DICTS) {
        const info = JA_GRAMMAR_DICT_INFO[dict];
        console.log(`  ${dict}: ${info.size} patterns (${info.source})`);
    }
    console.log('');

    const results: GrammarTestResult[] = [];

    // Test both grammar dictionaries
    for (const grammarDict of GRAMMAR_DICTS) {
        console.log(`Testing: kuromoji + default + ${grammarDict}...`);
        const startTime = Date.now();

        let totalPatterns = 0;
        const totalByLevel: Record<string, number> = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
        let successCount = 0;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            process.stdout.write(`\r  Progress: ${i + 1}/${items.length}`);

            try {
                const result = await analyzeLexProfileAsync(
                    item.text,
                    'ja',
                    'kuromoji',  // Best tokenizer
                    'default',   // Best vocab dict
                    grammarDict  // Grammar dict to test
                );

                if (result?.grammarProfile) {
                    const gp = result.grammarProfile;
                    totalPatterns += gp.total;
                    for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
                        totalByLevel[level] += gp.byLevel[level] || 0;
                    }
                    successCount++;
                }
            } catch (e) {
                // Skip errors
            }
        }

        const processingTime = Date.now() - startTime;
        console.log(`  Done in ${(processingTime / 1000).toFixed(1)}s`);

        const avgByLevel: Record<string, number> = {};
        for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
            avgByLevel[level] = successCount > 0 ? totalByLevel[level] / successCount : 0;
        }

        results.push({
            grammarDict,
            dictSize: JA_GRAMMAR_DICT_INFO[grammarDict].size,
            avgPatternsMatched: successCount > 0 ? totalPatterns / successCount : 0,
            avgByLevel,
            totalTexts: successCount,
            processingTime,
        });
    }

    // Print results table
    console.log('\n' + '='.repeat(70));
    console.log('结果对比 (kuromoji + default + 不同语法库)');
    console.log('='.repeat(70));
    console.log(
        '语法库'.padEnd(12) +
        '模式数'.padEnd(10) +
        '平均匹配'.padEnd(12) +
        'N1'.padEnd(8) +
        'N2'.padEnd(8) +
        'N3'.padEnd(8) +
        'N4'.padEnd(8) +
        'N5'.padEnd(8) +
        '时间'
    );
    console.log('-'.repeat(70));

    results.forEach((r) => {
        console.log(
            r.grammarDict.padEnd(12) +
            `${r.dictSize}`.padEnd(10) +
            `${r.avgPatternsMatched.toFixed(1)}`.padEnd(12) +
            `${r.avgByLevel.N1.toFixed(1)}`.padEnd(8) +
            `${r.avgByLevel.N2.toFixed(1)}`.padEnd(8) +
            `${r.avgByLevel.N3.toFixed(1)}`.padEnd(8) +
            `${r.avgByLevel.N4.toFixed(1)}`.padEnd(8) +
            `${r.avgByLevel.N5.toFixed(1)}`.padEnd(8) +
            `${(r.processingTime / 1000).toFixed(1)}s`
        );
    });

    // Calculate improvement
    const yapan = results.find(r => r.grammarDict === 'yapan')!;
    const hagoromo = results.find(r => r.grammarDict === 'hagoromo')!;

    const improvement = hagoromo.avgPatternsMatched - yapan.avgPatternsMatched;
    const improvementPct = yapan.avgPatternsMatched > 0
        ? ((improvement / yapan.avgPatternsMatched) * 100).toFixed(1)
        : '0';

    console.log('\n' + '='.repeat(70));
    console.log('📊 分析结论');
    console.log('='.repeat(70));
    console.log(`YAPAN 平均匹配: ${yapan.avgPatternsMatched.toFixed(2)} 模式/文本`);
    console.log(`Hagoromo 平均匹配: ${hagoromo.avgPatternsMatched.toFixed(2)} 模式/文本`);
    console.log(`提升: +${improvement.toFixed(2)} 模式/文本 (+${improvementPct}%)`);
    console.log('');
    console.log('按等级对比:');
    for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
        const y = yapan.avgByLevel[level];
        const h = hagoromo.avgByLevel[level];
        const diff = h - y;
        const sign = diff >= 0 ? '+' : '';
        console.log(`  ${level}: YAPAN ${y.toFixed(2)} → Hagoromo ${h.toFixed(2)} (${sign}${diff.toFixed(2)})`);
    }
    console.log('='.repeat(70));

    // Best recommendation
    console.log('\n🏆 最终推荐组合:');
    console.log('   分词器: kuromoji');
    console.log('   词汇库: default (8,133词) 或 tanos (8,130词)');
    const bestGrammar = hagoromo.avgPatternsMatched > yapan.avgPatternsMatched ? 'Hagoromo' : 'YAPAN';
    console.log(`   语法库: ${bestGrammar} (${hagoromo.avgPatternsMatched > yapan.avgPatternsMatched ? '1,731' : '667'}模式)`);
    console.log('');

    // Save results
    const fs = await import('fs');
    const outputPath = path.join(__dirname, 'grammar-coverage-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        config: { tokenizer: 'kuromoji', vocabDict: 'default' },
        testCount: items.length,
        results
    }, null, 2));
    console.log(`✅ Results saved to ${outputPath}`);
}

runTest().catch(console.error);
