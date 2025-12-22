import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { analyzeLexProfileAsync } from '@/lib/recommendation/lexProfileAnalyzer';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for scanning all items

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UnknownToken {
    token: string;
    lemma: string;
    pos: string;
    count: number;
    contexts: string[]; // Sample titles
}

interface ScanResult {
    totalItems: number;
    analyzedItems: number;
    unknownVocab: UnknownToken[];
    unmatchedGrammar: UnknownToken[];
    currentCoverage: {
        vocab: number;
        grammar: number;
    };
    stats: {
        totalVocabTokens: number;
        vocabWithLevel: number;
        totalGrammarTokens: number;
        grammarWithLevel: number;
    };
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const cookieStore = await cookies();
        const supabase = createServerClient(supabaseUrl, supabaseAnon, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() { },
                remove() { },
            },
        });

        let user = null;
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session?.user) {
            user = sessionData.session.user;
        } else {
            const authHeader = req.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const { data: userData, error } = await supabase.auth.getUser(token);
                if (!error && userData?.user) {
                    user = userData.user;
                }
            }
        }

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body for dictionary options
        const body = await req.json().catch(() => ({}));
        const jaVocabDict = body.jaVocabDict || 'combined';
        const jaGrammarDict = body.jaGrammarDict || 'combined';
        const jaTokenizer = body.jaTokenizer || 'kuromoji';

        // Fetch all Japanese items
        const adminClient = getServiceSupabase();
        const { data: items, error } = await adminClient
            .from('shadowing_items')
            .select('id, text, title, lang')
            .eq('lang', 'ja')
            .not('text', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No Japanese items found' }, { status: 404 });
        }

        // Collect unknown tokens
        const unknownVocabMap = new Map<string, UnknownToken>();
        const unmatchedGrammarMap = new Map<string, UnknownToken>();

        let analyzedItems = 0;
        let totalVocabTokens = 0;
        let vocabWithLevel = 0;
        let totalGrammarTokens = 0;
        let grammarWithLevel = 0;

        for (const item of items) {
            try {
                const result = await analyzeLexProfileAsync(
                    item.text,
                    'ja',
                    jaTokenizer,
                    jaVocabDict,
                    jaGrammarDict
                );

                analyzedItems++;

                for (const token of result.details.tokenList) {
                    if (token.isContentWord) {
                        totalVocabTokens++;
                        if (token.originalLevel === 'unknown') {
                            // Collect unknown vocab
                            const key = token.lemma || token.token;
                            const existing = unknownVocabMap.get(key);
                            if (existing) {
                                existing.count++;
                                if (existing.contexts.length < 3) {
                                    existing.contexts.push(item.title || 'Untitled');
                                }
                            } else {
                                unknownVocabMap.set(key, {
                                    token: token.token,
                                    lemma: token.lemma,
                                    pos: token.pos,
                                    count: 1,
                                    contexts: [item.title || 'Untitled'],
                                });
                            }
                        } else if (token.originalLevel !== 'proper_noun') {
                            vocabWithLevel++;
                        }
                    } else {
                        totalGrammarTokens++;
                        // Check if grammar has level (format: "grammar (N3)" vs just "grammar")
                        if (token.originalLevel.includes('(N')) {
                            grammarWithLevel++;
                        } else if (token.originalLevel === 'grammar') {
                            // Collect unmatched grammar
                            const key = token.token;
                            const existing = unmatchedGrammarMap.get(key);
                            if (existing) {
                                existing.count++;
                                if (existing.contexts.length < 3) {
                                    existing.contexts.push(item.title || 'Untitled');
                                }
                            } else {
                                unmatchedGrammarMap.set(key, {
                                    token: token.token,
                                    lemma: token.lemma,
                                    pos: token.pos,
                                    count: 1,
                                    contexts: [item.title || 'Untitled'],
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error analyzing item ${item.id}:`, err);
            }
        }

        // Sort by frequency
        const sortedVocab = [...unknownVocabMap.values()].sort((a, b) => b.count - a.count);
        const sortedGrammar = [...unmatchedGrammarMap.values()].sort((a, b) => b.count - a.count);

        const result: ScanResult = {
            totalItems: items.length,
            analyzedItems,
            unknownVocab: sortedVocab,
            unmatchedGrammar: sortedGrammar,
            currentCoverage: {
                vocab: totalVocabTokens > 0 ? (vocabWithLevel / totalVocabTokens) * 100 : 0,
                grammar: totalGrammarTokens > 0 ? (grammarWithLevel / totalGrammarTokens) * 100 : 0,
            },
            stats: {
                totalVocabTokens,
                vocabWithLevel,
                totalGrammarTokens,
                grammarWithLevel,
            },
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('Batch scan error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
