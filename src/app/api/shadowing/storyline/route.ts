export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
    getUserPermissions,
    checkLevelPermission,
    checkLanguagePermission,
    checkAccessPermission,
} from '@/lib/user-permissions-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface SubtopicWithProgress {
    id: string;
    title: string;
    one_line: string | null;
    itemId: string | null;
    isPracticed: boolean;
    score: number | null;
    order: number;
    top_scenes: { id: string; name: string; weight: number }[];
}

interface ThemeWithSubtopics {
    id: string;
    title: string;
    desc: string | null;
    lang: string;
    level: number;
    genre: string;
    subtopics: SubtopicWithProgress[];
    progress: {
        completed: number;
        total: number;
    };
    averageScore: number | null;
}

export async function GET(req: NextRequest) {
    try {
        // Bearer 优先，其次 Cookie 方式
        const authHeader = req.headers.get('authorization') || '';
        const cookieHeader = req.headers.get('cookie') || '';
        const hasBearer = /^Bearer\s+/.test(authHeader);
        let supabase: SupabaseClient;

        if (hasBearer) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            }) as unknown as SupabaseClient;
        } else {
            if (cookieHeader) {
                const cookieMap = new Map<string, string>();
                cookieHeader.split(';').forEach((pair) => {
                    const [k, ...rest] = pair.split('=');
                    const key = k.trim();
                    const value = rest.join('=').trim();
                    if (key) cookieMap.set(key, value);
                });
                supabase = createServerClient(supabaseUrl, supabaseAnon, {
                    cookies: {
                        get(name: string) {
                            return cookieMap.get(name);
                        },
                        set() { },
                        remove() { },
                    },
                }) as unknown as SupabaseClient;
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
                }) as unknown as SupabaseClient;
            }
        }

        // 认证
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 权限
        const permissions = await getUserPermissions(user.id);
        if (!checkAccessPermission(permissions, 'can_access_shadowing')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // 查询参数
        const url = new URL(req.url);
        const lang = url.searchParams.get('lang');
        const level = url.searchParams.get('level');

        // 语言/等级权限校验
        if (lang && !checkLanguagePermission(permissions, lang)) {
            return NextResponse.json({ themes: [] });
        }
        if (level) {
            const lvl = parseInt(level);
            if (!checkLevelPermission(permissions, lvl)) {
                return NextResponse.json({ themes: [] });
            }
        }

        // 1. 获取所有活跃的主题
        let themesQuery = supabase
            .from('shadowing_themes')
            .select('id, title, desc, lang, level, genre, created_at')
            .eq('status', 'active');

        if (lang) themesQuery = themesQuery.eq('lang', lang);
        if (level) themesQuery = themesQuery.eq('level', parseInt(level));

        const { data: themes, error: themesError } = await themesQuery.order('created_at', { ascending: true });
        if (themesError) {
            console.error('Themes query error:', themesError);
            return NextResponse.json({ error: 'Failed to load themes' }, { status: 400 });
        }

        if (!themes || themes.length === 0) {
            return NextResponse.json({ themes: [] });
        }

        const themeIds = themes.map((t) => t.id);

        // 2. 获取所有相关的子主题
        const { data: subtopics, error: subtopicsError } = await supabase
            .from('shadowing_subtopics')
            .select('id, title, one_line, theme_id, created_at')
            .in('theme_id', themeIds)
            .eq('status', 'active')
            .order('created_at', { ascending: true });

        if (subtopicsError) {
            console.error('Subtopics query error:', subtopicsError);
            return NextResponse.json({ error: 'Failed to load subtopics' }, { status: 400 });
        }

        // 3. 获取所有相关的题目及其练习状态
        const subtopicIds = (subtopics || []).map((s) => s.id);

        let items: { id: string; subtopic_id: string | null }[] = [];
        if (subtopicIds.length > 0) {
            // Batch query for items
            const batchSize = 50;
            const itemPromises = [];
            for (let i = 0; i < subtopicIds.length; i += batchSize) {
                const batch = subtopicIds.slice(i, i + batchSize);
                itemPromises.push(
                    supabase
                        .from('shadowing_items')
                        .select('id, subtopic_id')
                        .in('subtopic_id', batch)
                );
            }

            const itemResults = await Promise.all(itemPromises);
            for (const { data: itemsData, error: itemsError } of itemResults) {
                if (itemsError) {
                    console.error('Items query error:', itemsError);
                } else if (itemsData) {
                    items = [...items, ...itemsData];
                }
            }
        }

        // 4. 获取用户的练习记录 (包含分数信息)
        let practicedItemsMap = new Map<string, number>(); // itemId -> score

        // Optimize: Fetch ALL completed sessions for this user.
        const { data: allSessionsData, error: sessionsError } = await supabase
            .from('shadowing_sessions')
            .select('item_id, notes, recordings')
            .eq('user_id', user.id)
            .eq('status', 'completed');

        if (sessionsError) {
            console.error('Sessions query error:', sessionsError);
        }

        const allSessions = allSessionsData || [];

        // Calculate scores for each session
        allSessions.forEach((session: any) => {
            let totalScore = 0;
            let count = 0;

            // Try to get scores from notes.sentence_scores first
            if (session.notes && session.notes.sentence_scores) {
                const scores = Object.values(session.notes.sentence_scores) as any[];
                if (scores.length > 0) {
                    // Calculate average of best scores
                    const sum = scores.reduce((acc: number, curr: any) => {
                        let score = curr.bestScore || curr.score || 0;
                        // Fix: If score is <= 1 (decimal), convert to percentage
                        if (score <= 1 && score > 0) score *= 100;
                        return acc + score;
                    }, 0);
                    totalScore = sum;
                    count = scores.length;
                }
            }

            // Fallback to recordings if no sentence_scores
            if (count === 0 && session.recordings && Array.isArray(session.recordings)) {
                const validRecordings = session.recordings.filter((r: any) => typeof r.score === 'number');
                if (validRecordings.length > 0) {
                    const sum = validRecordings.reduce((acc: number, curr: any) => {
                        let score = curr.score;
                        // Fix: If score is <= 1 (decimal), convert to percentage
                        if (score <= 1 && score > 0) score *= 100;
                        return acc + score;
                    }, 0);
                    totalScore = sum;
                    count = validRecordings.length;
                }
            }

            if (count > 0) {
                const avgScore = Math.round(totalScore / count);
                practicedItemsMap.set(session.item_id, avgScore);
            } else {
                // Mark as practiced but no score (e.g. 0)
                practicedItemsMap.set(session.item_id, 0);
            }
        });

        // 5. 获取小主题的场景向量（Top 2）
        let subtopicScenesMap = new Map<string, { id: string; name: string; weight: number }[]>();
        if (subtopicIds.length > 0) {
            // Batch query for vectors
            const batchSize = 50;
            let allVectors: any[] = [];
            const vectorPromises = [];

            for (let i = 0; i < subtopicIds.length; i += batchSize) {
                const batch = subtopicIds.slice(i, i + batchSize);
                vectorPromises.push(
                    supabase
                        .from('subtopic_scene_vectors')
                        .select(`
                             subtopic_id,
                             weight,
                             scene:scene_tags!inner(scene_id, name_cn)
                         `)
                        .in('subtopic_id', batch)
                        .order('weight', { ascending: false })
                );
            }

            const vectorResults = await Promise.all(vectorPromises);
            for (const { data: vectors, error: vectorsError } of vectorResults) {
                if (vectorsError) {
                    console.error('Scene vectors query error:', vectorsError);
                } else if (vectors) {
                    allVectors = [...allVectors, ...vectors];
                }
            }

            if (allVectors.length > 0) {
                allVectors.forEach((v: any) => {
                    const list = subtopicScenesMap.get(v.subtopic_id) || [];
                    if (list.length < 2) { // 只取前2个
                        list.push({
                            id: v.scene.scene_id,
                            name: v.scene.name_cn,
                            weight: v.weight
                        });
                        subtopicScenesMap.set(v.subtopic_id, list);
                    }
                });
            }
        }

        // 6. 构建返回数据结构
        // 创建 subtopic -> item 映射
        const subtopicToItem = new Map<string, string>();
        items.forEach((item) => {
            if (item.subtopic_id) {
                subtopicToItem.set(item.subtopic_id, item.id);
            }
        });

        // 按 theme 分组 subtopics
        const subtopicsByTheme = new Map<string, typeof subtopics>();
        (subtopics || []).forEach((s) => {
            const list = subtopicsByTheme.get(s.theme_id) || [];
            list.push(s);
            subtopicsByTheme.set(s.theme_id, list);
        });

        const result: ThemeWithSubtopics[] = themes.map((theme) => {
            const themeSubtopics = subtopicsByTheme.get(theme.id) || [];

            const subtopicsWithProgress: SubtopicWithProgress[] = themeSubtopics.map((s, index) => {
                const itemId = subtopicToItem.get(s.id) || null;
                const isPracticed = itemId ? practicedItemsMap.has(itemId) : false;
                const score = itemId && isPracticed ? practicedItemsMap.get(itemId)! : null;

                return {
                    id: s.id,
                    title: s.title,
                    one_line: s.one_line,
                    itemId,
                    isPracticed,
                    score,
                    order: index + 1,
                    top_scenes: subtopicScenesMap.get(s.id) || [],
                };
            });

            const completedSubtopics = subtopicsWithProgress.filter((s) => s.isPracticed);
            const completed = completedSubtopics.length;

            // Calculate theme average score
            let averageScore: number | null = null;
            if (completed > 0) {
                const totalScore = completedSubtopics.reduce((acc, curr) => acc + (curr.score || 0), 0);
                averageScore = Math.round(totalScore / completed);
            }

            return {
                id: theme.id,
                title: theme.title,
                desc: theme.desc,
                lang: theme.lang,
                level: theme.level,
                genre: theme.genre,
                subtopics: subtopicsWithProgress,
                progress: {
                    completed,
                    total: subtopicsWithProgress.length,
                },
                averageScore,
            };
        });

        // 过滤掉没有子主题的主题
        const filteredResult = result.filter((t) => t.subtopics.length > 0);

        return NextResponse.json({ themes: filteredResult });
    } catch (error) {
        console.error('Error in shadowing storyline API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
