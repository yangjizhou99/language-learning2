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

    const text = data.text;
    const units = data.notes?.acu_units || [];

    console.log('=== Original Text ===');
    console.log(JSON.stringify(text)); // Shows escape sequences
    console.log();
    console.log('Text length:', text.length);
    console.log();

    console.log('=== Verifying ACU Alignment ===');
    let mismatches = 0;

    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        const extractedText = text.slice(u.start, u.end);

        if (extractedText !== u.span) {
            mismatches++;
            console.log('[MISMATCH ' + i + '] sid:' + u.sid);
            console.log('  span: "' + u.span + '"');
            console.log('  extracted: "' + extractedText + '"');
            console.log('  start:' + u.start + ', end:' + u.end);
        }
    }

    console.log();
    console.log('Total units:', units.length);
    console.log('Mismatches:', mismatches);

    if (mismatches > 0) {
        console.log();
        console.log('=== ACU Data Details ===');
        // Show first few units with context
        for (let i = 0; i < Math.min(10, units.length); i++) {
            const u = units[i];
            const context = text.slice(Math.max(0, u.start - 5), Math.min(text.length, u.end + 5));
            console.log('[' + i + '] sid:' + u.sid + ', span:"' + u.span + '"');
            console.log('     range:' + u.start + '-' + u.end + ', context: "...' + context + '..."');
        }
    }
}

main().catch(console.error);
