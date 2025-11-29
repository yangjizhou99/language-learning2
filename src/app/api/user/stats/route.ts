
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
    try {
        // 1. Authentication
        const authHeader = req.headers.get('authorization') || '';
        const hasBearer = /^Bearer\s+/.test(authHeader);
        let supabase;

        if (hasBearer) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            });
        } else {
            const cookieStore = await cookies();
            supabase = createServerClient(supabaseUrl, supabaseAnon, {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set() { },
                    remove() { },
                },
            });
        }

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Data
        // We need:
        // - Shadowing Attempts (with item_id -> theme_id)
        // - Pronunciation Attempts (optional, if we want to mix them)
        // - Theme Scene Vectors (to map themes to scenes)

        // Fetch Shadowing Attempts
        const { data: shadowingAttempts, error: shadowingError } = await supabase
            .from('shadowing_attempts')
            .select('id, created_at, metrics, item_id, lang')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1000); // Limit to recent 1000 attempts for performance

        console.log(`[Stats API] Found ${shadowingAttempts?.length || 0} attempts for user ${user.id}`);

        if (shadowingError) {
            console.error('Error fetching shadowing attempts:', shadowingError);
            return NextResponse.json({ error: 'Failed to fetch attempts' }, { status: 500 });
        }

        // Fetch Item Details (to get theme_id)
        // We collect all unique item_ids from attempts
        const itemIds = Array.from(new Set(shadowingAttempts.map((a) => a.item_id)));

        let itemsMap = new Map();
        if (itemIds.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('shadowing_items')
                .select('id, theme_id, title')
                .in('id', itemIds);

            if (itemsError) {
                console.error('Error fetching items:', itemsError);
            } else {
                items.forEach(item => itemsMap.set(item.id, item));
            }
        }

        // Fetch Theme Vectors
        // We collect all unique theme_ids
        const themeIds = Array.from(new Set(Array.from(itemsMap.values()).map((i) => i.theme_id).filter(Boolean)));

        let themeVectorsMap = new Map(); // theme_id -> [{scene_id, weight}]
        if (themeIds.length > 0) {
            const { data: vectors, error: vectorsError } = await supabase
                .from('theme_scene_vectors')
                .select('theme_id, scene_id, weight')
                .in('theme_id', themeIds);

            if (vectorsError) {
                console.error('Error fetching vectors:', vectorsError);
            } else {
                vectors.forEach(v => {
                    if (!themeVectorsMap.has(v.theme_id)) {
                        themeVectorsMap.set(v.theme_id, []);
                    }
                    themeVectorsMap.get(v.theme_id).push(v);
                });
            }
        }

        // Fetch Scene Names (optional, for display)
        // For now we can just use scene_id or fetch names if needed. 
        // Let's assume frontend has scene names or we fetch them.
        // To make it self-contained, let's fetch scene names.
        const { data: scenes } = await supabase.from('scenes').select('id, name_cn, name_en, name_ja');
        const sceneNameMap = new Map();
        scenes?.forEach(s => sceneNameMap.set(s.id, s.name_cn || s.name_en));


        // 3. Process Data

        // --- Ability Radar ---
        // Scene Score = Sum(Attempt Score * Theme-Scene Weight) / Sum(Theme-Scene Weight)
        // We need to track total weighted score and total weight for each scene.
        // NEW: We also track "Practice Volume" to calculate Mastery.
        // Mastery = Accuracy * (Count / (Count + K))
        const sceneStats = new Map<string, { totalWeightedScore: number; totalWeight: number; rawCount: number }>();

        shadowingAttempts.forEach(attempt => {
            const item = itemsMap.get(attempt.item_id);
            if (!item || !item.theme_id) return;

            const vectors = themeVectorsMap.get(item.theme_id);
            if (!vectors) return;

            // Extract score. Assuming metrics has 'score' (0-100)
            let score = 0;
            if (attempt.metrics && typeof attempt.metrics === 'object') {
                // Handle different potential structures
                if ('score' in attempt.metrics) {
                    score = Number(attempt.metrics.score);
                } else if ('accuracy' in attempt.metrics) {
                    const acc = Number(attempt.metrics.accuracy);
                    score = acc > 1 ? acc : acc * 100;
                }
            }
            // Note: We count even 0 score attempts as practice, but they contribute 0 to score.

            vectors.forEach((v: { scene_id: string; weight: number }) => {
                if (!sceneStats.has(v.scene_id)) {
                    sceneStats.set(v.scene_id, { totalWeightedScore: 0, totalWeight: 0, rawCount: 0 });
                }
                const stats = sceneStats.get(v.scene_id)!;
                stats.totalWeightedScore += score * v.weight;
                stats.totalWeight += v.weight;
                // We increment rawCount by weight to reflect that "Partial Relevance" counts less?
                // Or just count +1? 
                // Let's use accumulated weight as "Effective Practice Count" for this scene.
                // If a scene has weight 0.5 in a theme, doing it twice = 1 full practice.
                stats.rawCount += v.weight;
            });
        });

        const K = 5; // Mastery Constant: Need ~5 full practices to reach 50% of true accuracy potential.

        const abilityRadar = Array.from(sceneStats.entries()).map(([sceneId, stats]) => {
            const accuracy = stats.totalWeight > 0 ? stats.totalWeightedScore / stats.totalWeight : 0;
            const count = Math.round(stats.rawCount * 10) / 10; // Round to 1 decimal

            // Bayesian-like Mastery Score
            // If count is low, score is suppressed.
            // If count is high, score approaches accuracy.
            const masteryScore = accuracy * (count / (count + K));

            return {
                scene_id: sceneId,
                scene_name: sceneNameMap.get(sceneId) || sceneId,
                score: Math.round(masteryScore), // Display Score (Mastery)
                accuracy: Math.round(accuracy),  // True Accuracy
                count: count,                    // Effective Practice Count
                fullMark: 100
            };
        }).sort((a, b) => b.score - a.score).slice(0, 12); // Top 12 scenes (User has ~10)


        // --- Recent Accuracy ---
        // Last 20 attempts
        const recentAccuracy = shadowingAttempts
            .slice(0, 20)
            .reverse() // Oldest to newest
            .map(attempt => {
                let score = 0;
                if (attempt.metrics && typeof attempt.metrics === 'object') {
                    if ('score' in attempt.metrics) score = Number(attempt.metrics.score);
                    else if ('accuracy' in attempt.metrics) score = Number(attempt.metrics.accuracy) * 100;
                }
                // Fallback to metrics.completedAt if created_at is missing or invalid
                let dateStr = attempt.created_at;
                if (attempt.metrics && typeof attempt.metrics === 'object' && 'completedAt' in attempt.metrics) {
                    if (!dateStr || new Date(dateStr).toString() === 'Invalid Date') {
                        dateStr = attempt.metrics.completedAt;
                    }
                }

                return {
                    date: dateStr,
                    score: Math.round(score)
                };
            });


        // --- Learning Activity ---
        // Count attempts per day (last 30 days)
        const activityMap = new Map<string, number>();
        const now = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        shadowingAttempts.forEach(attempt => {
            const date = new Date(attempt.created_at);
            if (date < thirtyDaysAgo) return;

            const dateStr = date.toISOString().split('T')[0];
            activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
        });

        // Fetch Shadowing Sessions (to supplement activity data)
        const { data: shadowingSessions, error: sessionsError } = await supabase
            .from('shadowing_sessions')
            .select('id, updated_at, status')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });

        if (sessionsError) {
            console.error('Error fetching shadowing sessions:', sessionsError);
        }

        // Merge sessions into activity map
        shadowingSessions?.forEach(session => {
            const date = new Date(session.updated_at);
            if (date < thirtyDaysAgo) return;

            const dateStr = date.toISOString().split('T')[0];
            // Only increment if we haven't counted this day from attempts (or just sum them? usually attempts are more granular)
            // Let's just sum them for now, or use a Set to count unique interactions if we had timestamps.
            // Since we don't have exact timestamps matching attempts, let's just ensure the day has activity.
            // Actually, let's count sessions as activity too.
            activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
        });

        // Fill in missing days
        const activityChart = [];
        for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            activityChart.push({
                date: dateStr,
                count: activityMap.get(dateStr) || 0
            });
        }

        // --- Summary Stats ---
        // Use the larger of attempts or sessions for "Total Attempts" (or sum them? No, sessions are unique items, attempts are tries)
        // If attempts are 0 but sessions > 0, show sessions count.
        const totalAttempts = Math.max(shadowingAttempts.length, shadowingSessions?.length || 0);

        // --- Score Distribution ---
        // Buckets: 0-59 (Needs Practice), 60-79 (Fair), 80-89 (Good), 90-100 (Excellent)
        const scoreDistribution = [
            { name: '需练习 (0-59)', range: '0-59', count: 0, fill: '#ef4444' }, // Red-500
            { name: '一般 (60-79)', range: '60-79', count: 0, fill: '#f59e0b' }, // Amber-500
            { name: '良好 (80-89)', range: '80-89', count: 0, fill: '#3b82f6' }, // Blue-500
            { name: '优秀 (90-100)', range: '90-100', count: 0, fill: '#22c55e' }, // Green-500
        ];

        shadowingAttempts.forEach(attempt => {
            if (attempt.metrics && typeof attempt.metrics === 'object') {
                // Check for sentence-level scores first
                if ('sentenceScores' in attempt.metrics && typeof attempt.metrics.sentenceScores === 'object') {
                    const scores = Object.values(attempt.metrics.sentenceScores as Record<string, any>);
                    scores.forEach(s => {
                        const score = Number(s.score);
                        if (!isNaN(score)) {
                            if (score >= 90) scoreDistribution[3].count++;
                            else if (score >= 80) scoreDistribution[2].count++;
                            else if (score >= 60) scoreDistribution[1].count++;
                            else scoreDistribution[0].count++;
                        }
                    });
                } else {
                    // Fallback to overall score if no sentence details
                    let score = 0;
                    if ('score' in attempt.metrics) {
                        score = Number(attempt.metrics.score);
                    } else if ('accuracy' in attempt.metrics) {
                        const acc = Number(attempt.metrics.accuracy);
                        score = acc > 1 ? acc : acc * 100;
                    }

                    // Ensure score is valid
                    if (!isNaN(score)) {
                        if (score >= 90) scoreDistribution[3].count++;
                        else if (score >= 80) scoreDistribution[2].count++;
                        else if (score >= 60) scoreDistribution[1].count++;
                        else scoreDistribution[0].count++;
                    }
                }
            }
        });

        return NextResponse.json({
            abilityRadar,
            recentAccuracy,
            activityChart,
            scoreDistribution,
            stats: {
                totalAttempts,
                totalDays: activityMap.size,
            }
        });

    } catch (error) {
        console.error('Error in user stats API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
