const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    console.log('Checking columns for vocab_entries...');
    const { data, error } = await supabase
        .from('vocab_entries')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No data found, cannot infer columns from result.');
        // Try to insert a dummy to see if it accepts the column? No that's risky.
    }
}

checkColumns();
