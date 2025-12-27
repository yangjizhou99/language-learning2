/**
 * Direct test of lexical profile analyzer with all combinations
 * Run with: npx tsx scripts/test-lex-direct.ts
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
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'set' : 'missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Import the analyzer - dynamic import for ESM compatibility
async function runTest() {
    // @ts-ignore - dynamic require for the lexProfileAnalyzer
    const {
        analyzeLexProfileAsync,
        JA_VOCAB_DICT_INFO
    } = await import('../src/lib/recommendation/lexProfileAnalyzer');

    type JaTokenizer = 'kuromoji' | 'tinysegmenter' | 'budoux';
    type JaVocabDict = 'default' | 'elzup' | 'tanos';

    const VOCAB_DICTS: JaVocabDict[] = ['default', 'elzup', 'tanos'];
    const TOKENIZERS: JaTokenizer[] = ['kuromoji', 'tinysegmenter', 'budoux'];

    interface TestResult {
        vocabDict: JaVocabDict;
        tokenizer: JaTokenizer;
        dictSize: number;
        avgCoverage: number;
        avgUnknownRate: number;
        avgLeveledTokens: number;
        avgUniqueTokens: number;
        totalTexts: number;
        processingTime: number;
    }

    // Fetch Japanese items
    console.log('Fetching Japanese items from database...');
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lang')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .neq('text', '')
        .limit(30); // 30 items for reasonable speed

    if (error || !items?.length) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log(`Found ${items.length} Japanese items`);
    console.log(`\nTesting ${VOCAB_DICTS.length} dictionaries × ${TOKENIZERS.length} tokenizers = ${VOCAB_DICTS.length * TOKENIZERS.length} combinations\n`);

    // Show dictionary sizes
    console.log('Dictionary sizes:');
    for (const dict of VOCAB_DICTS) {
        const info = JA_VOCAB_DICT_INFO[dict];
        console.log(`  ${dict}: ${info.size} words (${info.source})`);
    }
    console.log('');

    const results: TestResult[] = [];

    // Test all combinations
    for (const tokenizer of TOKENIZERS) {
        for (const vocabDict of VOCAB_DICTS) {
            console.log(`Testing: ${tokenizer} + ${vocabDict}...`);
            const startTime = Date.now();

            let totalCoverage = 0;
            let totalUnknownRate = 0;
            let totalLeveledTokens = 0;
            let totalUniqueTokens = 0;
            let successCount = 0;

            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                process.stdout.write(`\r  Progress: ${i + 1}/${items.length}`);

                try {
                    const result = await analyzeLexProfileAsync(
                        item.text,
                        'ja',
                        tokenizer,
                        vocabDict
                    );

                    if (result) {
                        // Correct field names from LexProfileResult interface:
                        // - result.details.coverage (not coverageRate)
                        // - result.tokens (not totalTokens)
                        // - result.uniqueTokens
                        // - result.details.unknownTokens.length
                        // - result.lexProfile.unknown
                        const coverage = result.details?.coverage || 0;
                        const uniqueTokens = result.uniqueTokens || 0;
                        const unknownCount = result.details?.unknownTokens?.length || 0;
                        const unknownRate = uniqueTokens > 0 ? unknownCount / uniqueTokens : 0;
                        const leveledCount = uniqueTokens - unknownCount;

                        totalCoverage += coverage;
                        totalUnknownRate += unknownRate;
                        totalLeveledTokens += leveledCount;
                        totalUniqueTokens += uniqueTokens;
                        successCount++;
                    }
                } catch (e) {
                    // Skip errors
                }
            }

            const processingTime = Date.now() - startTime;
            console.log(`  Done in ${(processingTime / 1000).toFixed(1)}s`);

            results.push({
                vocabDict,
                tokenizer,
                dictSize: JA_VOCAB_DICT_INFO[vocabDict].size,
                avgCoverage: successCount > 0 ? totalCoverage / successCount : 0,
                avgUnknownRate: successCount > 0 ? totalUnknownRate / successCount : 0,
                avgLeveledTokens: successCount > 0 ? totalLeveledTokens / successCount : 0,
                avgUniqueTokens: successCount > 0 ? totalUniqueTokens / successCount : 0,
                totalTexts: successCount,
                processingTime,
            });
        }
    }

    // Sort by coverage rate (descending)
    results.sort((a, b) => b.avgCoverage - a.avgCoverage);

    // Print results table
    console.log('\n' + '='.repeat(90));
    console.log('RESULTS (sorted by coverage rate - higher is better)');
    console.log('='.repeat(90));
    console.log(
        'Rank'.padEnd(5) +
        'Tokenizer'.padEnd(15) +
        'Dictionary'.padEnd(10) +
        'Dict Size'.padEnd(10) +
        'Coverage'.padEnd(10) +
        'Unknown%'.padEnd(10) +
        'Leveled'.padEnd(10) +
        'Unique'.padEnd(10) +
        'Time'
    );
    console.log('-'.repeat(90));

    results.forEach((r, i) => {
        console.log(
            `${i + 1}`.padEnd(5) +
            r.tokenizer.padEnd(15) +
            r.vocabDict.padEnd(10) +
            `${r.dictSize}`.padEnd(10) +
            `${(r.avgCoverage * 100).toFixed(1)}%`.padEnd(10) +
            `${(r.avgUnknownRate * 100).toFixed(1)}%`.padEnd(10) +
            `${r.avgLeveledTokens.toFixed(1)}`.padEnd(10) +
            `${r.avgUniqueTokens.toFixed(1)}`.padEnd(10) +
            `${(r.processingTime / 1000).toFixed(1)}s`
        );
    });

    // Best combination
    const best = results[0];
    console.log('\n' + '='.repeat(90));
    console.log('🏆 BEST COMBINATION (highest vocabulary coverage)');
    console.log('='.repeat(90));
    console.log(`Tokenizer:        ${best.tokenizer}`);
    console.log(`Dictionary:       ${best.vocabDict} (${best.dictSize} words)`);
    console.log(`Average Coverage: ${(best.avgCoverage * 100).toFixed(2)}%`);
    console.log(`Unknown Rate:     ${(best.avgUnknownRate * 100).toFixed(2)}%`);
    console.log('='.repeat(90));

    // Analysis by tokenizer
    console.log('\n📊 ANALYSIS BY TOKENIZER (average across all dictionaries):');
    for (const tokenizer of TOKENIZERS) {
        const tokenizerResults = results.filter(r => r.tokenizer === tokenizer);
        const avgCov = tokenizerResults.reduce((a, b) => a + b.avgCoverage, 0) / tokenizerResults.length;
        const avgUnk = tokenizerResults.reduce((a, b) => a + b.avgUnknownRate, 0) / tokenizerResults.length;
        const avgTime = tokenizerResults.reduce((a, b) => a + b.processingTime, 0) / tokenizerResults.length;
        console.log(`  ${tokenizer.padEnd(15)}: Coverage ${(avgCov * 100).toFixed(1)}%, Unknown ${(avgUnk * 100).toFixed(1)}%, Time ${(avgTime / 1000).toFixed(1)}s`);
    }

    // Analysis by dictionary
    console.log('\n📚 ANALYSIS BY DICTIONARY (average across all tokenizers):');
    for (const dict of VOCAB_DICTS) {
        const dictResults = results.filter(r => r.vocabDict === dict);
        const avgCov = dictResults.reduce((a, b) => a + b.avgCoverage, 0) / dictResults.length;
        const avgUnk = dictResults.reduce((a, b) => a + b.avgUnknownRate, 0) / dictResults.length;
        console.log(`  ${dict.padEnd(10)} (${JA_VOCAB_DICT_INFO[dict].size} words): Coverage ${(avgCov * 100).toFixed(1)}%, Unknown ${(avgUnk * 100).toFixed(1)}%`);
    }

    // Save results
    const fs = await import('fs');
    const outputPath = path.join(__dirname, 'lex-combination-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        testCount: items.length,
        results
    }, null, 2));
    console.log(`\n✅ Results saved to ${outputPath}`);
}

runTest().catch(console.error);
