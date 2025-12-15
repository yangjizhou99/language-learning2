export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    pickTargetBand,
    UserAbilityState,
    ShadowingItemMetadata,
    calculateDifficultyScore,
} from '@/lib/recommendation/difficulty';
import { getUserPreferenceVectors } from '@/lib/recommendation/preferences';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
    try {
        // Auth setup
        const authHeader = req.headers.get('authorization') || '';
        const hasBearer = /^Bearer\s+/.test(authHeader);
        let supabase: SupabaseClient;

        if (hasBearer) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            });
        } else {
            const cookieStore = await cookies();
            supabase = (createServerClient(supabaseUrl, supabaseAnon, {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set() { },
                    remove() { },
                },
            }) as unknown) as SupabaseClient;
        }

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch User Profile & Preferences
        const [profileResult, prefs, userScenePrefsResult] = await Promise.all([
            supabase
                .from('profiles')
                .select('ability_level, vocab_unknown_rate, explore_config, comprehension_rate, target_langs')
                .eq('id', user.id)
                .single(),
            getUserPreferenceVectors(user.id),
            // Also fetch user's direct scene preferences for scene-based interest matching
            supabase
                .from('user_scene_preferences')
                .select('scene_id, weight')
                .eq('user_id', user.id)
        ]);

        const { data: profile, error: profileError } = profileResult;

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
        }

        const userState: UserAbilityState = {
            userId: user.id,
            level: profile.ability_level || 1.0,
            vocabUnknownRate: profile.vocab_unknown_rate || {},
            comprehensionRate: profile.comprehension_rate ?? 0.8,
            exploreConfig: profile.explore_config || {
                mainRatio: 0.6,
                downRatio: 0.2,
                upRatio: 0.2,
            },
        };

        // Build user scene preference map for direct scene-based interest matching
        const userScenePrefs = userScenePrefsResult.data || [];
        const userSceneMap = new Map<string, number>();
        for (const pref of userScenePrefs) {
            userSceneMap.set(pref.scene_id, pref.weight);
        }
        console.log('[ai-recommend] user scene prefs count:', userSceneMap.size);

        // 2. Pick Target Band (Explore vs Exploit)
        const targetBand = pickTargetBand(userState);

        // Calculate level range based on band
        let minLevel = 1, maxLevel = 6;
        if (targetBand === 'down') {
            maxLevel = Math.floor(userState.level);
            minLevel = Math.max(1, maxLevel - 1);
        } else if (targetBand === 'main') {
            minLevel = Math.max(1, Math.floor(userState.level) - 1);
            maxLevel = Math.min(6, Math.ceil(userState.level) + 1);
        } else {
            minLevel = Math.ceil(userState.level);
            maxLevel = Math.min(6, minLevel + 2);
        }

        // Generate reason based on band
        let bandReason = '';
        if (targetBand === 'down') {
            bandReason = '系统建议进行巩固练习，夯实基础';
        } else if (targetBand === 'main') {
            bandReason = '系统建议保持当前难度，稳步提升';
        } else {
            bandReason = '系统建议尝试挑战更高难度，突破瓶颈';
        }
        // Get user's target languages (default to ['zh'] if not set)
        const targetLangs: string[] = profile.target_langs || ['zh'];

        // 3. Fetch Candidates - only for user's target languages
        let query = supabase
            .from('shadowing_items')
            .select('id, title, level, base_level, lex_profile, text, audio_url, genre, theme_id, subtopic_id, lang')
            .gte('level', minLevel)
            .lte('level', maxLevel);

        // Filter by target languages
        if (targetLangs.length > 0) {
            query = query.in('lang', targetLangs);
        }

        const { data: items, error: itemsError } = await query.limit(50);

        if (itemsError) {
            console.error('Error fetching items:', itemsError);
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
        }

        // Filter out practiced items
        const { data: practicedSessions } = await supabase
            .from('shadowing_sessions')
            .select('item_id')
            .eq('user_id', user.id);

        const practicedIds = new Set(practicedSessions?.map(s => s.item_id) || []);
        const candidates = (items || []).filter(item => !practicedIds.has(item.id));

        // 4.5. Fetch scene vectors for candidates' subtopics
        const subtopicIds = [...new Set(candidates.map(item => item.subtopic_id).filter(Boolean))];
        let sceneVectorMap = new Map<string, { scene_id: string; name_cn: string; weight: number }[]>();

        console.log('[ai-recommend] subtopicIds count:', subtopicIds.length);

        if (subtopicIds.length > 0) {
            // First, get all scene vectors
            const { data: vectors, error: vectorsError } = await supabase
                .from('subtopic_scene_vectors')
                .select('subtopic_id, scene_id, weight')
                .in('subtopic_id', subtopicIds)
                .order('weight', { ascending: false });

            console.log('[ai-recommend] vectors result:', vectors?.length || 0, 'error:', vectorsError?.message);

            if (!vectorsError && vectors && vectors.length > 0) {
                // Get unique scene_ids to fetch scene names
                const sceneIds = [...new Set(vectors.map(v => v.scene_id).filter(Boolean))];

                // Fetch scene tags separately
                const { data: sceneTags, error: tagsError } = await supabase
                    .from('scene_tags')
                    .select('scene_id, name_cn')
                    .in('scene_id', sceneIds);

                console.log('[ai-recommend] sceneTags result:', sceneTags?.length || 0, 'error:', tagsError?.message);

                // Create a map for quick lookup
                const sceneNameMap = new Map<string, string>();
                if (!tagsError && sceneTags) {
                    sceneTags.forEach(tag => {
                        sceneNameMap.set(tag.scene_id, tag.name_cn);
                    });
                }

                // Build the final map
                vectors.forEach((v: any) => {
                    const list = sceneVectorMap.get(v.subtopic_id) || [];
                    const name_cn = sceneNameMap.get(v.scene_id) || v.scene_id;
                    list.push({
                        scene_id: v.scene_id,
                        name_cn,
                        weight: v.weight
                    });
                    sceneVectorMap.set(v.subtopic_id, list);
                });
            }
        }

        // 5. Score Candidates
        const scored = candidates.map(item => {
            const metadata: ShadowingItemMetadata = {
                id: item.id,
                level: item.base_level || item.level,
                lexProfile: item.lex_profile || {},
            };

            const difficultyScore = calculateDifficultyScore(userState, metadata, targetBand);

            // Get scene weights for this item's subtopic
            const sceneWeights = sceneVectorMap.get(item.subtopic_id || '') || [];

            // Calculate interest score based on scene vector matching
            // Formula: sum(user_scene_weight * item_scene_weight) / max_possible_score
            let interestScore = prefs.themeMap.get(item.theme_id || '') || 0.3; // fallback to theme-based

            if (userSceneMap.size > 0 && sceneWeights.length > 0) {
                let dotProduct = 0;
                let maxPossible = 0;

                for (const scene of sceneWeights) {
                    const userWeight = userSceneMap.get(scene.scene_id) || 0;
                    dotProduct += userWeight * scene.weight;
                    maxPossible += scene.weight; // Max if user had weight 1 for all scenes
                }

                // Normalize to 0-1 range
                if (maxPossible > 0) {
                    interestScore = Math.min(1, dotProduct / maxPossible);
                }
            }

            const finalScore = 0.6 * interestScore + 0.4 * difficultyScore;

            // Generate personalized reason
            let reason = '';
            if (interestScore > 0.6) {
                reason = `匹配你的兴趣主题，难度 L${item.level} 适合当前水平`;
            } else if (difficultyScore > 0.7) {
                reason = `难度 L${item.level} 非常适合你当前的能力`;
            } else {
                reason = `L${item.level} 练习有助于提升你的能力`;
            }

            return {
                item: {
                    id: item.id,
                    title: item.title,
                    level: item.level,
                    genre: item.genre,
                    theme_id: item.theme_id,
                    subtopic_id: item.subtopic_id,
                    lang: item.lang,
                },
                score: finalScore,
                scoreBreakdown: {
                    interest: interestScore,
                    difficulty: difficultyScore,
                    formula: '60% 兴趣 + 40% 难度匹配',
                },
                sceneWeights,
                reason,
            };
        });

        // 6. Sort and Return
        scored.sort((a, b) => b.score - a.score);
        const topRecommendations = scored.slice(0, 5);

        // Get scene names for user preferences
        const userScenePrefsWithNames = [];
        if (userScenePrefs.length > 0) {
            const sceneIds = userScenePrefs.map(p => p.scene_id);
            const { data: sceneNames } = await supabase
                .from('scene_tags')
                .select('scene_id, name_cn')
                .in('scene_id', sceneIds);

            const nameMap = new Map<string, string>();
            if (sceneNames) {
                sceneNames.forEach(s => nameMap.set(s.scene_id, s.name_cn));
            }

            for (const pref of userScenePrefs) {
                userScenePrefsWithNames.push({
                    scene_id: pref.scene_id,
                    name_cn: nameMap.get(pref.scene_id) || pref.scene_id,
                    weight: pref.weight
                });
            }
            // Sort by weight descending
            userScenePrefsWithNames.sort((a, b) => b.weight - a.weight);
        }

        return NextResponse.json({
            success: true,
            userLevel: {
                level: userState.level,
                vocabUnknownRate: userState.vocabUnknownRate,
                comprehensionRate: userState.comprehensionRate,
                exploreConfig: userState.exploreConfig,
            },
            difficultyRecommend: {
                targetBand,
                levelRange: { min: minLevel, max: maxLevel },
                reason: bandReason,
            },
            userScenePreferences: userScenePrefsWithNames,
            recommendations: topRecommendations,
        });

    } catch (error) {
        console.error('Error in ai-recommend API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
