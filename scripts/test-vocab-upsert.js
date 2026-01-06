const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testVocabUpsert() {
    const userId = '72e1204d-7585-4d1e-a4eb-03ed232115d2';
    const word = 'テストupsert';

    // 1. Insert first time
    const { data: data1, error: error1 } = await supabase
        .from('vocab_entries')
        .upsert({
            user_id: userId,
            word: word,
            source_lang: 'ja',
            target_lang: 'zh',
            definition: 'test',
            source_type: 'test'
        }, { onConflict: 'user_id,word,source_lang' })
        .select('id');

    console.log('First insert:', data1, error1);

    // 2. Insert again (update)
    const { data: data2, error: error2 } = await supabase
        .from('vocab_entries')
        .upsert({
            user_id: userId,
            word: word,
            source_lang: 'ja',
            target_lang: 'zh',
            definition: 'test update',
            source_type: 'test'
        }, { onConflict: 'user_id,word,source_lang' })
        .select('id');

    console.log('Second insert (update):', data2, error2);
}

testVocabUpsert();
