const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTranslations() {
    const title = '家庭の温もり';
    console.log(`Checking translations for item: ${title}`);

    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, title, translations, lang')
        .eq('title', title);

    if (error) {
        console.error('Error fetching item:', error);
        return;
    }

    if (items && items.length > 0) {
        items.forEach(item => {
            console.log('Item ID:', item.id);
            console.log('Language:', item.lang);
            console.log('Translations:', item.translations);
            if (!item.translations || Object.keys(item.translations).length === 0) {
                console.log('WARNING: No translations found!');
            }
        });
    } else {
        console.log('Item not found.');
    }
}

checkTranslations();
