const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVocabFullLogic() {
    const userId = '72e1204d-7585-4d1e-a4eb-03ed232115d2';

    console.log('Testing full vocab upsert logic for user:', userId);

    // Simulate selected_words from frontend
    const selected_words = [
        { text: 'ありがとう', lang: 'ja', definition: 'Thank you', cefr: 'N5', explanation: { gloss_native: '谢谢' } },
        { text: '推薦状', lang: 'ja', definition: 'Recommendation letter', cefr: 'N2', explanation: { gloss_native: '推荐信' } },
        { text: '提出期限', lang: 'ja', definition: 'Submission deadline', cefr: 'N3', explanation: { gloss_native: '提交期限' } },
    ];

    const item_id = '014ce67a-af0f-4aba-bbff-c3a176f0c1fe'; // Valid item ID

    // Step 1: Check for existing vocab entries
    console.log('[Step 1] Checking for existing vocab entries...');
    const terms = selected_words.map(w => w.text);
    const { data: existingVocab, error: existingError } = await supabase
        .from('vocab_entries')
        .select('id, term, lang')
        .eq('user_id', userId)
        .in('term', terms);

    if (existingError) {
        console.error('Error checking existing vocab:', existingError);
        return;
    }
    console.log('Existing vocab:', existingVocab);

    const existingMap = new Map();
    if (existingVocab) {
        existingVocab.forEach(v => {
            existingMap.set(`${v.term}_${v.lang}`, v.id);
        });
    }

    // Step 2: Build vocab entries
    console.log('[Step 2] Building vocab entries...');
    const vocabEntries = selected_words.map(word => {
        const lang = word.lang || 'en';
        const existingId = existingMap.get(`${word.text}_${lang}`);

        const entry = {
            id: existingId || crypto.randomUUID(), // Generate new UUID if not existing
            user_id: userId,
            lang: lang,
            native_lang: 'zh',
            term: word.text,
            explanation: {
                gloss_native: word.definition || '',
                ...word.explanation
            },
            context: word.context || '',
            source: 'shadowing',
            source_id: item_id,
            cefr_level: word.cefr || null,
            updated_at: new Date().toISOString(),
        };

        // Only set created_at for new rows
        if (!existingId) {
            entry.created_at = new Date().toISOString();
        }

        return entry;
    });

    console.log('Vocab entries to upsert:', JSON.stringify(vocabEntries, null, 2));

    // Step 3: Upsert vocab entries
    console.log('[Step 3] Upserting vocab entries...');
    const { data: insertedVocab, error: vocabError } = await supabase
        .from('vocab_entries')
        .upsert(vocabEntries)
        .select('id');

    if (vocabError) {
        console.error('Vocab upsert error:', JSON.stringify(vocabError, null, 2));
        return;
    }

    console.log('Vocab upsert success! IDs:', insertedVocab.map(v => v.id));
}

testVocabFullLogic();
