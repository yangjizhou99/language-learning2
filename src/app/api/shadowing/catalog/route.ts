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
    let supabase: any;
    
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
    console.log('Auth check:', { user: user?.id, error: authError?.message, hasBearer });
    if (authError || !user) {
      console.log('Authentication failed:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const lang = url.searchParams.get('lang');
    const level = url.searchParams.get('level'); 
    const practiced = url.searchParams.get('practiced'); // 'true', 'false', or null (all)

    // 直接查询，不使用缓存
    const result = await (async () => {
      // Build query for shadowing drafts
      let query = supabase
        .from('shadowing_drafts')
        .select(`
          id,
          lang,
          level,
          title,
          text,
          topic,
          genre,
          notes,
          ai_provider,
          ai_model,
          ai_usage,
          status,
          created_at,
          theme_id,
          subtopic_id
        `);

      // Apply filters
      if (lang) {
        query = query.eq('lang', lang);
      }
      if (level) {
        query = query.eq('level', level);
      }
      // 只显示已审核的内容
      query = query.eq('status', 'approved');

      const { data: items, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Database query error:', error);
        throw new Error(`Error fetching shadowing catalog: ${error.message}`);
      }

      // Get theme and subtopic data separately
      const themeIds = [...new Set(items?.map((item: any) => item.theme_id).filter(Boolean) || [])];
      const subtopicIds = [...new Set(items?.map((item: any) => item.subtopic_id).filter(Boolean) || [])];
      
      let themes: any[] = [];
      let subtopics: any[] = [];
      
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
          .select('id, title_cn, one_line_cn')
          .in('id', subtopicIds);
        subtopics = subtopicsData || [];
      }

      // Get session data separately
      const itemIds = items?.map((item: any) => item.id) || [];
      let sessions: any[] = [];
      
      if (itemIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from('shadowing_sessions')
          .select('id, user_id, item_id, status, recordings, picked_preview, created_at')
          .eq('user_id', user.id)
          .in('item_id', itemIds);
        sessions = sessionsData || [];
      }

      // Process items with session data
      const processedItems = items?.map((item: any) => {
        // Find the user's session for this item
        const userSession = sessions.find((session: any) => 
          session.item_id === item.id
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
        
        // Find theme and subtopic data
        const theme = themes.find(t => t.id === item.theme_id);
        const subtopic = subtopics.find(s => s.id === item.subtopic_id);
        
        return {
          ...item,
          theme,
          subtopic,
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
    })();

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in shadowing catalog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
