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
    compoundPattern?: string; // For fragments: points to the full compound pattern
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
        fragments?: string[]; // Original fragments that form this compound pattern
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
                    // Save the main compound pattern
                    grammarRules[chunk.surface] = {
                        level: chunk.jlpt,
                        canonical: chunk.canonical,
                        definition: chunk.definition,
                        source: 'llm',
                        createdAt: timestamp,
                    };
                    grammarSaved++;

                    // If this is a compound pattern with fragments, also save fragment mappings
                    if (chunk.fragments && chunk.fragments.length > 0) {
                        for (const fragment of chunk.fragments) {
                            // Only add if fragment doesn't already have a rule
                            if (!grammarRules[fragment]) {
                                grammarRules[fragment] = {
                                    level: chunk.jlpt,
                                    canonical: chunk.surface, // Point to full pattern
                                    definition: `→ ${chunk.surface} (${chunk.definition || ''})`,
                                    source: 'llm',
                                    createdAt: timestamp,
                                    compoundPattern: chunk.surface,
                                };
                            }
                        }
                    }
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

export async function DELETE(req: NextRequest) {
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

        // Clear files by saving empty objects
        await saveJsonFile(VOCAB_RULES_PATH, {});
        await saveJsonFile(GRAMMAR_RULES_PATH, {});

        return NextResponse.json({
            success: true,
            message: '所有补丁规则已删除',
        });
    } catch (error) {
        console.error('Error deleting rules:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
