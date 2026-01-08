const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking shadowing_sessions...');

    // 1. Check if any sessions exist
    const { data: sessions, error: sessionError } = await supabase
        .from('shadowing_sessions')
        .select('*')
        .limit(5);

    if (sessionError) {
        console.error('Error fetching sessions:', sessionError);
    } else {
        console.log(`Found ${sessions.length} sessions.`);
        if (sessions.length > 0) {
            console.log('Sample session:', sessions[0]);

            // 5. Simulate the manual join logic used in the API
            console.log('\nSimulating API manual join logic...');
            const session = sessions[0];
            console.log('Session ID:', session.id);
            console.log('Item ID:', session.item_id);

            let itemDetails = null;
            if (session.item_id) {
                const { data: item, error: itemError } = await supabase
                    .from('shadowing_items')
                    .select('title, level, genre')
                    .eq('id', session.item_id)
                    .single();

                if (!itemError) {
                    itemDetails = item;
                    console.log('Successfully fetched item manually:', item);
                } else {
                    console.error('Failed to fetch item manually:', itemError);
                }
            }

            const result = {
                id: session.id,
                date: session.created_at,
                score: session.score,
                itemId: session.item_id,
                title: itemDetails?.title || 'Unknown Item',
                level: itemDetails?.level || 0,
                genre: itemDetails?.genre || 'General',
            };

            console.log('Final constructed object:', result);
        }
    }
}

checkData();
