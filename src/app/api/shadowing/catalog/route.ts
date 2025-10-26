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
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      // 优先从请求头的 cookie 解析（客户端 fetch 转发 cookie 时更直接），退回到 cookies() API
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
            set() {},
            remove() {},
          },
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
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (process.env.NODE_ENV !== 'production') {
      console.log('Auth check:', { user: user?.id, error: authError?.message, hasBearer });
    }
    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Authentication failed:', authError);
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户权限
    const permissions = await getUserPermissions(user.id);
    if (process.env.NODE_ENV !== 'production') {
      console.log('User permissions:', permissions);
    }

    // 检查是否有访问Shadowing的权限
    if (!checkAccessPermission(permissions, 'can_access_shadowing')) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('User does not have shadowing access permission, permissions:', permissions);
      }
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');
    const level = url.searchParams.get('level');
    const practiced = url.searchParams.get('practiced'); // 'true', 'false', or null (all)
    const since = url.searchParams.get('since'); // for incremental syncing
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam))) : null; // 缺省不分页
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam)) : 0;

    // 使用优化的 PostgreSQL 函数进行单次查询
    // 性能提升：从 2-5秒 降至 250-650ms（8-20倍）
    const result = await (async () => {
      // 检查语言权限
      if (lang && !checkLanguagePermission(permissions, lang)) {
        if (process.env.NODE_ENV !== 'production') {
          console.log(
            'User does not have permission for language:',
            lang,
            'allowed languages:',
            permissions.allowed_languages,
          );
        }
        return {
          success: true,
          items: [],
          total: 0,
        };
      }

      // 检查等级权限
      if (level) {
        const levelNum = parseInt(level);
        if (!checkLevelPermission(permissions, levelNum)) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              'User does not have permission for level:',
              levelNum,
              'allowed levels:',
              permissions.allowed_levels,
            );
          }
          return {
            success: true,
            items: [],
            total: 0,
          };
        }
      }

      // 调用优化的数据库函数（使用 JOIN 和聚合，单次查询）
      // 传递权限参数以在数据库层面完成过滤，确保分页正确
      const { data: rawItems, error } = await supabase.rpc('get_shadowing_catalog', {
        p_user_id: user.id,
        p_lang: lang || null,
        p_level: level ? parseInt(level) : null,
        p_practiced: practiced || null,
        p_limit: limit || 100,
        p_offset: offset || 0,
        p_since: since || null,
        p_allowed_languages: lang ? null : permissions.allowed_languages,
        p_allowed_levels: level ? null : permissions.allowed_levels,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('Optimized query result:', {
          itemsCount: rawItems?.length || 0,
          error: error?.message,
          queryParams: { lang, level, practiced, limit, offset },
        });
      }

      if (error) {
        console.error('Database query error:', error);
        throw new Error(
          `Error fetching shadowing catalog: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // 定义数据库返回的类型
      type DbCatalogItem = {
        id: string;
        lang: string;
        level: number;
        title: string;
        text: string;
        audio_url: string | null;
        audio_bucket: string | null;
        audio_path: string | null;
        sentence_timeline: unknown;
        topic: string | null;
        genre: string | null;
        register: string | null;
        notes: { audio_url?: string } | null;
        translations: unknown;
        trans_updated_at: string | null;
        ai_provider: string | null;
        ai_model: string | null;
        ai_usage: unknown;
        status: string;
        theme_id: string | null;
        subtopic_id: string | null;
        created_at: string;
        updated_at: string;
        theme_title: string | null;
        theme_desc: string | null;
        subtopic_title: string | null;
        subtopic_one_line: string | null;
        session_status: string | null;
        last_practiced: string | null;
        recording_count: number;
        vocab_count: number;
        practice_time_seconds: number;
        is_practiced: boolean;
        total_count: string | number; // Window function returns bigint
      };

      // 转换数据库函数返回的扁平结构为前端期望的嵌套结构
      const processedItems = (rawItems || []).map((item: DbCatalogItem) => {
        // 构建 theme 对象
        const theme = item.theme_title ? {
          id: item.theme_id,
          title: item.theme_title,
          desc: item.theme_desc,
        } : null;

        // 构建 subtopic 对象
        const subtopic = item.subtopic_title ? {
          id: item.subtopic_id,
          title: item.subtopic_title,
          one_line: item.subtopic_one_line,
        } : null;

        // 计算展示用状态：优先使用用户 session 状态（可为 draft|completed）
        const effectiveStatus = (item.session_status as string | null) || (item.status as string | null) || null;

        // 构建最终的 item 对象
        return {
          id: item.id,
          lang: item.lang,
          level: item.level,
          title: item.title,
          text: item.text,
          sentence_timeline: item.sentence_timeline || null,
          topic: item.topic,
          genre: item.genre,
          register: item.register,
          notes: item.notes,
          translations: item.translations,
          trans_updated_at: item.trans_updated_at,
          ai_provider: item.ai_provider,
          ai_model: item.ai_model,
          ai_usage: item.ai_usage,
          status: effectiveStatus,
          theme_id: item.theme_id,
          subtopic_id: item.subtopic_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
          
          // 构建 audio_url（优先级：url > notes > storage）
          audio_url:
            item.audio_url ||
            (item.notes && item.notes.audio_url) ||
            (item.audio_bucket && item.audio_path
              ? `/api/storage-proxy?path=${item.audio_path}&bucket=${item.audio_bucket}`
              : null),
          
          // 嵌套对象
          theme,
          subtopic,
          
          // 练习状态
          isPracticed: item.is_practiced || false,
          
          // 统计信息（已由数据库计算好）
          stats: {
            recordingCount: item.recording_count || 0,
            vocabCount: item.vocab_count || 0,
            practiceTime: item.practice_time_seconds || 0,
            lastPracticed: item.last_practiced || null,
          },
        };
      });

      // 权限过滤已在数据库层面完成，无需应用层过滤
      // 这确保了分页的正确性：LIMIT/OFFSET 在过滤后的数据集上应用
      
      // 获取总记录数（从任意一条记录中获取，所有记录的 total_count 都相同）
      const totalCount = rawItems && rawItems.length > 0 
        ? parseInt(String(rawItems[0].total_count))
        : 0;
      
      const result = {
        success: true,
        items: processedItems,
        total: totalCount, // 使用窗口函数计算的真实总数
        limit: limit ?? undefined,
        offset: limit != null ? offset : undefined,
      } as const;

      if (process.env.NODE_ENV !== 'production') {
        console.log('Final result:', {
          returnedItemsCount: processedItems.length,
          totalCount: totalCount,
          permissions: {
            can_access_shadowing: permissions.can_access_shadowing,
            allowed_languages: permissions.allowed_languages,
            allowed_levels: permissions.allowed_levels,
          },
          pagination: { limit, offset },
          since: since || 'none',
        });
      }

      return result;
    })();

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in shadowing catalog API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
