
import { NextRequest, NextResponse } from 'next/server';
import { chatJSON } from '@/lib/ai/client';
import fs from 'fs/promises';
import path from 'path';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getFrequencyRank } from '@/lib/nlp/wordFrequency';

// GET method to retrieve current patches or scan for missing frequencies
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');
        const patchPath = path.join(process.cwd(), 'src', 'lib', 'nlp', 'data', 'frequency-patch.json');

        if (action === 'list') {
            let patches = {};
            try {
                const data = await fs.readFile(patchPath, 'utf-8');
                patches = JSON.parse(data);
            } catch (e) {
                // File might not exist yet
            }
            return NextResponse.json({ patches });
        }

        if (action === 'scan') {
            const supabase = getServiceSupabase();
            // Fetch text from shadowing_items (Question Bank)
            const { data: items, error } = await supabase
                .from('shadowing_items')
                .select('text');

            if (error) throw error;

            const missingFreqWords = new Map<string, number>();
            let totalTokens = 0;
            let totalTokensWithRank = 0;
            const uniqueTokens = new Set<string>();

            // Use Intl.Segmenter for Japanese tokenization
            const segmenter = new Intl.Segmenter('ja-JP', { granularity: 'word' });

            for (const item of items || []) {
                if (!item.text) continue;

                const segments = segmenter.segment(item.text);
                for (const seg of segments) {
                    if (!seg.isWordLike) continue; // Skip punctuation/spaces

                    const token = seg.segment;
                    totalTokens++;
                    uniqueTokens.add(token);

                    const rank = getFrequencyRank(token);
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
            await fs.writeFile(patchPath, JSON.stringify({}, null, 2));
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
Estimate the frequency rank (1-60000) for the following Japanese words.
Rank 1 is the most common word, Rank 60000 is a very rare word.

Reference Ranks for calibration:
- Rank 100 (Common): 其処, 良く, 皆
- Rank 1000 (Basic): 趣味, 熱, 真面目
- Rank 5000 (Intermediate): 出, 燃やす, 引き付ける
- Rank 10000 (Advanced): ばたり, 上皇, 呼び起こす
- Rank 20000 (Rare): アンコール, 自惚, 掠る
- Rank 30000 (Very Rare): あざとい, 弄り, ギャルソン
- Rank 40000 (Obscure): 雑色, 舞い舞い, ぬた
- Rank 50000 (Extremely Rare): どうだん, 控え柱, 三竦み

Words to estimate:
${tokens.join(', ')}

Return ONLY a JSON object mapping each word to its estimated rank number.
Example: { "word1": 1500, "word2": 45000 }
Do not include markdown formatting or explanations.
`;

        const { content } = await chatJSON({
            provider: 'deepseek',
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are a Japanese linguistics expert specializing in word frequency analysis.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            response_json: true
        });

        if (!content) {
            throw new Error('No content received from LLM');
        }

        const newPatches = JSON.parse(content);

        // IMPORTANT: Save patches to file
        const patchPath = path.join(process.cwd(), 'src', 'lib', 'nlp', 'data', 'frequency-patch.json');
        let existingPatches: Record<string, number> = {};
        try {
            const data = await fs.readFile(patchPath, 'utf-8');
            existingPatches = JSON.parse(data);
        } catch (e) {
            // File might not exist yet
        }

        // Merge new patches with existing
        const mergedPatches = { ...existingPatches, ...newPatches };
        await fs.writeFile(patchPath, JSON.stringify(mergedPatches, null, 2));

        return NextResponse.json({ patches: newPatches, totalSaved: Object.keys(mergedPatches).length });

    } catch (error: any) {
        console.error('Error in frequency repair:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
