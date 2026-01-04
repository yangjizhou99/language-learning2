export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { analyzeLexProfileAsync, toLexProfileForDB, getDictionarySize, SupportedLang, JaTokenizer, JaVocabDict, JaGrammarDict, JA_VOCAB_DICT_INFO, JA_GRAMMAR_DICT_INFO } from '@/lib/recommendation/lexProfileAnalyzer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
    try {
        // Auth check - use cookies for session
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

        // Try cookie auth first, then fall back to header auth
        let user = null;
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session?.user) {
            user = sessionData.session.user;
        } else {
            // Try Bearer token from Authorization header
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

        const body = await req.json();
        const { text, lang, jaTokenizer, jaVocabDict, jaGrammarDict } = body;

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }

        if (!lang || !['en', 'ja', 'zh'].includes(lang)) {
            return NextResponse.json({ error: 'lang must be en, ja, or zh' }, { status: 400 });
        }

        // Validate jaTokenizer if provided
        const validTokenizers: JaTokenizer[] = ['kuromoji', 'tinysegmenter', 'budoux'];
        const selectedTokenizer: JaTokenizer = validTokenizers.includes(jaTokenizer) ? jaTokenizer : 'kuromoji';

        // Validate jaVocabDict if provided
        const validVocabDicts: JaVocabDict[] = ['default', 'elzup', 'tanos', 'combined'];
        const selectedVocabDict: JaVocabDict = validVocabDicts.includes(jaVocabDict) ? jaVocabDict : 'default';

        // Validate jaGrammarDict if provided
        const validGrammarDicts: JaGrammarDict[] = ['yapan', 'hagoromo', 'combined'];
        const selectedGrammarDict: JaGrammarDict = validGrammarDicts.includes(jaGrammarDict) ? jaGrammarDict : 'yapan';

        // Analyze the text with async version (supports multiple Japanese tokenizers and dictionaries)
        const result = await analyzeLexProfileAsync(text, lang as SupportedLang, selectedTokenizer, selectedVocabDict, selectedGrammarDict);
        const lexProfileForDB = toLexProfileForDB(result);
        const dictSize = getDictionarySize(lang as SupportedLang, selectedVocabDict);

        return NextResponse.json({
            success: true,
            result: {
                ...result,
                lexProfileForDB,
                dictionarySize: dictSize,
                dictionaryInfo: lang === 'ja' ? JA_VOCAB_DICT_INFO : undefined,
                grammarDictInfo: lang === 'ja' ? JA_GRAMMAR_DICT_INFO : undefined,
                selectedVocabDict: lang === 'ja' ? selectedVocabDict : undefined,
                selectedGrammarDict: lang === 'ja' ? selectedGrammarDict : undefined,
            },
        });
    } catch (error) {
        console.error('Error in lex-profile-test API:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
