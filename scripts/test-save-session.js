const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role to bypass RLS for test setup, but we want to test AS a user.
// So we need to sign in or use a user ID.
// Let's use the user ID found in logs: 72e1204d-7585-4d1e-a4eb-03ed232115d2

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSaveSession() {
    const userId = '72e1204d-7585-4d1e-a4eb-03ed232115d2';
    const itemId = 'test-item-' + Date.now(); // Unique item ID

    console.log('Testing save session for user:', userId);

    // 1. Create a dummy session directly (simulating what the API does partially, 
    // but actually we want to call the logic that the API does).
    // Since we can't easily call the API route function directly, we'll replicate the logic here.

    const selected_words = [
        { text: 'テスト', lang: 'ja', definition: 'test', cefr: 'N5' },
        { text: '猫', lang: 'ja', definition: 'cat', cefr: 'N5' }
    ];

    // 1. Upsert Session
    const { data: session, error: sessionError } = await supabase
        .from('shadowing_sessions')
        .upsert({
            user_id: userId,
            item_id: itemId,
            status: 'completed',
            score: 100,
            quiz_result: { correctCount: 5, total: 5 }
        })
        .select()
        .single();

    if (sessionError) {
        console.error('Session upsert failed:', sessionError);
        return;
    }
    console.log('Session created:', session.id);

    // 2. Upsert Vocab
    const vocabEntries = selected_words.map(word => ({
        user_id: userId,
        source_lang: word.lang || 'en',
        target_lang: 'zh',
        word: word.text,
        definition: word.definition || '',
        source_type: 'shadowing',
        source_id: itemId,
        cefr_level: word.cefr || null,
        created_at: new Date().toISOString(),
    }));

    const { data: insertedVocab, error: vocabError } = await supabase
        .from('vocab_entries')
        .upsert(vocabEntries, {
            onConflict: 'user_id,word,source_lang',
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
        console.log('Session updated successfully:', updatedSession);
    }
}

testSaveSession();
