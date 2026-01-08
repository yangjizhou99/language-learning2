import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch Session Details
        const { data: session, error: sessionError } = await supabase
            .from('shadowing_sessions')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (sessionError || !session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Manually fetch item details
        let itemDetails: any = null;
        if (session.item_id) {
            const { data: item, error: itemError } = await supabase
                .from('shadowing_items')
                .select('title, level, genre, cover_image')
                .eq('id', session.item_id)
                .single();

            if (!itemError) {
                itemDetails = item;
            }
        }

        // 2. Fetch Imported Vocabulary (New Words)
        let newWords: any[] = [];
        if (session.imported_vocab_ids && session.imported_vocab_ids.length > 0) {
            // Fetch User Profile for Bayesian Prediction
            const { predictKnowledgeProbability, extractWordFeatures } = await import('@/lib/recommendation/vocabularyPredictor');
            const { data: profile } = await supabase
                .from('profiles')
                .select('native_lang, ability_level, vocab_unknown_rate')
                .eq('id', user.id)
                .single();

            const userProfile = {
                nativeLang: profile?.native_lang || 'zh',
                abilityLevel: profile?.ability_level || 1,
                vocabUnknownRate: profile?.vocab_unknown_rate
            };

            const { data: vocabData, error: vocabError } = await supabase
                .from('vocab_entries')
                .select('*')
                .in('id', session.imported_vocab_ids);

            if (!vocabError && vocabData) {
                // Enhance with current knowledge status (mastery)
                const words = vocabData.map((v: any) => v.term); // word -> term
                const { data: knowledgeData } = await supabase
                    .from('user_vocabulary_knowledge')
                    .select('word, jlpt_level, exposure_count, marked_unknown, not_marked_count')
                    .eq('user_id', user.id)
                    .in('word', words);

                const knowledgeMap = new Map(knowledgeData?.map((k: any) => [k.word, k]) || []);

                newWords = vocabData.map((v: any) => {
                    const k = knowledgeMap.get(v.term); // word -> term

                    // Get JLPT level from multiple sources
                    const jlptLevel = v.cefr_level || k?.jlpt_level || v.explanation?.cefr || 'N5';

                    const features = extractWordFeatures({
                        token: v.term, // word -> term
                        originalLevel: jlptLevel,
                        frequencyRank: k?.frequency_rank || -1
                    });

                    const evidence = k ? {
                        markedUnknown: k.marked_unknown,
                        exposureCount: k.exposure_count,
                        notMarkedCount: k.not_marked_count,
                    } : null;

                    const prediction = predictKnowledgeProbability(features, userProfile, evidence);


                    return {
                        id: v.id,
                        word: v.term, // word -> term
                        definition: v.explanation?.gloss_native || '', // definition -> explanation
                        jlpt_level: jlptLevel,
                        mastery: Math.round(prediction.knownProbability * 100),
                    };
                });
            }
        }

        // 3. Calculate Impact Stats
        // Group new words by JLPT level
        const levelDistribution: Record<string, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, Unknown: 0 };
        newWords.forEach(w => {
            const level = w.jlpt_level?.toUpperCase() || 'Unknown';
            if (levelDistribution[level] !== undefined) {
                levelDistribution[level]++;
            } else {
                levelDistribution['Unknown']++;
            }
        });

        // Calculate score
        let score = 0;
        if (session.quiz_result) {
            const correct = session.quiz_result.correctCount || session.quiz_result.correct_count || 0;
            const total = session.quiz_result.total || 0;
            if (total > 0) {
                score = Math.round((correct / total) * 100);
            }
        }

        // 4. Construct Response
        const responseData = {
            id: session.id,
            date: session.created_at,
            item: {
                title: itemDetails?.title || 'Unknown Title',
                level: itemDetails?.level || 0,
                genre: itemDetails?.genre || 'General',
                coverImage: itemDetails?.cover_image,
            },
            score: score,
            duration: session.duration || 0, // If you have duration
            newWords,
            stats: {
                totalNewWords: newWords.length,
                levelDistribution,
                quizScore: session.quiz_result?.correctCount || session.quiz_result?.correct_count || 0,
                quizTotal: session.quiz_result?.total || 0,
            }
        };

        return NextResponse.json({
            success: true,
            data: responseData,
        });

    } catch (error) {
        console.error('Error in session detail API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
