export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeLexProfileAsync } from '@/lib/recommendation/lexProfileAnalyzer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/shadowing/batch-lex-profile
 * Batch generate lex_profile for selected shadowing items
 * 
 * Body: { itemIds: string[] }
 */
export async function POST(req: NextRequest) {
    try {
        // Use service role for admin operations
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { itemIds } = body as { itemIds: string[] };

        if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return NextResponse.json({ error: 'itemIds array is required' }, { status: 400 });
        }

        console.log(`[BatchLexProfile] Processing ${itemIds.length} items...`);

        const results: { id: string; success: boolean; error?: string; lexProfile?: any }[] = [];

        for (const id of itemIds) {
            try {
                // 1. Fetch item text and language
                const { data: item, error: fetchError } = await supabase
                    .from('shadowing_items')
                    .select('text, lang')
                    .eq('id', id)
                    .single();

                if (fetchError || !item) {
                    results.push({ id, success: false, error: 'Item not found' });
                    continue;
                }

                if (!item.text) {
                    results.push({ id, success: false, error: 'Item has no text' });
                    continue;
                }

                // 2. Analyze lex profile
                console.log(`[BatchLexProfile] Analyzing item ${id} (lang: ${item.lang})...`);
                const analysis = await analyzeLexProfileAsync(item.text, item.lang || 'ja');

                // 3. Extract and save lex_profile (including tokenList for word selection)
                const lexProfile = {
                    A1_A2: analysis.lexProfile.A1_A2,
                    B1_B2: analysis.lexProfile.B1_B2,
                    C1_plus: analysis.lexProfile.C1_plus,
                    unknown: analysis.lexProfile.unknown,
                    contentWordCount: analysis.contentWordCount,
                    totalTokens: analysis.tokens,
                    // Include tokenList for word-level selection in practice interface
                    tokenList: analysis.details.tokenList,
                };

                const { error: updateError } = await supabase
                    .from('shadowing_items')
                    .update({ lex_profile: lexProfile })
                    .eq('id', id);

                if (updateError) {
                    results.push({ id, success: false, error: updateError.message });
                    continue;
                }

                results.push({ id, success: true, lexProfile });
                console.log(`[BatchLexProfile] Item ${id} completed:`, lexProfile);

            } catch (itemError) {
                console.error(`[BatchLexProfile] Error processing item ${id}:`, itemError);
                results.push({
                    id,
                    success: false,
                    error: itemError instanceof Error ? itemError.message : 'Unknown error'
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        console.log(`[BatchLexProfile] Completed: ${successCount} success, ${failCount} failed`);

        return NextResponse.json({
            success: true,
            summary: { total: itemIds.length, success: successCount, failed: failCount },
            results,
        });

    } catch (error) {
        console.error('[BatchLexProfile] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
