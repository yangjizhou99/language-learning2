import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();

        // Debug logging
        const { cookies } = await import('next/headers');
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll().map(c => c.name);
        console.log('[API Debug] Cookies present:', allCookies);

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) {
            console.error('[API Debug] Auth error:', authError);
        }
        if (!user) {
            console.error('[API Debug] No user found');
        } else {
            console.log('[API Debug] User found:', user.id);
        }

        if (authError || !user) {
            return NextResponse.json({
                error: 'Unauthorized',
                debug: {
                    message: authError?.message || 'No user found',
                    cookies: allCookies
                }
            }, { status: 401 });
        }

        // Fetch recent sessions with item details
        // We join with shadowing_items to get the title
        // Fetch recent sessions
        const { data: sessions, error } = await supabase
            .from('shadowing_sessions')
            .select('id, created_at, quiz_result, item_id, imported_vocab_ids')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching session history:', error);
            return NextResponse.json({
                error: 'Failed to fetch history',
                debug: {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                }
            }, { status: 500 });
        }

        // Manually fetch items to avoid foreign key issues
        const itemIds = sessions.map((s: any) => s.item_id).filter((id: any) => id);
        let itemsMap = new Map();

        if (itemIds.length > 0) {
            const { data: items, error: itemsError } = await supabase
                .from('shadowing_items')
                .select('id, title, level, genre')
                .in('id', itemIds);

            if (!itemsError && items) {
                itemsMap = new Map(items.map((i: any) => [i.id, i]));
            }
        }

        // Format the response
        const history = sessions.map((session: any) => {
            const item = itemsMap.get(session.item_id);

            // Calculate score from quiz_result
            let score = 0;
            if (session.quiz_result) {
                const correct = session.quiz_result.correctCount || session.quiz_result.correct_count || 0;
                const total = session.quiz_result.total || 0;
                if (total > 0) {
                    score = Math.round((correct / total) * 100);
                }
            }

            return {
                id: session.id,
                date: session.created_at,
                score: score,
                itemId: session.item_id,
                title: item?.title || 'Unknown Item',
                level: item?.level || 0,
                genre: item?.genre || 'General',
                newWordsCount: session.imported_vocab_ids?.length || 0,
            };
        });

        return NextResponse.json({
            success: true,
            history,
            debug: {
                userId: user.id,
                sessionCount: sessions.length,
                itemIdsCount: itemIds.length,
                itemsFound: itemsMap.size
            }
        });

    } catch (error) {
        console.error('Error in progress history API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
