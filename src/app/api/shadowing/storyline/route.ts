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

        // 1. 获取最后一次练习记录 (Keep purely for "Default Expanded" logic)
        // This is a fast single-row query with indexes
        const getLastPractice = async () => {
            const { data: lastSession } = await supabase
                .from('shadowing_sessions')
                .select(`
                    item_id,
                    shadowing_items!inner(
                        id,
                        subtopic_id,
                        shadowing_subtopics!inner(
                            id,
                            theme_id,
                            shadowing_themes!inner(
                                id,
                                lang,
                                level
                            )
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (lastSession?.shadowing_items) {
                const item = lastSession.shadowing_items as any;
                const subtopic = item.shadowing_subtopics;
                const theme = subtopic?.shadowing_themes;

                if (theme) {
                    return {
                        themeId: theme.id,
                        subtopicId: subtopic.id,
                        itemId: item.id,
                        lang: theme.lang,
                        level: theme.level
                    };
                }
            }
            return null;
        };

        // 2. Fetch Storyline Data via Optimized RPC
        // The RPC returns aggregated json for themes, subtopics, and progress
        const getStorylineData = async () => {
            const { data, error } = await supabase.rpc('get_storyline_complete', {
                p_user_id: user.id,
                p_lang: lang || null,
                p_level: level ? parseInt(level) : null
            });
            return { data, error };
        };

        // Run in parallel
        const [lastPracticeResult, storylineResult] = await Promise.all([
            getLastPractice(),
            getStorylineData()
        ]);

        if (storylineResult.error) {
            console.error('Storyline RPC error:', storylineResult.error);
            return NextResponse.json({ error: 'Failed to load storyline' }, { status: 500 });
        }

        // Sort Helper (The RPC already sorts by Level/Created, but we need dynamic sorting by status)
        // RPC relies on 'order by' in SQL.
        // We might want to re-sort here if the SQL sort wasn't dynamic enough (SQL sorted by level/date).
        // The Requirement: "进行中 > 已完成 > 未开始".
        // We can do this sort in JS quickly since the payload is now small (aggregated).
        let themes = storylineResult.data || [];

        // Dynamic Sort for UI Priority
        themes = themes.sort((a: any, b: any) => {
            // 1. Level Ascending
            if (a.level !== b.level) return a.level - b.level;

            // 2. Status Priority: In Progress (2) > Completed (1) > Not Started (0)
            const getStatus = (t: any) => {
                const { completed, total } = t.progress;
                if (completed > 0 && completed < total) return 2;
                if (completed === total && total > 0) return 1;
                return 0;
            };
            return getStatus(b) - getStatus(a);
        });

        return NextResponse.json({
            themes,
            lastPractice: lastPracticeResult
        });

    } catch (error) {
        console.error('Error in shadowing storyline API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

