const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSaveSessionCorrected() {
    const userId = '72e1204d-7585-4d1e-a4eb-03ed232115d2';

    console.log('Testing save session (corrected) for user:', userId);

    // Fetch a valid item ID
    const { data: item } = await supabase
        .from('shadowing_items')
        .select('id')
        .limit(1)
        .single();

    if (!item) {
        console.error('No shadowing items found');
        return;
    }
    const itemId = item.id;
    console.log('Using item ID:', itemId);

    // 1. Upsert Session (No score column, with UUID)
    const sessionId = crypto.randomUUID();
    const { data: session, error: sessionError } = await supabase
        .from('shadowing_sessions')
        .upsert({
            id: sessionId,
            user_id: userId,
            item_id: itemId,
            status: 'completed',
            quiz_result: { correctCount: 5, total: 5 }
        })
        .select()
        .single();

    if (sessionError) {
        console.error('Session upsert failed:', sessionError);
        return;
    }
    console.log('Session created:', session.id);

    // 2. Upsert Vocab (Correct columns: term, explanation, lang, native_lang, source)
    const selected_words = [
        { text: 'テスト修正' + Date.now(), lang: 'ja', definition: 'test corrected', cefr: 'N5' }
    ];

    const vocabEntries = selected_words.map(word => ({
        user_id: userId,
        lang: word.lang || 'en',
        native_lang: 'zh',
        term: word.text,
        explanation: { gloss_native: word.definition || '' },
        source: 'shadowing',
        source_id: itemId,
        cefr_level: word.cefr || null,
        created_at: new Date().toISOString(),
    }));

    const { data: insertedVocab, error: vocabError } = await supabase
        .from('vocab_entries')
        .upsert(vocabEntries, {
            onConflict: 'user_id,term,lang',
        })
        .select('id');

    if (vocabError) {
        console.error('Vocab upsert failed:', vocabError);
        return;
    }
    console.log('Vocab inserted:', insertedVocab.map(v => v.id));

    // 3. Update Session with IDs
    const vocabIds = insertedVocab.map(v => v.id);
    const { data: updatedSession, error: updateError } = await supabase
        .from('shadowing_sessions')
        .update({
            imported_vocab_ids: vocabIds,
        })
        .eq('id', session.id)
        .select();

    if (updateError) {
        console.error('Session update failed:', updateError);
    } else {
        console.log('Session updated successfully. Imported IDs:', updatedSession[0].imported_vocab_ids);
    }
}

testSaveSessionCorrected();
