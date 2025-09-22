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

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }) as unknown as SupabaseClient;
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log('Auth check:', { user: user?.id, error: authError?.message, hasBearer });
    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户权限
    const permissions = await getUserPermissions(user.id);
    console.log('User permissions:', permissions);

    // 检查是否有访问Shadowing的权限
    if (!checkAccessPermission(permissions, 'can_access_shadowing')) {
      console.log('User does not have shadowing access permission, permissions:', permissions);
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');
    const level = url.searchParams.get('level');
    const practiced = url.searchParams.get('practiced'); // 'true', 'false', or null (all)
    const since = url.searchParams.get('since');

    // 直接查询，不使用缓存
    const result = await (async () => {
      // Build query for shadowing items
      let query = supabase.from('shadowing_items').select(`
          id,
          lang,
          level,
          title,
          text,
          audio_url,
          audio_url_proxy,
          audio_bucket,
          audio_path,
          topic,
          genre,
          register,
          notes,
          translations,
          trans_updated_at,
          ai_provider,
          ai_model,
          ai_usage,
          status,
          theme_id,
          subtopic_id,
          created_at,
          updated_at
        `);

      // Apply filters
      if (lang) {
        // 检查语言权限
        if (!checkLanguagePermission(permissions, lang)) {
          console.log(
            'User does not have permission for language:',
            lang,
            'allowed languages:',
            permissions.allowed_languages,
          );
          return {
            success: true,
            items: [],
            total: 0,
          };
        }
        query = query.eq('lang', lang);
      }
      if (level) {
        const levelNum = parseInt(level);
        // 检查等级权限
        if (!checkLevelPermission(permissions, levelNum)) {
          console.log(
            'User does not have permission for level:',
            levelNum,
            'allowed levels:',
            permissions.allowed_levels,
          );
          return {
            success: true,
            items: [],
            total: 0,
          };
        }
        query = query.eq('level', levelNum);
      }
      // 只显示已审核的内容（shadowing_items 表中 status='approved' 的记录）
      query = query.eq('status', 'approved');

      if (since) {
        query = query.gt('updated_at', since).order('updated_at', { ascending: true }).limit(500);
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data: items, error } = await query;

      console.log('Database query result:', {
        itemsCount: items?.length || 0,
        error: error?.message,
        queryParams: { lang, level, status: 'approved' },
      });

      if (error) {
        console.error('Database query error:', error);
        throw new Error(
          `Error fetching shadowing catalog: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Get theme and subtopic data separately
      const themeIds = [...new Set((items || []).map((item: { theme_id?: string | null }) => item.theme_id).filter(Boolean))];
      const subtopicIds = [
        ...new Set((items || []).map((item: { subtopic_id?: string | null }) => item.subtopic_id).filter(Boolean)),
      ];

      let themes: Array<{ id: string; title: string; desc?: string } > = [];
      let subtopics: Array<{ id: string; title: string; one_line?: string } > = [];

      if (themeIds.length > 0) {
        const { data: themesData } = await supabase
          .from('shadowing_themes')
          .select('id, title, desc')
          .in('id', themeIds);
        themes = themesData || [];
      }

      if (subtopicIds.length > 0) {
        const { data: subtopicsData } = await supabase
          .from('shadowing_subtopics')
          .select('id, title, one_line')
          .in('id', subtopicIds);
        subtopics = subtopicsData || [];
      }

      // Get session data separately
      const itemIds = (items || []).map((item: { id: string }) => item.id);
      let sessions: Array<{ item_id: string; status: 'draft' | 'completed' | null; recordings?: Array<{ duration?: number }>; picked_preview?: unknown[]; created_at?: string | null }> = [];

      if (itemIds.length > 0 && user) {
        const { data: sessionsData } = await supabase
          .from('shadowing_sessions')
          .select('id, user_id, item_id, status, recordings, picked_preview, created_at')
          .eq('user_id', user.id)
          .in('item_id', itemIds);
        sessions = sessionsData || [];
      }

      // Process items with session data
      type ItemRow = { id: string; lang: string; level: number; title: string; text: string; audio_url?: string | null; audio_url_proxy?: string | null; audio_bucket?: string | null; audio_path?: string | null; notes?: { audio_url?: string | null } | null; theme_id?: string | null; subtopic_id?: string | null };
      const processedItems =
        (items || []).map((item: ItemRow) => {
          // Find the user's session for this item
          const userSession = sessions.find((session) => session.item_id === item.id);

          const isPracticed = userSession?.status === 'completed';
          const recordings = (userSession?.recordings || []) as Array<{ duration?: number }>;
          const selectedWords = userSession?.picked_preview || [];

          // Calculate practice time from recordings (duration is already in milliseconds)
          let practiceTime = 0;
          if (recordings && recordings.length > 0) {
            practiceTime = recordings.reduce((total: number, recording: { duration?: number }) => {
              console.log('录音时长:', recording.duration, '毫秒');
              return total + (recording.duration || 0);
            }, 0);
            console.log(
              '总练习时长:',
              practiceTime,
              '毫秒 =',
              Math.floor(practiceTime / 1000),
              '秒',
            );
          }

          // Find theme and subtopic data
          const theme = themes.find((t) => t.id === item.theme_id);
          const subtopic = subtopics.find((s) => s.id === item.subtopic_id);

          return {
            ...item,
            audio_url:
              item.audio_url_proxy ||
              item.audio_url ||
              (item.notes && item.notes.audio_url) ||
              (item.audio_bucket && item.audio_path
                ? `/api/storage-proxy?path=${item.audio_path}&bucket=${item.audio_bucket}`
                : null),
            theme,
            subtopic,
            isPracticed,
            status: userSession?.status || null,
            stats: {
              recordingCount: recordings.length,
              vocabCount: selectedWords.length,
              practiceTime: Math.floor(practiceTime / 1000), // Convert milliseconds to seconds
              lastPracticed: userSession?.created_at || null,
            },
          };
        }) || [];

      // Filter by practice status if specified
      let filteredItems = processedItems as Array<{ isPracticed: boolean; level: number; lang: string }>;
      if (practiced === 'true') {
        filteredItems = processedItems.filter((item) => item.isPracticed);
      } else if (practiced === 'false') {
        filteredItems = processedItems.filter((item) => !item.isPracticed);
      }

      // 如果没有指定等级，过滤掉用户没有权限的等级
      if (!level) {
        console.log('Filtering by level permissions, allowed levels:', permissions.allowed_levels);
        filteredItems = filteredItems.filter((item) => {
          const hasPermission = checkLevelPermission(permissions, item.level);
          if (!hasPermission) {
            console.log('Filtering out item with level:', item.level);
          }
          return hasPermission;
        });
      }

      // 如果没有指定语言，过滤掉用户没有权限的语言
      if (!lang) {
        console.log(
          'Filtering by language permissions, allowed languages:',
          permissions.allowed_languages,
        );
        filteredItems = filteredItems.filter((item) => {
          const hasPermission = checkLanguagePermission(permissions, item.lang);
          if (!hasPermission) {
            console.log('Filtering out item with language:', item.lang);
          }
          return hasPermission;
        });
      }

      const result = {
        success: true,
        items: filteredItems,
        total: filteredItems.length,
      };

      console.log('Final result:', {
        originalItemsCount: items?.length || 0,
        filteredItemsCount: filteredItems.length,
        permissions: {
          can_access_shadowing: permissions.can_access_shadowing,
          allowed_languages: permissions.allowed_languages,
          allowed_levels: permissions.allowed_levels,
        },
      });

      return result;
    })();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in shadowing catalog API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
