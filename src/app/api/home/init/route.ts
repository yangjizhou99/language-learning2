import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getDailyShadowingItem } from '@/lib/practice/daily-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Auth & Client Setup
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
            supabase = (createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) { return cookieMap.get(name); },
                        set() { },
                        remove() { },
                    },
                },
            ) as unknown) as SupabaseClient;
        } else {
            const cookieStore = await cookies();
            supabase = (createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        get(name: string) { return cookieStore.get(name)?.value; },
                        set() { },
                        remove() { },
                    },
                },
            ) as unknown) as SupabaseClient;
        }

        // 2. Authenticate User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
        }

        // 3. Parallel Fetching Setup
        // Use Admin Client for system-wide reads where appropriate (like daily items pool)
        const supabaseAdmin = getServiceSupabase();

        // Fetch Profile first to know target languages
        const { data: profile } = await supabase
            .from('profiles')
            .select('username, bio, goals, preferred_tone, native_lang, target_langs, domains, onboarding_completed')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return NextResponse.json({ error: 'profile_not_found' }, { status: 404 });
        }

        // Determine target languages for daily tasks
        const targetLangs = (profile.target_langs || []) as string[];
        // Logic from page.tsx: Preferred (0), Second (1), Korean (if present but not 0/1)
        const preferred = targetLangs[0] || null;
        const second = targetLangs[1] || null;
        const hasKorean = targetLangs.includes('ko');
        const koreanIsThird = hasKorean && preferred !== 'ko' && second !== 'ko';

        const langsToFetch = [];
        if (preferred) langsToFetch.push(preferred);
        if (second) langsToFetch.push(second);
        if (koreanIsThird) langsToFetch.push('ko');

        // Remove duplicates just in case
        const uniqueLangs = [...new Set(langsToFetch)];

        // 4. Parallel Execution
        const [statsResult, dailyResults, reviewDueResult] = await Promise.all([
            // A. User Stats (Vocab Count) - replicating get_vocab_stats or simple count
            // Using direct count query as in page.tsx
            supabase
                .from('vocab_entries')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id),

            // B. Daily Tasks (Parallel for each language)
            Promise.all(uniqueLangs.map(lang => getDailyShadowingItem(supabaseAdmin, user.id, lang))),

            // C. Vocab Review Due
            // Replicating /api/vocab/review/due logic (limit 1 to get total count)
            supabase
                .from('vocab_entries')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'learning') // Assuming review logic filters by date usually, but simpler check:
                .lte('next_review_at', new Date().toISOString())
        ]);

        // 5. Transform Results

        // Stats
        const stats = {
            totalVocab: statsResult.count || 0,
            completedLessons: 0, // Placeholder as in original
            streak: 0,          // Placeholder
            level: 1            // Placeholder
        };

        // Daily Tasks Map
        // Map results back to request: { daily, dailySecond, dailyKorean }
        const dailyMap: Record<string, any> = {};
        uniqueLangs.forEach((lang, index) => {
            dailyMap[lang] = dailyResults[index];
        });

        const dailyData = {
            daily: preferred ? dailyMap[preferred] : null,
            dailySecond: second ? dailyMap[second] : null,
            dailyKorean: koreanIsThird ? dailyMap['ko'] : null
        };

        // Due Count
        const dueCount = reviewDueResult.count || 0;

        return NextResponse.json({
            profile,
            stats,
            ...dailyData,
            dueCount
        });

    } catch (e) {
        console.error('Home init API failed:', e);
        return NextResponse.json({ error: 'server_error' }, { status: 500 });
    }
}
