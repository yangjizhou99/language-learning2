const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const itemId = '9346aa3d-db5f-4629-8a8c-58b9a53ca083';

    // First try shadowing_items
    let { data, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lex_profile, notes')
        .eq('id', itemId)
        .single();

    if (!data) {
        const result = await supabase
            .from('shadowing_drafts')
            .select('id, text, lex_profile, notes')
            .eq('id', itemId)
            .single();
        data = result.data;
        error = result.error;
    }

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    console.log('=== Item ID ===');
    console.log(data.id);

    console.log('\n=== Text ===');
    console.log(data.text);

    console.log('\n=== Lex Profile (top level) ===');
    if (data.lex_profile) {
        console.log('Found at top level lex_profile:');
        console.log('  Keys:', Object.keys(data.lex_profile));
        if (data.lex_profile.tokenList) {
            console.log('  tokenList count:', data.lex_profile.tokenList.length);
            console.log('  First 5 tokens:');
            data.lex_profile.tokenList.slice(0, 5).forEach((t, i) => {
                console.log('    [' + i + ']', JSON.stringify(t));
            });
        }
    } else {
        console.log('No lex_profile at top level');
    }

    console.log('\n=== Notes.lex_profile ===');
    if (data.notes && data.notes.lex_profile) {
        console.log('Found at notes.lex_profile:');
        console.log('  Keys:', Object.keys(data.notes.lex_profile));
        if (data.notes.lex_profile.tokenDetails) {
            console.log('  tokenDetails count:', data.notes.lex_profile.tokenDetails.length);
            console.log('  First 5 details:');
            data.notes.lex_profile.tokenDetails.slice(0, 5).forEach((t, i) => {
                console.log('    [' + i + ']', JSON.stringify(t));
            });
        }
    } else {
        console.log('No lex_profile in notes');
    }

    console.log('\n=== ACU Units ===');
    if (data.notes && data.notes.acu_units) {
        console.log('acu_units count:', data.notes.acu_units.length);
        console.log('First 5 units:');
        data.notes.acu_units.slice(0, 5).forEach((u, i) => {
            console.log('  [' + i + '] sid:' + u.sid + ', span:"' + u.span + '", start:' + u.start + ', end:' + u.end);
        });
    } else {
        console.log('No acu_units found');
    }
}

main().catch(console.error);
