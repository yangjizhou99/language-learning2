import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getUserPreferenceVectors } from '@/lib/recommendation/preferences';

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase;

    if (hasBearer) {
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            }
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
                },
            }
        );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('[Preferences API] Unauthorized:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const prefs = await getUserPreferenceVectors(user.id);
        return NextResponse.json({ success: true, prefs });
    } catch (error: any) {
        console.error('Error fetching preferences:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
