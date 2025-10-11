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
import type {
  AlignmentMaterial,
  AlignmentSubtopic,
  AlignmentTheme,
  AlignmentKnowledgePoints,
  AlignmentPracticeScenario,
  AlignmentStandardDialogue,
} from '@/lib/alignment/types';
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
  knowledge_points: AlignmentKnowledgePoints;
  requirements: Array<{ label: string; translations: Record<string, string> }>;
  standard_answer: string;
  standard_answer_translations: Record<string, string>;
  core_sentences: string[];
  rubric: Record<string, any>;
  dialogue_meta?: Record<string, any>;
  writing_meta?: Record<string, any>;
  ai_metadata?: Record<string, any>;
  practice_scenario?: AlignmentPracticeScenario;
  standard_dialogue?: AlignmentStandardDialogue;
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
  const [stageOneResult, setStageOneResult] = useState<GeneratedMaterial | null>(null);
  const [stageTwoResult, setStageTwoResult] = useState<{
    practice_scenario: AlignmentPracticeScenario | null;
    standard_dialogue: AlignmentStandardDialogue | null;
  } | null>(null);
  const [generatingStage, setGeneratingStage] = useState<null | 'stage1' | 'stage2' | 'all'>(null);
  const [translating, setTranslating] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, boolean>>({});
  const [bulkAction, setBulkAction] = useState<null | 'publish' | 'translate'>(null);

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
  useEffect(() => {
    setSelectedMaterials({});
  }, [materials]);

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

  useEffect(() => {
    setStageOneResult(null);
    setStageTwoResult(null);
    setGeneratePreview(null);
    setGeneratingStage(null);
  }, [generateSubtopicId, generateTaskType]);

  const normalizeStageOne = useCallback((item: any): GeneratedMaterial | null => {
    if (!item) return null;
    const knowledge = item.knowledge_points || {};
    return {
      ...item,
      task_prompt_translations: item.task_prompt_translations || {},
      exemplar_translations: item.exemplar_translations || {},
      knowledge_points: {
        words: Array.isArray(knowledge.words) ? knowledge.words : [],
        sentences: Array.isArray(knowledge.sentences) ? knowledge.sentences : [],
      },
      requirements: Array.isArray(item.requirements)
        ? item.requirements.map((req: any) => ({
            label: req.label || '',
            translations: req.translations || {},
          }))
        : [],
      standard_answer_translations: item.standard_answer_translations || {},
      core_sentences: Array.isArray(item.core_sentences) ? item.core_sentences : [],
      rubric: item.rubric || {},
      dialogue_meta: item.dialogue_meta || {},
      writing_meta: item.writing_meta || {},
      ai_metadata: item.ai_metadata || {},
    };
  }, []);

  const isGenerating = generatingStage !== null;
  const stageOneCompleted = Boolean(stageOneResult);
  const stageTwoCompleted = Boolean(stageTwoResult);
  const targetLangs = useMemo(() => {
    if (!selectedSubtopic) return [];
    return ALIGNMENT_LANGS.filter((code) => code !== selectedSubtopic.lang);
  }, [selectedSubtopic]);

  const translationStatus = useMemo(() => {
    if (!stageOneResult || !selectedSubtopic) {
      return {
        completed: false,
        perLang: targetLangs.map((code) => ({ code, fields: [], done: false })),
      };
    }
    return {
      completed: targetLangs.every((code) => {
        const promptDone = Boolean(stageOneResult.task_prompt_translations?.[code]);
        const exemplarDone = Boolean(stageOneResult.exemplar_translations?.[code]);
        const answerDone = Boolean(stageOneResult.standard_answer_translations?.[code]);
        const wordsDone =
          Array.isArray(stageOneResult.knowledge_points?.words) &&
          stageOneResult.knowledge_points.words.every(
            (item) => item.translations && item.translations[code],
          );
        const sentencesDone =
          Array.isArray(stageOneResult.knowledge_points?.sentences) &&
          stageOneResult.knowledge_points.sentences.every(
            (item) => item.translations && item.translations[code],
          );
        return promptDone && exemplarDone && answerDone && wordsDone && sentencesDone;
      }),
      perLang: targetLangs.map((code) => {
        const fields: string[] = [];
        if (!stageOneResult.task_prompt_translations?.[code]) fields.push('任务提示');
        if (!stageOneResult.exemplar_translations?.[code]) fields.push('范文');
        if (!stageOneResult.standard_answer_translations?.[code]) fields.push('标准答案');
        const wordsMissing =
          Array.isArray(stageOneResult.knowledge_points?.words) &&
          stageOneResult.knowledge_points.words.some(
            (item) => !item.translations || !item.translations[code],
          );
        if (wordsMissing) fields.push('核心词汇');
        const sentencesMissing =
          Array.isArray(stageOneResult.knowledge_points?.sentences) &&
          stageOneResult.knowledge_points.sentences.some(
            (item) => !item.translations || !item.translations[code],
          );
        if (sentencesMissing) fields.push('关键句型');
        if (
          stageOneResult.practice_scenario &&
          (!stageOneResult.practice_scenario.summary_translations?.[code] ||
            !stageOneResult.practice_scenario.user_role?.translations?.[code] ||
            !stageOneResult.practice_scenario.ai_role?.translations?.[code])
        ) {
          fields.push('练习场景');
        }
        if (
          stageOneResult.standard_dialogue &&
          (!stageOneResult.standard_dialogue.summary_translations?.[code] ||
            stageOneResult.standard_dialogue.turns?.some(
              (turn) => !turn.translations || !turn.translations[code],
            ))
        ) {
          fields.push('标准对话');
        }
        return {
          code,
          fields,
          done: fields.length === 0,
        };
      }),
    };
  }, [stageOneResult, targetLangs, selectedSubtopic]);

  const selectedMaterialIds = useMemo(
    () => Object.entries(selectedMaterials).filter(([, checked]) => checked).map(([id]) => id),
    [selectedMaterials],
  );
  const selectedMaterialObjects = useMemo(
    () =>
      selectedMaterialIds
        .map((id) => materials.find((item) => item.id === id))
        .filter((item): item is AlignmentMaterialWithRelations => Boolean(item)),
    [selectedMaterialIds, materials],
  );
  const canBulkTranslate = selectedMaterialObjects.some((mat) =>
    ALIGNMENT_LANGS.some((code) => code !== mat.lang),
  );

  const handleGenerateStageOne = useCallback(async () => {
    if (!generateSubtopicId) {
      alert('请选择小主题');
      return;
    }
    setGeneratingStage('stage1');
    setStageOneResult(null);
    setStageTwoResult(null);
    setGeneratePreview(null);
    try {
      const res = await fetch('/api/admin/alignment/materials/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          step: 'stage1',
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
      const base = normalizeStageOne(json.data || json.stage1 || null);
      if (!base) {
        throw new Error('AI 未返回有效内容');
      }
      setStageOneResult(base);
      setGeneratePreview(base);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGeneratingStage(null);
    }
  }, [
    generateSubtopicId,
    generateTaskType,
    generateTemperature,
    generateModel,
    getAuthHeaders,
    normalizeStageOne,
  ]);

  const handleGenerateStageTwo = useCallback(async () => {
    if (!generateSubtopicId) {
      alert('请选择小主题');
      return;
    }
    if (!stageOneResult) {
      alert('请先完成步骤一，生成基础素材');
      return;
    }
    setGeneratingStage('stage2');
    try {
      const res = await fetch('/api/admin/alignment/materials/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          step: 'stage2',
          subtopic_id: generateSubtopicId,
          task_type: generateTaskType,
          temperature: generateTemperature,
          model: generateModel,
          base_payload: stageOneResult,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '生成失败');
      }
      const data = json.data || json.stage2 || {};
      let practiceScenario: AlignmentPracticeScenario | null =
        data.practice_scenario || null;
      let standardDialogue: AlignmentStandardDialogue | null =
        data.standard_dialogue || null;
      if (practiceScenario && !Array.isArray(practiceScenario.objectives)) {
        practiceScenario.objectives = (selectedSubtopic?.objectives || []).map((obj: any) => ({
          label: obj.label || obj.title || '',
          translations: obj.translations || {},
        }));
      }
      if (standardDialogue && !Array.isArray(standardDialogue.turns)) {
        standardDialogue.turns = [];
      }
      const filledStandardAnswer =
        stageOneResult.standard_answer?.trim()
          ? stageOneResult.standard_answer
          : standardDialogue?.turns?.length
            ? standardDialogue.turns
                .map((turn) => `${turn.speaker === 'ai' ? 'AI' : '学员'}: ${turn.text}`)
                .join('\n')
            : stageOneResult.exemplar || '';
      const merged = {
        ...stageOneResult,
        practice_scenario: practiceScenario,
        standard_dialogue: standardDialogue,
        standard_answer: filledStandardAnswer,
      } as GeneratedMaterial;
      setStageOneResult(merged);
      setStageTwoResult({
        practice_scenario: practiceScenario ?? null,
        standard_dialogue: standardDialogue ?? null,
      });
      setGeneratePreview(merged);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGeneratingStage(null);
    }
  }, [
    generateSubtopicId,
    generateTaskType,
    generateTemperature,
    generateModel,
    getAuthHeaders,
    selectedSubtopic,
    stageOneResult,
  ]);

  const mergeTranslationRecords = useCallback(
    (base: Record<string, string> | null | undefined, incoming: Record<string, string> | null | undefined) => {
      const result: Record<string, string> = { ...(base || {}) };
      if (incoming) {
        Object.entries(incoming).forEach(([code, value]) => {
          if (typeof value === 'string' && value.trim()) {
            result[code] = value.trim();
          }
        });
      }
      return result;
    },
    [],
  );

  const buildTranslationPayload = useCallback((material: AlignmentMaterialWithRelations) => {
    const knowledge = material.knowledge_points || { words: [], sentences: [] };
    const resolvedStandardAnswer =
      material.standard_answer && material.standard_answer.trim()
        ? material.standard_answer
        : material.standard_dialogue?.turns?.length
          ? material.standard_dialogue.turns
              .map((turn: any) => `${turn.speaker === 'ai' ? 'AI' : '学员'}: ${turn.text}`)
              .join('\n')
          : material.exemplar || '';
    return {
      task_prompt: material.task_prompt,
      task_prompt_translations: material.task_prompt_translations || {},
      exemplar: material.exemplar || '',
      exemplar_translations: material.exemplar_translations || {},
      knowledge_points: {
        words: Array.isArray(knowledge.words)
          ? knowledge.words.map((item: any) => ({
              term: item?.term || item?.label || '',
              translations: item?.translations || {},
            }))
          : [],
        sentences: Array.isArray(knowledge.sentences)
          ? knowledge.sentences.map((item: any) => ({
              sentence: item?.sentence || item?.label || '',
              translations: item?.translations || {},
            }))
          : [],
      },
      requirements: Array.isArray(material.requirements)
        ? material.requirements.map((req: any) => ({
            label: req?.label || '',
            translations: req?.translations || {},
          }))
        : [],
      standard_answer: resolvedStandardAnswer,
      standard_answer_translations: material.standard_answer_translations || {},
      practice_scenario: material.practice_scenario || null,
      standard_dialogue: material.standard_dialogue || null,
    };
  }, []);

  const mergeTranslationIntoMaterial = useCallback(
    (
      material: AlignmentMaterialWithRelations,
      translated: any,
    ): Partial<AlignmentMaterial> => {
      const knowledge = material.knowledge_points || { words: [], sentences: [] };
      const translatedWords = Array.isArray(translated?.knowledge_points?.words)
        ? translated.knowledge_points.words
        : [];
      const translatedSentences = Array.isArray(translated?.knowledge_points?.sentences)
        ? translated.knowledge_points.sentences
        : [];

      const mergedWords = Array.isArray(knowledge.words)
        ? knowledge.words.map((item: any, idx: number) => ({
            ...item,
            term: item?.term || item?.label || translatedWords[idx]?.term || '',
            translations: mergeTranslationRecords(
              item?.translations,
              translatedWords[idx]?.translations,
            ),
          }))
        : [];

      const mergedSentences = Array.isArray(knowledge.sentences)
        ? knowledge.sentences.map((item: any, idx: number) => ({
            ...item,
            sentence: item?.sentence || item?.label || translatedSentences[idx]?.sentence || '',
            translations: mergeTranslationRecords(
              item?.translations,
              translatedSentences[idx]?.translations,
            ),
          }))
        : [];

      const mergedRequirements = Array.isArray(material.requirements)
        ? material.requirements.map((req: any, idx: number) => ({
            ...req,
            translations: mergeTranslationRecords(
              req?.translations,
              translated?.requirements?.[idx]?.translations,
            ),
          }))
        : [];

      let mergedScenario = material.practice_scenario
        ? { ...material.practice_scenario }
        : null;
      if (mergedScenario) {
        mergedScenario.summary_translations = mergeTranslationRecords(
          mergedScenario.summary_translations,
          translated?.practice_scenario?.summary_translations,
        );
        if (mergedScenario.user_role) {
          mergedScenario.user_role = {
            ...mergedScenario.user_role,
            translations: mergeTranslationRecords(
              mergedScenario.user_role.translations,
              translated?.practice_scenario?.user_role?.translations,
            ),
          };
        }
        if (mergedScenario.ai_role) {
          mergedScenario.ai_role = {
            ...mergedScenario.ai_role,
            translations: mergeTranslationRecords(
              mergedScenario.ai_role.translations,
              translated?.practice_scenario?.ai_role?.translations,
            ),
          };
        }
        if (typeof mergedScenario.context_notes === 'string') {
          mergedScenario.context_notes_translations = mergeTranslationRecords(
            mergedScenario.context_notes_translations,
            translated?.practice_scenario?.context_notes_translations,
          );
        }
        if (Array.isArray(mergedScenario.objectives)) {
          mergedScenario.objectives = mergedScenario.objectives.map((obj: any, idx: number) => ({
            ...obj,
            translations: mergeTranslationRecords(
              obj?.translations,
              translated?.practice_scenario?.objectives?.[idx]?.translations,
            ),
          }));
        }
      }

      let mergedDialogue = material.standard_dialogue
        ? { ...material.standard_dialogue }
        : null;
      if (mergedDialogue) {
        mergedDialogue.summary_translations = mergeTranslationRecords(
          mergedDialogue.summary_translations,
          translated?.standard_dialogue?.summary_translations,
        );
        if (Array.isArray(mergedDialogue.turns)) {
          mergedDialogue.turns = mergedDialogue.turns.map((turn: any, idx: number) => ({
            ...turn,
            translations: mergeTranslationRecords(
              turn?.translations,
              translated?.standard_dialogue?.turns?.[idx]?.translations,
            ),
          }));
        }
      }

      return {
        id: material.id,
        subtopic_id: material.subtopic_id,
        lang: material.lang,
        task_type: material.task_type,
        status: material.status,
        review_status: material.review_status,
        version: material.version,
        is_current: material.is_current,
        task_prompt: material.task_prompt,
        task_prompt_translations: mergeTranslationRecords(
          material.task_prompt_translations,
          translated?.task_prompt_translations,
        ),
        exemplar: material.exemplar || '',
        exemplar_translations: mergeTranslationRecords(
          material.exemplar_translations,
          translated?.exemplar_translations,
        ),
        knowledge_points: {
          words: mergedWords,
          sentences: mergedSentences,
        },
        requirements: mergedRequirements,
        standard_answer: material.standard_answer || '',
        standard_answer_translations: mergeTranslationRecords(
          material.standard_answer_translations,
          translated?.standard_answer_translations,
        ),
        core_sentences: material.core_sentences || [],
        rubric: material.rubric || {},
        dialogue_meta: material.dialogue_meta || {},
        writing_meta: material.writing_meta || {},
        ai_metadata: material.ai_metadata || {},
        practice_scenario: mergedScenario,
        standard_dialogue: mergedDialogue,
      };
    },
    [mergeTranslationRecords],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!generateSubtopicId) {
      alert('请选择小主题');
      return;
    }
    setGeneratingStage('all');
    setStageTwoResult(null);
    setStageOneResult(null);
    setGeneratePreview(null);
    try {
      const res = await fetch('/api/admin/alignment/materials/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          step: 'all',
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
      const item = normalizeStageOne(json.item || null);
      if (!item) {
        throw new Error('AI 未返回有效内容');
      }
      if (item.practice_scenario && !Array.isArray(item.practice_scenario.objectives)) {
        item.practice_scenario.objectives = (selectedSubtopic?.objectives || []).map(
          (obj: any) => ({
            label: obj.label || obj.title || '',
            translations: obj.translations || {},
          }),
        );
      }
      if (item.standard_dialogue && !Array.isArray(item.standard_dialogue.turns)) {
        item.standard_dialogue.turns = [];
      }
      item.standard_answer =
        item.standard_answer?.trim()
          ? item.standard_answer
          : item.standard_dialogue?.turns?.length
            ? item.standard_dialogue.turns
                .map((turn) => `${turn.speaker === 'ai' ? 'AI' : '学员'}: ${turn.text}`)
                .join('\n')
            : item.exemplar || '';
      item.standard_answer_translations = item.standard_answer_translations || {};
      setStageOneResult(item);
      setStageTwoResult({
        practice_scenario: item.practice_scenario ?? null,
        standard_dialogue: item.standard_dialogue ?? null,
      });
      setGeneratePreview(item);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '生成失败');
    } finally {
      setGeneratingStage(null);
    }
  }, [
    generateSubtopicId,
    generateTaskType,
    generateTemperature,
    generateModel,
    getAuthHeaders,
    normalizeStageOne,
    selectedSubtopic,
  ]);

  const handleGenerateTranslations = useCallback(async () => {
    if (!stageOneResult || !selectedSubtopic) {
      alert('请先完成步骤一');
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch('/api/admin/alignment/materials/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          lang: selectedSubtopic.lang,
          model: generateModel,
          payload: stageOneResult,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '翻译生成失败');
      }
      const merged = normalizeStageOne(json.item || stageOneResult) || stageOneResult;
      setStageOneResult(merged);
      if (merged.practice_scenario || merged.standard_dialogue) {
        setStageTwoResult({
          practice_scenario: merged.practice_scenario || null,
          standard_dialogue: merged.standard_dialogue || null,
        });
      }
      setGeneratePreview(merged);
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '翻译生成失败');
    } finally {
      setTranslating(false);
    }
  }, [stageOneResult, selectedSubtopic, generateModel, getAuthHeaders, normalizeStageOne]);

  const toggleMaterialSelection = useCallback((id: string, checked: boolean) => {
    setSelectedMaterials((prev) => {
      const next = { ...prev };
      if (checked) {
        next[id] = true;
      } else {
        delete next[id];
      }
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    if (selectedMaterialIds.length === materials.length) {
      setSelectedMaterials({});
      return;
    }
    const next: Record<string, boolean> = {};
    materials.forEach((item) => {
      next[item.id] = true;
    });
    setSelectedMaterials(next);
  }, [materials, selectedMaterialIds.length]);

  const handleBulkPublish = useCallback(async () => {
    if (selectedMaterialIds.length === 0) {
      alert('请先选择要操作的训练包');
      return;
    }
    setBulkAction('publish');
    try {
      const headers = await getAuthHeaders();
      for (const id of selectedMaterialIds) {
        const res = await fetch('/api/admin/alignment/materials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            action: 'review',
            id,
            status: 'active',
            review_status: 'approved',
            review_notes: null,
            is_current: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || '批量发布失败');
        }
      }
      alert('选中的训练包已发布');
      setSelectedMaterials({});
      await loadMaterials();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '批量发布失败');
    } finally {
      setBulkAction(null);
    }
  }, [selectedMaterialIds, getAuthHeaders, loadMaterials]);

  const handleBulkTranslateSelected = useCallback(async () => {
    if (selectedMaterialObjects.length === 0) {
      alert('请先选择要翻译的训练包');
      return;
    }
    setBulkAction('translate');
    try {
      const headers = await getAuthHeaders();
      for (const material of selectedMaterialObjects) {
        const availableTargets = ALIGNMENT_LANGS.filter((code) => code !== material.lang);
        if (availableTargets.length === 0) {
          continue;
        }
        const payload = buildTranslationPayload(material);
        const res = await fetch('/api/admin/alignment/materials/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            lang: material.lang,
            payload,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || '翻译生成失败');
        }
        const merged = mergeTranslationIntoMaterial(material, json.item || payload);
        await fetch('/api/admin/alignment/materials', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            action: 'upsert',
            item: merged,
          }),
        });
      }
      alert('翻译已补齐');
      setSelectedMaterials({});
      await loadMaterials();
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '翻译失败');
    } finally {
      setBulkAction(null);
    }
  }, [
    selectedMaterialObjects,
    getAuthHeaders,
    buildTranslationPayload,
    mergeTranslationIntoMaterial,
    loadMaterials,
  ]);

  const handleSaveGenerated = useCallback(async () => {
    if (!stageOneResult || !selectedSubtopic) {
      alert('请先生成基础素材');
      return;
    }
    if (generateTaskType === 'dialogue' && !stageOneResult.practice_scenario) {
      alert('请先生成练习场景与标准对话（步骤二）');
      return;
    }
    const finalPreview = generatePreview || stageOneResult;
    const resolvedStandardAnswer = (() => {
      if (finalPreview.standard_answer && finalPreview.standard_answer.trim()) {
        return finalPreview.standard_answer;
      }
      if (finalPreview.standard_dialogue?.turns?.length) {
        return finalPreview.standard_dialogue.turns
          .map((turn) => `${turn.speaker === 'ai' ? 'AI' : '学员'}: ${turn.text}`)
          .join('\n');
      }
      return finalPreview.exemplar || '';
    })();

    setSaving(true);
    try {
      const payload: Partial<AlignmentMaterial> = {
        subtopic_id: selectedSubtopic.id,
        lang: selectedSubtopic.lang,
        task_type: generateTaskType,
        status: 'pending_review',
        review_status: 'pending',
        task_prompt: finalPreview.task_prompt,
        task_prompt_translations: finalPreview.task_prompt_translations || {},
        exemplar: finalPreview.exemplar,
        exemplar_translations: finalPreview.exemplar_translations || {},
        knowledge_points: {
          words: finalPreview.knowledge_points?.words ?? [],
          sentences: finalPreview.knowledge_points?.sentences ?? [],
        },
        requirements: (finalPreview.requirements || []).map((req) => ({
          label: req.label || '',
          translations: req.translations || {},
        })),
        standard_answer: resolvedStandardAnswer,
        standard_answer_translations: finalPreview.standard_answer_translations || {},
        core_sentences: finalPreview.core_sentences || [],
        rubric: finalPreview.rubric || {},
        dialogue_meta: finalPreview.dialogue_meta || {},
        writing_meta: finalPreview.writing_meta || {},
        ai_metadata: finalPreview.ai_metadata || {},
        practice_scenario:
          finalPreview.practice_scenario ||
          stageTwoResult?.practice_scenario ||
          null,
        standard_dialogue:
          finalPreview.standard_dialogue ||
          stageTwoResult?.standard_dialogue || { summary: '', turns: [] },
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
      setStageOneResult(null);
      setStageTwoResult(null);
      await loadMaterials();
      alert('已保存为待审核草稿');
    } catch (error) {
      console.error(error);
      alert((error as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [
    stageOneResult,
    generatePreview,
    selectedSubtopic,
    generateTaskType,
    stageTwoResult,
    getAuthHeaders,
    loadMaterials,
  ]);

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
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateStageOne} disabled={isGenerating || !generateSubtopicId}>
              {generatingStage === 'stage1' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              步骤一：生成基础素材
            </Button>
            <Button
              variant="secondary"
              onClick={handleGenerateStageTwo}
              disabled={isGenerating || !stageOneCompleted}
            >
              {generatingStage === 'stage2' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              步骤二：生成场景/对话
            </Button>
            <Button variant="outline" onClick={handleGenerateAll} disabled={isGenerating || !generateSubtopicId}>
              {generatingStage === 'all' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              一键生成（可选）
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={stageOneCompleted ? 'default' : 'outline'}>
              步骤一 · {stageOneCompleted ? '已完成' : '待执行'}
            </Badge>
            <Badge variant={stageTwoCompleted ? 'default' : 'outline'}>
              步骤二 · {stageTwoCompleted ? '已完成' : '待执行'}
            </Badge>
          </div>

          {generatePreview && (
            <Card className="border border-dashed">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  生成预览
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateTranslations}
                    disabled={translating || !stageOneCompleted}
                  >
                    {translating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                    生成翻译字段
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {targetLangs.length > 0 && (
                  <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-xs space-y-2">
                    <div className="font-medium text-foreground">翻译状态</div>
                    {translationStatus.perLang.map((item) => (
                      <div key={item.code} className="flex items-start gap-2">
                        <Badge variant={item.done ? 'default' : 'secondary'} className="mt-0.5">
                          {item.code.toUpperCase()} {item.done ? '已完成' : '待翻译'}
                        </Badge>
                        {item.fields.length > 0 ? (
                          <span className="text-muted-foreground">
                            需补充：{item.fields.join(' / ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">所有字段已完成</span>
                        )}
                      </div>
                    ))}
                    <p className="text-muted-foreground">
                      使用“生成翻译字段”可一次性补齐所有语言，需要时可反复执行以覆盖最新内容。
                    </p>
                  </div>
                )}
                <div>
                  <span className="font-medium text-foreground">任务提示：</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1">{generatePreview.task_prompt}</pre>
                </div>
                <div>
                  <span className="font-medium text-foreground">范文：</span>
                  <pre className="whitespace-pre-wrap text-sm mt-1">{generatePreview.exemplar}</pre>
                </div>
                <div className="space-y-2">
                  <span className="font-medium text-foreground">核心词汇：</span>
                  {generatePreview.knowledge_points?.words?.length ? (
                    <ul className="space-y-1 text-sm leading-relaxed">
                      {generatePreview.knowledge_points.words.map((item, idx) => (
                        <li key={`word-${idx}`} className="border rounded px-3 py-2 bg-muted/40">
                          <div className="font-medium text-foreground">{item.term}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {Object.entries(item.translations || {}).length === 0
                              ? '暂无翻译'
                              : Object.entries(item.translations || {}).map(([code, value]) => (
                                  <div key={code}>
                                    <span className="uppercase font-semibold mr-1">{code}</span>
                                    {value}
                                  </div>
                                ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无词汇</p>
                  )}
                </div>
                <div className="space-y-2">
                  <span className="font-medium text-foreground">关键句型：</span>
                  {generatePreview.knowledge_points?.sentences?.length ? (
                    <ul className="space-y-1 text-sm leading-relaxed">
                      {generatePreview.knowledge_points.sentences.map((item, idx) => (
                        <li key={`sentence-${idx}`} className="border rounded px-3 py-2 bg-muted/30">
                          <div className="font-medium text-foreground">{item.sentence}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {Object.entries(item.translations || {}).length === 0
                              ? '暂无翻译'
                              : Object.entries(item.translations || {}).map(([code, value]) => (
                                  <div key={code}>
                                    <span className="uppercase font-semibold mr-1">{code}</span>
                                    {value}
                                  </div>
                                ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">暂无句型</p>
                  )}
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
                {generatePreview.practice_scenario && (
                  <div className="space-y-2">
                    <span className="font-medium text-foreground">练习场景：</span>
                    <div className="border rounded px-3 py-2 bg-muted/40 text-sm leading-relaxed">
                      <div>{generatePreview.practice_scenario.summary}</div>
                      <div className="text-xs text-muted-foreground mt-2">
                        学员角色：{generatePreview.practice_scenario.user_role?.name} ·{' '}
                        {generatePreview.practice_scenario.user_role?.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        AI 角色：{generatePreview.practice_scenario.ai_role?.name} ·{' '}
                        {generatePreview.practice_scenario.ai_role?.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        开场发言：{generatePreview.practice_scenario.kickoff_speaker === 'ai' ? 'AI' : '学员'}
                      </div>
                      {Array.isArray(generatePreview.practice_scenario.objectives) &&
                        generatePreview.practice_scenario.objectives.length > 0 && (
                          <ul className="text-xs text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                            {generatePreview.practice_scenario.objectives.map((obj, idx) => (
                              <li key={`obj-${idx}`}>{obj.label}</li>
                            ))}
                          </ul>
                        )}
                    </div>
                  </div>
                )}
                {generatePreview.standard_dialogue?.turns?.length ? (
                  <div className="space-y-2">
                    <span className="font-medium text-foreground">标准对话：</span>
                    <ul className="space-y-1 text-sm leading-relaxed">
                      {generatePreview.standard_dialogue.turns.map((turn, idx) => (
                        <li key={`turn-${idx}`} className="border rounded px-3 py-2 bg-muted/30">
                          <div className="font-medium">{turn.speaker === 'ai' ? 'AI' : '学员'}：</div>
                          <div>{turn.text}</div>
                          {turn.objective_refs?.length ? (
                            <div className="text-xs text-muted-foreground mt-1">
                              关联目标：{turn.objective_refs.join(', ')}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <Button onClick={handleSaveGenerated} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    保存为草稿
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGeneratePreview(null);
                      setStageOneResult(null);
                      setStageTwoResult(null);
                    }}
                  >
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
        <CardHeader className="flex flex-col gap-2">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <CardTitle>训练包列表</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAllVisible}
                disabled={materials.length === 0}
              >
                {selectedMaterialIds.length === materials.length && materials.length > 0
                  ? '取消全选'
                  : '全选当前列表'}
              </Button>
              <Button
                size="sm"
                onClick={handleBulkPublish}
                disabled={selectedMaterialIds.length === 0 || bulkAction !== null}
              >
                {bulkAction === 'publish' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                发布选中
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleBulkTranslateSelected}
                disabled={
                  selectedMaterialIds.length === 0 || bulkAction !== null || !canBulkTranslate
                }
              >
                {bulkAction === 'translate' && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                翻译选中
              </Button>
              <div className="text-xs text-muted-foreground">
                已选 {selectedMaterialIds.length} 项
              </div>
            </div>
          </div>
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
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={Boolean(selectedMaterials[material.id])}
                          onChange={(e) => toggleMaterialSelection(material.id, e.target.checked)}
                        />
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
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(material)}>
                            <Edit2 className="w-4 h-4 mr-1" />
                            查看 / 审核
                          </Button>
                        </div>
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
                <Label>练习场景 JSON</Label>
                <Textarea
                  rows={5}
                  value={JSON.stringify(editing.practice_scenario || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const value = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, practice_scenario: value } : prev));
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
                <Label>标准对话 JSON</Label>
                <Textarea
                  rows={5}
                  value={JSON.stringify(editing.standard_dialogue || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const value = JSON.parse(e.target.value);
                      setEditing((prev) => (prev ? { ...prev, standard_dialogue: value } : prev));
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
