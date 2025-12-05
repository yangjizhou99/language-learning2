'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Volume2, Languages, BookOpen, Play, Users, RefreshCw, Zap, Settings } from 'lucide-react';
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

export default function ThemeBatchProcessor() {
    const [themes, setThemes] = useState<Theme[]>([]);
    const [selectedTheme, setSelectedTheme] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [themeInfo, setThemeInfo] = useState<any>(null);

    // 音色选择
    const [candidateVoices, setCandidateVoices] = useState<CandidateVoice[]>([]);
    const [showVoiceSelector, setShowVoiceSelector] = useState(false);
    const [voiceLanguage, setVoiceLanguage] = useState('zh');

    // 操作选择
    const [doAudio, setDoAudio] = useState(true);
    const [doACU, setDoACU] = useState(true);
    const [doTranslation, setDoTranslation] = useState(true);

    // 处理状态
    const [processing, setProcessing] = useState(false);
    const [progress, setProgress] = useState({ step: '', current: 0, total: 0, currentItem: '' });
    const [logs, setLogs] = useState<string[]>([]);

    // 缓存的音色映射（整个主题使用同一套）
    const [cachedVoiceMapping, setCachedVoiceMapping] = useState<Record<string, string> | null>(null);

    // 加载主题列表
    useEffect(() => {
        loadThemes();
    }, []);

    async function loadThemes() {
        try {
            const { data, error } = await supabase
                .from('shadowing_themes')
                .select('id, title, lang, level')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (!error && data) {
                // 获取每个主题的小主题数量和草稿数量
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
        }
    }

    // 从候选音色中根据角色性别分配音色
    function pickVoicesFromCandidates(roles?: Record<string, any>): Record<string, string> {
        const maleVoices = candidateVoices.filter((v) => {
            const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
            return g === 'male' || g.includes('男');
        });
        const femaleVoices = candidateVoices.filter((v) => {
            const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
            return g === 'female' || g.includes('女');
        });

        const pickRandom = (arr: CandidateVoice[]) =>
            arr.length ? arr[Math.floor(Math.random() * arr.length)].name : '';

        const mapping: Record<string, string> = {};

        // 根据角色的实际性别分配音色
        const speakers = ['A', 'B', 'C', 'D', 'E', 'F'];
        for (const speaker of speakers) {
            const roleInfo = roles?.[speaker];
            let gender: string | null = null;

            if (roleInfo && typeof roleInfo === 'object') {
                gender = roleInfo.gender; // 'male' or 'female'
            }

            if (gender === 'male' && maleVoices.length > 0) {
                mapping[speaker] = pickRandom(maleVoices);
            } else if (gender === 'female' && femaleVoices.length > 0) {
                mapping[speaker] = pickRandom(femaleVoices);
            } else if (candidateVoices.length > 0) {
                // 没有性别信息时，随机选一个
                mapping[speaker] = pickRandom(candidateVoices);
            }
        }

        return mapping;
    }

    async function loadThemeInfo(themeId: string) {
        if (!themeId) return;

        setLoading(true);
        setCachedVoiceMapping(null); // 重置音色缓存

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch('/api/admin/shadowing/batch-theme', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    theme_id: themeId,
                    action: 'extract_roles',
                }),
            });

            if (response.ok) {
                const result = await response.json();
                setThemeInfo(result);
                // 根据主题语言设置音色选择器语言
                if (result.theme?.lang) {
                    setVoiceLanguage(result.theme.lang);
                }
            }
        } catch (e) {
            console.error('加载主题信息失败:', e);
        } finally {
            setLoading(false);
        }
    }

    async function startBatchProcess() {
        if (!selectedTheme) return;
        if (candidateVoices.length === 0 && doAudio) {
            setLogs(['❌ 请先点击"设置备选音色"选择音色']);
            return;
        }

        setProcessing(true);
        setLogs([]);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        try {
            // 获取主题下所有草稿
            const { data: drafts } = await supabase
                .from('shadowing_drafts')
                .select('*')
                .eq('theme_id', selectedTheme)
                .eq('status', 'draft')
                .order('created_at', { ascending: true });

            if (!drafts || drafts.length === 0) {
                setLogs(['⚠️ 该主题下没有待处理的草稿']);
                setProcessing(false);
                return;
            }

            setLogs([`📋 找到 ${drafts.length} 个草稿待处理`]);

            // 2. 生成语音
            if (doAudio) {
                setProgress({ step: '生成语音', current: 0, total: drafts.length, currentItem: '' });
                setLogs(prev => [...prev, '🔊 开始批量生成语音...']);

                let audioSuccess = 0;
                let audioFail = 0;

                // 使用缓存的音色映射（按角色名字而非标签）
                let nameToVoiceMapping = cachedVoiceMapping;
                if (!nameToVoiceMapping) {
                    // 收集所有草稿中的所有角色名字及其性别
                    const allCharacters: Record<string, string> = {}; // name -> gender
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

                    nameToVoiceMapping = {};
                    for (const [charName, gender] of Object.entries(allCharacters)) {
                        if (gender === 'male' && maleVoices.length > 0) {
                            nameToVoiceMapping[charName] = pickRandom(maleVoices);
                        } else if (gender === 'female' && femaleVoices.length > 0) {
                            nameToVoiceMapping[charName] = pickRandom(femaleVoices);
                        } else if (candidateVoices.length > 0) {
                            nameToVoiceMapping[charName] = pickRandom(candidateVoices);
                        }
                    }
                    setCachedVoiceMapping(nameToVoiceMapping);

                    const charList = Object.entries(nameToVoiceMapping);
                    setLogs(prev => [
                        ...prev,
                        `🎤 已固定主题音色映射（按角色名字，共 ${charList.length} 个角色）:`,
                        ...charList.slice(0, 5).map(([name, voice]) => {
                            const gender = allCharacters[name] || '未知';
                            return `   "${name}" (${gender}): ${voice}`;
                        }),
                        ...(charList.length > 5 ? [`   ... 还有 ${charList.length - 5} 个角色`] : []),
                    ]);
                }

                for (let i = 0; i < drafts.length; i++) {
                    const draft = drafts[i];
                    setProgress(prev => ({ ...prev, current: i + 1, currentItem: draft.title }));

                    try {
                        // 将角色名字映射转换为该草稿的 A/B/C 标签映射
                        const draftRoles = draft.notes?.roles || {};
                        const speakerVoicesForDraft: Record<string, string> = {};
                        for (const [label, roleInfo] of Object.entries(draftRoles)) {
                            if (roleInfo && typeof roleInfo === 'object') {
                                const charName = (roleInfo as any).name;
                                if (charName && nameToVoiceMapping[charName]) {
                                    speakerVoicesForDraft[label] = nameToVoiceMapping[charName];
                                }
                            }
                        }

                        const synthResponse = await fetch('/api/admin/shadowing/synthesize-dialogue', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                text: draft.text,
                                lang: themeInfo?.theme?.lang || 'zh',
                                speakerVoices: speakerVoicesForDraft, // 使用转换后的标签映射
                                speakingRate: 1.0,
                            }),
                        });

                        if (synthResponse.ok) {
                            const synthResult = await synthResponse.json();

                            // 更新草稿
                            await supabase
                                .from('shadowing_drafts')
                                .update({
                                    notes: {
                                        ...(draft.notes || {}),
                                        audio_url: synthResult.audio_url,
                                        voice_mapping: nameToVoiceMapping, // 保存角色名字 -> 音色的映射
                                        sentence_timeline: synthResult.sentence_timeline,
                                    },
                                })
                                .eq('id', draft.id);

                            audioSuccess++;
                        } else {
                            audioFail++;
                            setLogs(prev => [...prev, `   ❌ ${draft.title}: 语音合成失败`]);
                        }
                    } catch (e: any) {
                        audioFail++;
                        setLogs(prev => [...prev, `   ❌ ${draft.title}: ${e.message}`]);
                    }
                }

                setLogs(prev => [...prev, `✅ 语音生成完成: ${audioSuccess} 成功, ${audioFail} 失败`]);
            }

            // 3. 生成ACU
            if (doACU) {
                setProgress({ step: '生成ACU', current: 0, total: drafts.length, currentItem: '' });
                setLogs(prev => [...prev, '📝 开始批量生成ACU...']);

                let acuSuccess = 0;
                let acuFail = 0;

                for (let i = 0; i < drafts.length; i++) {
                    const draft = drafts[i];
                    setProgress(prev => ({ ...prev, current: i + 1, currentItem: draft.title }));

                    try {
                        const acuResponse = await fetch('/api/admin/shadowing/acu/segment', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                id: draft.id,
                                text: draft.text,
                                lang: themeInfo?.theme?.lang || 'zh',
                                genre: draft.genre,
                            }),
                        });

                        if (acuResponse.ok) {
                            acuSuccess++;
                        } else {
                            acuFail++;
                        }
                    } catch (e: any) {
                        acuFail++;
                    }
                }

                setLogs(prev => [...prev, `✅ ACU生成完成: ${acuSuccess} 成功, ${acuFail} 失败`]);
            }

            // 4. 生成翻译
            if (doTranslation) {
                setProgress({ step: '生成翻译', current: 0, total: drafts.length, currentItem: '' });
                setLogs(prev => [...prev, '🌐 开始批量生成翻译...']);

                let transSuccess = 0;
                let transFail = 0;

                for (let i = 0; i < drafts.length; i++) {
                    const draft = drafts[i];
                    setProgress(prev => ({ ...prev, current: i + 1, currentItem: draft.title }));

                    try {
                        const transResponse = await fetch('/api/admin/shadowing/translate/one', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                id: draft.id,
                                scope: 'drafts',
                                force: false,
                            }),
                        });

                        if (transResponse.ok) {
                            transSuccess++;
                        } else {
                            transFail++;
                        }
                    } catch (e: any) {
                        transFail++;
                    }
                }

                setLogs(prev => [...prev, `✅ 翻译生成完成: ${transSuccess} 成功, ${transFail} 失败`]);
            }

            setLogs(prev => [...prev, '🎉 批量处理完成!']);
        } catch (e: any) {
            setLogs(prev => [...prev, `❌ 处理出错: ${e.message}`]);
        } finally {
            setProcessing(false);
            setProgress({ step: '', current: 0, total: 0, currentItem: '' });
        }
    }

    const selectedThemeData = themes.find(t => t.id === selectedTheme);

    // 计算男女音色数量
    const maleCount = candidateVoices.filter((v) => {
        const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
        return g === 'male' || g.includes('男');
    }).length;
    const femaleCount = candidateVoices.filter((v) => {
        const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
        return g === 'female' || g.includes('女');
    }).length;

    return (
        <Card className="mb-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    主题批量处理
                    <Badge variant="outline" className="ml-2 text-xs">
                        固定音色模式
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* 主题选择 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>选择主题</Label>
                        <Select
                            value={selectedTheme}
                            onValueChange={(v) => {
                                setSelectedTheme(v);
                                loadThemeInfo(v);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="选择一个主题..." />
                            </SelectTrigger>
                            <SelectContent>
                                {themes.map((theme) => (
                                    <SelectItem key={theme.id} value={theme.id}>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{theme.lang}</Badge>
                                            <Badge variant="secondary">L{theme.level}</Badge>
                                            <span>{theme.title}</span>
                                            <span className="text-muted-foreground text-xs">
                                                ({theme.draft_count}个草稿)
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 设置备选音色按钮 */}
                    <div>
                        <Label>备选音色</Label>
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
                                <div className="text-sm text-muted-foreground mb-4">
                                    从备选音色中随机选择，A=男声，B=女声，C+=随机
                                </div>
                                <CandidateVoiceSelector
                                    language={voiceLanguage}
                                    onCandidateVoicesSet={(voices) => {
                                        setCandidateVoices(voices);
                                        setCachedVoiceMapping(null); // 重置缓存
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
                    </div>
                </div>

                {/* 音色状态提示 */}
                {selectedTheme && (
                    <div className="p-3 bg-muted rounded-lg text-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4" />
                            <span className="font-medium">音色分配说明</span>
                        </div>
                        {candidateVoices.length > 0 ? (
                            <div className="text-muted-foreground">
                                将从 <span className="font-medium text-foreground">{candidateVoices.length}</span> 个候选音色中
                                (♂{maleCount} ♀{femaleCount})
                                <span className="text-green-600 font-medium"> 随机抽取一次</span>，
                                主题下所有 <span className="font-medium text-foreground">{selectedThemeData?.draft_count || 0}</span> 个草稿将使用
                                <span className="text-blue-600 font-medium"> 同一套音色</span>
                            </div>
                        ) : (
                            <div className="text-amber-600">
                                ⚠️ 请先点击上方"设置备选音色"选择音色，否则无法生成语音
                            </div>
                        )}
                        {cachedVoiceMapping && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                                <span className="text-muted-foreground">已固定:</span>
                                {Object.entries(cachedVoiceMapping).slice(0, 2).map(([key, voice]) => (
                                    voice && (
                                        <Badge key={key} variant="outline" className="text-xs">
                                            {key}: {voice}
                                        </Badge>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 操作选择 */}
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
                </div>

                {/* 进度条 */}
                {processing && progress.total > 0 && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>{progress.step}: {progress.currentItem}</span>
                            <span>{progress.current}/{progress.total}</span>
                        </div>
                        <Progress value={(progress.current / progress.total) * 100} />
                    </div>
                )}

                {/* 操作按钮 */}
                <Button
                    onClick={startBatchProcess}
                    disabled={!selectedTheme || processing || loading}
                    className="w-full"
                >
                    {processing ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            处理中... {progress.step}
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 mr-2" />
                            开始批量处理
                        </>
                    )}
                </Button>

                {/* 日志输出 */}
                {logs.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg max-h-40 overflow-auto">
                        <div className="font-mono text-xs space-y-1">
                            {logs.map((log, i) => (
                                <div key={i}>{log}</div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
