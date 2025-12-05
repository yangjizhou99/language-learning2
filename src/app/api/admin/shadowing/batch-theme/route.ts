export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10分钟超时，支持批量处理

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';

// 角色类型
interface RoleInfo {
    name: string;
    gender: 'male' | 'female';
}

// 音色映射类型
interface VoiceMapping {
    [roleKey: string]: {
        voice: string;
        provider: 'google' | 'gemini' | 'xunfei';
    };
}

// 根据语言和性别推荐音色
function getDefaultVoiceForGender(lang: string, gender: 'male' | 'female'): { voice: string; provider: 'google' | 'gemini' | 'xunfei' } {
    // 中文音色
    if (lang === 'zh') {
        if (gender === 'male') {
            return { voice: 'xunfei-x4_lingxiaoxuan_oral', provider: 'xunfei' };
        } else {
            return { voice: 'xunfei-x4_lingxiaojing_oral', provider: 'xunfei' };
        }
    }
    // 日语音色
    if (lang === 'ja') {
        if (gender === 'male') {
            return { voice: 'ja-JP-Neural2-C', provider: 'gemini' };
        } else {
            return { voice: 'ja-JP-Neural2-B', provider: 'gemini' };
        }
    }
    // 英语音色
    if (lang === 'en') {
        if (gender === 'male') {
            return { voice: 'en-US-Neural2-J', provider: 'google' };
        } else {
            return { voice: 'en-US-Neural2-F', provider: 'google' };
        }
    }
    // 默认
    return { voice: 'cmn-CN-Chirp3-HD-Kore', provider: 'gemini' };
}

// 从主题的所有小主题中提取唯一角色
function extractUniqueRoles(subtopics: any[]): Record<string, RoleInfo> {
    const roles: Record<string, RoleInfo> = {};

    for (const subtopic of subtopics) {
        if (subtopic.roles && typeof subtopic.roles === 'object') {
            for (const [key, value] of Object.entries(subtopic.roles)) {
                if (!roles[key]) {
                    if (typeof value === 'object' && value !== null) {
                        roles[key] = value as RoleInfo;
                    } else if (typeof value === 'string') {
                        // 旧格式兼容
                        roles[key] = { name: value, gender: 'male' };
                    }
                }
            }
        }
    }

    return roles;
}

// 生成角色-音色映射
function generateVoiceMapping(roles: Record<string, RoleInfo>, lang: string, customMapping?: VoiceMapping): VoiceMapping {
    const mapping: VoiceMapping = {};

    for (const [key, role] of Object.entries(roles)) {
        if (customMapping && customMapping[key]) {
            mapping[key] = customMapping[key];
        } else {
            mapping[key] = getDefaultVoiceForGender(lang, role.gender);
        }
    }

    return mapping;
}

export async function POST(req: NextRequest) {
    try {
        const auth = await requireAdmin(req);
        if (!auth.ok) {
            return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }

        const supabase = auth.supabase;
        const body = await req.json();
        const {
            theme_id,
            action, // 'extract_roles' | 'generate_audio' | 'generate_acu' | 'generate_translation'
            voice_mapping, // 自定义角色-音色映射
            provider = 'deepseek',
            model = 'deepseek-chat',
        } = body;

        if (!theme_id) {
            return NextResponse.json({ error: '缺少 theme_id' }, { status: 400 });
        }

        // 获取主题信息
        const { data: theme, error: themeError } = await supabase
            .from('shadowing_themes')
            .select('*')
            .eq('id', theme_id)
            .single();

        if (themeError || !theme) {
            return NextResponse.json({ error: '主题不存在' }, { status: 404 });
        }

        // 获取主题下的所有小主题
        const { data: subtopics, error: subtopicsError } = await supabase
            .from('shadowing_subtopics')
            .select('*')
            .eq('theme_id', theme_id)
            .eq('status', 'active')
            .order('sequence_order', { ascending: true });

        if (subtopicsError) {
            return NextResponse.json({ error: '获取小主题失败' }, { status: 500 });
        }

        // 提取角色
        if (action === 'extract_roles') {
            const roles = extractUniqueRoles(subtopics || []);
            const defaultMapping = generateVoiceMapping(roles, theme.lang);

            return NextResponse.json({
                success: true,
                theme: {
                    id: theme.id,
                    title: theme.title,
                    lang: theme.lang,
                    level: theme.level,
                },
                subtopics_count: subtopics?.length || 0,
                roles,
                default_voice_mapping: defaultMapping,
            });
        }

        // 获取主题下的所有草稿
        const { data: drafts, error: draftsError } = await supabase
            .from('shadowing_drafts')
            .select('*')
            .eq('theme_id', theme_id)
            .eq('status', 'draft');

        if (draftsError) {
            return NextResponse.json({ error: '获取草稿失败' }, { status: 500 });
        }

        // 批量生成语音
        if (action === 'generate_audio') {
            const roles = extractUniqueRoles(subtopics || []);
            const mapping = generateVoiceMapping(roles, theme.lang, voice_mapping);

            const results: any[] = [];
            const errors: any[] = [];

            for (const draft of (drafts || [])) {
                try {
                    // 调用语音合成API
                    const synthResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/shadowing/synthesize-dialogue`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': req.headers.get('Authorization') || '',
                        },
                        body: JSON.stringify({
                            text: draft.text,
                            lang: theme.lang,
                            voice_mapping: mapping,
                            speakingRate: 1.0,
                        }),
                    });

                    if (synthResponse.ok) {
                        const synthResult = await synthResponse.json();

                        // 更新草稿的音频URL
                        await supabase
                            .from('shadowing_drafts')
                            .update({
                                notes: {
                                    ...(draft.notes || {}),
                                    audio_url: synthResult.audio_url,
                                    voice_mapping: mapping,
                                },
                            })
                            .eq('id', draft.id);

                        results.push({
                            draft_id: draft.id,
                            title: draft.title,
                            audio_url: synthResult.audio_url,
                            success: true,
                        });
                    } else {
                        errors.push({
                            draft_id: draft.id,
                            title: draft.title,
                            error: '语音合成失败',
                        });
                    }
                } catch (e: any) {
                    errors.push({
                        draft_id: draft.id,
                        title: draft.title,
                        error: e.message,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                processed: results.length,
                failed: errors.length,
                results,
                errors,
                voice_mapping: mapping,
            });
        }

        // 批量生成ACU
        if (action === 'generate_acu') {
            const results: any[] = [];
            const errors: any[] = [];

            for (const draft of (drafts || [])) {
                try {
                    const acuResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/shadowing/acu/segment`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': req.headers.get('Authorization') || '',
                        },
                        body: JSON.stringify({
                            id: draft.id,
                            text: draft.text,
                            lang: theme.lang,
                            genre: draft.genre,
                            provider,
                            model,
                        }),
                    });

                    if (acuResponse.ok) {
                        const acuResult = await acuResponse.json();
                        results.push({
                            draft_id: draft.id,
                            title: draft.title,
                            unit_count: acuResult.unitCount || acuResult.units?.length || 0,
                            success: true,
                        });
                    } else {
                        errors.push({
                            draft_id: draft.id,
                            title: draft.title,
                            error: 'ACU生成失败',
                        });
                    }
                } catch (e: any) {
                    errors.push({
                        draft_id: draft.id,
                        title: draft.title,
                        error: e.message,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                processed: results.length,
                failed: errors.length,
                results,
                errors,
            });
        }

        // 批量生成翻译
        if (action === 'generate_translation') {
            const results: any[] = [];
            const errors: any[] = [];

            for (const draft of (drafts || [])) {
                try {
                    const transResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/shadowing/translate/one`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': req.headers.get('Authorization') || '',
                        },
                        body: JSON.stringify({
                            id: draft.id,
                            scope: 'drafts',
                            provider,
                            model,
                            force: false,
                        }),
                    });

                    if (transResponse.ok) {
                        const transResult = await transResponse.json();
                        results.push({
                            draft_id: draft.id,
                            title: draft.title,
                            translations: Object.keys(transResult.translations || {}),
                            success: true,
                        });
                    } else {
                        errors.push({
                            draft_id: draft.id,
                            title: draft.title,
                            error: '翻译生成失败',
                        });
                    }
                } catch (e: any) {
                    errors.push({
                        draft_id: draft.id,
                        title: draft.title,
                        error: e.message,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                processed: results.length,
                failed: errors.length,
                results,
                errors,
            });
        }

        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    } catch (error: any) {
        console.error('批量处理失败:', error);
        return NextResponse.json({ error: error.message || '服务器错误' }, { status: 500 });
    }
}
