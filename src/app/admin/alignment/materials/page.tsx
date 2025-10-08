'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AlignmentMaterial, AlignmentSubtopic, AlignmentTheme } from '@/lib/alignment/types';
import {
  ALIGNMENT_GENRES,
  ALIGNMENT_LANGS,
  ALIGNMENT_LEVELS,
  ALIGNMENT_TASK_TYPES,
  ALIGNMENT_LEVEL_REQUIREMENT_COUNTS,
  ALIGNMENT_WRITING_WORD_RANGES,
} from '@/lib/alignment/constants';
import type { AlignmentGenre, AlignmentLang, AlignmentLevel, AlignmentTaskType } from '@/lib/alignment/constants';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Sparkles, FileText, CheckCircle2, XCircle, Edit2 } from 'lucide-react';

type AlignmentMaterialWithRelations = AlignmentMaterial & {
  subtopic?: AlignmentSubtopic & {
    theme?: AlignmentTheme | null;
  } | null;
};

type GeneratedMaterial = {
  task_prompt: string;
  task_prompt_translations: Record<string, string>;
  exemplar: string;
  exemplar_translations: Record<string, string>;
  knowledge_points: any;
  requirements: Array<{ label: string; translations: Record<string, string> }>;
  standard_answer: string;
  standard_answer_translations: Record<string, string>;
  core_sentences: string[];
  rubric: Record<string, any>;
  dialogue_meta?: Record<string, any>;
  writing_meta?: Record<string, any>;
  ai_metadata?: Record<string, any>;
};

const LANG_LABEL: Record<AlignmentLang, string> = {
  en: '英语',
  ja: '日语',
  zh: '中文',
};

const GENRE_LABEL: Record<AlignmentGenre, string> = {
  dialogue: '对话',
  article: '文章',
  task_email: '任务邮件',
  long_writing: '长写作',
};

const TASK_LABEL: Record<AlignmentTaskType, string> = {
  dialogue: '对话',
  article: '文章写作',
  task_email: '任务邮件',
  long_writing: '长写作',
};

export default function AlignmentMaterialsPage() {
  const [materials, setMaterials] = useState<AlignmentMaterialWithRelations[]>([]);
  const [subtopics, setSubtopics] = useState<AlignmentSubtopic[]>([]);
  const [themes, setThemes] = useState<AlignmentTheme[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [lang, setLang] = useState<'all' | AlignmentLang>('all');
  const [status, setStatus] = useState<'all' | AlignmentMaterial['status']>('all');
  const [taskType, setTaskType] = useState<'all' | AlignmentTaskType>('all');
  const [themeFilter, setThemeFilter] = useState<string>('all');
  const [subtopicFilter, setSubtopicFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [onlyCurrent, setOnlyCurrent] = useState(false);

  const [generateSubtopicId, setGenerateSubtopicId] = useState<string>('');
  const [generateTaskType, setGenerateTaskType] = useState<AlignmentTaskType>('article');
  const [generateTemperature, setGenerateTemperature] = useState(0.75);
  const [generateModel, setGenerateModel] = useState('deepseek-chat');
  const [generatePreview, setGeneratePreview] = useState<GeneratedMaterial | null>(null);
  const [generating, setGenerating] = useState(false);

  const [editing, setEditing] = useState<AlignmentMaterialWithRelations | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
    return headers;
  }, []);

  const loadThemes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alignment/themes', {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setThemes(json.items || []);
      }
    } catch (error) {
      console.error('加载主题失败', error);
    }
  }, [getAuthHeaders]);

  const loadSubtopics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/alignment/subtopics', {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setSubtopics(json.items || []);
      }
    } catch (error) {
      console.error('加载小主题失败', error);
    }
  }, [getAuthHeaders]);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (status !== 'all') params.set('status', status);
      if (taskType !== 'all') params.set('task_type', taskType);
      if (themeFilter !== 'all') params.set('theme_id', themeFilter);
      if (subtopicFilter !== 'all') params.set('subtopic_id', subtopicFilter);
      if (search.trim()) params.set('q', search.trim());
      if (onlyCurrent) params.set('is_current', 'true');

      const res = await fetch(`/api/admin/alignment/materials?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setMaterials(json.items || []);
      } else {
        console.error('加载材料失败', json.error);
      }
    } catch (error) {
      console.error('加载材料失败', error);
    } finally {
      setLoading(false);
    }
  }, [lang, status, taskType, themeFilter, subtopicFilter, search, onlyCurrent, getAuthHeaders]);

  useEffect(() => {
    loadThemes();
    loadSubtopics();
  }, [loadThemes, loadSubtopics]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const subtopicsForGeneration = useMemo(() => {
    if (themeFilter !== 'all') {
      return subtopics.filter((s) => s.theme_id === themeFilter);
    }
    return subtopics;
  }, [subtopics, themeFilter]);

  const subtopicsForFilter = useMemo(() => {
    if (themeFilter !== 'all') {
      return subtopics.filter((s) => s.theme_id === themeFilter);
    }
    return subtopics;
  }, [subtopics, themeFilter]);

  useEffect(() => {
    if (subtopicsForGeneration.length === 0) {
      setGenerateSubtopicId('');
      return;
    }
    if (!generateSubtopicId || !subtopicsForGeneration.some((s) => s.id === generateSubtopicId)) {
      setGenerateSubtopicId(subtopicsForGeneration[0].id);
    }
  }, [subtopicsForGeneration, generateSubtopicId]);

  useEffect(() => {
    if (subtopicsForGeneration.length === 0) {
      setGenerateSubtopicId('');
      return;
    }
    if (!generateSubtopicId || !subtopicsForGeneration.some((s) => s.id === generateSubtopicId)) {
      setGenerateSubtopicId(subtopicsForGeneration[0].id);
    }
  }, [subtopicsForGeneration, generateSubtopicId]);

  useEffect(() => {
    if (subtopicsForFilter.length === 0) {
      setSubtopicFilter('all');
      return;
    }
    if (
      subtopicFilter !== 'all' &&
      !subtopicsForFilter.some((subtopic) => subtopic.id === subtopicFilter)
    ) {
      setSubtopicFilter('all');
    }
  }, [subtopicsForFilter, subtopicFilter]);

  const selectedSubtopic = useMemo(
    () => subtopics.find((s) => s.id === generateSubtopicId),
    [subtopics, generateSubtopicId],
  );

  const requirementRange = useMemo(() => {
    if (!selectedSubtopic) return null;
    return ALIGNMENT_LEVEL_REQUIREMENT_COUNTS[selectedSubtopic.level as AlignmentLevel];
  }, [selectedSubtopic]);

  const wordRange = useMemo(() => {
    if (!selectedSubtopic) return null;
    const level = selectedSubtopic.level as AlignmentLevel;
    return ALIGNMENT_WRITING_WORD_RANGES[level]?.[generateTaskType as 'article' | 'task_email' | 'long_writing'] || null;
  }, [selectedSubtopic, generateTaskType]);

  const handleGenerate = useCallback(async () => {
    if (!generateSubtopicId) {
      alert('请选择小主题');
      return;
    }
    setGenerating(true);
    setGeneratePreview(null);
    try {
      const res = await fetch('/api/admin/alignment/materials/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          subtopic_id: generateSubtopicId,
          task_type: generateTaskType,
          temperature: generateTemperature,
          model: generateModel,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '生成失败');
      }
      setGeneratePreview(json.item || null);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGenerating(false);
    }
  }, [generateSubtopicId, generateTaskType, generateTemperature, generateModel, getAuthHeaders]);

  const handleSaveGenerated = useCallback(async () => {
    if (!generatePreview || !selectedSubtopic) return;
    setSaving(true);
    try {
      const payload: Partial<AlignmentMaterial> = {
        subtopic_id: selectedSubtopic.id,
        lang: selectedSubtopic.lang,
        task_type: generateTaskType,
        status: 'pending_review',
        review_status: 'pending',
        task_prompt: generatePreview.task_prompt,
        task_prompt_translations: generatePreview.task_prompt_translations || {},
        exemplar: generatePreview.exemplar,
        exemplar_translations: generatePreview.exemplar_translations || {},
        knowledge_points: generatePreview.knowledge_points || {},
        requirements: (generatePreview.requirements || []).map((req) => ({
          label: req.label || '',
          translations: req.translations || {},
        })),
        standard_answer: generatePreview.standard_answer,
        standard_answer_translations: generatePreview.standard_answer_translations || {},
        core_sentences: generatePreview.core_sentences || [],
        rubric: generatePreview.rubric || {},
        dialogue_meta: generatePreview.dialogue_meta || {},
        writing_meta: generatePreview.writing_meta || {},
        ai_metadata: generatePreview.ai_metadata || {},
      };

      const res = await fetch('/api/admin/alignment/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ action: 'upsert', item: payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '保存失败');
      }
      setGeneratePreview(null);
      await loadMaterials();
      alert('已保存为待审核草稿');
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [generatePreview, selectedSubtopic, generateTaskType, getAuthHeaders, loadMaterials]);

  const openEdit = useCallback((material: AlignmentMaterialWithRelations) => {
    setEditing(material);
    setReviewNotes(material.review_notes || '');
    setEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/alignment/materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ action: 'upsert', item: editing }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '保存失败');
      }
      setEditOpen(false);
      await loadMaterials();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [editing, getAuthHeaders, loadMaterials]);

  const handleReview = useCallback(
    async (id: string, action: 'approve' | 'reject') => {
      setSaving(true);
      try {
        const res = await fetch('/api/admin/alignment/materials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({
            action: 'review',
            id,
            status: action === 'approve' ? 'active' : 'draft',
            review_status: action === 'approve' ? 'approved' : 'rejected',
            review_notes: reviewNotes || null,
            is_current: action === 'approve',
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || '操作失败');
        }
        setEditOpen(false);
        await loadMaterials();
      } catch (error) {
        console.error(error);
        alert((error as Error).message || '操作失败');
      } finally {
        setSaving(false);
      }
    },
    [getAuthHeaders, loadMaterials, reviewNotes],
  );

  const renderRequirementRange = () => {
    if (!requirementRange) return null;
    return (
      <span className="text-xs text-muted-foreground">
        要求数量建议：{requirementRange[0]}~{requirementRange[1]} 条
      </span>
    );
  };

  const renderWordRange = () => {
    if (!wordRange) return null;
    return (
      <span className="text-xs text-muted-foreground">
        字数目标：{wordRange[0]}~{wordRange[1]} 词
      </span>
    );
  };

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">对齐练习 · 训练包生成与审核</h1>
          <p className="text-sm text-muted-foreground">
            为小主题生成完整的练习材料，审核并发布，对应的任务与评分标准会提供给学员。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadMaterials} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI 生成训练包
          </CardTitle>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {renderRequirementRange()}
            {renderWordRange()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>选择主题</Label>
              <Select value={themeFilter} onValueChange={setThemeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="筛选主题" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">全部主题</SelectItem>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.title} · {LANG_LABEL[theme.lang]} · L{theme.level} · {GENRE_LABEL[theme.genre]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>选择小主题</Label>
              <Select value={generateSubtopicId} onValueChange={setGenerateSubtopicId}>
                <SelectTrigger>
                  <SelectValue placeholder="选择小主题" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {subtopicsForGeneration.map((subtopic) => (
                    <SelectItem key={subtopic.id} value={subtopic.id}>
                      {subtopic.title} · L{subtopic.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>任务类型</Label>
              <Select value={generateTaskType} onValueChange={(val) => setGenerateTaskType(val as AlignmentTaskType)}>
                <SelectTrigger>
                  <SelectValue placeholder="任务类型" />
                </SelectTrigger>
                <SelectContent>
                  {ALIGNMENT_TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TASK_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperature</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={generateTemperature}
                onChange={(e) => setGenerateTemperature(Math.max(0, Math.min(1, Number(e.target.value))))}
              />
            </div>
            <div className="space-y-2">
              <Label>模型</Label>
              <Select value={generateModel} onValueChange={setGenerateModel}>
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek-chat">deepseek-chat</SelectItem>
                  <SelectItem value="deepseek-reasoner">deepseek-reasoner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={generating || !generateSubtopicId}>
            {generating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            生成训练包
          </Button>

          {generatePreview && (
            <Card className="border border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  生成预览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">任务提示：</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1">{generatePreview.task_prompt}</pre>
                </div>
                <div>
                  <span className="font-medium text-foreground">范文：</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1">{generatePreview.exemplar}</pre>
                </div>
                <div>
                  <span className="font-medium text-foreground">知识点：</span>
                  <pre className="bg-muted/40 rounded p-3 text-xs overflow-auto">
                    {JSON.stringify(generatePreview.knowledge_points, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="font-medium text-foreground">要求：</span>
                  <ul className="list-disc list-inside">
                    {generatePreview.requirements?.map((req, idx) => (
                      <li key={idx}>{req.label}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="font-medium text-foreground">标准答案：</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1">{generatePreview.standard_answer}</pre>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveGenerated} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    保存为草稿
                  </Button>
                  <Button variant="outline" onClick={() => setGeneratePreview(null)}>
                    清空
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>语言</Label>
              <Select value={lang} onValueChange={(val) => setLang(val as typeof lang)}>
                <SelectTrigger>
                  <SelectValue placeholder="语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {ALIGNMENT_LANGS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {LANG_LABEL[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
                <SelectTrigger>
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="pending_review">待审核</SelectItem>
                  <SelectItem value="active">已发布</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>所属主题</Label>
              <Select value={themeFilter} onValueChange={setThemeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="筛选主题" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">全部主题</SelectItem>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.title} · {LANG_LABEL[theme.lang]} · L{theme.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>所属小主题</Label>
              <Select value={subtopicFilter} onValueChange={setSubtopicFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="筛选小主题" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">全部小主题</SelectItem>
                  {subtopicsForFilter.map((subtopic) => (
                    <SelectItem key={subtopic.id} value={subtopic.id}>
                      {subtopic.title} · L{subtopic.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>任务类型</Label>
              <Select value={taskType} onValueChange={(val) => setTaskType(val as typeof taskType)}>
                <SelectTrigger>
                  <SelectValue placeholder="任务类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {ALIGNMENT_TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {TASK_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>关键词</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="标题/内容搜索" />
            </div>
            <div className="space-y-2">
              <Label>只看当前版本</Label>
              <Select value={onlyCurrent ? 'true' : 'false'} onValueChange={(val) => setOnlyCurrent(val === 'true')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">全部</SelectItem>
                  <SelectItem value="true">仅当前版本</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle>训练包列表</CardTitle>
          <div className="text-sm text-muted-foreground">共 {materials.length} 条记录</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : materials.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-4">
              {materials.map((material) => (
                <Card
                  key={material.id}
                  className={`border ${material.review_status === 'pending' ? 'border-yellow-200' : material.review_status === 'approved' ? 'border-green-200' : ''}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">
                            {material.subtopic?.title || '未关联小主题'}
                          </h3>
                          <Badge variant="outline">{LANG_LABEL[material.lang as AlignmentLang]}</Badge>
                          <Badge variant="outline">{TASK_LABEL[material.task_type as AlignmentTaskType]}</Badge>
                          {material.status === 'active' && <Badge variant="default">已发布</Badge>}
                          {material.review_status === 'pending' && (
                            <Badge variant="secondary">待审核</Badge>
                          )}
                          {material.is_current && (
                            <Badge variant="outline" className="border-green-500 text-green-600">
                              当前版本
                            </Badge>
                          )}
                        </div>
                        {material.subtopic?.theme && (
                          <div className="text-xs text-muted-foreground mt-1">
                            主题：{material.subtopic.theme.title} · L{material.subtopic.theme.level} ·{' '}
                            {GENRE_LABEL[material.subtopic.theme.genre as AlignmentGenre]}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground mt-2 line-clamp-3">
                          {material.task_prompt}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(material)}>
                          <Edit2 className="w-4 h-4 mr-1" />
                          查看 / 审核
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      更新时间：{new Date(material.updated_at).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>训练包详情</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>任务提示</Label>
                  <Textarea
                    rows={3}
                    value={editing.task_prompt}
                    onChange={(e) =>
                      setEditing((prev) => (prev ? { ...prev, task_prompt: e.target.value } : prev))
                    }
                  />
                </div>
                <div>
                  <Label>范文</Label>
                  <Textarea
                    rows={3}
                    value={editing.exemplar || ''}
                    onChange={(e) =>
                      setEditing((prev) => (prev ? { ...prev, exemplar: e.target.value } : prev))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>知识点 JSON</Label>
                <Textarea
                  rows={6}
                  value={JSON.stringify(editing.knowledge_points || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const value = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, knowledge_points: value } : prev));
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div>
                <Label>要求 JSON</Label>
                <Textarea
                  rows={5}
                  value={JSON.stringify(editing.requirements || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const value = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, requirements: value } : prev));
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div>
                <Label>标准答案</Label>
                <Textarea
                  rows={4}
                  value={editing.standard_answer || ''}
                  onChange={(e) =>
                    setEditing((prev) => (prev ? { ...prev, standard_answer: e.target.value } : prev))
                  }
                />
              </div>
              <div>
                <Label>Rubric JSON</Label>
                <Textarea
                  rows={4}
                  value={JSON.stringify(editing.rubric || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const value = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, rubric: value } : prev));
                    } catch {
                      // ignore
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>审核备注</Label>
                <Textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="可记录审核意见或改进建议"
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    关闭
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    保存修改
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => handleReview(editing.id, 'reject')}
                    disabled={saving}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <XCircle className="w-4 h-4 mr-1" />
                    驳回
                  </Button>
                  <Button onClick={() => handleReview(editing.id, 'approve')} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    通过并发布
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
