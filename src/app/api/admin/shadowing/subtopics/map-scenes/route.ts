export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

type Provider = 'openrouter' | 'deepseek' | 'openai';

export async function POST(req: NextRequest) {
    console.log('[map-scenes] POST called');
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const supabase = auth.supabase;
        const adminUser = auth.user;
        const body = await req.json();
        const subtopicId: string | undefined = body?.subtopic_id || body?.subtopicId;
        const providerBody: Provider | undefined = body?.provider;
        const modelBody: string | undefined = body?.model;
        const temperatureBody: number | undefined = body?.temperature;

        if (!subtopicId) {
            return NextResponse.json({ error: 'subtopic_id is required' }, { status: 400 });
        }

        // 读取小主题信息
        const { data: subtopic, error: subtopicError } = await supabase
            .from('shadowing_subtopics')
            .select('*')
            .eq('id', subtopicId)
            .single();

        if (subtopicError || !subtopic) {
            console.log('[map-scenes] subtopic query failed:', { subtopicId, subtopicError, subtopic });
            return NextResponse.json(
                { error: 'subtopic_not_found', detail: subtopicError?.message },
                { status: 404 },
            );
        }
        console.log('[map-scenes] subtopic found:', subtopic.id);

        // 读取父主题信息（用于补充上下文）
        const { data: theme } = await supabase
            .from('shadowing_themes')
            .select('id, title, desc')
            .eq('id', subtopic.theme_id)
            .single();

        // 读取场景标签列表
        const { data: scenes, error: sceneError } = await supabase
            .from('scene_tags')
            .select('scene_id, name_cn, name_en, description')
            .order('scene_id', { ascending: true });

        if (sceneError || !scenes || scenes.length === 0) {
            return NextResponse.json(
                { error: 'scene_tags_not_ready', detail: sceneError?.message },
                { status: 500 },
            );
        }

        const providerEnv = (providerBody || process.env.AI_PROVIDER || 'openrouter') as Provider;
        const modelEnv = modelBody || process.env.AI_DEFAULT_MODEL || 'openrouter/auto';

        const sceneListText = scenes
            .map(
                (s: any) =>
                    `- ${s.scene_id}: ${s.name_cn || s.name_en || ''} ` +
                    `${s.description ? `（${s.description}）` : ''}`,
            )
            .join('\n');

        // 提取角色信息
        let rolesText = '';
        if (subtopic.roles && typeof subtopic.roles === 'object') {
            const roleEntries = Object.entries(subtopic.roles);
            if (roleEntries.length > 0) {
                rolesText = roleEntries
                    .map(([key, value]: [string, any]) => {
                        if (typeof value === 'object' && value.name) {
                            return `${key}: ${value.name}${value.gender ? ` (${value.gender})` : ''}`;
                        }
                        return `${key}: ${value}`;
                    })
                    .join(', ');
            }
        }

        const systemPrompt =
            '你是一个语言学习网站的"场景标签分配器"。' +
            '对于给定的跟读练习小主题（subtopic），你需要根据其标题、说明、角色信息等，' +
            '判断它与各个"学习场景标签"的相关程度，并为每个场景打 0~1 的权重。';

        const userPrompt = [
            '【小主题信息】',
            `ID: ${subtopic.id}`,
            `语言: ${subtopic.lang}`,
            `等级: L${subtopic.level}`,
            `体裁: ${subtopic.genre}`,
            `标题: ${subtopic.title || '(无)'}`,
            (subtopic as any).one_line ? `一句话描述: ${(subtopic as any).one_line}` : '',
            (subtopic as any).description ? `详细说明: ${(subtopic as any).description}` : '',
            rolesText ? `角色: ${rolesText}` : '',
            theme ? `所属大主题: ${theme.title}` : '',
            '',
            '【可用场景标签列表】(scene_tags)',
            sceneListText,
            '',
            '请根据小主题的具体内容（标题、一句话描述、角色等），判断它与各个场景的相关程度，为每个场景分配 0~1 的权重。',
            '要求：',
            '- 每个 scene_id 都要给出一个 0~1 的实数权重（可以保留 1~2 位小数）。',
            '- 至少有 2~3 个场景的权重大于 0.5，表示小主题的主要应用场景。',
            '- 根据小主题的具体内容匹配，比大主题匹配更精确。',
            '',
            '输出格式（只输出 JSON，对应字段名不要改）：',
            '{',
            '  "weights": [',
            '    { "scene_id": "daily_life", "weight": 0.8 },',
            '    { "scene_id": "travel_and_directions", "weight": 0.6 }',
            '  ]',
            '}',
            '',
            '注意：',
            '- weights 数组中每个 scene_id 只能出现一次。',
            '- 如果某个场景几乎无关，也可以给 0.0 或接近 0 的权重（如 0.05）。',
        ]
            .filter(Boolean)
            .join('\n');

        const result = await chatJSON({
            provider: providerEnv,
            model: modelEnv,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_json: true,
            temperature: typeof temperatureBody === 'number' ? temperatureBody : 0.2,
            timeoutMs: 60_000,
            // Note: userId removed to use env API keys directly for admin operations
        });

        let parsed: any = null;
        try {
            if (typeof result.content === 'string') {
                parsed = JSON.parse(result.content);
            } else {
                parsed = result.content;
            }
        } catch (e) {
            // 尝试从字符串中提取 JSON 块
            try {
                const text = String(result.content || '');
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                }
            } catch (e2) {
                console.error('Failed to parse scene weights JSON:', e2, 'raw:', result.content);
                return NextResponse.json({ error: 'invalid_json_from_model' }, { status: 500 });
            }
        }

        if (!parsed || !Array.isArray(parsed.weights)) {
            return NextResponse.json(
                { error: 'invalid_response_format', detail: 'weights array missing' },
                { status: 500 },
            );
        }

        const rows = (parsed.weights as Array<{ scene_id: string; weight: number }>).map((w) => {
            const raw = typeof w.weight === 'number' ? w.weight : 0;
            let val = Number.isFinite(raw) ? raw : 0;
            if (val < 0) val = 0;
            if (val > 1) val = 1;
            return {
                subtopic_id: subtopic.id as string,
                scene_id: String(w.scene_id),
                weight: val,
                updated_at: new Date().toISOString(),
            };
        });

        // 过滤掉无效 scene_id（不在 scene_tags 表中的）
        const validSceneIds = new Set((scenes || []).map((s: any) => s.scene_id));
        const filteredRows = rows.filter((r) => validSceneIds.has(r.scene_id));

        // 若无任何有效 scene_id，则保留原有映射并返回错误
        if (filteredRows.length === 0) {
            return NextResponse.json(
                {
                    error: 'no_valid_scene_weights',
                    detail: 'LLM returned no valid scene_ids; existing mapping is kept.',
                },
                { status: 400 },
            );
        }

        const newSceneIds = filteredRows.map((r) => r.scene_id);

        // 先插入/更新新的向量，再清理多余的旧向量
        let insertedCount = 0;
        const { error: insertError } = await supabase
            .from('subtopic_scene_vectors')
            .upsert(filteredRows, { onConflict: 'subtopic_id,scene_id' });

        if (insertError) {
            console.error('Upsert subtopic_scene_vectors error:', insertError);
            return NextResponse.json(
                { error: 'db_error', detail: insertError.message },
                { status: 500 },
            );
        }
        insertedCount = filteredRows.length;

        // 清理不再需要的旧场景向量
        const { error: deleteError } = await supabase
            .from('subtopic_scene_vectors')
            .delete()
            .eq('subtopic_id', subtopic.id)
            .not('scene_id', 'in', `(${newSceneIds.join(',')})`);

        if (deleteError) {
            console.error('Cleanup extra subtopic_scene_vectors error:', deleteError);
        }

        return NextResponse.json({
            success: true,
            subtopic_id: subtopic.id,
            inserted_count: insertedCount,
            weights: filteredRows,
        });
    } catch (error) {
        console.error('Error in /api/admin/shadowing/subtopics/map-scenes:', error);
        const err: any = error;
        return NextResponse.json(
            {
                error: 'internal_error',
                detail: err?.message || String(error),
            },
            { status: 500 },
        );
    }
}
