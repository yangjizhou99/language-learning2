require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
    console.log('Checking database connection via Supabase Client...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in .env.local');
        return;
    }

    console.log(`Connecting to Supabase URL: ${supabaseUrl}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Try to select the specific column
        const { data, error } = await supabase
            .from('profiles')
            .select('bayesian_profile')
            .limit(1);

        if (error) {
            console.error('❌ Error querying bayesian_profile:', error.message);
            if (error.code === '42703') { // Undefined column
                console.error('   CONFIRMED: The column "bayesian_profile" does not exist in the connected database.');
            }
        } else {
            console.log('✅ Query successful. Column "bayesian_profile" appears to exist.');
            console.log('   Sample data:', data);
        }

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

checkSchema();
