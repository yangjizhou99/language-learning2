export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// File paths for vocabulary data
const LLM_VOCAB_PATH = path.join(process.cwd(), 'src', 'data', 'vocab', 'llm-vocab-rules.json');
const FREQUENCY_PATH = path.join(process.cwd(), 'src', 'lib', 'nlp', 'data', 'frequency.json');
const FREQUENCY_PATCH_PATH = path.join(process.cwd(), 'src', 'lib', 'nlp', 'data', 'frequency-patch.json');

// Static dictionary paths
const STATIC_DICTS: Record<string, string> = {
    'ja-jlpt': path.join(process.cwd(), 'src', 'data', 'vocab', 'ja-jlpt.json'),
    'ja-jlpt-combined': path.join(process.cwd(), 'src', 'data', 'vocab', 'ja-jlpt-combined.json'),
    'ja-jlpt-elzup': path.join(process.cwd(), 'src', 'data', 'vocab', 'ja-jlpt-elzup.json'),
    'ja-jlpt-tanos': path.join(process.cwd(), 'src', 'data', 'vocab', 'ja-jlpt-tanos.json'),
    'en-cefr': path.join(process.cwd(), 'src', 'data', 'vocab', 'en-cefr.json'),
    'zh-hsk': path.join(process.cwd(), 'src', 'data', 'vocab', 'zh-hsk.json'),
};

interface LLMVocabEntry {
    level: string;
    reading?: string;
    definition?: string;
    source?: string;
    createdAt?: string;
}

interface VocabItem {
    word: string;
    level: string;
    reading?: string;
    definition?: string;
    source?: string;
    createdAt?: string;
}

/**
 * GET /api/admin/vocabulary
 * Get vocabulary list with pagination, search, and filtering
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify admin access
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') || 'llm-vocab'; // llm-vocab, frequency, static-dict
        const dictName = searchParams.get('dict') || 'ja-jlpt';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = parseInt(searchParams.get('pageSize') || '50');
        const search = searchParams.get('search') || '';
        const level = searchParams.get('level') || '';

        if (type === 'llm-vocab') {
            // Load LLM vocabulary rules
            const content = await fs.readFile(LLM_VOCAB_PATH, 'utf-8');
            const data: Record<string, LLMVocabEntry> = JSON.parse(content);

            // Convert to array
            let items: VocabItem[] = Object.entries(data).map(([word, entry]) => ({
                word,
                level: entry.level,
                reading: entry.reading,
                definition: entry.definition,
                source: entry.source,
                createdAt: entry.createdAt,
            }));

            // Apply filters
            if (search) {
                const lowerSearch = search.toLowerCase();
                items = items.filter(item =>
                    item.word.toLowerCase().includes(lowerSearch) ||
                    (item.reading && item.reading.toLowerCase().includes(lowerSearch)) ||
                    (item.definition && item.definition.toLowerCase().includes(lowerSearch))
                );
            }
            if (level) {
                items = items.filter(item => item.level === level);
            }

            // Sort by word
            items.sort((a, b) => a.word.localeCompare(b.word, 'ja'));

            // Paginate
            const total = items.length;
            const startIndex = (page - 1) * pageSize;
            const paginatedItems = items.slice(startIndex, startIndex + pageSize);

            return NextResponse.json({
                type: 'llm-vocab',
                items: paginatedItems,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            });

        } else if (type === 'frequency') {
            // Load frequency data
            const freqContent = await fs.readFile(FREQUENCY_PATH, 'utf-8');
            const freqData = JSON.parse(freqContent);

            // Load patch data
            let patchData: Record<string, number> = {};
            try {
                const patchContent = await fs.readFile(FREQUENCY_PATCH_PATH, 'utf-8');
                patchData = JSON.parse(patchContent);
            } catch { /* patch file may not exist */ }

            // Convert to array
            let items: { word: string; rank: number; source: 'main' | 'patch' }[] = [];

            if (Array.isArray(freqData)) {
                items = freqData.map((word: string, index: number) => ({
                    word,
                    rank: index + 1,
                    source: 'main' as const,
                }));
            } else {
                items = Object.entries(freqData as Record<string, number>).map(([word, rank]) => ({
                    word,
                    rank: rank as number,
                    source: 'main' as const,
                }));
            }

            // Add patch entries
            Object.entries(patchData).forEach(([word, rank]) => {
                const existing = items.find(i => i.word === word);
                if (existing) {
                    existing.rank = rank;
                    existing.source = 'patch';
                } else {
                    items.push({ word, rank, source: 'patch' });
                }
            });

            // Apply search
            if (search) {
                items = items.filter(item => item.word.includes(search));
            }

            // Sort by rank
            items.sort((a, b) => a.rank - b.rank);

            // Paginate
            const total = items.length;
            const startIndex = (page - 1) * pageSize;
            const paginatedItems = items.slice(startIndex, startIndex + pageSize);

            return NextResponse.json({
                type: 'frequency',
                items: paginatedItems,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            });

        } else if (type === 'static-dict') {
            const dictPath = STATIC_DICTS[dictName];
            if (!dictPath) {
                return NextResponse.json({ error: `Unknown dictionary: ${dictName}` }, { status: 400 });
            }

            const content = await fs.readFile(dictPath, 'utf-8');
            const data: Record<string, string> = JSON.parse(content);

            // Convert to array
            let items = Object.entries(data).map(([word, wordLevel]) => ({
                word,
                level: wordLevel,
            }));

            // Apply filters
            if (search) {
                items = items.filter(item => item.word.includes(search));
            }
            if (level) {
                items = items.filter(item => item.level === level);
            }

            // Sort
            items.sort((a, b) => a.word.localeCompare(b.word, 'ja'));

            // Paginate
            const total = items.length;
            const startIndex = (page - 1) * pageSize;
            const paginatedItems = items.slice(startIndex, startIndex + pageSize);

            return NextResponse.json({
                type: 'static-dict',
                dictName,
                items: paginatedItems,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                availableDicts: Object.keys(STATIC_DICTS),
            });

        } else if (type === 'article-lex-profile') {
            // Fetch shadowing items with lex_profile from database
            const lang = searchParams.get('lang') || '';
            const includeAll = searchParams.get('includeAll') === 'true';

            let query = supabase
                .from('shadowing_items')
                .select('id, title, text, lang, level, genre, status, lex_profile, created_at', { count: 'exact' });

            // Filter by lex_profile unless includeAll
            if (!includeAll) {
                query = query.not('lex_profile', 'is', null);
            }

            // Apply language filter
            if (lang) {
                query = query.eq('lang', lang);
            }

            query = query.order('created_at', { ascending: false });

            // Apply search filter
            if (search) {
                query = query.or(`title.ilike.%${search}%,text.ilike.%${search}%`);
            }

            // Paginate
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data: items, error, count } = await query;

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            // Transform items to include computed stats
            const transformedItems = (items || []).map(item => {
                const lexProfile = item.lex_profile || {};
                const totalContent = (lexProfile.A1_A2 || 0) + (lexProfile.B1_B2 || 0) + (lexProfile.C1_plus || 0) + (lexProfile.unknown || 0);
                return {
                    id: item.id,
                    title: item.title || item.text?.slice(0, 50) + '...',
                    text: item.text?.slice(0, 100) + (item.text?.length > 100 ? '...' : ''),
                    fullText: item.text,
                    lang: item.lang,
                    level: item.level,
                    genre: item.genre,
                    status: item.status,
                    createdAt: item.created_at,
                    hasLexProfile: !!item.lex_profile,
                    lexProfile: {
                        A1_A2: lexProfile.A1_A2 || 0,
                        B1_B2: lexProfile.B1_B2 || 0,
                        C1_plus: lexProfile.C1_plus || 0,
                        unknown: lexProfile.unknown || 0,
                        contentWordCount: lexProfile.contentWordCount || 0,
                        totalTokens: lexProfile.totalTokens || 0,
                    },
                    stats: {
                        totalContentWords: totalContent,
                        a1a2Percent: totalContent > 0 ? Math.round((lexProfile.A1_A2 || 0) / totalContent * 100) : 0,
                        b1b2Percent: totalContent > 0 ? Math.round((lexProfile.B1_B2 || 0) / totalContent * 100) : 0,
                        c1PlusPercent: totalContent > 0 ? Math.round((lexProfile.C1_plus || 0) / totalContent * 100) : 0,
                        unknownPercent: totalContent > 0 ? Math.round((lexProfile.unknown || 0) / totalContent * 100) : 0,
                    },
                };
            });

            return NextResponse.json({
                type: 'article-lex-profile',
                items: transformedItems,
                total: count || 0,
                page,
                pageSize,
                totalPages: Math.ceil((count || 0) / pageSize),
            });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error) {
        console.error('[Vocabulary API] GET Error:', error);
        return NextResponse.json({
            error: 'Failed to load vocabulary data',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * PUT /api/admin/vocabulary
 * Update vocabulary entry
 */
export async function PUT(req: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify admin access
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const body = await req.json();
        const { type, word, level, reading, definition, rank, dictName } = body;

        if (!type || !word) {
            return NextResponse.json({ error: 'type and word are required' }, { status: 400 });
        }

        if (type === 'llm-vocab') {
            const content = await fs.readFile(LLM_VOCAB_PATH, 'utf-8');
            const data: Record<string, LLMVocabEntry> = JSON.parse(content);

            if (!data[word]) {
                return NextResponse.json({ error: 'Word not found' }, { status: 404 });
            }

            // Update entry
            data[word] = {
                ...data[word],
                level: level || data[word].level,
                reading: reading !== undefined ? reading : data[word].reading,
                definition: definition !== undefined ? definition : data[word].definition,
            };

            await fs.writeFile(LLM_VOCAB_PATH, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, entry: data[word] });

        } else if (type === 'frequency') {
            // Update frequency patch file
            let patchData: Record<string, number> = {};
            try {
                const patchContent = await fs.readFile(FREQUENCY_PATCH_PATH, 'utf-8');
                patchData = JSON.parse(patchContent);
            } catch { /* file may not exist */ }

            if (rank !== undefined) {
                patchData[word] = rank;
            }

            await fs.writeFile(FREQUENCY_PATCH_PATH, JSON.stringify(patchData, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, rank });

        } else if (type === 'static-dict') {
            const dictPath = STATIC_DICTS[dictName];
            if (!dictPath) {
                return NextResponse.json({ error: `Unknown dictionary: ${dictName}` }, { status: 400 });
            }

            const content = await fs.readFile(dictPath, 'utf-8');
            const data: Record<string, string> = JSON.parse(content);

            if (!data[word]) {
                return NextResponse.json({ error: 'Word not found' }, { status: 404 });
            }

            data[word] = level;
            await fs.writeFile(dictPath, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, level });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error) {
        console.error('[Vocabulary API] PUT Error:', error);
        return NextResponse.json({
            error: 'Failed to update vocabulary',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/vocabulary
 * Delete vocabulary entries
 */
export async function DELETE(req: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify admin access
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const body = await req.json();
        const { type, words, dictName } = body;

        if (!type || !words || !Array.isArray(words)) {
            return NextResponse.json({ error: 'type and words array are required' }, { status: 400 });
        }

        if (type === 'llm-vocab') {
            const content = await fs.readFile(LLM_VOCAB_PATH, 'utf-8');
            const data: Record<string, LLMVocabEntry> = JSON.parse(content);

            let deletedCount = 0;
            for (const word of words) {
                if (data[word]) {
                    delete data[word];
                    deletedCount++;
                }
            }

            await fs.writeFile(LLM_VOCAB_PATH, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, deletedCount });

        } else if (type === 'frequency') {
            // Remove from patch file only
            let patchData: Record<string, number> = {};
            try {
                const patchContent = await fs.readFile(FREQUENCY_PATCH_PATH, 'utf-8');
                patchData = JSON.parse(patchContent);
            } catch { /* file may not exist */ }

            let deletedCount = 0;
            for (const word of words) {
                if (patchData[word] !== undefined) {
                    delete patchData[word];
                    deletedCount++;
                }
            }

            await fs.writeFile(FREQUENCY_PATCH_PATH, JSON.stringify(patchData, null, 2), 'utf-8');

            return NextResponse.json({ success: true, deletedCount });

        } else if (type === 'static-dict') {
            const dictPath = STATIC_DICTS[dictName];
            if (!dictPath) {
                return NextResponse.json({ error: `Unknown dictionary: ${dictName}` }, { status: 400 });
            }

            const content = await fs.readFile(dictPath, 'utf-8');
            const data: Record<string, string> = JSON.parse(content);

            let deletedCount = 0;
            for (const word of words) {
                if (data[word]) {
                    delete data[word];
                    deletedCount++;
                }
            }

            await fs.writeFile(dictPath, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, deletedCount });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error) {
        console.error('[Vocabulary API] DELETE Error:', error);
        return NextResponse.json({
            error: 'Failed to delete vocabulary',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

/**
 * POST /api/admin/vocabulary
 * Add new vocabulary entry
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify admin access
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const token = authHeader.replace('Bearer ', '');
            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const body = await req.json();
        const { type, word, level, reading, definition, rank, dictName } = body;

        if (!type || !word) {
            return NextResponse.json({ error: 'type and word are required' }, { status: 400 });
        }

        if (type === 'llm-vocab') {
            if (!level) {
                return NextResponse.json({ error: 'level is required for llm-vocab' }, { status: 400 });
            }

            const content = await fs.readFile(LLM_VOCAB_PATH, 'utf-8');
            const data: Record<string, LLMVocabEntry> = JSON.parse(content);

            if (data[word]) {
                return NextResponse.json({ error: 'Word already exists' }, { status: 409 });
            }

            data[word] = {
                level,
                reading: reading || '',
                definition: definition || '',
                source: 'manual',
                createdAt: new Date().toISOString(),
            };

            await fs.writeFile(LLM_VOCAB_PATH, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, entry: data[word] });

        } else if (type === 'frequency') {
            if (rank === undefined) {
                return NextResponse.json({ error: 'rank is required for frequency' }, { status: 400 });
            }

            let patchData: Record<string, number> = {};
            try {
                const patchContent = await fs.readFile(FREQUENCY_PATCH_PATH, 'utf-8');
                patchData = JSON.parse(patchContent);
            } catch { /* file may not exist */ }

            patchData[word] = rank;
            await fs.writeFile(FREQUENCY_PATCH_PATH, JSON.stringify(patchData, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, rank });

        } else if (type === 'static-dict') {
            if (!level) {
                return NextResponse.json({ error: 'level is required for static-dict' }, { status: 400 });
            }

            const dictPath = STATIC_DICTS[dictName];
            if (!dictPath) {
                return NextResponse.json({ error: `Unknown dictionary: ${dictName}` }, { status: 400 });
            }

            const content = await fs.readFile(dictPath, 'utf-8');
            const data: Record<string, string> = JSON.parse(content);

            if (data[word]) {
                return NextResponse.json({ error: 'Word already exists' }, { status: 409 });
            }

            data[word] = level;
            await fs.writeFile(dictPath, JSON.stringify(data, null, 2), 'utf-8');

            return NextResponse.json({ success: true, word, level });
        }

        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

    } catch (error) {
        console.error('[Vocabulary API] POST Error:', error);
        return NextResponse.json({
            error: 'Failed to add vocabulary',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
