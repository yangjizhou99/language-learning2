const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestVocab() {
    console.log('Checking latest vocab entries...');
    const { data, error } = await supabase
        .from('vocab_entries')
        .select('id, term, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching vocab:', error);
    } else {
        console.log('Latest Vocab:', JSON.stringify(data, null, 2));
    }
}

checkLatestVocab();
