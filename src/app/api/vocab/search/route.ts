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
    let supabase: any;

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
          set() {},
          remove() {},
        },
      });
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const term = url.searchParams.get('term');

    if (!term) {
      return NextResponse.json({ error: 'term parameter is required' }, { status: 400 });
    }

    console.log('Searching for term:', term, 'user_id:', user.id);

    // Search for vocabulary entries - first try exact match, then fuzzy match
    // 只选择必要字段减少数据传输
    const selectFields = 'id,term,definition,pronunciation,examples,lang,created_at,updated_at';

    let { data: entries, error } = await supabase
      .from('vocab_entries')
      .select(selectFields)
      .eq('user_id', user.id)
      .eq('term', term)
      .order('created_at', { ascending: false })
      .limit(10);

    // If no exact match found, try fuzzy match
    if (!entries || entries.length === 0) {
      const { data: fuzzyEntries, error: fuzzyError } = await supabase
        .from('vocab_entries')
        .select(selectFields)
        .eq('user_id', user.id)
        .ilike('term', `%${term}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!fuzzyError) {
        entries = fuzzyEntries;
        error = null;
      } else {
        error = fuzzyError;
      }
    }

    if (error) {
      console.error('Error searching vocabulary:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      entries: entries || [],
    });
  } catch (error) {
    console.error('Error in vocab search API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
