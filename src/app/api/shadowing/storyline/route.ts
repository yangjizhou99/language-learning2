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
            return NextResponse.json({ themes: [], lastPractice: null });
        }
        if (level) {
            const lvl = parseInt(level);
            if (!checkLevelPermission(permissions, lvl)) {
                return NextResponse.json({ themes: [], lastPractice: null });
            }
        }

        // 0. 获取用户最后一次做题记录（分步查询避免复杂join）
        let lastPractice: {
            themeId: string;
            subtopicId: string;
            itemId: string;
            lang: string;
            level: number
        } | null = null;

        // Step 1: 获取最新的 session
        const { data: lastSession } = await supabase
            .from('shadowing_sessions')
            .select('id, item_id, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (lastSession?.item_id) {
            // Step 2: 获取 item 对应的 subtopic
            const { data: item } = await supabase
                .from('shadowing_items')
                .select('id, subtopic_id')
                .eq('id', lastSession.item_id)
                .single();

            if (item?.subtopic_id) {
                // Step 3: 获取 subtopic 对应的 theme
                const { data: subtopic } = await supabase
                    .from('shadowing_subtopics')
                    .select('id, theme_id')
                    .eq('id', item.subtopic_id)
                    .single();

                if (subtopic?.theme_id) {
                    // Step 4: 获取 theme 的语言和等级
                    const { data: theme } = await supabase
                        .from('shadowing_themes')
                        .select('id, lang, level')
                        .eq('id', subtopic.theme_id)
                        .single();

                    if (theme) {
                        lastPractice = {
                            themeId: theme.id,
                            subtopicId: subtopic.id,
                            itemId: item.id,
                            lang: theme.lang,
                            level: theme.level
                        };
                    }
                }
            }
        }

        // 1. 获取所有活跃的主题（不分页，因为需要按进度排序）
        let themesQuery = supabase
            .from('shadowing_themes')
            .select('id, title, desc, lang, level, genre, created_at')
            .eq('status', 'active');

        if (lang) themesQuery = themesQuery.eq('lang', lang);
        if (level) themesQuery = themesQuery.eq('level', parseInt(level));

        const { data: themes, error: themesError } = await themesQuery
            .order('level', { ascending: true })
            .order('created_at', { ascending: true });
        if (themesError) {
            console.error('Themes query error:', themesError);
            return NextResponse.json({ error: 'Failed to load themes' }, { status: 400 });
        }

        if (!themes || themes.length === 0) {
            return NextResponse.json({ themes: [], lastPractice });
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

        // Run items, sessions, and vectors queries in PARALLEL
        const batchSize = 100; // Increased batch size for fewer round trips

        // Prepare batch queries for items
        const itemBatches: PromiseLike<any>[] = [];
        for (let i = 0; i < subtopicIds.length; i += batchSize) {
            const batch = subtopicIds.slice(i, i + batchSize);
            itemBatches.push(
                supabase
                    .from('shadowing_items')
                    .select('id, subtopic_id')
                    .in('subtopic_id', batch)
            );
        }

        // Prepare batch queries for scene vectors
        const vectorBatches: PromiseLike<any>[] = [];
        for (let i = 0; i < subtopicIds.length; i += batchSize) {
            const batch = subtopicIds.slice(i, i + batchSize);
            vectorBatches.push(
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

        // Sessions query
        const sessionsPromise = supabase
            .from('shadowing_sessions')
            .select('item_id, notes, recordings')
            .eq('user_id', user.id)
            .eq('status', 'completed');

        // Execute ALL queries in parallel
        const [itemResults, vectorResults, sessionsResult] = await Promise.all([
            Promise.all(itemBatches),
            Promise.all(vectorBatches),
            sessionsPromise
        ]);

        // 3. Process items
        let items: { id: string; subtopic_id: string | null }[] = [];
        for (const { data: itemsData, error: itemsError } of itemResults) {
            if (itemsError) {
                console.error('Items query error:', itemsError);
            } else if (itemsData) {
                items = [...items, ...itemsData];
            }
        }

        // 4. 获取用户的练习记录 (包含分数信息)
        const practicedItemsMap = new Map<string, number>(); // itemId -> score

        if (sessionsResult.error) {
            console.error('Sessions query error:', sessionsResult.error);
        }

        const allSessions = sessionsResult.data || [];

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
        const subtopicScenesMap = new Map<string, { id: string; name: string; weight: number }[]>();
        let allVectors: any[] = [];
        let needsFallback = false;

        for (const { data: vectors, error: vectorsError } of vectorResults) {
            if (vectorsError) {
                // Check if this is a foreign key relationship error
                if (vectorsError.code === 'PGRST200') {
                    needsFallback = true;
                    console.warn('Scene vectors foreign key missing, using fallback query');
                } else {
                    console.error('Scene vectors query error:', vectorsError);
                }
            } else if (vectors) {
                allVectors = [...allVectors, ...vectors];
            }
        }

        // Fallback: If foreign key relationship is missing, fetch scene_tags separately
        if (needsFallback && subtopicIds.length > 0) {
            try {
                // Get vectors without join
                const { data: rawVectors } = await supabase
                    .from('subtopic_scene_vectors')
                    .select('subtopic_id, scene_id, weight')
                    .in('subtopic_id', subtopicIds)
                    .order('weight', { ascending: false });

                if (rawVectors && rawVectors.length > 0) {
                    // Get unique scene_ids
                    const sceneIds = [...new Set(rawVectors.map((v: any) => v.scene_id))];

                    // Fetch scene_tags separately
                    const { data: sceneTags } = await supabase
                        .from('scene_tags')
                        .select('scene_id, name_cn')
                        .in('scene_id', sceneIds);

                    // Create a lookup map
                    const sceneTagsMap = new Map<string, string>();
                    (sceneTags || []).forEach((tag: any) => {
                        sceneTagsMap.set(tag.scene_id, tag.name_cn);
                    });

                    // Transform vectors to expected format
                    allVectors = rawVectors.map((v: any) => ({
                        subtopic_id: v.subtopic_id,
                        weight: v.weight,
                        scene: {
                            scene_id: v.scene_id,
                            name_cn: sceneTagsMap.get(v.scene_id) || v.scene_id
                        }
                    }));
                }
            } catch (fallbackError) {
                console.error('Scene vectors fallback query error:', fallbackError);
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

        // 按进度排序：进行中 > 已完成 > 未开始，同等级内按此排序
        const sortedResult = filteredResult.sort((a, b) => {
            // 先按等级排序
            if (a.level !== b.level) return a.level - b.level;

            // 计算进度状态：2=进行中, 1=已完成, 0=未开始
            const getProgressStatus = (t: typeof a) => {
                if (t.progress.completed > 0 && t.progress.completed < t.progress.total) return 2; // 进行中
                if (t.progress.completed === t.progress.total && t.progress.total > 0) return 1; // 已完成
                return 0; // 未开始
            };

            return getProgressStatus(b) - getProgressStatus(a);
        });

        return NextResponse.json({
            themes: sortedResult,
            lastPractice
        });
    } catch (error) {
        console.error('Error in shadowing storyline API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
