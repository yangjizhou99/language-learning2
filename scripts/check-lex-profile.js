
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env.local manually to ensure we get the keys
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkLexProfile() {
    console.log('🔍 Checking shadowing_items for lex_profile data...\n');

    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, title, lex_profile');

    if (error) {
        console.error('❌ Error fetching items:', error.message);
        return;
    }

    const total = items.length;
    let processed = 0;
    let unprocessed = 0;
    const examples = [];

    items.forEach(item => {
        const hasProfile = item.lex_profile && Object.keys(item.lex_profile).length > 0;
        if (hasProfile) {
            processed++;
            if (examples.length < 3) {
                examples.push(item);
            }
        } else {
            unprocessed++;
        }
    });

    console.log(`📊 Total Items: ${total}`);
    console.log(`✅ Processed (has lex_profile): ${processed}`);
    console.log(`⚠️  Unprocessed (empty/null): ${unprocessed}`);
    console.log(`📈 Coverage: ${total > 0 ? ((processed / total) * 100).toFixed(1) : 0}%\n`);

    if (examples.length > 0) {
        console.log('📋 Examples of processed items:');
        examples.forEach(item => {
            console.log(`\nTitle: ${item.title}`);
            console.log(`Lex Profile: ${JSON.stringify(item.lex_profile, null, 2)}`);
        });
    } else {
        console.log('ℹ️  No processed items found.');
    }
}

checkLexProfile().catch(console.error);
