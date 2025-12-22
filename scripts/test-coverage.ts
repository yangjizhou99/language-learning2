/**
 * Quick coverage test script
 * Usage: npx tsx scripts/test-coverage.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { analyzeLexProfileAsync } from '../src/lib/recommendation/lexProfileAnalyzer';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Testing coverage rate...\n');

    // Fetch items
    const { data, error } = await supabase
        .from('shadowing_items')
        .select('id, text, title, lang')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .order('created_at', { ascending: false });

    if (error || !data) {
        console.error('Error:', error);
        return;
    }

    let totalCoverage = 0;
    let totalVocabWithLevel = 0;
    let totalVocab = 0;
    let totalGrammarWithLevel = 0;
    let totalGrammar = 0;
    let analyzed = 0;

    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        process.stdout.write(`\r  Analyzing: ${i + 1}/${data.length}`);

        try {
            const result = await analyzeLexProfileAsync(item.text, 'ja', 'kuromoji', 'default', 'hagoromo');

            totalCoverage += result.details.coverage;
            analyzed++;

            // Count vocab tokens
            for (const token of result.details.tokenList) {
                if (token.isContentWord) {
                    totalVocab++;
                    if (token.originalLevel !== 'unknown' && token.originalLevel !== 'proper_noun') {
                        totalVocabWithLevel++;
                    }
                } else {
                    totalGrammar++;
                    // Check if grammar has level (format: "grammar (N3)" or just "grammar")
                    if (token.originalLevel.includes('(N')) {
                        totalGrammarWithLevel++;
                    }
                }
            }
        } catch (err) {
            // Skip errors
        }
    }

    console.log('\n\n');
    console.log('='.repeat(60));
    console.log('COVERAGE REPORT');
    console.log('='.repeat(60));
    console.log(`Total items analyzed: ${analyzed}`);
    console.log();
    console.log(`📚 Vocabulary Coverage:`);
    console.log(`   Total content words: ${totalVocab}`);
    console.log(`   With JLPT level: ${totalVocabWithLevel}`);
    console.log(`   Coverage rate: ${(totalVocabWithLevel / totalVocab * 100).toFixed(2)}%`);
    console.log();
    console.log(`📖 Grammar Coverage:`);
    console.log(`   Total grammar tokens: ${totalGrammar}`);
    console.log(`   With JLPT level: ${totalGrammarWithLevel}`);
    console.log(`   Coverage rate: ${(totalGrammarWithLevel / totalGrammar * 100).toFixed(2)}%`);
    console.log();
    console.log(`📊 Overall:`);
    console.log(`   Average content word coverage: ${(totalCoverage / analyzed * 100).toFixed(2)}%`);
    console.log('='.repeat(60));
}

main().catch(console.error);
