// Check database data after practice session
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
    console.log('=== Checking Database Data ===\n');

    // 1. Check latest shadowing_sessions
    console.log('1. Latest Shadowing Sessions:');
    const { data: sessions, error: sessErr } = await supabase
        .from('shadowing_sessions')
        .select('id, user_id, item_id, status, created_at, notes')
        .order('created_at', { ascending: false })
        .limit(3);

    if (sessErr) {
        console.error('Error:', sessErr.message);
    } else {
        sessions.forEach(s => {
            console.log(`  - Session ${s.id.slice(0, 8)}... | Status: ${s.status} | Created: ${s.created_at}`);
            if (s.notes?.prediction_accuracy) {
                const acc = s.notes.prediction_accuracy;
                console.log(`    Prediction Accuracy: P=${acc.precision}, R=${acc.recall}, F1=${acc.f1Score}`);
                console.log(`    Predicted: ${acc.predictedCount}, Marked: ${acc.markedCount}`);
            }
        });
    }

    // 2. Check user_vocabulary_knowledge
    console.log('\n2. Latest Vocabulary Knowledge Records (last 10):');
    const { data: knowledge, error: knowledgeErr } = await supabase
        .from('user_vocabulary_knowledge')
        .select('word, jlpt_level, marked_unknown, exposure_count, not_marked_count, last_seen_at')
        .order('last_seen_at', { ascending: false })
        .limit(10);

    if (knowledgeErr) {
        console.error('Error:', knowledgeErr.message);
    } else {
        console.log(`  Found ${knowledge.length} recent records:`);
        knowledge.forEach(k => {
            const status = k.marked_unknown ? '❌ Unknown' : '✅ Known';
            console.log(`  - "${k.word}" (${k.jlpt_level || 'N/A'}) | ${status} | Exp: ${k.exposure_count}, NotMarked: ${k.not_marked_count}`);
        });
    }

    // 3. Check profiles.bayesian_profile
    console.log('\n3. User Profile (Bayesian):');
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, bayesian_profile')
        .not('bayesian_profile', 'is', null)
        .limit(3);

    if (profiles?.length) {
        profiles.forEach(p => {
            const bp = p.bayesian_profile;
            if (bp) {
                console.log(`  User ${p.id.slice(0, 8)}...:`);
                console.log(`    JLPT Mastery: N5=${(bp.jlptMastery?.N5 * 100).toFixed(1)}%, N4=${(bp.jlptMastery?.N4 * 100).toFixed(1)}%, N3=${(bp.jlptMastery?.N3 * 100).toFixed(1)}%`);
                console.log(`    Evidence Count: ${bp.evidenceCount || 0}`);
                console.log(`    Estimated Level: ${bp.estimatedLevel?.toFixed(2) || 'N/A'}`);
                if (bp.predictionFeedback) {
                    console.log(`    Prediction Feedback: P=${bp.predictionFeedback.precision}, R=${bp.predictionFeedback.recall}`);
                }
            }
        });
    } else {
        console.log('  No bayesian profiles found');
    }

    // 4. Summary statistics
    console.log('\n4. Summary Statistics:');
    const { count: totalKnowledge } = await supabase
        .from('user_vocabulary_knowledge')
        .select('*', { count: 'exact', head: true });

    const { count: markedUnknown } = await supabase
        .from('user_vocabulary_knowledge')
        .select('*', { count: 'exact', head: true })
        .eq('marked_unknown', true);

    console.log(`  Total vocabulary records: ${totalKnowledge || 0}`);
    console.log(`  Marked as unknown: ${markedUnknown || 0}`);
    console.log(`  Known (not marked): ${(totalKnowledge || 0) - (markedUnknown || 0)}`);
}

checkData().catch(console.error);
