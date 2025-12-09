
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLatestDraft() {
    // Search for any draft where notes->audio_url is not null
    const { data, error } = await supabase
        .from('shadowing_drafts')
        .select('*')
        .not('notes->audio_url', 'is', null)
        .limit(5);

    if (error) {
        console.error('Error fetching draft:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`Found ${data.length} drafts WITH audio_url.`);
        data.forEach(draft => {
            console.log(`Draft ID: ${draft.id}, URL: ${draft.notes.audio_url}`);
        });
    } else {
        console.log('No drafts found with audio_url');
    }
}

checkLatestDraft();
