'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ACUPreview from '@/components/ACUPreview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Languages,
  Users,
  Settings,
  Volume2,
  Save,
  Upload,
  RefreshCw,
  Info,
  Tag,
  BookOpen,
  MessageSquare
} from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
};

const LEVEL_LABELS: Record<string, string> = {
  L1: 'L1 入门',
  L2: 'L2 基础',
  L3: 'L3 进阶',
  L4: 'L4 中级',
  L5: 'L5 高级',
  L6: 'L6 专业',
};

const GENRE_LABELS: Record<string, string> = {
  dialogue: '对话',
  monologue: '独白',
  news: '新闻',
  lecture: '讲座',
};

const DIALOGUE_TYPE_LABELS: Record<string, string> = {
  casual: '日常闲聊',
  task: '任务导向',
  emotion: '情感表达',
  opinion: '观点讨论',
  request: '请求建议',
  roleplay: '角色扮演',
  pattern: '句型操练',
};

const REGISTER_LABELS: Record<string, string> = {
  casual: '口语化',
  neutral: '中性',
  formal: '正式',
};

export default function ShadowingReviewDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [ttsLoading, setTtsLoading] = useState(false);

  // 翻译相关状态
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [transLoading, setTransLoading] = useState(false);
  const [transProvider, setTransProvider] = useState('deepseek');
  const [transModel, setTransModel] = useState('deepseek-chat');
  const [transTemperature, setTransTemperature] = useState(0.3);
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);

  // ACU 相关状态
  const [acuLoading, setAcuLoading] = useState(false);

  // 关联的主题和小主题信息
  const [themeInfo, setThemeInfo] = useState<any>(null);
  const [subtopicInfo, setSubtopicInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch(`/api/admin/shadowing/drafts/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await r.json();
      setDraft(j.draft);
      // 设置翻译内容
      if (j.draft?.translations) {
        setTranslations(j.draft.translations);
      }
      // 加载关联信息
      if (j.draft?.theme_id) {
        loadThemeInfo(j.draft.theme_id, token);
      }
      if (j.draft?.subtopic_id) {
        loadSubtopicInfo(j.draft.subtopic_id, token);
      }
    })();
  }, [id]);

  // 加载主题信息
  async function loadThemeInfo(themeId: string, token?: string) {
    try {
      const { data } = await supabase
        .from('shadowing_themes')
        .select('*')
        .eq('id', themeId)
        .single();
      setThemeInfo(data);
    } catch (e) {
      console.error('Failed to load theme info:', e);
    }
  }

  // 加载小主题信息
  async function loadSubtopicInfo(subtopicId: string, token?: string) {
    try {
      const { data } = await supabase
        .from('shadowing_subtopics')
        .select('*')
        .eq('id', subtopicId)
        .single();
      setSubtopicInfo(data);
    } catch (e) {
      console.error('Failed to load subtopic info:', e);
    }
  }

  // 加载可用模型
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: draft.title,
        topic: draft.topic,
        genre: draft.genre,
        register: draft.register,
        text: draft.text,
        notes: draft.notes,
        translations: translations,
        trans_updated_at:
          translations && Object.keys(translations).length > 0 ? new Date().toISOString() : null,
      }),
    });
    setSaving(false);
    setLog(r.ok ? '✅ 已保存' : `❌ 保存失败: ${r.status}`);
  }

  async function publish() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'publish' }),
    });
    if (r.ok) router.push('/admin/shadowing/review');
    else setLog(`❌ 发布失败: ${r.status}`);
  }

  async function synthAndAttach() {
    try {
      setTtsLoading(true);
      setLog('🔊 合成语音中…');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/shadowing/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: draft.text,
          lang: draft.lang,
          voice: draft?.notes?.voice || null,
          speakingRate: draft?.notes?.speakingRate || 1.0,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setLog('❌ 合成失败：' + (j.error || r.statusText));
        setTtsLoading(false);
        return;
      }
      setAudioUrl(j.audio_url);
      const next = { ...draft, notes: { ...(draft.notes || {}), audio_url: j.audio_url } };
      setDraft(next);
      await save();
      setLog('✅ 已合成并保存');
      setTtsLoading(false);
    } catch (e: any) {
      setTtsLoading(false);
      setLog('❌ 合成异常：' + (e.message || String(e)));
    }
  }

  // 生成翻译
  async function generateTranslations(force = false) {
    if (!draft) return;

    try {
      setTransLoading(true);
      setLog('🌐 生成翻译中…');

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/shadowing/translate/one', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: draft.id,
          scope: 'drafts',
          provider: transProvider,
          model: transModel,
          temperature: transTemperature,
          force,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '翻译失败');
      }

      setTranslations(result.translations);
      setLog('✅ 翻译生成完成');

      setDraft((prev: any) => ({
        ...prev,
        translations: result.translations,
        trans_updated_at: result.trans_updated_at,
      }));
    } catch (error: any) {
      setLog('❌ 翻译失败：' + (error.message || String(error)));
    } finally {
      setTransLoading(false);
    }
  }

  function getTargetLanguages(sourceLang: string): string[] {
    switch (sourceLang) {
      case 'zh': return ['en', 'ja'];
      case 'en': return ['ja', 'zh'];
      case 'ja': return ['en', 'zh'];
      default: return [];
    }
  }

  async function fetchAvailableModels() {
    try {
      setModelsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/api/admin/shadowing/translate/models', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const result = await response.json();
        setAvailableModels(result.models);
        if (result.models[transProvider] && !result.models[transProvider].includes(transModel)) {
          setTransModel(result.models[transProvider][0] || '');
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setModelsLoading(false);
    }
  }

  const handleProviderChange = (provider: string) => {
    setTransProvider(provider);
    if (availableModels[provider] && availableModels[provider].length > 0) {
      setTransModel(availableModels[provider][0]);
    }
  };

  // ACU 生成函数
  async function generateACU() {
    if (!draft) return;

    try {
      setAcuLoading(true);
      setLog('📝 生成 ACU 中…');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/shadowing/acu/segment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: draft.id,
          text: draft.text,
          lang: draft.lang,
          genre: draft.genre,
          provider: 'deepseek',
          model: 'deepseek-chat',
          concurrency: 8,
          retries: 2,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error('ACU 生成失败');
      }

      setDraft({
        ...draft,
        notes: {
          ...(draft.notes || {}),
          acu_marked: result.acu_marked,
          acu_units: result.units,
        },
      });

      setLog(`✅ ACU 生成成功：${result.unitCount || result.units.length} 个块`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLog(`❌ ACU 生成失败：${message}`);
    } finally {
      setAcuLoading(false);
    }
  }

  if (!draft) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="ml-2">加载中…</span>
    </div>
  );

  const meta = draft.notes?.meta || {};
  const source = draft.notes?.source || {};
  const roles = draft.notes?.roles || subtopicInfo?.roles || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* 页面标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shadowing 草稿详情</h1>
          <p className="text-muted-foreground">ID: {draft.id}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} variant="default">
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button onClick={publish} variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            发布
          </Button>
        </div>
      </div>

      {/* 状态提示 */}
      {log && (
        <div className={`p-3 rounded-lg ${log.startsWith('✅') ? 'bg-green-50 text-green-700' : log.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
          {log}
        </div>
      )}

      <Tabs defaultValue="content" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="content"><FileText className="w-4 h-4 mr-2" />内容</TabsTrigger>
          <TabsTrigger value="metadata"><Info className="w-4 h-4 mr-2" />元数据</TabsTrigger>
          <TabsTrigger value="translation"><Languages className="w-4 h-4 mr-2" />翻译</TabsTrigger>
          <TabsTrigger value="acu"><BookOpen className="w-4 h-4 mr-2" />ACU</TabsTrigger>
          <TabsTrigger value="audio"><Volume2 className="w-4 h-4 mr-2" />语音</TabsTrigger>
        </TabsList>

        {/* 内容标签页 */}
        <TabsContent value="content" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 基本信息卡片 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>标题</Label>
                  <Input
                    value={draft.title || ''}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label>主题</Label>
                  <Input
                    value={draft.topic || ''}
                    onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>语言</Label>
                    <div className="p-2 bg-muted rounded">
                      <Badge>{LANG_LABELS[draft.lang] || draft.lang}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label>等级</Label>
                    <div className="p-2 bg-muted rounded">
                      <Badge variant="secondary">{LEVEL_LABELS[`L${draft.level}`] || `L${draft.level}`}</Badge>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>体裁</Label>
                    <Select value={draft.genre || 'monologue'} onValueChange={(v) => setDraft({ ...draft, genre: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dialogue">对话</SelectItem>
                        <SelectItem value="monologue">独白</SelectItem>
                        <SelectItem value="news">新闻</SelectItem>
                        <SelectItem value="lecture">讲座</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>语域</Label>
                    <Select value={draft.register || 'neutral'} onValueChange={(v) => setDraft({ ...draft, register: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">口语化</SelectItem>
                        <SelectItem value="neutral">中性</SelectItem>
                        <SelectItem value="formal">正式</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {draft.genre === 'dialogue' && (
                  <div>
                    <Label>对话类型</Label>
                    <div className="p-2 bg-muted rounded">
                      <Badge variant="outline">
                        {DIALOGUE_TYPE_LABELS[draft.dialogue_type || meta.dialogue_type] || draft.dialogue_type || meta.dialogue_type || '未设置'}
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 正文卡片 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  正文内容
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={draft.text || ''}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                  rows={16}
                  className="font-mono"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  字数: {draft.text?.length || 0} | 行数: {draft.text?.split('\n').length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 角色信息卡片 */}
          {(Object.keys(roles).length > 0 || subtopicInfo) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  角色定义
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(roles).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(roles).map(([key, value]) => {
                      // 处理新格式 {name, gender} 和旧格式 string
                      const isObject = typeof value === 'object' && value !== null;
                      const name = isObject ? (value as any).name : String(value);
                      const gender = isObject ? (value as any).gender : null;

                      return (
                        <div key={key} className="p-3 bg-muted rounded-lg">
                          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            角色 {key}
                            {gender && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${gender === 'male'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-pink-100 text-pink-700'
                                }`}>
                                {gender === 'male' ? '♂ 男' : '♀ 女'}
                              </span>
                            )}
                          </div>
                          <div className="font-medium">{name}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-muted-foreground">暂无角色定义</div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 元数据标签页 */}
        <TabsContent value="metadata" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 来源信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">来源信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">来源类型</Label>
                    <div className="font-medium">{source.kind || '未知'}</div>
                  </div>
                  {source.subtopic_id && (
                    <div>
                      <Label className="text-muted-foreground">小主题 ID</Label>
                      <div className="font-mono text-xs break-all">{source.subtopic_id}</div>
                    </div>
                  )}
                </div>
                {subtopicInfo && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="font-medium">关联小主题</div>
                    <div className="text-lg">{subtopicInfo.title}</div>
                    <div className="text-sm text-muted-foreground">{subtopicInfo.one_line}</div>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary">{LANG_LABELS[subtopicInfo.lang]}</Badge>
                      <Badge variant="secondary">L{subtopicInfo.level}</Badge>
                      <Badge variant="secondary">{GENRE_LABELS[subtopicInfo.genre]}</Badge>
                      {subtopicInfo.dialogue_type && (
                        <Badge variant="outline">{DIALOGUE_TYPE_LABELS[subtopicInfo.dialogue_type]}</Badge>
                      )}
                    </div>
                  </div>
                )}
                {themeInfo && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="font-medium">关联大主题</div>
                    <div className="text-lg">{themeInfo.title}</div>
                    <div className="text-sm text-muted-foreground">{themeInfo.desc}</div>
                    {themeInfo.script && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-blue-600">查看剧本大纲</summary>
                        <pre className="mt-2 p-2 bg-white rounded text-xs whitespace-pre-wrap">{themeInfo.script}</pre>
                      </details>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes JSON */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Notes JSON
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="font-mono text-xs"
                  rows={16}
                  value={JSON.stringify(draft.notes || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setDraft({ ...draft, notes: JSON.parse(e.target.value) });
                    } catch { }
                  }}
                />
              </CardContent>
            </Card>
          </div>

          {/* AI 使用信息 */}
          {(draft.ai_provider || draft.ai_model) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">AI 生成信息</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-muted-foreground">提供商</Label>
                    <div className="font-medium">{draft.ai_provider || '-'}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">模型</Label>
                    <div className="font-medium">{draft.ai_model || '-'}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">创建时间</Label>
                    <div className="font-medium">{draft.created_at ? new Date(draft.created_at).toLocaleString() : '-'}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">状态</Label>
                    <Badge variant={draft.status === 'draft' ? 'secondary' : 'default'}>{draft.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 翻译标签页 */}
        <TabsContent value="translation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  翻译管理
                </span>
                <div className="flex items-center gap-2">
                  <Select value={transProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openrouter">OpenRouter</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={transModel} onValueChange={setTransModel}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(availableModels[transProvider] || []).map((model) => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    className="w-20"
                    value={transTemperature}
                    onChange={(e) => setTransTemperature(Number(e.target.value))}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => generateTranslations(false)} disabled={transLoading}>
                  {transLoading ? '生成中...' : '生成/补齐翻译'}
                </Button>
                <Button variant="outline" onClick={() => generateTranslations(true)} disabled={transLoading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getTargetLanguages(draft.lang).map((targetLang) => (
                  <div key={targetLang}>
                    <Label className="flex items-center gap-2">
                      <Badge variant="outline">{LANG_LABELS[targetLang]}</Badge>
                    </Label>
                    <Textarea
                      className="mt-1"
                      rows={8}
                      value={translations[targetLang] || ''}
                      onChange={(e) => setTranslations({ ...translations, [targetLang]: e.target.value })}
                      placeholder={`${LANG_LABELS[targetLang]}翻译...`}
                    />
                  </div>
                ))}
              </div>

              {draft.trans_updated_at && (
                <div className="text-sm text-muted-foreground">
                  最后更新: {new Date(draft.trans_updated_at).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACU 标签页 */}
        <TabsContent value="acu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  ACU 预处理
                </span>
                <Button onClick={generateACU} disabled={acuLoading}>
                  {acuLoading ? '生成中...' : '生成 ACU'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {draft.notes?.acu_marked ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    句子数: {draft.notes.acu_units?.length || 0} 个块
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <ACUPreview
                      text={draft.text || ''}
                      acuMarked={draft.notes.acu_marked}
                      units={draft.notes.acu_units || []}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  尚未生成 ACU，点击上方按钮生成
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 语音标签页 */}
        <TabsContent value="audio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  语音合成
                </span>
                <Button onClick={synthAndAttach} disabled={ttsLoading}>
                  {ttsLoading ? '合成中...' : '生成语音'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(audioUrl || draft.notes?.audio_url) ? (
                <div className="space-y-4">
                  <audio controls src={audioUrl || draft.notes?.audio_url} preload="metadata" className="w-full" />
                  <div className="text-sm text-muted-foreground">
                    音频 URL: {audioUrl || draft.notes?.audio_url}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  尚未生成语音，点击上方按钮合成
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
