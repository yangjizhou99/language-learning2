require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function check() {
    const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Check recent sessions with prediction_accuracy
    const { data: sessions } = await s
        .from('shadowing_sessions')
        .select('id,item_id,status,notes,created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('=== Recent Sessions ===');
    for (const sess of sessions || []) {
        console.log('Session:', sess.id?.slice(0, 8), '| Status:', sess.status);
        if (sess.notes?.prediction_accuracy) {
            console.log('  ✅ Prediction Stats:', JSON.stringify(sess.notes.prediction_accuracy));
        } else {
            console.log('  ❌ No prediction_accuracy');
        }
    }

    // Check vocabulary knowledge
    const { data: vocab, count } = await s
        .from('user_vocabulary_knowledge')
        .select('*', { count: 'exact' })
        .limit(5);

    console.log('\n=== User Vocabulary Knowledge ===');
    console.log('Total records:', count);
    for (const v of vocab || []) {
        console.log('-', v.word, '| Level:', v.jlpt_level, '| Marked:', v.marked_unknown, '| Exposure:', v.exposure_count);
    }
}

check().catch(console.error);
