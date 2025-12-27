/**
 * Test all combinations of Japanese vocabulary dictionaries and tokenizers
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/test-lex-combinations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// API endpoint
const API_BASE = 'http://localhost:3000/api/admin/lex-profile-test';

// Test configurations
const VOCAB_DICTS = ['default', 'elzup', 'tanos'] as const;
const TOKENIZERS = ['kuromoji', 'tinysegmenter', 'budoux'] as const;

interface TestResult {
    vocabDict: string;
    tokenizer: string;
    avgCoverage: number;
    avgUnknownRate: number;
    avgTokens: number;
    totalTexts: number;
    processingTime: number;
}

interface LexProfileResult {
    totalTokens: number;
    uniqueTokens: number;
    leveledTokens: number;
    unknownTokens: number;
    coverageRate: number;
    levelDistribution: Record<string, number>;
}

async function fetchJapaneseItems(): Promise<{ id: string; text: string }[]> {
    console.log('Fetching Japanese items from database...');

    const { data, error } = await supabase
        .from('shadowing_items')
        .select('id, jp_text')
        .not('jp_text', 'is', null)
        .limit(50); // Test with 50 items for reasonable speed

    if (error) {
        console.error('Error fetching items:', error);
        return [];
    }

    console.log(`Found ${data?.length || 0} Japanese items`);
    return (data || []).map(item => ({ id: item.id, text: item.jp_text }));
}

async function analyzeText(
    text: string,
    tokenizer: string,
    vocabDict: string
): Promise<LexProfileResult | null> {
    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                lang: 'ja',
                jaTokenizer: tokenizer,
                jaVocabDict: vocabDict,
            }),
        });

        if (!response.ok) {
            console.error(`API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        return data.result;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
}

async function testCombination(
    items: { id: string; text: string }[],
    tokenizer: string,
    vocabDict: string
): Promise<TestResult> {
    console.log(`\nTesting: ${tokenizer} + ${vocabDict}`);

    const startTime = Date.now();
    let totalCoverage = 0;
    let totalUnknownRate = 0;
    let totalTokens = 0;
    let successCount = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        process.stdout.write(`\r  Progress: ${i + 1}/${items.length}`);

        const result = await analyzeText(item.text, tokenizer, vocabDict);

        if (result) {
            totalCoverage += result.coverageRate;
            totalUnknownRate += result.uniqueTokens > 0
                ? result.unknownTokens / result.uniqueTokens
                : 0;
            totalTokens += result.totalTokens;
            successCount++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const processingTime = Date.now() - startTime;

    console.log(`\n  Completed in ${(processingTime / 1000).toFixed(1)}s`);

    return {
        vocabDict,
        tokenizer,
        avgCoverage: successCount > 0 ? totalCoverage / successCount : 0,
        avgUnknownRate: successCount > 0 ? totalUnknownRate / successCount : 0,
        avgTokens: successCount > 0 ? totalTokens / successCount : 0,
        totalTexts: successCount,
        processingTime,
    };
}

async function main() {
    console.log('='.repeat(60));
    console.log('Lexical Profile Combination Test');
    console.log('='.repeat(60));

    // Fetch test data
    const items = await fetchJapaneseItems();
    if (items.length === 0) {
        console.error('No items to test!');
        return;
    }

    console.log(`\nTesting ${VOCAB_DICTS.length} dictionaries × ${TOKENIZERS.length} tokenizers = ${VOCAB_DICTS.length * TOKENIZERS.length} combinations`);
    console.log(`Using ${items.length} Japanese texts\n`);

    const results: TestResult[] = [];

    // Test all combinations
    for (const tokenizer of TOKENIZERS) {
        for (const vocabDict of VOCAB_DICTS) {
            const result = await testCombination(items, tokenizer, vocabDict);
            results.push(result);
        }
    }

    // Sort by coverage rate (descending)
    results.sort((a, b) => b.avgCoverage - a.avgCoverage);

    // Print results table
    console.log('\n' + '='.repeat(80));
    console.log('RESULTS (sorted by coverage rate)');
    console.log('='.repeat(80));
    console.log(
        'Rank'.padEnd(6) +
        'Tokenizer'.padEnd(15) +
        'Dictionary'.padEnd(12) +
        'Coverage'.padEnd(12) +
        'Unknown%'.padEnd(12) +
        'Avg Tokens'.padEnd(12) +
        'Time(s)'
    );
    console.log('-'.repeat(80));

    results.forEach((r, i) => {
        console.log(
            `${i + 1}`.padEnd(6) +
            r.tokenizer.padEnd(15) +
            r.vocabDict.padEnd(12) +
            `${(r.avgCoverage * 100).toFixed(2)}%`.padEnd(12) +
            `${(r.avgUnknownRate * 100).toFixed(2)}%`.padEnd(12) +
            `${r.avgTokens.toFixed(1)}`.padEnd(12) +
            `${(r.processingTime / 1000).toFixed(1)}`
        );
    });

    // Best combination
    const best = results[0];
    console.log('\n' + '='.repeat(80));
    console.log('🏆 BEST COMBINATION');
    console.log('='.repeat(80));
    console.log(`Tokenizer: ${best.tokenizer}`);
    console.log(`Dictionary: ${best.vocabDict}`);
    console.log(`Average Coverage: ${(best.avgCoverage * 100).toFixed(2)}%`);
    console.log(`Average Unknown Rate: ${(best.avgUnknownRate * 100).toFixed(2)}%`);
    console.log('='.repeat(80));

    // Save results to JSON
    const outputPath = './scripts/lex-combination-results.json';
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        testCount: items.length,
        results
    }, null, 2));
    console.log(`\nResults saved to ${outputPath}`);
}

main().catch(console.error);
