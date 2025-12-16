export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface SentenceTimeline {
    index: number;
    text: string;
    start: number;
    end: number;
    speaker?: string;
}

/**
 * 获取生词来源的音频信息
 * 根据 source_id（shadowing_items的ID）查找音频URL和句子时间线
 */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const sourceId = url.searchParams.get('source_id');
        const context = url.searchParams.get('context'); // 用于匹配句子时间线

        if (!sourceId) {
            return NextResponse.json({ error: 'Missing source_id parameter' }, { status: 400 });
        }

        const authHeader = req.headers.get('authorization') || '';
        const hasBearer = /^Bearer\s+/.test(authHeader);
        let supabase: ReturnType<typeof createClient>;

        if (hasBearer) {
            supabase = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            });
        } else {
            const cookieStore = await cookies();
            supabase = createServerClient(supabaseUrl, supabaseAnon, {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set() { },
                    remove() { },
                },
            });
        }

        // 验证用户身份
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: '未授权' }, { status: 401 });
        }

        // 查询shadowing_items获取音频信息
        const { data: item, error } = await supabase
            .from('shadowing_items')
            .select('id, audio_url, audio_bucket, audio_path, text, sentence_timeline, notes')
            .eq('id', sourceId)
            .single();

        if (error || !item) {
            return NextResponse.json({ error: '未找到音频来源' }, { status: 404 });
        }

        // 类型断言
        const itemData = item as {
            id: string;
            audio_url: string | null;
            audio_bucket: string | null;
            audio_path: string | null;
            text: string | null;
            sentence_timeline: SentenceTimeline[] | null;
            notes: { audio_url?: string } | null;
        };

        // 构建音频URL（优先级：audio_url > notes.audio_url > storage path）
        let audioUrl = itemData.audio_url;
        if (!audioUrl && itemData.notes?.audio_url) {
            audioUrl = itemData.notes.audio_url;
        }
        if (!audioUrl && itemData.audio_bucket && itemData.audio_path) {
            audioUrl = `${supabaseUrl}/storage/v1/object/public/${itemData.audio_bucket}/${itemData.audio_path}`;
        }

        if (!audioUrl) {
            return NextResponse.json({ error: '音频URL不可用' }, { status: 404 });
        }

        // 解析sentence_timeline
        const timeline: SentenceTimeline[] = Array.isArray(itemData.sentence_timeline)
            ? itemData.sentence_timeline
            : [];

        // 如果提供了context，尝试匹配对应的句子时间段
        let matchedSegment: { startTime: number; endTime: number; text: string } | null = null;

        if (context && timeline.length > 0) {
            // 规范化context用于比较
            const normalizedContext = context.trim().toLowerCase();

            // 尝试找到包含context的句子
            for (const segment of timeline) {
                const segmentText = segment.text.trim().toLowerCase();
                if (segmentText.includes(normalizedContext) || normalizedContext.includes(segmentText)) {
                    matchedSegment = {
                        startTime: segment.start,
                        endTime: segment.end,
                        text: segment.text,
                    };
                    break;
                }
            }

            // 如果没有精确匹配，使用模糊匹配（查找包含关键词最多的句子）
            if (!matchedSegment) {
                const contextWords = normalizedContext.split(/\s+/).filter(w => w.length > 1);
                let bestMatch: { segment: SentenceTimeline; score: number } | null = null;

                for (const segment of timeline) {
                    const segmentWords = segment.text.toLowerCase().split(/\s+/);
                    let score = 0;
                    for (const word of contextWords) {
                        if (segmentWords.some(sw => sw.includes(word) || word.includes(sw))) {
                            score++;
                        }
                    }
                    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                        bestMatch = { segment, score };
                    }
                }

                if (bestMatch) {
                    matchedSegment = {
                        startTime: bestMatch.segment.start,
                        endTime: bestMatch.segment.end,
                        text: bestMatch.segment.text,
                    };
                }
            }
        }

        return NextResponse.json({
            audio_url: audioUrl,
            source_text: itemData.text,
            sentence_timeline: timeline,
            matched_segment: matchedSegment,
        });
    } catch (e) {
        console.error('source-audio route error:', e);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
