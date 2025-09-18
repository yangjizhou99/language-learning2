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
    console.log('Auth header:', authHeader);
    console.log('Has bearer:', hasBearer);

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
    console.log('Auth check:', { user: user?.id, error: authError?.message, hasBearer });

    // Also try to get session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    console.log('Session check:', {
      session: session ? 'exists' : 'null',
      error: sessionError?.message,
    });

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          details: authError?.message,
          sessionError: sessionError?.message,
          hasBearer,
          authHeader: authHeader.substring(0, 20) + '...',
          cookies: req.headers.get('cookie') ? 'present' : 'missing',
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
      hasBearer,
      authHeader: authHeader.substring(0, 20) + '...',
    });
  } catch (error) {
    console.error('Error in test auth API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
