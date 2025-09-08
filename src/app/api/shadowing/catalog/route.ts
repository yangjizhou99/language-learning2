export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

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

    // Build query for shadowing items (simplified without sessions for now)
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
        created_at
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
      console.error('Error fetching shadowing catalog:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }


    // Process items (simplified without session data for now)
    const processedItems = items?.map((item: any) => ({
      ...item,
      isPracticed: false, // Default to not practiced
      stats: {
        recordingCount: 0,
        vocabCount: 0,
        practiceTime: 0,
        lastPracticed: null
      }
    })) || [];

    // Filter by practice status if specified
    let filteredItems = processedItems;
    if (practiced === 'true') {
      filteredItems = processedItems.filter(item => item.isPracticed);
    } else if (practiced === 'false') {
      filteredItems = processedItems.filter(item => !item.isPracticed);
    }

    return NextResponse.json({
      success: true,
      items: filteredItems,
      total: filteredItems.length
    });

  } catch (error) {
    console.error('Error in shadowing catalog API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
