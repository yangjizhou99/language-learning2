
import { NextRequest, NextResponse } from 'next/server';
import { chatJSON } from '@/lib/ai/client';
import fs from 'fs/promises';
import path from 'path';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getFrequencyRank } from '@/lib/nlp/wordFrequency';

// English frequency patch file path
const FREQUENCY_PATCH_EN_PATH = path.join(process.cwd(), 'src', 'lib', 'nlp', 'data', 'frequency-patch-en.json');

// GET method to retrieve current patches or scan for missing frequencies
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        if (action === 'list') {
            let patches = {};
            try {
                const data = await fs.readFile(FREQUENCY_PATCH_EN_PATH, 'utf-8');
                patches = JSON.parse(data);
            } catch (e) {
                // File might not exist yet
            }
            return NextResponse.json({ patches });
        }

        if (action === 'scan') {
            const supabase = getServiceSupabase();
            // Fetch English text from shadowing_items
            const { data: items, error } = await supabase
                .from('shadowing_items')
                .select('text, lang')
                .eq('lang', 'en');

            if (error) throw error;

            const missingFreqWords = new Map<string, number>();
            let totalTokens = 0;
            let totalTokensWithRank = 0;
            const uniqueTokens = new Set<string>();

            // Use Intl.Segmenter for English word tokenization
            const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

            for (const item of items || []) {
                if (!item.text) continue;

                const segments = segmenter.segment(item.text);
                for (const seg of segments) {
                    if (!seg.isWordLike) continue; // Skip punctuation/spaces

                    const token = seg.segment.toLowerCase();
                    // Skip very short tokens and numbers
                    if (token.length < 2 || /^\d+$/.test(token)) continue;

                    totalTokens++;
                    uniqueTokens.add(token);

                    const rank = getFrequencyRank(token, token, 'en');
                    if (rank !== -1) {
                        totalTokensWithRank++;
                    } else {
                        missingFreqWords.set(token, (missingFreqWords.get(token) || 0) + 1);
                    }
                }
            }

            // Convert map to sorted list
            const missingList = Array.from(missingFreqWords.entries())
                .map(([token, count]) => ({ token, count }))
                .sort((a, b) => b.count - a.count);

            return NextResponse.json({
                totalItems: items?.length || 0,
                totalTokens,
                uniqueTokens: uniqueTokens.size,
                unknownVocabCount: missingList.length,
                vocabCoverage: totalTokens > 0 ? (totalTokensWithRank / totalTokens) * 100 : 0,
                unknownVocabList: missingList
            });
        }

        if (action === 'delete_all') {
            await fs.writeFile(FREQUENCY_PATCH_EN_PATH, JSON.stringify({}, null, 2));
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { tokens } = await req.json();

        if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
            return NextResponse.json({ error: 'No tokens provided' }, { status: 400 });
        }

        const prompt = `
Estimate the frequency rank (1-30000) for the following English words.
Rank 1 is the most common word ("the"), Rank 30000 is a rare word.

Reference Ranks for calibration (based on OpenSubtitles corpus):
- Rank 1-10 (Most Common): the, to, you, i, a, it, that, is, and, of
- Rank 50-100 (Very Common): just, ok, there, come, all, really, time, think, know, now
- Rank 500-1000 (Common): book, interesting, important, perhaps, begin, young, speak, music, lady
- Rank 1000-3000 (Basic): scientist, opportunity, behavior, comfortable, apologize, ridiculous
- Rank 3000-5000 (Intermediate): spontaneous, peculiar, magnificent, phenomenal, deceive
- Rank 5000-10000 (Advanced): detrimental, ubiquitous, nonchalant, ostentatious, sycophant
- Rank 10000-20000 (Rare): perfunctory, quixotic, lugubrious, sesquipedalian
- Rank 20000-30000 (Very Rare): defenestration, pulchritudinous, concatenate

Words to estimate:
${tokens.join(', ')}

Return ONLY a JSON object mapping each word to its estimated rank number.
Example: { "word1": 1500, "word2": 25000 }
Do not include markdown formatting or explanations.
`;

        const { content } = await chatJSON({
            provider: 'deepseek',
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are an English linguistics expert specializing in word frequency analysis.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            response_json: true
        });

        if (!content) {
            throw new Error('No content received from LLM');
        }

        const newPatches = JSON.parse(content);

        // Save patches to file
        let existingPatches: Record<string, number> = {};
        try {
            const data = await fs.readFile(FREQUENCY_PATCH_EN_PATH, 'utf-8');
            existingPatches = JSON.parse(data);
        } catch (e) {
            // File might not exist yet
        }

        // Merge new patches with existing
        const mergedPatches = { ...existingPatches, ...newPatches };
        await fs.writeFile(FREQUENCY_PATCH_EN_PATH, JSON.stringify(mergedPatches, null, 2));

        return NextResponse.json({ patches: newPatches, totalSaved: Object.keys(mergedPatches).length });

    } catch (error: any) {
        console.error('Error in English frequency repair:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
