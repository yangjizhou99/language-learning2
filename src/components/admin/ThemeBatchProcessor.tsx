'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Volume2, Languages, BookOpen, Play, Users, RefreshCw, Zap, Settings,
    ChevronDown, CheckCheck, Square, Check, Loader2, AlertCircle, CheckCircle2, Target, HelpCircle, Undo2
} from 'lucide-react';
import CandidateVoiceSelector from '@/components/CandidateVoiceSelector';

interface Theme {
    id: string;
    title: string;
    lang: string;
    level: number;
    subtopic_count?: number;
    draft_count?: number;
}

interface CandidateVoice {
    name: string;
    ssml_gender?: string;
    ssmlGender?: string;
    display_name?: string;
}

type ThemeStatus = 'pending' | 'processing' | 'done' | 'error';

const LANGUAGE_OPTIONS = [
    { value: 'en', label: '英语' },
    { value: 'ja', label: '日语' },
    { value: 'zh', label: '中文' },
    { value: 'ko', label: '韩语' },
];

export default function ThemeBatchProcessor() {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [filterLang, setFilterLang] = useState<string>('all');
    const [filterLevel, setFilterLevel] = useState<string>('all');

    // 音色选择
    const [candidateVoices, setCandidateVoices] = useState<CandidateVoice[]>([]);
    const [showVoiceSelector, setShowVoiceSelector] = useState(false);
    const [voiceLanguage, setVoiceLanguage] = useState('zh');

    // 操作选择
    const [doAudio, setDoAudio] = useState(true);
    const [doACU, setDoACU] = useState(true);
    const [doTranslation, setDoTranslation] = useState(true);
    const [doPublish, setDoPublish] = useState(true);
    const [doSceneVector, setDoSceneVector] = useState(false);
    const [doQuiz, setDoQuiz] = useState(false);
    const [doUnpublish, setDoUnpublish] = useState(false);
    const [transTargetLanguages, setTransTargetLanguages] = useState<string[]>([]);

    // 跳过选项
    const [skipExistingAudio, setSkipExistingAudio] = useState(true);
    const [skipExistingSceneVector, setSkipExistingSceneVector] = useState(true);
    const [skipExistingACU, setSkipExistingACU] = useState(true);
    const [skipExistingQuiz, setSkipExistingQuiz] = useState(true);

    // 性能参数
    const [themeConcurrency, setThemeConcurrency] = useState(2);
    const [draftConcurrency, setDraftConcurrency] = useState(6);
    const [retries, setRetries] = useState(2);
    const [throttle, setThrottle] = useState(200);
    const [showSettings, setShowSettings] = useState(false);

    // 处理状态
    const [processing, setProcessing] = useState(false);
    const [themeStatuses, setThemeStatuses] = useState<Record<string, ThemeStatus>>({});
    const [overallProgress, setOverallProgress] = useState({ current: 0, total: 0 });
    const [currentProgress, setCurrentProgress] = useState({ step: '', current: 0, total: 0, currentItem: '' });
    const [logs, setLogs] = useState<string[]>([]);

    // 缓存的音色映射（整个批次使用同一套）
    const [cachedVoiceMapping, setCachedVoiceMapping] = useState<Record<string, string> | null>(null);

    // 加载主题列表
    useEffect(() => {
        loadThemes();
    }, []);

    async function loadThemes() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('shadowing_themes')
                .select('id, title, lang, level')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (!error && data) {
                // 获取每个主题的草稿数量
                const themesWithCount = await Promise.all(
                    data.map(async (theme) => {
                        const [subtopicRes, draftRes] = await Promise.all([
                            supabase
                                .from('shadowing_subtopics')
                                .select('*', { count: 'exact', head: true })
                                .eq('theme_id', theme.id),
                            supabase
                                .from('shadowing_drafts')
                                .select('*', { count: 'exact', head: true })
                                .eq('theme_id', theme.id)
                                .eq('status', 'draft'),
                        ]);
                        return {
                            ...theme,
                            subtopic_count: subtopicRes.count || 0,
                            draft_count: draftRes.count || 0,
                        };
                    })
                );
                setThemes(themesWithCount);
            }
        } catch (e) {
            console.error('加载主题失败:', e);
        } finally {
            setLoading(false);
        }
    }

    // 筛选后的主题
    const filteredThemes = themes.filter(theme => {
        if (filterLang !== 'all' && theme.lang !== filterLang) return false;
        if (filterLevel !== 'all' && theme.level !== parseInt(filterLevel)) return false;
        return true;
    });

    // 全选/反选当前筛选的主题
    function toggleSelectAll() {
        const filteredIds = filteredThemes.map(t => t.id);
        const allSelected = filteredIds.every(id => selectedThemes.has(id));

        if (allSelected) {
            // 反选
            setSelectedThemes(prev => {
                const next = new Set(prev);
                filteredIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            // 全选
            setSelectedThemes(prev => {
                const next = new Set(prev);
                filteredIds.forEach(id => next.add(id));
                return next;
            });
        }
    }

    function toggleTheme(themeId: string) {
        setSelectedThemes(prev => {
            const next = new Set(prev);
            if (next.has(themeId)) {
                next.delete(themeId);
            } else {
                next.add(themeId);
            }
            return next;
        });
    }

    function toggleTransLang(lang: string) {
        setTransTargetLanguages(prev => {
            if (prev.includes(lang)) {
                return prev.filter(l => l !== lang);
            } else {
                return [...prev, lang];
            }
        });
    }

    const wait = (ms: number) => new Promise<void>(resolve => {
        const timer = (globalThis as any).setTimeout(resolve, ms);
        if (typeof timer === 'object' && 'unref' in timer) timer.unref();
    });

    // 并发处理单个主题
    async function processTheme(themeId: string, headers: Record<string, string>, voiceMapping: Record<string, string> | null): Promise<boolean> {
        setThemeStatuses(prev => ({ ...prev, [themeId]: 'processing' }));
        const theme = themes.find(t => t.id === themeId);

        try {
            // 如果是撤回发布模式，直接处理
            if (doUnpublish) {
                setLogs(prev => [...prev, `📋 ${theme?.title}: 开始撤回发布`]);
                await processThemeUnpublish(themeId, headers);
                setThemeStatuses(prev => ({ ...prev, [themeId]: 'done' }));
                setLogs(prev => [...prev, `✅ ${theme?.title}: 撤回完成`]);
                return true;
            }

            // 获取主题下所有草稿
            const { data: drafts } = await supabase
                .from('shadowing_drafts')
                .select('*')
                .eq('theme_id', themeId)
                .eq('status', 'draft')
                .order('created_at', { ascending: true });

            if (!drafts || drafts.length === 0) {
                setLogs(prev => [...prev, `⚠️ ${theme?.title}: 无待处理草稿`]);
                setThemeStatuses(prev => ({ ...prev, [themeId]: 'done' }));
                return true;
            }

            setLogs(prev => [...prev, `📋 ${theme?.title}: 开始处理 ${drafts.length} 个草稿`]);


            // 生成语音
            if (doAudio) {
                await processDraftsBatch(drafts, themeId, 'audio', headers, theme?.lang || 'zh', voiceMapping);
            }

            // 生成ACU
            if (doACU) {
                await processDraftsBatch(drafts, themeId, 'acu', headers, theme?.lang || 'zh');
            }

            // 生成场景向量（针对小主题）
            if (doSceneVector) {
                await processSubtopicsSceneVectors(themeId, headers);
            }

            // 生成翻译
            if (doTranslation && transTargetLanguages.length > 0) {
                await processDraftsBatch(drafts, themeId, 'translation', headers, theme?.lang || 'zh');
            }

            // 生成理解题 (在发布前处理，因为 API 查询 status='draft' 的草稿)
            if (doQuiz) {
                await processThemeQuiz(themeId, headers);
            }

            // 自动发布 (在理解题生成后发布，quiz_questions 会一起复制到 items)
            if (doPublish) {
                await processDraftsBatch(drafts, themeId, 'publish', headers, theme?.lang || 'zh');
            }

            // 撤回发布 (将已发布的 items 删除，并将 drafts 恢复为 draft 状态)
            if (doUnpublish) {
                await processThemeUnpublish(themeId, headers);
            }

            setThemeStatuses(prev => ({ ...prev, [themeId]: 'done' }));
            setLogs(prev => [...prev, `✅ ${theme?.title}: 处理完成`]);
            return true;
        } catch (e: any) {
            setThemeStatuses(prev => ({ ...prev, [themeId]: 'error' }));
            setLogs(prev => [...prev, `❌ ${theme?.title}: ${e.message}`]);
            return false;
        }
    }

    // 批量处理草稿（按类型）
    async function processDraftsBatch(
        drafts: any[],
        themeId: string,
        type: 'audio' | 'acu' | 'translation' | 'publish',
        headers: Record<string, string>,
        lang: string,
        voiceMapping: Record<string, string> | null = null
    ) {
        const theme = themes.find(t => t.id === themeId);
        const typeLabels = { audio: '语音', acu: 'ACU', translation: '翻译', publish: '发布' };

        setCurrentProgress({
            step: `${theme?.title} - ${typeLabels[type]}`,
            current: 0,
            total: drafts.length,
            currentItem: ''
        });

        let success = 0;
        let fail = 0;

        // 按并发数分批处理
        for (let i = 0; i < drafts.length; i += draftConcurrency) {
            const batch = drafts.slice(i, Math.min(i + draftConcurrency, drafts.length));

            const results = await Promise.all(
                batch.map(async (draft) => {
                    for (let attempt = 0; attempt <= retries; attempt++) {
                        try {
                            const result = await processSingleDraft(draft, type, headers, lang, voiceMapping);
                            return result;
                        } catch (e) {
                            if (attempt === retries) return false;
                            await wait(1000 * (attempt + 1)); // 指数退避
                        }
                    }
                    return false;
                })
            );

            success += results.filter(r => r).length;
            fail += results.filter(r => !r).length;

            setCurrentProgress(prev => ({
                ...prev,
                current: Math.min(i + batch.length, drafts.length)
            }));

            // 节流延迟
            if (throttle > 0 && i + draftConcurrency < drafts.length) {
                await wait(throttle);
            }
        }

        setLogs(prev => [...prev, `   ${typeLabels[type]}: ${success}成功 ${fail}失败`]);
    }

    // 处理主题下所有小主题的场景向量生成
    async function processSubtopicsSceneVectors(themeId: string, headers: Record<string, string>) {
        const theme = themes.find(t => t.id === themeId);

        // 获取该主题下的所有小主题
        const { data: subtopics, error: subtopicsError } = await supabase
            .from('shadowing_subtopics')
            .select('id, title')
            .eq('theme_id', themeId)
            .order('sequence_order', { ascending: true });

        if (subtopicsError || !subtopics || subtopics.length === 0) {
            console.log('[SceneVector] subtopics query result:', { themeId, subtopics, subtopicsError });
            setLogs(prev => [...prev, `   场景向量: 无小主题可处理 (theme_id=${themeId}, error=${subtopicsError?.message || 'none'})`]);
            return;
        }

        setCurrentProgress({
            step: `${theme?.title} - 场景向量`,
            current: 0,
            total: subtopics.length,
            currentItem: ''
        });

        let success = 0;
        let fail = 0;

        // 按并发数分批处理
        for (let i = 0; i < subtopics.length; i += draftConcurrency) {
            const batch = subtopics.slice(i, Math.min(i + draftConcurrency, subtopics.length));

            const results = await Promise.all(
                batch.map(async (subtopic) => {
                    for (let attempt = 0; attempt <= retries; attempt++) {
                        try {
                            // 检查是否跳过已有向量
                            if (skipExistingSceneVector) {
                                const { data: existingVectors } = await supabase
                                    .from('subtopic_scene_vectors')
                                    .select('scene_id')
                                    .eq('subtopic_id', subtopic.id)
                                    .limit(1);

                                if (existingVectors && existingVectors.length > 0) {
                                    return true; // 已有向量，跳过
                                }
                            }

                            const response = await fetch('/api/admin/shadowing/subtopics/map-scenes', {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({
                                    subtopic_id: subtopic.id,
                                    provider: 'deepseek',
                                    model: 'deepseek-chat',
                                    temperature: 0.2,
                                }),
                            });
                            return response.ok;
                        } catch (e) {
                            if (attempt === retries) return false;
                            await wait(1000 * (attempt + 1)); // 指数退避
                        }
                    }
                    return false;
                })
            );

            success += results.filter(r => r).length;
            fail += results.filter(r => !r).length;

            setCurrentProgress(prev => ({
                ...prev,
                current: Math.min(i + batch.length, subtopics.length)
            }));

            // 节流延迟
            if (throttle > 0 && i + draftConcurrency < subtopics.length) {
                await wait(throttle);
            }
        }

        setLogs(prev => [...prev, `   场景向量: ${success}成功 ${fail}失败`]);
    }

    // 处理主题下所有草稿的理解题生成
    async function processThemeQuiz(themeId: string, headers: Record<string, string>) {
        const theme = themes.find(t => t.id === themeId);

        setCurrentProgress({
            step: `${theme?.title} - 理解题`,
            current: 0,
            total: 1,
            currentItem: ''
        });

        try {
            const response = await fetch('/api/admin/shadowing/quiz/generate', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    theme_id: themeId,
                    scope: 'drafts', // 在草稿阶段生成理解题
                    provider: 'deepseek',
                    model: 'deepseek-chat',
                    temperature: 0.7,
                    skip_existing: skipExistingQuiz,
                    concurrency: 3,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                setLogs(prev => [...prev, `   理解题: 生成失败 - ${errorText}`]);
                return;
            }

            // 处理SSE响应
            const reader = response.body?.getReader();
            if (!reader) {
                setLogs(prev => [...prev, `   理解题: 无法读取响应流`]);
                return;
            }

            const decoder = new TextDecoder();
            let completed = 0;
            let failed = 0;
            let total = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === 'start') {
                                total = data.total;
                                setCurrentProgress(prev => ({
                                    ...prev,
                                    total: total,
                                    currentItem: `已跳过 ${data.skipped} 个已有题目`
                                }));
                            } else if (data.type === 'progress') {
                                completed = data.completed;
                                failed = data.failed;
                                setCurrentProgress(prev => ({
                                    ...prev,
                                    current: completed + failed
                                }));
                            } else if (data.type === 'complete') {
                                completed = data.completed;
                                failed = data.failed;
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }

            setLogs(prev => [...prev, `   理解题: ${completed}成功 ${failed}失败`]);
        } catch (e: any) {
            setLogs(prev => [...prev, `   理解题: ${e.message}`]);
        }
    }

    // 撤回发布：通过approved状态的drafts调用revert，删除对应items并恢复drafts
    async function processThemeUnpublish(themeId: string, headers: Record<string, string>) {
        const theme = themes.find(t => t.id === themeId);

        setCurrentProgress({
            step: `${theme?.title} - 撤回发布`,
            current: 0,
            total: 1,
            currentItem: ''
        });

        try {
            // 1. 获取该主题下所有已发布(approved)的drafts
            const { data: approvedDrafts, error: draftsError } = await supabase
                .from('shadowing_drafts')
                .select('id, title')
                .eq('theme_id', themeId)
                .eq('status', 'approved');

            if (draftsError) {
                setLogs(prev => [...prev, `   撤回发布: 获取drafts失败 - ${draftsError.message}`]);
                return;
            }

            if (!approvedDrafts || approvedDrafts.length === 0) {
                setLogs(prev => [...prev, `   撤回发布: 无已发布drafts`]);
                return;
            }

            setCurrentProgress(prev => ({
                ...prev,
                total: approvedDrafts.length,
                currentItem: `共 ${approvedDrafts.length} 个已发布drafts`
            }));

            // 2. 对每个draft调用revert action
            let success = 0;
            let fail = 0;

            for (let i = 0; i < approvedDrafts.length; i++) {
                const draft = approvedDrafts[i];
                try {
                    const response = await fetch(`/api/admin/shadowing/drafts/${draft.id}`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ action: 'revert' }),
                    });

                    if (response.ok) {
                        success++;
                    } else {
                        fail++;
                        console.error(`Revert failed for draft ${draft.id}:`, await response.text());
                    }
                } catch (e) {
                    fail++;
                    console.error(`Revert error for draft ${draft.id}:`, e);
                }

                setCurrentProgress(prev => ({
                    ...prev,
                    current: i + 1
                }));
            }

            setLogs(prev => [...prev, `   撤回发布: ${success}成功 ${fail}失败`]);
        } catch (e: any) {
            setLogs(prev => [...prev, `   撤回发布: ${e.message}`]);
        }
    }

    // 处理单个草稿
    async function processSingleDraft(
        draft: any,
        type: 'audio' | 'acu' | 'translation' | 'publish',
        headers: Record<string, string>,
        lang: string,
        voiceMapping: Record<string, string> | null = null
    ): Promise<boolean> {
        try {
            if (type === 'audio') {
                // 跳过已有音频
                if (skipExistingAudio && draft.notes?.audio_url) {
                    return true;
                }

                // 构建说话者音色映射
                const draftRoles = draft.notes?.roles || {};
                const speakerVoicesForDraft: Record<string, string> = {};

                // 优先使用传入的 voiceMapping，否则使用缓存的
                const effectiveVoiceMapping = voiceMapping || cachedVoiceMapping;

                if (effectiveVoiceMapping) {
                    for (const [label, roleInfo] of Object.entries(draftRoles)) {
                        if (roleInfo && typeof roleInfo === 'object') {
                            const charName = (roleInfo as any).name;
                            if (charName && effectiveVoiceMapping[charName]) {
                                speakerVoicesForDraft[label] = effectiveVoiceMapping[charName];
                            }
                        }
                    }
                }

                // 刷新 session 以确保 token 有效
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token;
                const currentHeaders = {
                    ...headers,
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                };

                const response = await fetch('/api/admin/shadowing/synthesize-dialogue', {
                    method: 'POST',
                    headers: currentHeaders,
                    body: JSON.stringify({
                        text: draft.text,
                        lang: lang,
                        speakerVoices: speakerVoicesForDraft,
                        speakingRate: 1.0,
                        draftId: draft.id,
                        voiceMapping: voiceMapping,
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('TTS API Response:', result);

                    if (!result.audio_url) {
                        console.error('TTS API returned no audio_url');
                        return false;
                    }

                    console.log('DB Update handled by API');
                    return true;
                }
                console.error('TTS API Failed:', response.status, await response.text());
                return false;
            } else if (type === 'acu') {
                // 跳过已有ACU
                if (skipExistingACU && draft.notes?.acu_units?.length > 0) {
                    return true;
                }

                const response = await fetch('/api/admin/shadowing/acu/segment', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        id: draft.id,
                        text: draft.text,
                        lang: lang,
                        genre: draft.genre,
                        provider: 'deepseek',
                        model: 'deepseek-chat',
                    }),
                });
                return response.ok;
            } else if (type === 'translation') {
                const response = await fetch('/api/admin/shadowing/translate/one', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        id: draft.id,
                        scope: 'drafts',
                        force: false,
                        targetLanguages: transTargetLanguages,
                    }),
                });
                return response.ok;
            } else if (type === 'publish') {
                const response = await fetch(`/api/admin/shadowing/drafts/${draft.id}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ action: 'publish' }),
                });
                return response.ok;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    // 开始批量处理
    async function startBatchProcess() {
        if (selectedThemes.size === 0) {
            setLogs(['❌ 请先选择要处理的主题']);
            return;
        }
        if (candidateVoices.length === 0 && doAudio) {
            setLogs(['❌ 请先点击"设置备选音色"选择音色']);
            return;
        }
        if (doTranslation && transTargetLanguages.length === 0) {
            setLogs(['❌ 请至少选择一个翻译目标语言']);
            return;
        }

        setProcessing(true);
        setLogs([]);
        setThemeStatuses({});
        setOverallProgress({ current: 0, total: selectedThemes.size });

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        try {
            // 预先收集所有角色并分配音色
            let voiceMapping: Record<string, string> | null = cachedVoiceMapping;
            if (doAudio && !voiceMapping) {
                voiceMapping = await prepareVoiceMapping(Array.from(selectedThemes));
            }

            const themeIds = Array.from(selectedThemes);
            setLogs([`🚀 开始处理 ${themeIds.length} 个主题 (并发: ${themeConcurrency})`]);

            // 初始化所有主题状态
            const initialStatuses: Record<string, ThemeStatus> = {};
            themeIds.forEach(id => { initialStatuses[id] = 'pending'; });
            setThemeStatuses(initialStatuses);

            // 按并发数分批处理主题
            for (let i = 0; i < themeIds.length; i += themeConcurrency) {
                const batch = themeIds.slice(i, Math.min(i + themeConcurrency, themeIds.length));

                await Promise.all(
                    batch.map(themeId => processTheme(themeId, headers, voiceMapping))
                );

                setOverallProgress(prev => ({
                    ...prev,
                    current: Math.min(i + batch.length, themeIds.length)
                }));

                // 主题间延迟
                if (i + themeConcurrency < themeIds.length) {
                    await wait(500);
                }
            }

            setLogs(prev => [...prev, '🎉 批量处理完成!']);
        } catch (e: any) {
            setLogs(prev => [...prev, `❌ 处理出错: ${e.message}`]);
        } finally {
            setProcessing(false);
            setCurrentProgress({ step: '', current: 0, total: 0, currentItem: '' });
            // 刷新主题列表
            loadThemes();
        }
    }

    // 预先准备音色映射
    async function prepareVoiceMapping(themeIds: string[]) {
        const allCharacters: Record<string, string> = {};

        for (const themeId of themeIds) {
            const { data: drafts } = await supabase
                .from('shadowing_drafts')
                .select('notes')
                .eq('theme_id', themeId)
                .eq('status', 'draft');

            if (drafts) {
                for (const draft of drafts) {
                    const draftRoles = draft.notes?.roles || {};
                    for (const [_, value] of Object.entries(draftRoles)) {
                        if (value && typeof value === 'object') {
                            const { name, gender } = value as { name?: string; gender?: string };
                            if (name && !allCharacters[name]) {
                                allCharacters[name] = gender || 'unknown';
                            }
                        }
                    }
                }
            }
        }

        // 为每个角色名字分配音色
        const maleVoices = candidateVoices.filter(v => {
            const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
            return g === 'male' || g.includes('男');
        });
        const femaleVoices = candidateVoices.filter(v => {
            const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
            return g === 'female' || g.includes('女');
        });
        const pickRandom = (arr: CandidateVoice[]) =>
            arr.length ? arr[Math.floor(Math.random() * arr.length)].name : '';

        const mapping: Record<string, string> = {};
        for (const [charName, gender] of Object.entries(allCharacters)) {
            if (gender === 'male' && maleVoices.length > 0) {
                mapping[charName] = pickRandom(maleVoices);
            } else if (gender === 'female' && femaleVoices.length > 0) {
                mapping[charName] = pickRandom(femaleVoices);
            } else if (candidateVoices.length > 0) {
                mapping[charName] = pickRandom(candidateVoices);
            }
        }

        setCachedVoiceMapping(mapping);
        setLogs(prev => [
            ...prev,
            `🎤 已分配 ${Object.keys(mapping).length} 个角色音色`,
        ]);
        return mapping;
    }

    // 计算男女音色数量
    const maleCount = candidateVoices.filter((v) => {
        const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
        return g === 'male' || g.includes('男');
    }).length;
    const femaleCount = candidateVoices.filter((v) => {
        const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
        return g === 'female' || g.includes('女');
    }).length;

    const selectedCount = selectedThemes.size;
    const totalDrafts = Array.from(selectedThemes).reduce((sum, id) => {
        const theme = themes.find(t => t.id === id);
        return sum + (theme?.draft_count || 0);
    }, 0);

    const getStatusIcon = (status: ThemeStatus) => {
        switch (status) {
            case 'pending': return <Square className="w-4 h-4 text-gray-400" />;
            case 'processing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'done': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
        }
    };

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    主题批量处理
                    <Badge variant="outline" className="ml-2 text-xs">
                        多选并发
                    </Badge>
                </CardTitle>
                <CardDescription>
                    选择多个主题一键处理至可发布状态
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 主题筛选 */}
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <Label>筛选语言</Label>
                        <Select value={filterLang} onValueChange={setFilterLang}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部语言</SelectItem>
                                {LANGUAGE_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <Label>筛选等级</Label>
                        <Select value={filterLevel} onValueChange={setFilterLevel}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部等级</SelectItem>
                                {[1, 2, 3, 4, 5].map(l => (
                                    <SelectItem key={l} value={l.toString()}>L{l}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" onClick={toggleSelectAll}>
                        <CheckCheck className="w-4 h-4 mr-2" />
                        {filteredThemes.every(t => selectedThemes.has(t.id)) ? '反选' : '全选'}
                    </Button>
                    <Button variant="ghost" onClick={loadThemes} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* 主题列表 */}
                <ScrollArea className="h-48 border rounded-lg p-2">
                    {filteredThemes.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            暂无符合条件的主题
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredThemes.map(theme => (
                                <div
                                    key={theme.id}
                                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 ${selectedThemes.has(theme.id) ? 'bg-muted' : ''
                                        }`}
                                    onClick={() => toggleTheme(theme.id)}
                                >
                                    <Checkbox
                                        checked={selectedThemes.has(theme.id)}
                                        onCheckedChange={() => toggleTheme(theme.id)}
                                    />
                                    {themeStatuses[theme.id] && getStatusIcon(themeStatuses[theme.id])}
                                    <Badge variant="outline">{theme.lang}</Badge>
                                    <Badge variant="secondary">L{theme.level}</Badge>
                                    <span className="flex-1 truncate">{theme.title}</span>
                                    <span className="text-muted-foreground text-xs">
                                        {theme.draft_count}个草稿
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* 选中统计 */}
                {selectedCount > 0 && (
                    <div className="text-sm text-muted-foreground">
                        已选择 <span className="font-medium text-foreground">{selectedCount}</span> 个主题，
                        共 <span className="font-medium text-foreground">{totalDrafts}</span> 个草稿
                    </div>
                )}

                {/* 设置备选音色 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Dialog open={showVoiceSelector} onOpenChange={setShowVoiceSelector}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                                <Settings className="w-4 h-4 mr-2" />
                                设置备选音色
                                {candidateVoices.length > 0 && (
                                    <Badge variant="secondary" className="ml-auto">
                                        已选 {candidateVoices.length} 个
                                        {maleCount > 0 && <span className="text-blue-600 ml-1">♂{maleCount}</span>}
                                        {femaleCount > 0 && <span className="text-pink-600 ml-1">♀{femaleCount}</span>}
                                    </Badge>
                                )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    设置备选音色
                                </DialogTitle>
                            </DialogHeader>
                            <CandidateVoiceSelector
                                language={voiceLanguage}
                                onCandidateVoicesSet={(voices) => {
                                    setCandidateVoices(voices);
                                    setCachedVoiceMapping(null);
                                }}
                                showLanguageSelector={true}
                            />
                            <div className="flex justify-end mt-4">
                                <Button onClick={() => setShowVoiceSelector(false)}>
                                    确定 ({candidateVoices.length} 个音色)
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* 性能参数 */}
                    <Collapsible open={showSettings} onOpenChange={setShowSettings}>
                        <CollapsibleTrigger asChild>
                            <Button variant="outline" className="w-full justify-between">
                                <span className="flex items-center">
                                    <Settings className="w-4 h-4 mr-2" />
                                    性能参数
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4 space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <Label className="text-xs">主题并发</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={themeConcurrency}
                                        onChange={(e) => setThemeConcurrency(Number(e.target.value) || 2)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">草稿并发</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={draftConcurrency}
                                        onChange={(e) => setDraftConcurrency(Number(e.target.value) || 6)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">重试次数</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={retries}
                                        onChange={(e) => setRetries(Number(e.target.value) || 2)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">延迟(ms)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={2000}
                                        value={throttle}
                                        onChange={(e) => setThrottle(Number(e.target.value) || 200)}
                                    />
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </div>

                {/* 操作选择 */}
                <div className="space-y-3">
                    <div className="flex gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doAudio} onCheckedChange={(c) => setDoAudio(!!c)} />
                            <Volume2 className="w-4 h-4" />
                            <span>语音</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doACU} onCheckedChange={(c) => setDoACU(!!c)} />
                            <BookOpen className="w-4 h-4" />
                            <span>ACU</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doTranslation} onCheckedChange={(c) => setDoTranslation(!!c)} />
                            <Languages className="w-4 h-4" />
                            <span>翻译</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doPublish} onCheckedChange={(c) => setDoPublish(!!c)} />
                            <Check className="w-4 h-4" />
                            <span>自动发布</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doSceneVector} onCheckedChange={(c) => setDoSceneVector(!!c)} />
                            <Target className="w-4 h-4" />
                            <span>场景向量</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={doQuiz} onCheckedChange={(c) => setDoQuiz(!!c)} />
                            <HelpCircle className="w-4 h-4" />
                            <span>理解题</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-red-600">
                            <Checkbox checked={doUnpublish} onCheckedChange={(c) => {
                                setDoUnpublish(!!c);
                                // 撤回发布时自动关闭其他操作
                                if (c) {
                                    setDoAudio(false);
                                    setDoACU(false);
                                    setDoTranslation(false);
                                    setDoPublish(false);
                                    setDoSceneVector(false);
                                    setDoQuiz(false);
                                }
                            }} />
                            <Undo2 className="w-4 h-4" />
                            <span>撤回发布</span>
                        </label>
                    </div>

                    {/* 翻译目标语言 */}
                    {doTranslation && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <Label className="text-sm mb-2 block">翻译目标语言</Label>
                            <div className="flex gap-4 flex-wrap">
                                {LANGUAGE_OPTIONS.map(opt => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                        <Checkbox
                                            checked={transTargetLanguages.includes(opt.value)}
                                            onCheckedChange={() => toggleTransLang(opt.value)}
                                        />
                                        <span>{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                            {transTargetLanguages.length === 0 && (
                                <p className="text-xs text-amber-600 mt-2">⚠️ 请至少选择一个目标语言</p>
                            )}
                        </div>
                    )}

                    {/* 跳过选项 */}
                    <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={skipExistingAudio} onCheckedChange={(c) => setSkipExistingAudio(!!c)} />
                            <span>跳过已有音频</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={skipExistingACU} onCheckedChange={(c) => setSkipExistingACU(!!c)} />
                            <span>跳过已有ACU</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={skipExistingSceneVector} onCheckedChange={(c) => setSkipExistingSceneVector(!!c)} />
                            <span>跳过已有场景向量</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={skipExistingQuiz} onCheckedChange={(c) => setSkipExistingQuiz(!!c)} />
                            <span>跳过已有理解题</span>
                        </label>
                    </div>
                </div>

                {/* 进度条 */}
                {processing && (
                    <div className="space-y-3">
                        {/* 总进度 */}
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span>总进度: 主题</span>
                                <span>{overallProgress.current}/{overallProgress.total}</span>
                            </div>
                            <Progress value={(overallProgress.current / overallProgress.total) * 100} />
                        </div>
                        {/* 当前进度 */}
                        {currentProgress.total > 0 && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span className="truncate max-w-[70%]">{currentProgress.step}</span>
                                    <span>{currentProgress.current}/{currentProgress.total}</span>
                                </div>
                                <Progress
                                    value={(currentProgress.current / currentProgress.total) * 100}
                                    className="h-1"
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* 操作按钮 */}
                <Button
                    onClick={startBatchProcess}
                    disabled={selectedThemes.size === 0 || processing || loading}
                    className="w-full"
                    size="lg"
                >
                    {processing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            处理中...
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 mr-2" />
                            开始批量处理 ({selectedCount} 个主题)
                        </>
                    )}
                </Button>

                {/* 日志输出 */}
                {logs.length > 0 && (
                    <ScrollArea className="h-40 p-3 bg-muted rounded-lg">
                        <div className="font-mono text-xs space-y-1">
                            {logs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}
