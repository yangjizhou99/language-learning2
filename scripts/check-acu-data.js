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
        .select('id, text, notes')
        .eq('id', itemId)
        .single();

    if (!data) {
        // Try shadowing_drafts
        const result = await supabase
            .from('shadowing_drafts')
            .select('id, text, notes')
            .eq('id', itemId)
            .single();
        data = result.data;
        error = result.error;
    }

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    console.log('=== Item Data ===');
    console.log('ID:', data.id);
    console.log('Text:', data.text);
    console.log('\n=== ACU Units ===');
    if (data.notes && data.notes.acu_units) {
        console.log('Units count:', data.notes.acu_units.length);
        data.notes.acu_units.forEach((u, i) => {
            console.log('[' + i + '] sid:' + u.sid + ', span:"' + u.span + '", start:' + u.start + ', end:' + u.end);
        });
    } else {
        console.log('No acu_units found in notes');
        console.log('Notes:', JSON.stringify(data.notes, null, 2));
    }
}

main().catch(console.error);
