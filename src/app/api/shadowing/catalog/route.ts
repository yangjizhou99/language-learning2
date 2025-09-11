export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');
    const level = url.searchParams.get('level'); 
    const practiced = url.searchParams.get('practiced'); // 'true', 'false', or null (all)

    // 生成缓存键（包含用户ID以确保用户数据隔离）
    const cacheKey = CacheManager.generateKey("shadowing:catalog", { 
      userId: user.id, 
      lang, 
      level, 
      practiced 
    });
    
    // 尝试从缓存获取
    const cached = await CacheManager.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 使用请求去重防止并发请求
    const result = await CacheManager.dedupe(cacheKey, async () => {
      // Build query for shadowing items with session data
      let query = supabase
        .from('shadowing_items')
        .select(`
          id,
          lang,
          level,
          title,
          text,
          audio_url,
          duration_ms,
          tokens,
          cefr,
          meta,
          translations,
          trans_updated_at,
          created_at,
          shadowing_sessions!left(
            id,
            user_id,
            status,
            recordings,
            picked_preview,
            created_at
          )
        `);

      // Apply filters
      if (lang) {
        query = query.eq('lang', lang);
      }
      if (level) {
        query = query.eq('level', level);
      }

      const { data: items, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching shadowing catalog: ${error.message}`);
      }

      // Process items with session data
      const processedItems = items?.map((item: any) => {
        // Find the user's session for this item
        const userSession = item.shadowing_sessions?.find((session: any) => 
          session.user_id === user.id
        );
        
        const isPracticed = userSession?.status === 'completed';
        const recordings = userSession?.recordings || [];
        const selectedWords = userSession?.picked_preview || [];
        
        // Calculate practice time from recordings (duration is already in milliseconds)
        let practiceTime = 0;
        if (recordings && recordings.length > 0) {
          practiceTime = recordings.reduce((total: number, recording: any) => {
            console.log('录音时长:', recording.duration, '毫秒');
            return total + (recording.duration || 0);
          }, 0);
          console.log('总练习时长:', practiceTime, '毫秒 =', Math.floor(practiceTime / 1000), '秒');
        }
        
        return {
          ...item,
          isPracticed,
          status: userSession?.status || null,
          stats: {
            recordingCount: recordings.length,
            vocabCount: selectedWords.length,
            practiceTime: Math.floor(practiceTime / 1000), // Convert milliseconds to seconds
            lastPracticed: userSession?.created_at || null
          }
        };
      }) || [];

      // Filter by practice status if specified
      let filteredItems = processedItems;
      if (practiced === 'true') {
        filteredItems = processedItems.filter((item: any) => item.isPracticed);
      } else if (practiced === 'false') {
        filteredItems = processedItems.filter((item: any) => !item.isPracticed);
      }

      return {
        success: true,
        items: filteredItems,
        total: filteredItems.length
      };
    });

    // 缓存结果（2分钟，因为包含用户数据）
    await CacheManager.set(cacheKey, result, 120);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in shadowing catalog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
