const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestSession() {
    console.log('Checking latest session...');
    const { data, error } = await supabase
        .from('shadowing_sessions')
        .select('id, created_at, imported_vocab_ids, quiz_result')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching session:', error);
    } else {
        console.log('Latest Session:', JSON.stringify(data, null, 2));
    }
}

checkLatestSession();
