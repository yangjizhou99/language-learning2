export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeLexProfileAsync } from '@/lib/recommendation/lexProfileAnalyzer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/admin/vocabulary/article-detail?id=xxx
 * Get detailed word-by-word analysis for a specific article
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { searchParams } = new URL(req.url);
        const itemId = searchParams.get('id');

        if (!itemId) {
            return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
        }

        // Fetch the item
        const { data: item, error: fetchError } = await supabase
            .from('shadowing_items')
            .select('id, title, text, lang, level, genre, status, lex_profile, created_at')
            .eq('id', itemId)
            .single();

        if (fetchError || !item) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        if (!item.text) {
            return NextResponse.json({ error: 'Item has no text' }, { status: 400 });
        }

        // Analyze the text to get detailed token information
        console.log(`[ArticleDetail] Analyzing item ${itemId} (lang: ${item.lang})...`);
        const analysis = await analyzeLexProfileAsync(item.text, item.lang || 'ja');

        // Transform token info for frontend display
        const words = analysis.details.tokenList
            .filter(token => token.isContentWord) // Only show content words
            .map(token => ({
                word: token.token,
                lemma: token.lemma,
                pos: token.pos,
                level: token.originalLevel || 'Unknown',
                broadCEFR: token.broadCEFR,
                frequencyRank: token.frequencyRank ?? -1,
                frequencyLabel: getFrequencyLabel(token.frequencyRank ?? -1),
                knownProbability: token.knownProbability ?? 0,
            }));

        // Count by level
        const levelCounts: Record<string, number> = {};
        words.forEach(w => {
            levelCounts[w.level] = (levelCounts[w.level] || 0) + 1;
        });

        // Count by frequency tier
        const freqCounts = {
            common: words.filter(w => w.frequencyRank > 0 && w.frequencyRank <= 1000).length,
            moderate: words.filter(w => w.frequencyRank > 1000 && w.frequencyRank <= 5000).length,
            uncommon: words.filter(w => w.frequencyRank > 5000 && w.frequencyRank <= 10000).length,
            rare: words.filter(w => w.frequencyRank > 10000 || w.frequencyRank === -1).length,
        };

        return NextResponse.json({
            id: item.id,
            title: item.title || item.text.slice(0, 50) + '...',
            text: item.text,
            lang: item.lang,
            level: item.level,
            genre: item.genre,
            status: item.status,
            createdAt: item.created_at,
            analysis: {
                totalTokens: analysis.tokens,
                contentWordCount: analysis.contentWordCount,
                lexProfile: analysis.lexProfile,
                levelCounts,
                freqCounts,
            },
            words,
        });

    } catch (error) {
        console.error('[ArticleDetail] Error:', error);
        return NextResponse.json({
            error: 'Failed to analyze article',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

function getFrequencyLabel(rank: number): string {
    if (rank === -1) return '罕见';
    if (rank <= 1000) return '常用';
    if (rank <= 5000) return '较常用';
    if (rank <= 10000) return '不常用';
    return '罕见';
}
