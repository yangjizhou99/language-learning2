export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/vocabulary/knowledge
 * Fetch user's vocabulary knowledge for a list of words
 * 
 * Query params:
 * - words: comma-separated list of words
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient(req);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(req.url);
        const wordsParam = url.searchParams.get('words');

        if (!wordsParam) {
            return NextResponse.json({ error: 'words parameter is required' }, { status: 400 });
        }

        const words = wordsParam.split(',').map(w => w.trim()).filter(Boolean);

        if (words.length === 0) {
            return NextResponse.json({ knowledge: {} });
        }

        const { data, error } = await supabase
            .from('user_vocabulary_knowledge')
            .select('word, lemma, jlpt_level, marked_unknown, marked_at, exposure_count, not_marked_count, first_seen_at, last_seen_at')
            .eq('user_id', user.id)
            .in('word', words);

        if (error) {
            console.error('Error fetching vocabulary knowledge:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Convert to map for easy lookup
        const knowledgeMap: Record<string, {
            markedUnknown: boolean;
            markedAt: Date | null;
            exposureCount: number;
            notMarkedCount: number;
            firstSeenAt: Date | null;
            lastSeenAt: Date | null;
        }> = {};

        for (const row of data || []) {
            knowledgeMap[row.word] = {
                markedUnknown: row.marked_unknown || false,
                markedAt: row.marked_at ? new Date(row.marked_at) : null,
                exposureCount: row.exposure_count || 0,
                notMarkedCount: row.not_marked_count || 0,
                firstSeenAt: row.first_seen_at ? new Date(row.first_seen_at) : null,
                lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : null,
            };
        }

        return NextResponse.json({
            success: true,
            knowledge: knowledgeMap
        });
    } catch (error) {
        console.error('Error in GET vocabulary knowledge:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/vocabulary/knowledge
 * Record vocabulary observations from article practice
 * 
 * Body:
 * - words: Array of { word, lemma?, level?, frequencyRank?, markedUnknown? }
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient(req);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { words } = body as {
            words: Array<{
                word: string;
                lemma?: string;
                level?: string;
                frequencyRank?: number;
                markedUnknown?: boolean;
            }>;
        };

        if (!words || !Array.isArray(words) || words.length === 0) {
            return NextResponse.json({ error: 'words array is required' }, { status: 400 });
        }

        const now = new Date().toISOString();
        let updatedCount = 0;
        let insertedCount = 0;

        // Process each word
        for (const wordData of words) {
            const { word, lemma, level, frequencyRank, markedUnknown } = wordData;

            if (!word) continue;

            // Check if record exists
            const { data: existing } = await supabase
                .from('user_vocabulary_knowledge')
                .select('id, exposure_count, not_marked_count, marked_unknown')
                .eq('user_id', user.id)
                .eq('word', word)
                .single();

            if (existing) {
                // Update existing record
                const updates: Record<string, unknown> = {
                    exposure_count: (existing.exposure_count || 0) + 1,
                    last_seen_at: now,
                };

                // If marked as unknown this time
                if (markedUnknown === true) {
                    updates.marked_unknown = true;
                    updates.marked_at = now;
                } else if (markedUnknown === false && !existing.marked_unknown) {
                    // Exposed but not marked → weak positive evidence
                    updates.not_marked_count = (existing.not_marked_count || 0) + 1;
                }

                const { error: updateError } = await supabase
                    .from('user_vocabulary_knowledge')
                    .update(updates)
                    .eq('id', existing.id);

                if (!updateError) updatedCount++;
            } else {
                // Insert new record
                const newRecord = {
                    user_id: user.id,
                    word,
                    lemma: lemma || word,
                    jlpt_level: level || null,
                    frequency_rank: frequencyRank || null,
                    marked_unknown: markedUnknown || false,
                    marked_at: markedUnknown ? now : null,
                    exposure_count: 1,
                    not_marked_count: markedUnknown ? 0 : 1,
                    first_seen_at: now,
                    last_seen_at: now,
                };

                const { error: insertError } = await supabase
                    .from('user_vocabulary_knowledge')
                    .insert(newRecord);

                if (!insertError) insertedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            inserted: insertedCount,
            updated: updatedCount,
        });
    } catch (error) {
        console.error('Error in POST vocabulary knowledge:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function getSupabaseClient(req: NextRequest): Promise<SupabaseClient> {
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);

    if (hasBearer) {
        return createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: authHeader } },
        });
    } else {
        const cookieStore = await cookies();
        return createServerClient(supabaseUrl, supabaseAnon, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() { },
                remove() { },
            },
        }) as unknown as SupabaseClient;
    }
}
