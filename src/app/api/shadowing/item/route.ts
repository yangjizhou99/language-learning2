export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else if (cookieHeader) {
      const cookieMap = new Map<string, string>();
      cookieHeader.split(';').forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        const key = k.trim();
        const value = rest.join('=').trim();
        if (key) cookieMap.set(key, value);
      });
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        },
      );
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        },
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    // 使用服务端密钥查询，避免RLS导致前端拿不到题面
    const supabaseAdmin = getServiceSupabase();
    type ItemRow = {
      id: string;
      lang: string;
      level: number;
      title: string;
      text: string;
      audio_url: string | null;
      audio_bucket: string | null;
      audio_path: string | null;
      notes: { audio_url?: string } | null;
      audio_url_proxy: string | null;
      duration_ms: number | null;
      tokens: number | null;
      cefr: string | null;
      meta: unknown;
      translations: unknown;
      trans_updated_at: string | null;
      created_at: string;
      sentence_timeline: unknown;
      theme_id?: string | null;
      subtopic_id?: string | null;
    };

    const { data, error } = await supabaseAdmin
      .from('shadowing_items')
      .select(
        'id, lang, level, title, text, audio_url, audio_bucket, audio_path, notes, audio_url_proxy, duration_ms, tokens, cefr, meta, translations, trans_updated_at, created_at, sentence_timeline',
      )
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const row = data as ItemRow;
    const audioUrl =
      row.audio_url_proxy || row.audio_url || row.notes?.audio_url ||
      (row.audio_bucket && row.audio_path
        ? `/api/storage-proxy?path=${encodeURIComponent(row.audio_path)}&bucket=${encodeURIComponent(row.audio_bucket)}`
        : null);

    const item = {
      ...(row as Record<string, unknown>),
      audio_url: audioUrl,
    };

    return NextResponse.json({ item });
  } catch (e) {
    console.error('item api failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}


