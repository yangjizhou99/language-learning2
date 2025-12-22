/**
 * Analyze all Japanese items in the database to collect:
 * 1. Unknown vocabulary (content words not in JLPT dictionary)
 * 2. Unmatched grammar words (function words without JLPT level)
 * 
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/analyze-unknown-tokens.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { analyzeLexProfileAsync, LexProfileResult, TokenInfo } from '../src/lib/recommendation/lexProfileAnalyzer';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface UnknownTokenStats {
    token: string;
    lemma: string;
    count: number;
    type: 'vocab' | 'grammar';
    pos: string;
    contexts: string[];  // Sample titles containing this token
}

async function fetchJapaneseItems(): Promise<{ id: string; text: string; title: string }[]> {
    console.log('Fetching Japanese items from database...');

    const { data, error } = await supabase
        .from('shadowing_items')
        .select('id, text, title, lang')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching items:', error);
        return [];
    }

    console.log(`Found ${data?.length || 0} Japanese items`);
    return (data || []).map(item => ({ id: item.id, text: item.text, title: item.title }));
}

function categorizeToken(token: TokenInfo): 'suitable_for_llm' | 'suitable_for_code' | 'ignore' {
    const surface = token.token;

    // Ignore single hiragana characters (usually grammar fragments)
    if (/^[\u3040-\u309f]$/.test(surface)) {
        return 'ignore';
    }

    // Ignore numbers
    if (/^[0-9０-９]+$/.test(surface)) {
        return 'ignore';
    }

    // Very short hiragana-only strings are usually grammar
    if (/^[\u3040-\u309f]{1,2}$/.test(surface)) {
        return 'suitable_for_code';
    }

    // Content words with kanji or katakana - good candidates for LLM
    if (token.isContentWord) {
        if (/[\u4e00-\u9faf]/.test(surface) || /[\u30a0-\u30ff]/.test(surface)) {
            return 'suitable_for_llm';
        }
    }

    // Grammar words that are common patterns - can be coded
    const commonGrammarPatterns = ['ちゃう', 'なきゃ', 'ちゃっ', 'じゃない', 'んだ', 'のに', 'けど'];
    if (commonGrammarPatterns.some(p => surface.includes(p))) {
        return 'suitable_for_code';
    }

    // Default: LLM for content words, code for grammar
    return token.isContentWord ? 'suitable_for_llm' : 'suitable_for_code';
}

async function main() {
    console.log('='.repeat(70));
    console.log('Unknown Token Analysis Report');
    console.log('='.repeat(70));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log();

    const items = await fetchJapaneseItems();
    if (items.length === 0) {
        console.error('No items to analyze!');
        return;
    }

    const unknownVocab: Map<string, UnknownTokenStats> = new Map();
    const unmatchedGrammar: Map<string, UnknownTokenStats> = new Map();

    let totalItems = 0;
    let totalUnknownVocab = 0;
    let totalUnmatchedGrammar = 0;

    console.log(`Analyzing ${items.length} items directly using lexProfileAnalyzer...\n`);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        process.stdout.write(`\r  Progress: ${i + 1}/${items.length} (${((i + 1) / items.length * 100).toFixed(1)}%)`);

        try {
            // Directly call the analyzer function
            const result: LexProfileResult = await analyzeLexProfileAsync(
                item.text,
                'ja',
                'kuromoji',
                'default',
                'hagoromo'
            );

            totalItems++;

            // Collect unknown vocabulary (content words with 'unknown' level)
            for (const token of result.details.tokenList) {
                if (token.originalLevel === 'unknown' && token.isContentWord) {
                    totalUnknownVocab++;
                    const key = token.lemma || token.token;
                    const existing = unknownVocab.get(key);
                    if (existing) {
                        existing.count++;
                        if (existing.contexts.length < 3) {
                            existing.contexts.push(item.title);
                        }
                    } else {
                        unknownVocab.set(key, {
                            token: token.token,
                            lemma: token.lemma,
                            count: 1,
                            type: 'vocab',
                            pos: token.pos,
                            contexts: [item.title],
                        });
                    }
                }

                // Collect unmatched grammar (function words with just 'grammar' label, no level)
                if (token.originalLevel === 'grammar' && !token.isContentWord) {
                    totalUnmatchedGrammar++;
                    const key = token.token;
                    const existing = unmatchedGrammar.get(key);
                    if (existing) {
                        existing.count++;
                        if (existing.contexts.length < 3) {
                            existing.contexts.push(item.title);
                        }
                    } else {
                        unmatchedGrammar.set(key, {
                            token: token.token,
                            lemma: token.lemma,
                            count: 1,
                            type: 'grammar',
                            pos: token.pos,
                            contexts: [item.title],
                        });
                    }
                }
            }
        } catch (err) {
            // Skip items that fail analysis
            console.error(`\nError analyzing item ${item.id}:`, err);
        }
    }

    console.log('\n\n');
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total items analyzed: ${totalItems}`);
    console.log(`Unique unknown vocabulary: ${unknownVocab.size}`);
    console.log(`Unique unmatched grammar: ${unmatchedGrammar.size}`);
    console.log(`Total unknown vocab occurrences: ${totalUnknownVocab}`);
    console.log(`Total unmatched grammar occurrences: ${totalUnmatchedGrammar}`);
    console.log();

    // Sort by frequency
    const sortedVocab = [...unknownVocab.entries()].sort((a, b) => b[1].count - a[1].count);
    const sortedGrammar = [...unmatchedGrammar.entries()].sort((a, b) => b[1].count - a[1].count);

    // Categorize tokens
    const vocabForLLM: UnknownTokenStats[] = [];
    const vocabForCode: UnknownTokenStats[] = [];
    const grammarForLLM: UnknownTokenStats[] = [];
    const grammarForCode: UnknownTokenStats[] = [];

    for (const [, stats] of sortedVocab) {
        const category = categorizeToken({
            token: stats.token,
            lemma: stats.lemma,
            pos: stats.pos,
            originalLevel: 'unknown',
            broadCEFR: 'unknown',
            isContentWord: true,
        });
        if (category === 'suitable_for_llm') vocabForLLM.push(stats);
        else if (category === 'suitable_for_code') vocabForCode.push(stats);
    }

    for (const [, stats] of sortedGrammar) {
        const category = categorizeToken({
            token: stats.token,
            lemma: stats.lemma,
            pos: stats.pos,
            originalLevel: 'grammar',
            broadCEFR: 'unknown',
            isContentWord: false,
        });
        if (category === 'suitable_for_llm') grammarForLLM.push(stats);
        else if (category === 'suitable_for_code') grammarForCode.push(stats);
    }

    // Print results
    console.log('='.repeat(70));
    console.log('UNKNOWN VOCABULARY (Top 50)');
    console.log('='.repeat(70));
    console.log('\n--- Suitable for LLM Level Assignment ---');
    console.log('These are real vocabulary words that need JLPT level classification:\n');
    vocabForLLM.slice(0, 30).forEach((v, i) => {
        console.log(`${(i + 1).toString().padStart(3)}. ${v.token.padEnd(15)} (${v.pos.padEnd(8)}) x${v.count} | ${v.contexts.slice(0, 2).join(', ')}`);
    });

    console.log('\n--- Suitable for Code Handling ---');
    console.log('These might need special processing rules:\n');
    vocabForCode.slice(0, 20).forEach((v, i) => {
        console.log(`${(i + 1).toString().padStart(3)}. ${v.token.padEnd(15)} (${v.pos.padEnd(8)}) x${v.count} | ${v.contexts.slice(0, 2).join(', ')}`);
    });

    console.log('\n');
    console.log('='.repeat(70));
    console.log('UNMATCHED GRAMMAR WORDS (Top 50)');
    console.log('='.repeat(70));
    console.log('\n--- Suitable for Code Handling ---');
    console.log('Common grammar patterns that can be mapped programmatically:\n');
    grammarForCode.slice(0, 30).forEach((g, i) => {
        console.log(`${(i + 1).toString().padStart(3)}. ${g.token.padEnd(15)} (${g.pos.padEnd(8)}) x${g.count}`);
    });

    console.log('\n--- May Need LLM or Manual Review ---');
    console.log('Less common or ambiguous grammar:\n');
    grammarForLLM.slice(0, 20).forEach((g, i) => {
        console.log(`${(i + 1).toString().padStart(3)}. ${g.token.padEnd(15)} (${g.pos.padEnd(8)}) x${g.count}`);
    });

    // Save detailed results to JSON
    const fs = require('fs');
    const outputPath = './scripts/unknown-tokens-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        totalItemsAnalyzed: totalItems,
        summary: {
            uniqueUnknownVocab: unknownVocab.size,
            uniqueUnmatchedGrammar: unmatchedGrammar.size,
            totalUnknownVocabOccurrences: totalUnknownVocab,
            totalUnmatchedGrammarOccurrences: totalUnmatchedGrammar,
        },
        recommendations: {
            vocabForLLM: vocabForLLM.map(v => ({ word: v.token, lemma: v.lemma, count: v.count, pos: v.pos })),
            vocabForCode: vocabForCode.map(v => ({ word: v.token, lemma: v.lemma, count: v.count, pos: v.pos })),
            grammarForCode: grammarForCode.map(g => ({ word: g.token, count: g.count, pos: g.pos })),
            grammarForLLM: grammarForLLM.map(g => ({ word: g.token, count: g.count, pos: g.pos })),
        },
        allUnknownVocab: sortedVocab.map(([k, v]) => ({ key: k, ...v })),
        allUnmatchedGrammar: sortedGrammar.map(([k, v]) => ({ key: k, ...v })),
    }, null, 2));
    console.log(`\nDetailed results saved to ${outputPath}`);

    // Print recommendations
    console.log('\n');
    console.log('='.repeat(70));
    console.log('RECOMMENDATIONS');
    console.log('='.repeat(70));
    console.log(`
1. **LLM Level Assignment (${vocabForLLM.length} words)**
   Use the existing LLM API to assign JLPT levels to unknown vocabulary.
   These are primarily:
   - Kanji compound words (漢字熟語)
   - Katakana loanwords (外来語)
   - Longer hiragana vocabulary

2. **Code-based Handling (${grammarForCode.length + vocabForCode.length} patterns)**
   Add rules to lexProfileAnalyzer.ts for:
   - Common verb conjugation endings
   - Colloquial contractions (ちゃう → てしまう)
   - Auxiliary verb forms
   - Particles and connectives

3. **Suggested Code Additions:**
   - Add missing entries to grammarFragments Set
   - Extend grammarLevelMap with common patterns
   - Add fallback rules for verb endings

4. **Quality Improvements:**
   - High-frequency unknown words should be prioritized
   - Consider adding a user feedback system for unknown words
`);
}

main().catch(console.error);
