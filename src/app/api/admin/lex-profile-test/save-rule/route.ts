import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import * as fs from 'fs/promises';
import * as path from 'path';

export const runtime = 'nodejs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface VocabRule {
    level: string;
    reading?: string;
    definition?: string;
    source: 'llm';
    createdAt: string;
}

interface GrammarRule {
    level: string;
    canonical?: string;
    definition?: string;
    source: 'llm';
    createdAt: string;
}

interface SaveRuleRequest {
    vocabEntries?: Array<{
        surface: string;
        reading?: string;
        definition?: string;
        jlpt: string;
    }>;
    grammarChunks?: Array<{
        surface: string;
        canonical?: string;
        definition?: string;
        jlpt: string;
    }>;
}

// File paths for rule storage
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const VOCAB_RULES_PATH = path.join(DATA_DIR, 'vocab', 'llm-vocab-rules.json');
const GRAMMAR_RULES_PATH = path.join(DATA_DIR, 'grammar', 'llm-grammar-rules.json');

async function loadJsonFile<T>(filePath: string): Promise<T> {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {} as T;
    }
}

async function saveJsonFile(filePath: string, data: unknown): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
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

        const body = await req.json() as SaveRuleRequest;
        const { vocabEntries, grammarChunks } = body;

        const timestamp = new Date().toISOString();
        let vocabSaved = 0;
        let grammarSaved = 0;

        // Save vocab entries
        if (vocabEntries && vocabEntries.length > 0) {
            const vocabRules = await loadJsonFile<Record<string, VocabRule>>(VOCAB_RULES_PATH);

            for (const entry of vocabEntries) {
                if (entry.surface && entry.jlpt) {
                    vocabRules[entry.surface] = {
                        level: entry.jlpt,
                        reading: entry.reading,
                        definition: entry.definition,
                        source: 'llm',
                        createdAt: timestamp,
                    };
                    vocabSaved++;
                }
            }

            await saveJsonFile(VOCAB_RULES_PATH, vocabRules);
        }

        // Save grammar chunks
        if (grammarChunks && grammarChunks.length > 0) {
            const grammarRules = await loadJsonFile<Record<string, GrammarRule>>(GRAMMAR_RULES_PATH);

            for (const chunk of grammarChunks) {
                if (chunk.surface && chunk.jlpt) {
                    grammarRules[chunk.surface] = {
                        level: chunk.jlpt,
                        canonical: chunk.canonical,
                        definition: chunk.definition,
                        source: 'llm',
                        createdAt: timestamp,
                    };
                    grammarSaved++;
                }
            }

            await saveJsonFile(GRAMMAR_RULES_PATH, grammarRules);
        }

        return NextResponse.json({
            success: true,
            saved: {
                vocab: vocabSaved,
                grammar: grammarSaved,
            },
            message: `保存了 ${vocabSaved} 个词汇规则和 ${grammarSaved} 个语法规则`,
        });
    } catch (error) {
        console.error('Error saving rules:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to retrieve current rules count
export async function GET() {
    try {
        const vocabRules = await loadJsonFile<Record<string, VocabRule>>(VOCAB_RULES_PATH);
        const grammarRules = await loadJsonFile<Record<string, GrammarRule>>(GRAMMAR_RULES_PATH);

        return NextResponse.json({
            vocabCount: Object.keys(vocabRules).length,
            grammarCount: Object.keys(grammarRules).length,
            vocabRules,
            grammarRules,
        });
    } catch (error) {
        console.error('Error loading rules:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
