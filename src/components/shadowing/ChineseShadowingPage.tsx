'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo, useDeferredValue, RefObject, startTransition } from 'react';
import pLimit from 'p-limit';

// 韩语词边界检测函数
const isKoreanWordBoundary = (
  chars: string[],
  startIndex: number,
  wordLength: number,
  endIndex: number
): boolean => {
  // 检查词前边界
  const beforeChar = startIndex > 0 ? chars[startIndex - 1] : '';
  const isBeforeBoundary = startIndex === 0 ||
    /[\s\p{P}\p{S}]/u.test(beforeChar) || // 空格、标点符号
    !/[\uac00-\ud7af]/.test(beforeChar); // 非韩文字符

  // 检查词后边界
  const afterChar = endIndex < chars.length ? chars[endIndex] : '';
  const isAfterBoundary = endIndex === chars.length ||
    /[\s\p{P}\p{S}]/u.test(afterChar) || // 空格、标点符号
    !/[\uac00-\ud7af]/.test(afterChar); // 非韩文字符

  return isBeforeBoundary && isAfterBoundary;
};

// 英语词边界检测函数（仅把 A-Z 视为单词字符，避免将 though 命中 thought）
const isEnglishWordBoundary = (
  chars: string[],
  startIndex: number,
  wordLength: number,
  endIndex: number
): boolean => {
  const isLetter = (ch: string) => /[A-Za-z]/.test(ch);
  const beforeChar = startIndex > 0 ? chars[startIndex - 1] : '';
  const isBeforeBoundary = startIndex === 0 || !isLetter(beforeChar);
  const afterChar = endIndex < chars.length ? chars[endIndex] : '';
  const isAfterBoundary = endIndex === chars.length || !isLetter(afterChar);
  return isBeforeBoundary && isAfterBoundary;
};
import { Virtuoso } from 'react-virtuoso';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
const SelectablePassage = dynamic(() => import('@/components/SelectablePassage'), { ssr: false, loading: () => <div className="p-2 text-gray-500">加载中...</div> });
const AcuText = dynamic(() => import('@/components/shadowing/AcuText'), { ssr: false, loading: () => <div className="p-2 text-gray-500">加载中...</div> });
const LexText = dynamic(() => import('@/components/shadowing/LexText'), { ssr: false, loading: () => <div className="p-2 text-gray-500">加载中...</div> });
import useUserPermissions from '@/hooks/useUserPermissions';
import dynamic from 'next/dynamic';
const AudioRecorder = dynamic(() => import('@/components/AudioRecorder'), { ssr: false });
const SentencePractice = dynamic(() => import('@/components/shadowing/SentencePractice'), { ssr: false });
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANG_LABEL } from '@/types/lang';
import { useMobile } from '@/contexts/MobileContext';
import FilterLanguageSelector from './FilterLanguageSelector';
import PracticeStepper, { type StepIndex } from './PracticeStepper';
import { speakText as speakTextUtil, selectBestVoiceAsync } from '@/lib/speechUtils';
import CollapsibleFilterSection from './CollapsibleFilterSection';
import CompactStatsCards from './CompactStatsCards';
import EnhancedAudioPlayer, { type EnhancedAudioPlayerRef } from './EnhancedAudioPlayer';
import SentenceInlinePlayer from './SentenceInlinePlayer';
const RightPanelTabs = dynamic(() => import('./RightPanelTabs'), { ssr: false, loading: () => <div className="p-2 text-gray-500">加载中...</div> });
const QuizModal = dynamic(() => import('./QuizModal'), { ssr: false });
import CollapsibleCard from './CollapsibleCard';
// import { getAuthHeaders } from "@/lib/supabase";
import {
  Shuffle,
  Filter,
  Clock,
  Mic,
  BookOpen,
  CheckCircle,
  Circle,
  ArrowRight,
  ArrowLeft,
  Save,
  FileText,
  Play,
  Pause,
  Menu,
  X,
  Star,
  Sparkles,
  Target,
  FileEdit,
  ArrowUpDown,
  Map as MapIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCached, setCached } from '@/lib/clientCache';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { loadFilters as loadShadowingFilters, saveFilters as saveShadowingFilters } from '@/lib/shadowingFilterStorage';
import { deriveKanjiFuriganaSegments, sanitizeJapaneseReadingToHiragana } from '@/lib/japanese/furigana';
import { performSimpleAnalysis } from '@/lib/shadowing/simpleAnalysis';
import { getNextRecommendedItem, getRecommendationReason, RecommendationResult, bayesianToUnknownRate, bayesianToRecommendedLevel } from '@/lib/recommendation/nextItem';
import { NextPracticeCard } from '@/components/recommendation/NextPracticeCard';
import { ThemePreference } from '@/lib/recommendation/preferences';
import { BayesianUserProfile, calculatePreciseUnknownRate, ArticleLexProfile, predictKnowledgeProbability, extractWordFeatures, WordFeatures, UserWordEvidence, adjustThresholdFromFeedback, PredictionAccuracyFeedback } from '@/lib/recommendation/vocabularyPredictor';
import { usePredictedWords } from '@/hooks/usePredictedWords';

// 题目数据类型
interface ShadowingItem {
  id: string;
  lang: 'ja' | 'en' | 'zh' | 'ko';
  level: number;
  title: string;
  text: string;
  audio_url: string;
  duration_ms?: number;
  tokens?: number;
  cefr?: string;
  genre?: string;
  dialogue_type?: string;
  meta?: Record<string, unknown>;
  translations?: Record<string, string>;
  trans_updated_at?: string;
  created_at: string;
  isPracticed: boolean;
  status?: 'draft' | 'completed';
  theme_id?: string;
  subtopic_id?: string;
  theme?: {
    id: string;
    title: string;
    desc?: string;
  };
  subtopic?: {
    id: string;
    title: string;
    one_line?: string;
  };
  top_scenes?: { id: string; name: string; weight: number }[];
  quiz_questions?: Array<{
    question: string;
    options: { A: string; B: string; C: string; D: string };
    answer: 'A' | 'B' | 'C' | 'D';
  }>;
  notes?: {
    acu_marked?: string;
    acu_units?: Array<{ span: string; start: number; end: number; sid: number }>;
    lex_profile?: {
      A1_A2: number;
      B1_B2: number;
      C1_plus: number;
      unknown: number;
      contentWordCount?: number;
      totalTokens?: number;
      tokenList?: Array<{
        token: string;
        lemma: string;
        pos: string;
        originalLevel: string;
        broadCEFR: 'A1_A2' | 'B1_B2' | 'C1_plus' | 'unknown';
        isContentWord: boolean;
        compoundGrammar?: string;
      }>;
    };
    [key: string]: any;
  };
  // Direct lex_profile field (also stored at top level)
  lex_profile?: {
    A1_A2: number;
    B1_B2: number;
    C1_plus: number;
    unknown: number;
    contentWordCount?: number;
    totalTokens?: number;
    tokenList?: Array<{
      token: string;
      lemma: string;
      pos: string;
      originalLevel: string;
      broadCEFR: 'A1_A2' | 'B1_B2' | 'C1_plus' | 'unknown';
      isContentWord: boolean;
      compoundGrammar?: string;
    }>;
  };
  stats: {
    recordingCount: number;
    vocabCount: number;
    practiceTime: number;
    lastPracticed: string | null;
  };
}

// 会话数据类型
interface ShadowingSession {
  id: string;
  user_id: string;
  item_id: string;
  status: 'draft' | 'completed';
  recordings: Array<{
    url: string;
    fileName: string;
    size: number;
    type: string;
    duration: number;
    created_at: string;
  }>;
  vocab_entry_ids: string[];
  picked_preview: Array<{
    word: string;
    context: string;
    lang: string;
  }>;
  imported_vocab_ids: string[];
  notes: Record<string, unknown> | null;
  created_at: string;
}

// 录音数据类型
interface AudioRecording {
  url: string;
  fileName: string;
  size: number;
  type: string;
  duration: number;
  created_at: string;
  transcription?: string;
}

type TimelineSegment = {
  index?: number;
  text?: string;
  start?: number;
  end?: number;
  speaker?: string;
};

type RoleSegment = {
  index: number;
  start?: number;
  end?: number;
  text: string;
  speaker: string;
};

const normalizeSpeakerSymbol = (value: string | null | undefined) => {
  if (!value) return '';
  const converted = value.replace(/[Ａ-Ｚａ-ｚ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xFEE0),
  );
  const match = converted.match(/[A-Za-z]/);
  if (match) return match[0].toUpperCase();
  return converted.trim().charAt(0).toUpperCase();
};

const parseSegmentLine = (line: string): { speaker: string; content: string } | null => {
  if (!line) return null;
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Za-zＡ-Ｚ])[:：]\s*(.+)$/);
  if (!match) return null;
  const speaker = normalizeSpeakerSymbol(match[1]);
  const content = match[2].trim();
  if (!speaker || !content) return null;
  return { speaker, content };
};

const buildSegmentsFromText = (text: string): RoleSegment[] => {
  if (!text) return [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const segments: RoleSegment[] = [];
  let cursor = 0;
  lines.forEach((line) => {
    const parsed = parseSegmentLine(line);
    if (!parsed) return;
    const duration = Math.max(parsed.content.length / 5, 2);
    segments.push({
      index: segments.length,
      speaker: parsed.speaker,
      text: parsed.content,
      start: cursor,
      end: cursor + duration,
    });
    cursor += duration;
  });
  return segments;
};

const mergeTimelineWithText = (
  timeline: TimelineSegment[],
  textSegments: RoleSegment[],
): RoleSegment[] => {
  if (!timeline.length) {
    return textSegments.map((seg, idx) => ({ ...seg, index: idx }));
  }

  const result: RoleSegment[] = [];
  const fallbackQueue = [...textSegments];

  timeline.forEach((segment, order) => {
    const fallback = fallbackQueue[0];
    const rawText = typeof segment.text === 'string' ? segment.text.trim() : '';
    const parsedFromTimeline = parseSegmentLine(rawText);

    let speaker = normalizeSpeakerSymbol(segment.speaker || parsedFromTimeline?.speaker || fallback?.speaker || '');
    let content =
      parsedFromTimeline?.content ||
      (rawText && parsedFromTimeline ? parsedFromTimeline.content : rawText) ||
      fallback?.text ||
      '';

    if (!content && fallback) {
      content = fallback.text;
    } else if (content) {
      const parsed = parseSegmentLine(content);
      if (parsed) {
        speaker = speaker || parsed.speaker;
        content = parsed.content;
      }
    }

    if (!content) return;

    const start =
      typeof segment.start === 'number'
        ? segment.start
        : fallback?.start ?? order * 4;
    const end =
      typeof segment.end === 'number'
        ? segment.end
        : fallback?.end ?? start + Math.max(content.length / 5, 2);

    result.push({
      index: order,
      speaker: speaker || 'A',
      text: content.trim(),
      start,
      end,
    });

    if (fallbackQueue.length) {
      fallbackQueue.shift();
    }
  });

  if (!result.length) {
    return textSegments.map((seg, idx) => ({ ...seg, index: idx }));
  }

  return result
    .filter((seg) => seg.text.length > 0)
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
    .map((seg, idx) => ({
      ...seg,
      index: idx,
    }));
};

// 全局词汇搜索缓存，避免重复请求
// 使用 LRU 缓存策略，限制最大条目数
const MAX_CACHE_SIZE = 200; // 最大缓存条目数
const globalVocabCache = new Map<string, { data: { entries?: Array<{ explanation?: any }> }; timestamp: number }>();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天缓存
const pendingRequests = new Map<string, Promise<any>>(); // 请求去重

// LRU 缓存清理：当缓存超过最大大小时，删除最旧的条目
const cleanupLRUCache = () => {
  if (globalVocabCache.size <= MAX_CACHE_SIZE) return;

  // 按时间戳排序，删除最旧的条目
  const entries = Array.from(globalVocabCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toDelete = entries.slice(0, globalVocabCache.size - MAX_CACHE_SIZE);
  toDelete.forEach(([key]) => {
    globalVocabCache.delete(key);
  });
};

// 增强的词汇搜索函数，包含请求去重和持久化缓存
// lang 参数用于区分不同语言的缓存
const searchVocabWithCache = async (
  word: string,
  lang: 'ja' | 'en' | 'zh' | 'ko',
  getAuthHeaders: () => Promise<HeadersInit>
): Promise<any> => {
  // 缓存 key 包含语言代码，避免跨语言缓存冲突
  const cacheKey = `vocab:${lang}:${word.toLowerCase().trim()}`;
  const now = Date.now();

  // 检查内存缓存
  const cached = globalVocabCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    return cached.data;
  }

  // 检查sessionStorage缓存
  try {
    const sessionKey = `vocab_cache_${cacheKey}`;
    const sessionCached = sessionStorage.getItem(sessionKey);
    if (sessionCached) {
      const { data, timestamp } = JSON.parse(sessionCached);
      if (now - timestamp < CACHE_DURATION) {
        // 更新内存缓存
        globalVocabCache.set(cacheKey, { data, timestamp });
        cleanupLRUCache(); // 检查并清理缓存
        return data;
      }
    }
  } catch (e) {
    // sessionStorage可能不可用，忽略错误
  }

  // 检查是否有正在进行的相同请求
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // 创建新的请求
  const requestPromise = (async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `/api/vocab/search?term=${encodeURIComponent(word)}&lang=${lang}&_t=${Date.now()}`,
        { headers }
      );
      const data = await response.json();

      // 更新缓存
      globalVocabCache.set(cacheKey, { data, timestamp: now });
      cleanupLRUCache(); // 检查并清理缓存

      // 更新sessionStorage缓存
      try {
        const sessionKey = `vocab_cache_${cacheKey}`;
        sessionStorage.setItem(sessionKey, JSON.stringify({ data, timestamp: now }));
      } catch (e) {
        // sessionStorage可能不可用，忽略错误
      }

      return data;
    } finally {
      // 请求完成后移除pending状态
      pendingRequests.delete(cacheKey);
    }
  })();

  // 记录pending请求
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Shadowing 跟读练习页面 - 统一多语言实现
 * 
 * 此组件作为所有语言（日语、英语、中文、韩语）的统一实现，
 * 通过 URL 参数 `lang` 和本地持久化来支持多语言切换。
 * 虽然组件名为 `ChineseShadowingPage`，但实际上支持所有语言。
 * 
 * 主要功能：
 * - 题库加载、筛选与搜索
 * - 分步骤跟读流程（盲听 → 生词 → 原文+翻译 → 录音评分）
 * - 音频控制与播放
 * - 词汇查询与导入
 * - 生词解释缓存
 */
export default function ShadowingPage() {
  const { t, language, setLanguageFromUserProfile } = useLanguage();
  const { permissions } = useUserPermissions();
  const { user, authLoading, getAuthHeaders, profile } = useAuth();

  // 页面加载状态，用于延迟词汇搜索
  const [pageLoaded, setPageLoaded] = useState(false);

  // 过滤和筛选状态
  const [lang, setLang] = useState<'ja' | 'en' | 'zh' | 'ko'>('zh');

  // 页面加载完成后才允许词汇搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoaded(true);
    }, 2000); // 页面加载2秒后才允许词汇搜索

    return () => clearTimeout(timer);
  }, []);


  // 注意：由于缓存 key 已包含 lang，语言切换时不再需要清空缓存
  // 这样可以避免跨语言切换时的"冷启动"问题
  const [level, setLevel] = useState<number | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const urlLevel = params.get('level');
        if (urlLevel !== null && urlLevel !== undefined && urlLevel !== '') {
          const parsed = Number(urlLevel);
          if (!Number.isNaN(parsed)) return parsed;
        }
        const persisted = loadShadowingFilters();
        if (persisted && typeof persisted.level !== 'undefined') {
          return persisted.level ?? null;
        }
      }
    } catch { }
    return 1;
  });
  const [practiced, setPracticed] = useState<'all' | 'practiced' | 'unpracticed'>('all');
  const [dialogueType, setDialogueType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<string>('all');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('all');
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>('all');
  const [practiceMode, setPracticeMode] = useState<'default' | 'role' | 'followAlong'>('default');
  const [selectedRole, setSelectedRole] = useState<string>('A');
  const [completedRoleList, setCompletedRoleList] = useState<string[]>([]);
  const [nextRoleSuggestion, setNextRoleSuggestion] = useState<string | null>(null);
  // 依据用户历史表现的推荐等级（按语言）
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  // Bayesian user profile for precise vocabulary prediction
  const [bayesianProfile, setBayesianProfile] = useState<BayesianUserProfile | null>(null);

  // 故事线来源信息（用于返回故事线）
  const [storylineSource, setStorylineSource] = useState<{
    isFromStoryline: boolean;
    themeId: string | null;
    subtopicId: string | null;
  }>({ isFromStoryline: false, themeId: null, subtopicId: null });

  // 列表排序模式
  const [sortMode, setSortMode] = useState<'recommended' | 'recent' | 'completion'>('recommended');

  // 本地持久化 + URL 同步（仅语言、等级、练习情况）
  const navSearchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filtersReadyRef = useRef(false);
  const replaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileListScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopListScrollRef = useRef<HTMLDivElement | null>(null);

  // 初始化：URL 优先，其次本地存储；不区分语言分桶；跳转（带参）为准
  useEffect(() => {
    const params = new URLSearchParams(navSearchParams?.toString() || '');

    const urlLang = params.get('lang') as 'ja' | 'en' | 'zh' | 'ko' | null;
    if (urlLang && ['ja', 'en', 'zh', 'ko'].includes(urlLang)) {
      if (urlLang !== lang) setLang(urlLang);
    }

    const urlLevel = params.get('level');
    if (urlLevel !== null && urlLevel !== undefined && urlLevel !== '') {
      const parsed = Number(urlLevel);
      if (!Number.isNaN(parsed)) setLevel(parsed);
    }

    const urlPracticed = params.get('practiced') as 'all' | 'practiced' | 'unpracticed' | null;
    if (urlPracticed && ['all', 'practiced', 'unpracticed'].includes(urlPracticed)) {
      if (urlPracticed !== practiced) setPracticed(urlPracticed);
    }

    const urlMode = params.get('mode');
    if (urlMode === 'role') {
      setPracticeMode('role');
    }

    const urlRole = params.get('role');
    if (urlRole) {
      setSelectedRole(urlRole.toUpperCase());
    }

    // 检查是否从故事线进入
    const urlSrc = params.get('src');
    const urlThemeId = params.get('themeId');
    const urlSubtopicId = params.get('subtopicId');
    if (urlSrc === 'storyline') {
      setStorylineSource({
        isFromStoryline: true,
        themeId: urlThemeId,
        subtopicId: urlSubtopicId,
      });
    }

    // 如果 URL 未提供，则尝试本地持久化
    const persisted = loadShadowingFilters();
    if (persisted) {
      if (!urlLang && persisted.lang && persisted.lang !== lang) setLang(persisted.lang);
      if (!urlLevel && typeof persisted.level !== 'undefined') setLevel(persisted.level ?? null);
      if (!urlPracticed && persisted.practiced) setPracticed(persisted.practiced);
      if (persisted.dialogue_type) setDialogueType(persisted.dialogue_type);
    }
    // 标记初始化完成，后续变更才能写回本地/URL，避免用默认值覆盖持久化
    filtersReadyRef.current = true;
    // 仅初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 状态变化时：写回本地 + 合并更新URL（保留其他参数，例如 item）
  useEffect(() => {
    if (!filtersReadyRef.current) return;
    // 本地保存（3天 TTL 在工具内默认）
    saveShadowingFilters({ lang, level, practiced, dialogue_type: dialogueType });

    if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
    replaceTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams(navSearchParams?.toString() || '');
      params.set('lang', lang);
      if (level !== null && level !== undefined) params.set('level', String(level)); else params.delete('level');
      params.set('practiced', practiced);
      if (practiceMode === 'role') {
        params.set('mode', 'role');
        if (selectedRole) {
          params.set('role', selectedRole.toUpperCase());
        }
      } else {
        params.delete('mode');
        params.delete('role');
      }

      const next = `${pathname}?${params.toString()}`;
      const current = `${pathname}?${navSearchParams?.toString() || ''}`;
      if (next !== current) {
        router.replace(next, { scroll: false });
      }
    }, 200);
    // 不依赖 searchParams，避免自身 replace 触发循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, practiced, dialogueType, practiceMode, selectedRole, pathname, router]);

  useEffect(() => {
    return () => {
      if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
    };
  }, []);

  // 体裁选项（基于6级难度设计）
  const GENRE_OPTIONS = [
    { value: 'all', label: t.shadowing.all_genres },
    { value: 'dialogue', label: t.shadowing.dialogue },
    { value: 'monologue', label: t.shadowing.monologue },
    { value: 'news', label: t.shadowing.news },
    { value: 'lecture', label: t.shadowing.lecture },
  ];

  const DIALOGUE_TYPE_OPTIONS = [
    { value: 'all', label: t.shadowing.dialogue_types.all },
    { value: 'casual', label: t.shadowing.dialogue_types.casual },
    { value: 'task', label: t.shadowing.dialogue_types.task },
    { value: 'emotion', label: t.shadowing.dialogue_types.emotion },
    { value: 'opinion', label: t.shadowing.dialogue_types.opinion },
    { value: 'request', label: t.shadowing.dialogue_types.request },
    { value: 'roleplay', label: t.shadowing.dialogue_types.roleplay },
    { value: 'pattern', label: t.shadowing.dialogue_types.pattern },
  ];

  // 题库相关状态
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentItem, setCurrentItem] = useState<ShadowingItem | null>(null);
  const [currentSession, setCurrentSession] = useState<ShadowingSession | null>(null);

  // User vocabulary knowledge cache for Bayesian prediction with historical evidence
  const [vocabKnowledge, setVocabKnowledge] = useState<Map<string, UserWordEvidence>>(new Map());

  // Fetch user vocabulary knowledge when currentItem changes
  useEffect(() => {
    const tokens = currentItem?.lex_profile?.tokenList ||
      (currentItem?.notes?.lex_profile as { tokenDetails?: Array<{ token: string }> })?.tokenDetails;
    if (!tokens?.length) {
      setVocabKnowledge(new Map());
      return;
    }

    // Get unique words
    const words = [...new Set(tokens.map((t: { token: string }) => t.token))].join(',');
    if (!words) return;

    // Fetch knowledge from API
    const fetchKnowledge = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/vocabulary/knowledge?words=${encodeURIComponent(words)}`, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.knowledge) {
            // Convert API response to UserWordEvidence map
            const knowledgeMap = new Map<string, UserWordEvidence>();
            for (const [word, evidence] of Object.entries(data.knowledge)) {
              const e = evidence as {
                markedUnknown: boolean;
                markedAt: string | null;
                exposureCount: number;
                notMarkedCount: number;
                firstSeenAt: string | null;
                lastSeenAt: string | null;
              };
              knowledgeMap.set(word, {
                markedUnknown: e.markedUnknown,
                markedAt: e.markedAt ? new Date(e.markedAt) : undefined,
                exposureCount: e.exposureCount,
                notMarkedCount: e.notMarkedCount,
                firstSeenAt: e.firstSeenAt ? new Date(e.firstSeenAt) : undefined,
                lastSeenAt: e.lastSeenAt ? new Date(e.lastSeenAt) : undefined,
              });
            }
            setVocabKnowledge(knowledgeMap);
          }
        }
      } catch (error) {
        console.error('Failed to fetch vocabulary knowledge:', error);
      }
    };

    fetchKnowledge();
  }, [currentItem?.id]); // Re-fetch when item changes


  // Generate word predictions map for current item using Bayesian algorithm
  const wordPredictions = useMemo(() => {
    const predictions = new Map<string, { probability: number; confidence: 'high' | 'medium' | 'low' }>();

    // Unified data source: prefer lex_profile.tokenList, fallback to notes.lex_profile.tokenDetails
    // tokenList uses "originalLevel", tokenDetails uses "level" - we handle both
    type TokenData = { token: string; originalLevel?: string; level?: string; frequencyRank?: number; isContentWord?: boolean };

    const tokenList = currentItem?.lex_profile?.tokenList as TokenData[] | undefined;
    const tokenDetailsFromNotes = (currentItem?.notes?.lex_profile as { tokenDetails?: TokenData[] })?.tokenDetails;
    const tokens = tokenList || tokenDetailsFromNotes;

    if (!tokens || !bayesianProfile) {
      return predictions;
    }

    // Convert bayesianProfile to UserProfileForPrediction format
    const userProfile = {
      nativeLang: 'zh', // Default to Chinese as native language
      abilityLevel: bayesianProfile.estimatedLevel || 3.0,
      vocabUnknownRate: {
        A1_A2: 1 - (bayesianProfile.jlptMastery.N5 + bayesianProfile.jlptMastery.N4) / 2,
        B1_B2: 1 - bayesianProfile.jlptMastery.N3,
        C1_plus: 1 - (bayesianProfile.jlptMastery.N2 + bayesianProfile.jlptMastery.N1) / 2,
      },
    };

    // Calculate prediction for each token
    for (const token of tokens) {
      if (!token.token || predictions.has(token.token)) continue;

      try {
        // Extract pure JLPT level - handle both "originalLevel" (tokenList) and "level" (tokenDetails)
        // Format might be "N3" or "grammar (N5)"
        let extractedLevel = 'unknown';
        const rawLevel = token.originalLevel || token.level || '';
        const levelMatch = rawLevel.match(/N[1-5]/i);
        if (levelMatch) {
          extractedLevel = levelMatch[0].toUpperCase();
        }

        // Extract word features
        const wordFeatures: WordFeatures = {
          surface: token.token,
          lemma: token.token,
          level: extractedLevel,
          frequencyRank: token.frequencyRank || -1,
          isKanji: /[\u4e00-\u9faf]/.test(token.token),
          isLoanword: /^[ァ-ヴー]+$/.test(token.token),
          length: token.token.length,
        };

        // Get user evidence for this word (includes forgetting curve data)
        const evidence = vocabKnowledge.get(token.token) || null;

        // Calculate prediction with user historical evidence
        const prediction = predictKnowledgeProbability(wordFeatures, userProfile, evidence);

        predictions.set(token.token, {
          probability: prediction.knownProbability,
          confidence: prediction.confidence,
        });
      } catch (e) {
        // Skip tokens that fail prediction
      }
    }

    return predictions;
  }, [currentItem, bayesianProfile, vocabKnowledge]);

  // Dynamic prediction threshold based on user's historical accuracy feedback
  const predictionThreshold = useMemo(() => {
    // Get accumulated prediction accuracy from bayesianProfile (if available)
    const feedback = (bayesianProfile as any)?.predictionFeedback as PredictionAccuracyFeedback | undefined;
    return adjustThresholdFromFeedback(0.5, feedback || null);
  }, [bayesianProfile]);

  // Difficulty Rating State
  const [selfDifficulty, setSelfDifficulty] = useState<'too_easy' | 'just_right' | 'a_bit_hard' | 'too_hard' | null>(null);
  const [showDifficultyModal, setShowDifficultyModal] = useState(false);
  const [sessionSpeakingDuration, setSessionSpeakingDuration] = useState(0);

  // 主题数据状态
  const [themes, setThemes] = useState<Array<{ id: string; title: string; desc?: string }>>([]);
  const [subtopics, setSubtopics] = useState<
    Array<{ id: string; title: string; one_line?: string }>
  >([]);

  // 练习相关状态
  const [selectedWords, setSelectedWords] = useState<
    Array<{
      word: string;
      context: string;
      lang: string;
      explanation?: {
        gloss_native: string;
        senses?: Array<{
          example_target: string;
          example_native: string;
        }>;
      };
    }>
  >([]);
  const [previousWords, setPreviousWords] = useState<
    Array<{
      word: string;
      context: string;
      lang: string;
      explanation?: {
        gloss_native: string;
        senses?: Array<{
          example_target: string;
          example_native: string;
        }>;
      };
    }>
  >([]);
  const [isVocabMode, setIsVocabMode] = useState(false);
  const [selectedText, setSelectedText] = useState<{ word: string; context: string } | null>(null);
  const [clearSelection, setClearSelection] = useState(false);
  const [isAddingToVocab, setIsAddingToVocab] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [practiceStartTime, setPracticeStartTime] = useState<Date | null>(null);
  const [currentRecordings, setCurrentRecordings] = useState<AudioRecording[]>([]);
  const [generatingWord, setGeneratingWord] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // UI 状态
  // 统一侧边栏状态：所有设备都使用抽屉式
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { actualIsMobile } = useMobile();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<EnhancedAudioPlayerRef | null>(null);
  const mainAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
  // 移动端也启用步骤门控：仅在未完成时生效
  const gatingActive = !practiceComplete;
  const [showSentenceComparison, setShowSentenceComparison] = useState(false);
  const [scoringResult, setScoringResult] = useState<{
    score?: number;
    accuracy?: number;
    feedback?: string;
    transcription?: string;
    originalText?: string;
    sentenceComparison?: Array<{
      original: string;
      transcribed: string;
      accuracy: number;
    }>;
  } | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [currentTranscription, setCurrentTranscription] = useState<string>('');
  // 播放完成的句子索引（用于分角色模式检测播放完成）
  const [completedSegmentIndex, setCompletedSegmentIndex] = useState<number | null>(null);

  // 统一分段播放：由底部 EnhancedAudioPlayer 控制
  // playSegment 内部已经通过监听 currentTime >= stopAt 来判断播放完成
  const playSentenceByIndex = (index: number): Promise<void> | void => {
    const timeline = (currentItem as unknown as { sentence_timeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }> })?.sentence_timeline;
    if (!timeline || !Array.isArray(timeline) || !timeline.length) return;
    const seg = timeline.find(s => s.index === index) || timeline[index];
    if (!seg || typeof seg.start !== 'number' || typeof seg.end !== 'number') return;

    try {
      // playSegment 已经返回 Promise，它会监听播放条时间点（currentTime >= stopAt）来判断完成
      return audioPlayerRef.current?.playSegment(seg.start, seg.end);
    } catch {
      return;
    }
  };

  // 桌面端显示播放器：已在渲染层保证展示，如需自动滚动可在后续交互中触发

  // 桌面端分步骤练习（仅在未完成状态下启用）
  // 桌面端分步骤练习（仅在未完成状态下启用）
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  useEffect(() => {
    if (step === 4) {
      try {
        mainAudioContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch { }
    }
  }, [step]);
  const [highlightPlay, setHighlightPlay] = useState(false);
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [highlightScore, setHighlightScore] = useState(false);

  // ACU 模式状态
  const [isACUMode, setIsACUMode] = useState(true); // 默认使用 ACU 模式

  // 理解题状态
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    answers: Array<{ questionIndex: number; selected: string; correct: boolean }>;
    correctCount: number;
    total: number;
  } | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<number, string>>({});


  const stepTips: Record<number, string> = {
    1: t.shadowing.step1_tip,
    2: t.shadowing.step2_tip,
    3: t.shadowing.step3_tip,
    4: t.shadowing.step5_tip,
  };

  // 步骤切换时的联动：自动开/关生词模式与翻译偏好
  useEffect(() => {
    if (!currentItem) return;
    // 只在第2步开启生词模式，其余步骤关闭
    setIsVocabMode(step === 2);

    if (step === 3) {
      setShowTranslation(true);
      const available = currentItem.translations ? Object.keys(currentItem.translations) : [];
      const uiLang = (language as 'en' | 'ja' | 'zh' | 'ko');
      const pref = (profile?.native_lang as 'en' | 'ja' | 'zh' | 'ko' | undefined) || undefined;
      if (available.includes(uiLang)) {
        setTranslationLang(uiLang);
      } else if (pref && available.includes(pref)) {
        setTranslationLang(pref);
      } else {
        const targets = getTargetLanguages(currentItem.lang);
        if (targets.length > 0) {
          setTranslationLang(targets[0] as 'en' | 'ja' | 'zh' | 'ko');
        }
      }
    } else {
      // 非第4步隐藏翻译
      setShowTranslation(false);
    }
  }, [step, currentItem, profile, language]);

  // 关键按钮短暂高亮引导
  useEffect(() => {
    if (practiceComplete) return;
    let timeoutId: number | undefined;
    if (step === 1) {
      setHighlightPlay(true);
      timeoutId = window.setTimeout(() => setHighlightPlay(false), 2000);
    } else if (step === 2) {
      setHighlightVocab(true);
      timeoutId = window.setTimeout(() => setHighlightVocab(false), 2000);
    } else if (step === 4) {
      setHighlightScore(true);
      timeoutId = window.setTimeout(() => setHighlightScore(false), 2000);
    }
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [step, practiceComplete]);
  const [sentenceScores, setSentenceScores] = useState<Record<number, any>>({});
  const [isImporting, setIsImporting] = useState(false);
  // 从首页每日一题等入口深链进入时，用于在题目自动加载期间展示整页加载动画
  const [initialDeepLinkLoading, setInitialDeepLinkLoading] = useState(() => {
    try {
      const params = new URLSearchParams(navSearchParams?.toString() || '');
      const itemId = params.get('item');
      const auto = params.get('autostart') === '1';
      return !!itemId && auto;
    } catch {
      return false;
    }
  });

  // 录音组件引用
  const audioRecorderRef = useRef<{
    uploadCurrentRecording: () => Promise<void>;
    hasUnsavedRecording: () => boolean;
    stopPlayback: () => void;
    suspendMicForPlayback: () => void;
  } | null>(null);

  // 请求中止控制器
  const abortRef = useRef<AbortController | null>(null);

  // 首次数据加载标记，用于避免认证完成和筛选条件变化时的重复加载
  const initialLoadRef = useRef(false);

  // AI解释相关状态
  const [wordExplanations, setWordExplanations] = useState<
    Record<
      string,
      {
        gloss_native: string;
        pronunciation?: string;
        pos?: string;
        senses?: Array<{
          example_target: string;
          example_native: string;
        }>;
      }
    >
  >({});
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [isGeneratingBatchExplanation, setIsGeneratingBatchExplanation] = useState(false);
  const [batchExplanationProgress, setBatchExplanationProgress] = useState({
    current: 0,
    total: 0,
    status: '',
  });
  const [isRefreshingAllPrev, setIsRefreshingAllPrev] = useState(false);

  // 主题偏好
  const [themePrefs, setThemePrefs] = useState<Record<string, ThemePreference>>({});

  // 加载主题偏好
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/shadowing/preferences', { headers });
        const data = await res.json();
        if (data.success && data.prefs?.themeMap) {
          // Convert array/map to record if needed, or just use the raw prefs object
          // getNextRecommendedItem expects Record<string, ThemePreference>
          // UserPreferenceVectors.themes is ThemePreference[]
          const map: Record<string, ThemePreference> = {};
          data.prefs.themes.forEach((t: ThemePreference) => {
            map[t.theme_id] = t;
          });
          setThemePrefs(map);
        }
      } catch (e) {
        console.error('Failed to load preferences', e);
      }
    };
    if (user) loadPrefs();
  }, [user]);

  // 下一条推荐
  const [nextRecommendation, setNextRecommendation] = useState<RecommendationResult | null>(null);

  // 计算下一条推荐
  useEffect(() => {
    if (!currentItem) return;

    const fetchRecommendation = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/shadowing/recommendations', { headers });
        if (response.ok) {
          const data = await response.json();
          if (data.recommendations && data.recommendations.length > 0) {
            const rec = data.recommendations[0];
            // Ensure stats exist
            const itemWithStats = {
              ...rec.item,
              stats: rec.item.stats || { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
              isPracticed: false,
              // Ensure other required fields if missing from API
              lang: rec.item.lang || 'en',
              level: rec.item.level || 1,
              title: rec.item.title || 'Untitled',
              text: rec.item.text || '',
              audio_url: rec.item.audio_url || '',
              created_at: rec.item.created_at || new Date().toISOString(),
            };

            setNextRecommendation({
              item: itemWithStats,
              reason: rec.reason,
              score: rec.score
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      }
    };

    // Only fetch when we have a current item (e.g. starting a session or finishing one)
    // We might want to debounce or only fetch when scoringResult is present (practice complete)
    // But fetching early is fine too.
    fetchRecommendation();
  }, [currentItem?.id, getAuthHeaders]);

  const handleStartNext = (nextItemCandidate: any) => {
    const nextItem = items.find(i => i.id === nextItemCandidate.id);
    if (nextItem) {
      setCurrentItem(nextItem);
      // 重置状态
      setStep(1);
      setScoringResult(null);
      setCurrentRecordings([]);
      setPracticeStartTime(new Date());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 解释缓存
  const [explanationCache, setExplanationCache] = useState<
    Record<
      string,
      {
        gloss_native: string;
        pronunciation?: string;
        pos?: string;
        senses?: Array<{ example_target: string; example_native: string }>;
      }
    >
  >({});

  const roleSegments = useMemo<RoleSegment[]>(() => {
    if (!currentItem) return [];
    const rawTimeline = Array.isArray(
      (currentItem as unknown as { sentence_timeline?: TimelineSegment[] })?.sentence_timeline,
    )
      ? ((currentItem as unknown as { sentence_timeline: TimelineSegment[] }).sentence_timeline ?? [])
      : [];
    const textSegments = buildSegmentsFromText(currentItem.text || '');
    return mergeTimelineWithText(rawTimeline, textSegments);
  }, [currentItem]);

  const availableRoles = useMemo<string[]>(() => {
    const set = new Set<string>();
    roleSegments.forEach((segment) => {
      const normalized = normalizeSpeakerSymbol(segment.speaker);
      if (normalized) {
        set.add(normalized);
      }
    });
    return Array.from(set);
  }, [roleSegments]);

  useEffect(() => {
    if (!availableRoles.length) {
      setPracticeMode('default');
      return;
    }
    if (!availableRoles.includes(selectedRole)) {
      setSelectedRole(availableRoles[0]);
    }
  }, [availableRoles, selectedRole]);

  useEffect(() => {
    setCompletedRoleList((prev) => prev.filter((role) => availableRoles.includes(role)));
  }, [availableRoles]);

  useEffect(() => {
    if (practiceMode !== 'role') {
      setNextRoleSuggestion(null);
      setCompletedRoleList([]);
    }
  }, [practiceMode]);

  useEffect(() => {
    if (!currentItem) {
      setPracticeMode('default');
      setSelectedRole('A');
      setCompletedRoleList([]);
      setNextRoleSuggestion(null);
      return;
    }
    setCompletedRoleList([]);
    setNextRoleSuggestion(null);
  }, [currentItem?.id]);

  // 用户个人资料状态
  const [userProfile, setUserProfile] = useState<{ native_lang?: string } | null>(null);

  // 翻译相关状态
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<'en' | 'ja' | 'zh' | 'ko'>('en');

  // 读音注音开关（zh/ja 默认开启），带本地持久化
  const [showRubyPronunciation, setShowRubyPronunciation] = useState<boolean>(false);
  useEffect(() => {
    const lang = currentItem?.lang;
    if (lang === 'zh' || lang === 'ja' || lang === 'ko') {
      // 中文/日语场景：默认始终开启注音
      setShowRubyPronunciation(true);
      return;
    }
    // 其他语言保留用户偏好
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('shadowing.showRubyPronunciation') : null;
      if (stored !== null) {
        setShowRubyPronunciation(stored === 'true');
      }
    } catch { }
  }, [currentItem?.lang]);
  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('shadowing.showRubyPronunciation', String(showRubyPronunciation)); } catch { }
  }, [showRubyPronunciation]);

  // 用户生词本状态
  const [userVocab, setUserVocab] = useState<Array<{
    term: string;
    explanation: {
      gloss_native: string;
      senses?: Array<{ example_target: string; example_native: string }>;
    } | null;
    id: string;
    context?: string;
  }>>([]);

  // 获取目标语言
  const getTargetLanguages = (sourceLang: string): string[] => {
    switch (sourceLang) {
      case 'zh':
        return ['en', 'ja', 'ko'];
      case 'en':
        return ['ja', 'zh', 'ko'];
      case 'ja':
        return ['en', 'zh', 'ko'];
      case 'ko':
        return ['en', 'ja', 'zh'];
      default:
        return [];
    }
  };

  // 获取语言名称
  const getLangName = (lang: string): string => {
    const names = {
      en: 'English',
      ja: '日本語',
      zh: '简体中文',
      ko: '한국어',
    };
    return names[lang as keyof typeof names] || lang;
  };

  const handleRoleRoundComplete = useCallback(
    (results: any[]) => {
      // Merge role practice scores into main sentenceScores
      setSentenceScores(prev => {
        const next = { ...prev };
        results.forEach(res => {
          if (res.index !== undefined && res.scorePercent !== undefined) {
            const existing = next[res.index];
            const scoreValue = res.scoreRatio || (res.scorePercent / 100);
            next[res.index] = {
              score: scoreValue,
              finalText: res.transcript || res.text,
              missing: res.missing || [],
              extra: res.extra || [],
              // alignmentResult might be missing in role results, but that's acceptable
              attempts: (existing?.attempts || 0) + 1,
              firstScore: existing?.firstScore ?? scoreValue,
              bestScore: Math.max(existing?.bestScore || 0, scoreValue),
            };
          }
        });
        return next;
      });

      setCompletedRoleList((prev) => {
        if (prev.includes(selectedRole)) return prev;
        const updated = [...prev, selectedRole];
        const remaining = availableRoles.filter((role) => !updated.includes(role));
        setNextRoleSuggestion(remaining.length > 0 ? remaining[0] : null);
        return updated;
      });
    },
    [availableRoles, selectedRole],
  );

  const renderPracticeModeSwitcher = () => (
    <Card className="p-4 border border-indigo-100 bg-white/80 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-indigo-600">
              {t.shadowing?.role_mode_switcher_title || '练习模式'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {t.shadowing?.role_mode_switcher_hint || '可在普通逐句与分角色对话之间切换'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={practiceMode === 'default' ? 'default' : 'outline'}
              onClick={() => {
                setPracticeMode('default');
                setNextRoleSuggestion(null);
                setCompletedRoleList([]);
              }}
              size="sm"
            >
              {t.shadowing?.mode_default || '逐句练习'}
            </Button>
            <Button
              variant={practiceMode === 'role' ? 'default' : 'outline'}
              onClick={() => {
                if (!availableRoles.length) return;
                setPracticeMode('role');
                setCompletedRoleList([]);
                setNextRoleSuggestion(null);
                setSelectedRole((prev) =>
                  availableRoles.includes(prev) ? prev : availableRoles[0],
                );
              }}
              disabled={!availableRoles.length}
              size="sm"
            >
              {t.shadowing?.mode_role || '分角色对话'}
            </Button>
            <Button
              variant={practiceMode === 'followAlong' ? 'default' : 'outline'}
              onClick={() => {
                setPracticeMode('followAlong');
                setNextRoleSuggestion(null);
                setCompletedRoleList([]);
              }}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
            >
              {'跟读模式'}
            </Button>
          </div>
        </div>
        {practiceMode === 'role' && (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm text-slate-600">
                {t.shadowing?.role_select_label || '选择角色'}
              </Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => {
                  setSelectedRole(value.toUpperCase());
                  setNextRoleSuggestion(null);
                }}
                disabled={!availableRoles.length}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="A" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {practiceMode === 'role' && availableRoles.length === 0 && (
              <div className="text-sm text-rose-600">
                {t.shadowing?.role_mode_unavailable || '当前素材暂不支持分角色练习'}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );

  // 获取用户个人资料
  const fetchUserProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('native_lang')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.warn('获取用户资料失败:', error);
        return;
      }

      if (profile?.native_lang) {
        setUserProfile(profile);
        // 根据用户母语设置界面语言
        setLanguageFromUserProfile(profile.native_lang);
      }
    } catch (error) {
      console.error('获取用户资料失败:', error);
    }
  }, [setLanguageFromUserProfile]);

  // 当题目改变时，自动设置翻译语言
  useEffect(() => {
    if (!currentItem) return;
    const targetLangs = getTargetLanguages(currentItem.lang);
    if (targetLangs.length > 0) {
      setTranslationLang(targetLangs[0] as 'en' | 'ja' | 'zh' | 'ko');
    }
  }, [currentItem]);

  // 加载用户生词本 (当前语言)
  useEffect(() => {
    if (!currentItem?.lang || !user) return;

    const loadUserVocab = async () => {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `/api/vocab/entries?lang=${currentItem.lang}&limit=1000`,
          { headers }
        );
        const data = await response.json();
        if (data.success) {
          setUserVocab(data.entries || []);

          // 筛选出不是从当前文章来源的单词，并检查是否在当前文章文本中存在
          const filteredVocab = (data.entries || []).filter((entry: { source_id: string }) =>
            entry.source_id !== currentItem.id
          );

          if (filteredVocab.length > 0 && currentItem.text) {
            // 检查哪些单词在当前文章文本中存在
            const articleText = currentItem.text.toLowerCase();
            const wordsInArticle = filteredVocab.filter((entry: { term: string }) =>
              articleText.includes(entry.term.toLowerCase())
            );

            if (wordsInArticle.length > 0) {
              // 转换为 previousWords 格式
              const vocabWords = wordsInArticle.map((entry: { term: string; context?: string; explanation?: object; id: string }) => ({
                word: entry.term,
                context: entry.context || '',
                explanation: entry.explanation,
                fromVocab: true,
                vocabId: entry.id
              }));

              // 获取当前已有的 previousWords，避免重复
              setPreviousWords(prevWords => {
                const existingWords = new Set(prevWords.map(w => w.word));
                const newWords = vocabWords.filter((v: { word: string }) => !existingWords.has(v.word));

                if (newWords.length > 0) {
                  return [...prevWords, ...newWords];
                }
                return prevWords;
              });
            }
          }
        }
      } catch (error) {
        console.error('加载生词本失败:', error);
      }
    };

    loadUserVocab();
  }, [currentItem?.lang, currentItem?.id, user]);

  // 刷新生词解释
  const handleRefreshExplanation = async (word: string, vocabId?: string) => {
    if (!vocabId) return;

    try {
      setIsGeneratingExplanation(true);
      const headers = await getAuthHeaders();

      // 重新生成解释
      const response = await fetch('/api/vocab/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          term: word,
          lang: currentItem?.lang || lang,
          native_lang: language,
          context: currentItem?.text || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.explanation) {
          // 更新生词本中的解释
          const updateResponse = await fetch('/api/vocab/entries', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              id: vocabId,
              explanation: data.explanation
            })
          });

          if (updateResponse.ok) {
            // 更新本地状态
            setUserVocab(prev => prev.map(v =>
              v.id === vocabId
                ? { ...v, explanation: data.explanation }
                : v
            ));
            toast.success('解释已刷新');
          }
        }
      }
    } catch (error) {
      console.error('刷新解释失败:', error);
      toast.error('刷新解释失败');
    } finally {
      setIsGeneratingExplanation(false);
    }
  };

  // （移除重复母语加载副作用，统一由"步骤切换时的联动"处理翻译语言）

  // 增强的发音功能 (使用和黄字相同的语音选择逻辑)
  const speakWord = (word: string, lang: string) => {
    // 调用浏览器发音 - 使用和黄字相同的逻辑
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // 停止当前正在播放的语音
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(word);

        // 根据当前语言设置语音
        const langMap: Record<string, string> = {
          'ja': 'ja-JP',
          'zh': 'zh-CN',
          'en': 'en-US',
          'ko': 'ko-KR',
        };
        const langCode = langMap[lang] || 'ko-KR';
        utterance.lang = langCode;
        utterance.rate = 0.5; // 放慢语速，更清晰
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // 使用共享的语音选择工具函数
        selectBestVoiceAsync(utterance, lang, langCode, () => {
          window.speechSynthesis.speak(utterance);
        });
      } catch (error) {
        console.error('语音合成失败:', error);
      }
    }
  };

  // 悬停/点击解释组件
  const HoverExplanation = ({
    word,
    explanation,
    children,
    fromVocab = false,
    vocabId,
    onRefresh,
    lang = 'ko',
  }: {
    word: string;
    explanation?: {
      gloss_native: string;
      pronunciation?: string;
      pos?: string;
      senses?: Array<{ example_target: string; example_native: string }>;
    };
    children: React.ReactNode;
    fromVocab?: boolean;
    vocabId?: string;
    onRefresh?: (word: string, vocabId?: string) => void;
    lang?: string;
  }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [latestExplanation, setLatestExplanation] = useState(explanation);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const lastClickTimeRef = useRef<number>(0); // 防止重复点击
    const pron =
      explanation?.pronunciation ||
      latestExplanation?.pronunciation ||
      (wordExplanations?.[word]?.pronunciation) ||
      (explanationCache?.[word]?.pronunciation);
    const shouldRuby = (
      // 步骤4（日语）强制仅汉字注音显示
      ((lang === 'ja') && step === 4 && !!pron) ||
      // 其他情况走用户开关
      ((lang === 'zh' || lang === 'ja' || lang === 'ko') && showRubyPronunciation && !!pron)
    );

    const handleMouseEnter = async () => {
      setShowTooltip(true);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (abortRef.current) { try { abortRef.current.abort(); } catch { } abortRef.current = null; }

      // 优先使用本地缓存的解释
      if (latestExplanation) {
        return; // 如果已有解释，直接显示，不发起新请求
      }

      // 只有在页面加载完成后才允许搜索
      if (!pageLoaded) {
        return;
      }

      // 增加防抖延迟到1500ms，进一步减少频繁请求
      tooltipTimerRef.current = setTimeout(async () => {
        try {
          const data = await searchVocabWithCache(word, lang as 'ja' | 'en' | 'zh' | 'ko', getAuthHeaders);
          if (data?.entries && data.entries.length > 0 && data.entries[0].explanation) {
            setLatestExplanation(data.entries[0].explanation);
          }
        } catch (error) {
          if ((error as any)?.name !== 'AbortError') console.error(`获取 ${word} 解释失败:`, error);
        }
      }, 1500); // 进一步增加防抖延迟到1500ms
    };

    const handleMouseLeave = () => {
      setShowTooltip(false);
      if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null; }
      if (abortRef.current) { try { abortRef.current.abort(); } catch { } abortRef.current = null; }
    };

    // 点击发音功能
    const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // 防止重复触发（300ms 内的重复点击会被忽略）
      const now = Date.now();
      if (now - lastClickTimeRef.current < 300) {
        return;
      }
      lastClickTimeRef.current = now;

      // 只专注发音，不切换tooltip

      // 调用浏览器发音
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          setIsSpeaking(true);
          // 停止当前正在播放的语音
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(word);

          // 根据当前语言设置语音
          const langMap: Record<string, string> = {
            'ja': 'ja-JP',
            'zh': 'zh-CN',
            'en': 'en-US',
            'ko': 'ko-KR',
          };
          const langCode = langMap[lang] || 'ko-KR';
          utterance.lang = langCode;
          utterance.rate = 0.5; // 放慢语速，更清晰
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          // 使用共享的语音选择工具函数
          // 添加状态监听
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => {
            setIsSpeaking(false);
            console.error('TTS发音失败');
          };

          selectBestVoiceAsync(utterance, lang, langCode, () => {
            window.speechSynthesis.speak(utterance);
          });
        } catch (error) {
          setIsSpeaking(false);
          console.error('语音合成失败:', error);
        }
      }
    };

    useEffect(() => {
      return () => {
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
        if (abortRef.current) { try { abortRef.current.abort(); } catch { } }
      };
    }, []);

    const tooltipText = latestExplanation?.gloss_native || '已选择的生词';

    return (
      <span
        className={`relative z-10 text-yellow-800 font-medium 
                   cursor-pointer relative 
                   hover:shadow-md active:scale-95 
                   transition-all duration-150
                   ${isSpeaking ? 'animate-pulse ring-2 ring-yellow-400' : ''}
                   touch-manipulation select-none`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => {
          // 处理点击事件（移动端和桌面端都使用）
          e.preventDefault();
          e.stopPropagation();

          // 统一处理：只触发发音
          handleClick(e);
        }}
        onTouchEnd={(e) => {
          // 在移动设备上，确保触摸结束后也能触发发音
          // 这是为了确保在 iPad Safari 上也能正常工作
          // 注意：onClick 和 onTouchEnd 可能会同时触发，但 handleClick 内部有防抖机制
          e.preventDefault();
          e.stopPropagation();
          handleClick(e as any);
        }}
        title={`点击发音: ${word}`}
      >
        {shouldRuby ? (
          lang === 'ja' ? (
            (() => {
              const pronSan = sanitizeJapaneseReadingToHiragana(pron || '');
              if (!pronSan) {
                return <span className="bg-yellow-200">{children}</span>;
              }
              const segs = deriveKanjiFuriganaSegments(String(word), pronSan);
              return (
                <span className="bg-yellow-200">
                  {segs.map((seg, idx) =>
                    seg.type === 'kanji' && seg.rt ? (
                      <ruby key={`ja-ruby-${word}-${idx}`} className="align-baseline">
                        <span>{seg.text}</span>
                        <rt className="relative -top-[3px] text-[10px] leading-3 text-gray-700">{seg.rt}</rt>
                      </ruby>
                    ) : (
                      <span key={`ja-plain-${word}-${idx}`}>{seg.text}</span>
                    ),
                  )}
                </span>
              );
            })()
          ) : (
            <ruby className="align-baseline">
              <span className="bg-yellow-200">{children}</span>
              <rt className="relative -top-[3px] text-[10px] leading-3 text-gray-700">{pron}</rt>
            </ruby>
          )
        ) : (
          <span className="bg-yellow-200">{children}</span>
        )}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg w-32 z-50 hidden md:block">
            <div className="flex justify-between items-start mb-1">
              <span>{tooltipText}</span>
              {fromVocab && onRefresh && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh(word, vocabId);
                  }}
                  className="text-xs underline ml-2 hover:text-blue-300"
                  title="刷新解释"
                >
                  🔄
                </button>
              )}
            </div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
          </div>
        )}
      </span>
    );
  };
  // 带发音的生词显示组件
  // 带发音的生词显示组件
  const WordWithPronunciation = ({
    word,
    explanation,
    lang,
  }: {
    word: string;
    explanation?: {
      gloss_native: string;
      pronunciation?: string;
      pos?: string;
      senses?: Array<{ example_target: string; example_native: string }>;
    };
    lang?: string;
  }) => {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">{word}</span>
        {explanation?.pronunciation && (
          (() => {
            let toShow = explanation.pronunciation;
            if (lang === 'ja' || (!lang && /[\s\u3040-\u309f\u30a0-\u30ff]/.test(toShow))) {
              const san = sanitizeJapaneseReadingToHiragana(explanation.pronunciation || '');
              toShow = san || explanation.pronunciation;
            }

            return (
              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">{toShow}</span>
            );
          })()
        )}
      </div>
    );
  };

  // 动态解释组件
  const DynamicExplanation = ({
    word,
    fallbackExplanation,
  }: {
    word: string;
    fallbackExplanation?: {
      gloss_native: string;
      pronunciation?: string;
      pos?: string;
      senses?: Array<{ example_target: string; example_native: string }>;
      cefr?: string;
    };
  }) => {
    // 优先使用缓存中的最新解释，其次使用fallback解释
    const [latestExplanation, setLatestExplanation] = useState<
      | {
        gloss_native: string;
        pronunciation?: string;
        pos?: string;
        senses?: Array<{ example_target: string; example_native: string }>;
        cefr?: string;
      }
      | undefined
    >(explanationCache[word] || fallbackExplanation);
    const [explanationLoading, setExplanationLoading] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);

    // 刷新解释函数 - 强制从数据库获取最新数据
    const refreshExplanation = useCallback(async () => {
      setExplanationLoading(true);
      try {
        // 清除缓存，强制重新获取
        const key = `vocab:${currentItem?.lang || lang}:${word.toLowerCase().trim()}`;
        globalVocabCache.delete(key);
        try {
          const sessionKey = `vocab_cache_${key}`;
          sessionStorage.removeItem(sessionKey);
        } catch (_) {
          // sessionStorage 可能不可用，忽略
        }

        const data = await searchVocabWithCache(word, (currentItem?.lang || lang) as 'ja' | 'en' | 'zh' | 'ko', getAuthHeaders);

        if (data?.entries && data.entries.length > 0 && data.entries[0].explanation) {
          const explanation = data.entries[0].explanation;
          setLatestExplanation(explanation);
          // 更新缓存
          setExplanationCache((prev) => ({
            ...prev,
            [word]: explanation,
          }));
        } else {
          // 如果没有找到解释，清除缓存
          setLatestExplanation(undefined);
          setExplanationCache((prev) => {
            const newCache = { ...prev };
            delete newCache[word];
            return newCache;
          });
        }
      } catch (error) {
        console.error(`获取 ${word} 解释失败:`, error);
      } finally {
        setExplanationLoading(false);
      }
    }, [word, searchVocabWithCache]);

    // 初始化时获取最新解释（等待页面加载完成）
    useEffect(() => {
      if (!hasInitialized && pageLoaded) {
        setHasInitialized(true);

        const fetchInitialExplanation = async () => {
          setExplanationLoading(true);
          try {
            const data = await searchVocabWithCache(word, (currentItem?.lang || lang) as 'ja' | 'en' | 'zh' | 'ko', getAuthHeaders);
            if (data?.entries && data.entries.length > 0 && data.entries[0].explanation) {
              const explanation = data.entries[0].explanation;
              setLatestExplanation(explanation);
            }
          } catch (error) {
            console.error(`获取 ${word} 解释失败:`, error);
          } finally {
            setExplanationLoading(false);
          }
        };
        fetchInitialExplanation();
      }
    }, [hasInitialized, pageLoaded, word, searchVocabWithCache]);

    // 当缓存更新时，同步更新显示
    const cachedExplanation = explanationCache[word];
    useEffect(() => {
      if (cachedExplanation) {
        setLatestExplanation(cachedExplanation);
      }
    }, [cachedExplanation, word]);

    if (!latestExplanation) {
      return (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span>{t.shadowing.no_explanation || '暂无解释'}</span>
          <button
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title={t.shadowing.refresh_explanation || '刷新解释'}
          >
            🔄
          </button>
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-700">
        <div className="mb-2 flex items-center gap-2">
          <strong>{t.shadowing.explanation || '解释'}：</strong>
          {latestExplanation.cefr && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mr-2
              ${latestExplanation.cefr.startsWith('A') ? 'bg-green-100 text-green-800' :
                latestExplanation.cefr.startsWith('B') ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'}`}>
              {latestExplanation.cefr}
            </span>
          )}
          {latestExplanation.gloss_native}
          <button
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title={t.shadowing.refresh_explanation || '刷新解释'}
            disabled={loading}
          >
            🔄
          </button>
        </div>

        {/* 显示词性信息 */}
        {latestExplanation.pos && (
          <div className="mb-2 text-sm text-gray-600">
            <strong>{t.shadowing.part_of_speech || '词性'}：</strong>
            {latestExplanation.pos}
          </div>
        )}

        {latestExplanation.senses && latestExplanation.senses.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>{t.shadowing.example_sentence || '例句'}：</strong>
            <div className="mt-1">
              <div className="font-medium">{latestExplanation.senses[0]?.example_target}</div>
              <div className="text-gray-500">{latestExplanation.senses[0]?.example_native}</div>
            </div>
          </div>
        )}
      </div>
    );
  };


  // 认证头由 useAuth 提供的 getAuthHeaders 统一处理

  // 重复定义的 loadThemes/loadSubtopics 已移除（保留下方新版本）
  // 获取题库列表
  const fetchItems = useCallback(async () => {
    // 取消之前的请求
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch { }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // 设置请求超时（15秒）
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 15000);

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level !== null) params.set('level', String(level));
      if (practiced !== 'all') params.set('practiced', practiced === 'practiced' ? 'true' : 'false');
      if (dialogueType !== 'all') params.set('dialogue_type', dialogueType);

      const key = `shadowing_catalog:${params.toString()}`;
      const cached = getCached<any>(key);
      if (cached) {
        setItems(cached.items || []);
        setLoading(false);
        clearTimeout(timeoutId);
        abortRef.current = null;
        return;
      }

      let headers = await getAuthHeaders();
      let response = await fetch(`/api/shadowing/catalog?${params.toString()}`, {
        headers,
        credentials: 'include',
        signal: controller.signal
      });

      if (response.status === 401) {
        try {
          await supabase.auth.refreshSession();
          headers = await getAuthHeaders();
          response = await fetch(`/api/shadowing/catalog?${params.toString()}`, {
            headers,
            credentials: 'include',
            signal: controller.signal
          });
        } catch (refreshError) {
          console.error('Session refresh failed:', refreshError);
        }
      }

      if (response.ok) {
        const data = await response.json();
        setCached(key, data, 30_000);
        setItems(data.items || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch items:', response.status, errorText);
        // 显示用户友好的错误提示
        setItems([]);
      }
    } catch (error: any) {
      // 区分不同类型的错误
      if (error.name === 'AbortError') {
        // Request was cancelled or timed out
      } else {
        console.error('Failed to fetch items:', error);
      }
      setItems([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
      abortRef.current = null;
    }
  }, [lang, level, practiced, dialogueType, getAuthHeaders]);

  // 加载主题列表
  const loadThemes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level?.toString() || '');
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/themes?${params.toString()}`, {
        headers,
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setThemes((data.items || data.themes) ?? []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load themes:', response.status, errorText);
        setThemes([]);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
      setThemes([]);
    }
  }, [lang, level, getAuthHeaders]);

  // 加载某主题下的小主题
  const loadSubtopics = useCallback(async (themeId: string) => {
    try {
      const params = new URLSearchParams();
      params.set('theme_id', themeId);
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level?.toString() || '');
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/subtopics?${params.toString()}`, {
        headers,
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSubtopics((data.items || data.subtopics) ?? []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load subtopics:', response.status, errorText);
        setSubtopics([]);
      }
    } catch (error) {
      console.error('Failed to load subtopics:', error);
      setSubtopics([]);
    }
  }, [lang, level, getAuthHeaders]);

  // 鉴权由 AuthContext 统一处理

  // 首次加载：确保认证完成后自动触发数据加载
  useEffect(() => {
    // 当认证完成且之前未加载过数据时，触发首次加载
    if (!authLoading && user && !initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchItems();
    }
  }, [authLoading, user?.id, fetchItems]);

  // 加载题库（筛选条件变化时）
  useEffect(() => {
    // 等待认证完成且用户已登录
    if (authLoading || !user) return;

    // 如果是首次加载，已经由上面的 effect 处理，避免重复
    if (!initialLoadRef.current) return;

    // 防抖延迟，避免快速切换时多次请求
    const t = setTimeout(() => {
      fetchItems();
    }, 50);

    return () => clearTimeout(t);
    // 依赖筛选条件和fetchItems函数，确保条件变化时重新加载
  }, [lang, level, practiced, dialogueType, authLoading, user?.id, fetchItems]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 清理定时器
      if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
      // 清理请求
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch { }
        abortRef.current = null;
      }
    };
  }, []);


  // 加载主题数据
  useEffect(() => {
    if (!authLoading && user) {
      loadThemes();
    }
  }, [lang, level, authLoading, user?.id, loadThemes]);


  // State for vocab unknown rate
  const [vocabUnknownRate, setVocabUnknownRate] = useState<Record<string, number>>({ A1_A2: 0, B1_B2: 0, C1_plus: 0 });

  // 根据用户历史表现获取推荐等级（按当前筛选语言）
  useEffect(() => {
    const fetchRecommendedLevel = async () => {
      try {
        if (!user) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        const effectiveLang = lang || 'zh';

        // Parallel fetch: recommended level API + Bayesian vocabulary profile
        const [recResp, profileResp] = await Promise.all([
          fetch(`/api/shadowing/recommended?lang=${effectiveLang}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: 'include',
          }),
          fetch('/api/vocabulary/profile', {
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: 'include',
          })
        ]);

        if (recResp.ok) {
          const data = await recResp.json();
          if (typeof data?.recommended === 'number') {
            setRecommendedLevel(data.recommended);
          }
        }

        // Use Bayesian profile to set vocab unknown rate
        if (profileResp.ok) {
          const profileData = await profileResp.json();
          console.log('[Bayesian Debug] Profile API response:', profileData);
          if (profileData?.success && profileData?.profile) {
            const bayesianProfile = profileData.profile as BayesianUserProfile;
            console.log('[Bayesian Debug] jlptMastery:', bayesianProfile.jlptMastery);
            const unknownRate = bayesianToUnknownRate(bayesianProfile);
            console.log('[Bayesian Debug] Converted unknownRate:', unknownRate);
            setVocabUnknownRate(unknownRate);
            // Store the full profile for precise per-article prediction
            setBayesianProfile(bayesianProfile);

            // Optionally update recommended level from Bayesian profile
            if (!recResp.ok && bayesianProfile.estimatedLevel) {
              setRecommendedLevel(Math.round(bayesianProfile.estimatedLevel));
            }
          }
        } else {
          console.error('[Bayesian Debug] Profile API failed:', profileResp.status);
        }

      } catch {
        // ignore, fallback to仅基于完成状态的排序
      }
    };
    fetchRecommendedLevel();
  }, [lang, user]);

  // 加载用户对各大主题的偏好（场景向量）

  useEffect(() => {
    if (selectedThemeId !== 'all' && themes.length > 0) {
      const themeExists = themes.some((theme) => theme.id === selectedThemeId);
      if (!themeExists) {
        setSelectedThemeId('all');
        setSelectedSubtopicId('all');
        setSubtopics([]);
      }
    }
  }, [themes, selectedThemeId]);

  // 当选择大主题时，加载对应的子主题
  useEffect(() => {
    if (selectedThemeId !== 'all') {
      loadSubtopics(selectedThemeId);
    } else {
      setSubtopics([]);
      setSelectedSubtopicId('all');
    }
  }, [selectedThemeId, loadSubtopics]);

  // 搜索值延迟，降低频繁输入导致的重算
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // 为搜索建立轻量索引，避免在 filter 中重复对长文本 toLowerCase
  const searchIndex = useMemo(() => {
    const map = new Map<string, { title: string; text: string }>();
    for (const it of items) {
      const tl = (it.title || '').toLowerCase();
      // 限制参与搜索的正文长度，避免大文本拖慢过滤
      const xl = (it.text || '').slice(0, 800).toLowerCase();
      map.set(it.id, { title: tl, text: xl });
    }
    return map;
  }, [items]);

  // 过滤显示的题目（记忆化）
  const filteredItems = useMemo(() => {
    const list = items
      .filter((item) => {
        if (dialogueType !== 'all' && item.dialogue_type !== dialogueType) return false;
        // 搜索筛选
        if (deferredSearchQuery) {
          const query = deferredSearchQuery.toLowerCase();
          const idx = searchIndex.get(item.id);
          const matchesSearch = idx
            ? (idx.title.includes(query) || idx.text.includes(query))
            : ((item.title || '').toLowerCase().includes(query) || (item.text || '').toLowerCase().includes(query));
          if (!matchesSearch) return false;
        }

        // 体裁筛选（基于 genre 字段或等级推断的体裁筛选）
        if (theme !== 'all') {
          let itemGenre =
            item.genre ||
            item.meta?.genre ||
            item.meta?.theme ||
            (item.meta?.tags && Array.isArray(item.meta.tags) ? item.meta.tags[0] : null);

          // 如果没有体裁信息，根据等级和内容特征推断
          if (!itemGenre) {
            // 根据6级难度设计的体裁分配规则
            const levelGenreMap: Record<number, string[]> = {
              1: ['dialogue'],
              2: ['dialogue', 'monologue'],
              3: ['monologue', 'news'],
              4: ['news', 'dialogue'],
              5: ['lecture', 'news'],
              6: ['lecture', 'news'],
            };

            const possibleGenres = levelGenreMap[item.level] || [];
            // 如果等级对应的体裁包含当前筛选的体裁，则通过
            if (possibleGenres.includes(theme)) {
              itemGenre = theme;
            }
          }

          if (!itemGenre || !itemGenre.toLowerCase().includes(theme.toLowerCase())) {
            return false;
          }
        }

        // 大主题筛选（精确匹配）
        if (selectedThemeId !== 'all') {
          // 大主题筛选逻辑

          if (!item.theme_id || item.theme_id !== selectedThemeId) {
            return false;
          }
        }

        // 小主题筛选（小主题和标题是一对一关系）
        if (selectedSubtopicId !== 'all') {
          if (!item.subtopic_id || item.subtopic_id !== selectedSubtopicId) {
            return false;
          }
        }

        return true;
      });

    const getLastTs = (item: ShadowingItem) => {
      if (item.stats?.lastPracticed) {
        const ts = new Date(item.stats.lastPracticed).getTime();
        if (!Number.isNaN(ts)) return ts;
      }
      const created = new Date(item.created_at).getTime();
      return Number.isNaN(created) ? 0 : created;
    };

    // 最近练习排序：按最近练习时间降序
    if (sortMode === 'recent') {
      return list.sort((a, b) => getLastTs(b) - getLastTs(a));
    }

    // 完成度优先：已完成 > 其它，内部按最近练习时间降序
    if (sortMode === 'completion') {
      return list.sort((a, b) => {
        const pa = a.isPracticed ? 1 : 0;
        const pb = b.isPracticed ? 1 : 0;
        if (pb !== pa) return pb - pa; // 已完成优先
        return getLastTs(b) - getLastTs(a);
      });
    }

    // 默认：“推荐”排序（使用个性化分数）
    return list.sort((a, b) => {
      // 如果有推荐等级或场景偏好，则优先按“个性化推荐得分”排序
      const hasPersonalizedSignal =
        recommendedLevel != null || (themePrefs && Object.keys(themePrefs).length > 0);

      if (hasPersonalizedSignal) {
        const scoreFor = (item: ShadowingItem) => {
          // 练习状态：未开始 > 草稿中 > 已完成
          const practiceWeight = item.isPracticed ? 0.1 : item.status === 'draft' ? 0.7 : 1.0;

          // 难度与推荐等级的匹配度
          let difficultyWeight = 0.5;
          if (recommendedLevel != null) {
            const diff = Math.abs(item.level - recommendedLevel);
            if (diff === 0) difficultyWeight = 1.0;
            else if (diff === 1) difficultyWeight = 0.6;
            else if (diff === 2) difficultyWeight = 0.3;
            else difficultyWeight = 0.0;
          }

          // 场景 / 主题偏好权重
          const basePref = item.theme_id ? themePrefs[item.theme_id]?.weight ?? 0.3 : 0.3;
          const themeWeight = Math.max(0, Math.min(1, basePref));

          // 综合得分：场景 > 难度 > 状态
          return 0.5 * themeWeight + 0.3 * difficultyWeight + 0.2 * practiceWeight;
        };

        const sa = scoreFor(a);
        const sb = scoreFor(b);
        if (sb !== sa) return sb - sa;
      }

      // 回退规则：按状态 + 序号排序（原有逻辑）
      // 排序规则：已完成 > 草稿中 > 未开始
      const getStatusOrder = (item: ShadowingItem) => {
        if (item.isPracticed) return 0; // 已完成
        if (item.status === 'draft') return 1; // 草稿中
        return 2; // 未开始
      };

      const orderA = getStatusOrder(a);
      const orderB = getStatusOrder(b);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // 相同状态按数字顺序排序
      const getNumberFromTitle = (title: string) => {
        const match = title.match(/^(\d+)\./);
        return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
      };

      const numA = getNumberFromTitle(a.title);
      const numB = getNumberFromTitle(b.title);

      if (numA !== numB) {
        return numA - numB;
      }

      // 如果数字相同，按标题排序
      return a.title.localeCompare(b.title);
    });
  }, [
    items,
    deferredSearchQuery,
    theme,
    selectedThemeId,
    selectedSubtopicId,
    searchIndex,
    recommendedLevel,
    themePrefs,
    sortMode,
    dialogueType,
  ]);

  // 列表统计一次性计算，避免多处重复 filter
  const listStats = useMemo(() => {
    const stats = { totalCount: filteredItems.length, completedCount: 0, draftCount: 0, unstartedCount: 0 };
    for (const it of filteredItems) {
      if (it.isPracticed) stats.completedCount += 1;
      else if (it.status === 'draft') stats.draftCount += 1;
      else stats.unstartedCount += 1;
    }
    return stats;
  }, [filteredItems]);

  // 批量进度节流（rAF + 100ms），减少频繁 setState 抖动
  const progressThrottleRef = useRef<{ last: number; raf: number | null }>({ last: 0, raf: null });
  const updateProgressThrottled = useCallback((updater: Parameters<typeof setBatchExplanationProgress>[0]) => {
    const now = Date.now();
    const since = now - progressThrottleRef.current.last;
    const commit = () => {
      setBatchExplanationProgress(updater as any);
      progressThrottleRef.current.last = Date.now();
      progressThrottleRef.current.raf = null;
    };
    if (since >= 100) {
      commit();
      return;
    }
    if (progressThrottleRef.current.raf != null) {
      try { cancelAnimationFrame(progressThrottleRef.current.raf as number); } catch { }
    }
    try {
      const id = requestAnimationFrame(commit);
      progressThrottleRef.current.raf = id;
    } catch {
      commit();
    }
  }, []);

  // 随机选择未练习的题目
  const getRandomUnpracticed = () => {
    const unpracticed = items.filter((item) => !item.isPracticed);
    if (unpracticed.length === 0) {
      toast.info('所有题目都已练习过！');
      return;
    }
    const randomItem = unpracticed[Math.floor(Math.random() * unpracticed.length)];
    loadItem(randomItem);
  };

  // 顺序下一题（未练习的）
  const getNextUnpracticed = () => {
    const unpracticed = items.filter((item) => !item.isPracticed);
    if (unpracticed.length === 0) {
      toast.info('所有题目都已练习过！');
      return;
    }
    loadItem(unpracticed[0]);
  };

  // 加载题目
  const loadItem = async (item: ShadowingItem) => {
    // 切题前停止录音组件的播放，避免串音
    try {
      // @ts-ignore
      audioRecorderRef.current?.stopPlayback?.();
    } catch { }
    // 停止页面音频播放并复位
    try {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current?.reset();
    } catch { }
    setCurrentItem(item);
    setSelectedWords([]);
    setPreviousWords([]);
    setCurrentRecordings([]);
    setPracticeStartTime(new Date());
    // 如果该题已完成，刷新加载时直接解除门控显示全部模块
    setPracticeComplete(!!item.isPracticed);
    setStep(1);
    setScoringResult(null);
    setShowSentenceComparison(false);
    setSelfDifficulty(null);
    setShowDifficultyModal(false);

    // 将当前题目写入 URL，支持刷新后自动恢复
    try {
      const params = new URLSearchParams(navSearchParams?.toString() || '');
      params.set('item', item.id);
      params.set('autostart', '1');
      // 移除来源标记，避免后续错误回退（如 src=daily 再次触发每日回退）
      params.delete('src');
      const next = `${pathname}?${params.toString()}`;
      const current = `${pathname}?${navSearchParams?.toString() || ''}`;
      if (next !== current) {
        router.replace(next, { scroll: false });
      }
    } catch { }

    // 将当前题目写入本地存储（按语言分桶），用于无 URL 参数时的兜底恢复
    try {
      const keyLang = (item as any)?.lang || lang;
      if (typeof window !== 'undefined' && keyLang) {
        localStorage.setItem(`shadowing:lastItem:${keyLang}`, item.id);
      }
    } catch { }

    // 尝试加载之前的会话数据（不管是否标记为已练习）
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/session?item_id=${item.id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setCurrentSession(data.session);
          if (data.session.status === 'completed') {
            setPracticeComplete(true);
          }

          // 将之前的生词设置为 previousWords
          const previousWordsData = data.session.picked_preview || [];
          setPreviousWords(previousWordsData);

          // 还原AI解释 - 从数据库获取所有单词的最新解释
          // 注意：这里不再并行请求所有解释，而是让DynamicExplanation组件按需加载
          // 这样可以避免一次性发起大量API请求

          // 重新生成录音的signed URL，因为之前的URL可能已过期
          const recordingsWithValidUrls = await Promise.all(
            (data.session.recordings || []).map(async (recording: AudioRecording) => {
              try {
                // 从fileName中提取路径
                const filePath = recording.fileName;
                if (!filePath) return recording;

                // 重新生成signed URL（复用全局 supabase 客户端）
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from('recordings')
                  .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

                if (signedUrlError) {
                  console.error('重新生成URL失败:', signedUrlError);
                  return recording;
                }

                return {
                  ...recording,
                  url: signedUrlData.signedUrl,
                };
              } catch (error) {
                console.error('处理录音URL时出错:', error);
                return recording;
              }
            }),
          );

          setCurrentRecordings(recordingsWithValidUrls);
        } else {
          setCurrentSession(null);
        }
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      setCurrentSession(null);
    }
  };
  // 深链支持：?item=&autostart=1 直接加载题目
  const searchParams = useSearchParams();
  const pendingItemIdRef = useRef<string | null>(null);
  const lastLoadedItemIdRef = useRef<string | null>(null);
  const explicitItemRef = useRef<boolean>(false);
  useEffect(() => {
    (async () => {
      try {
        const itemId = searchParams?.get('item');
        explicitItemRef.current = !!itemId;
        const auto = searchParams?.get('autostart') === '1';
        const src = searchParams?.get('src');
        // 从每日一题等入口自动进入某道题时，显示整页加载动画，直至题目加载完成
        if (itemId && (auto || src === 'storyline')) {
          setInitialDeepLinkLoading(true);
        }
        if (!itemId) return;
        // 记录待自动进入的题目，若立即加载失败，待题库就绪后再尝试
        pendingItemIdRef.current = itemId;
        let target = items.find((x) => x.id === itemId) || null;
        if (!target) {
          let headers: HeadersInit | undefined = undefined;
          try {
            if (user) headers = await getAuthHeaders();
          } catch { }
          const resp = await fetch(`/api/shadowing/item?id=${itemId}`, { headers, credentials: 'include' });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.item) {
              target = {
                ...data.item,
                isPracticed: false,
                stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
              } as ShadowingItem;
              setItems((prev) => {
                const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
                return exists ? prev : [target as ShadowingItem, ...prev];
              });
            }
          } else if (resp.status === 404) {
            // 显式每日入口（src=daily）且首次加载失败时，回退到每日一题接口一次
            try {
              const src = searchParams?.get('src');
              const urlLang = (searchParams?.get('lang') as 'zh' | 'ja' | 'en' | 'ko') || lang;
              if (src === 'daily' && !currentItem && !lastLoadedItemIdRef.current && urlLang) {
                const dailyResp = await fetch(`/api/shadowing/daily?lang=${urlLang}`, { headers, credentials: 'include' });
                if (dailyResp.ok) {
                  const dailyData = await dailyResp.json();
                  if (dailyData?.item) {
                    target = {
                      ...dailyData.item,
                      isPracticed: false,
                      stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
                    } as ShadowingItem;
                    setItems((prev) => {
                      const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
                      return exists ? prev : [target as ShadowingItem, ...prev];
                    });
                  }
                }
              }

              // 非显式每日入口，且 URL 未显式指定 item 时，才尝试本地兜底
              if (!explicitItemRef.current) {
                const lastId = typeof window !== 'undefined' ? localStorage.getItem(`shadowing:lastItem:${lang}`) : null;
                if (lastId && lastId !== itemId) {
                  const altResp = await fetch(`/api/shadowing/item?id=${encodeURIComponent(lastId)}`, { headers, credentials: 'include' });
                  if (altResp.ok) {
                    const altData = await altResp.json();
                    if (altData?.item) {
                      target = {
                        ...altData.item,
                        isPracticed: false,
                        stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
                      } as ShadowingItem;
                      setItems((prev) => {
                        const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
                        return exists ? prev : [target as ShadowingItem, ...prev];
                      });
                    }
                  }
                }
              }
            } catch { }
          }
        }
        if (target) {
          await loadItem(target);
          pendingItemIdRef.current = null;
          lastLoadedItemIdRef.current = itemId;
        }
      } catch {
        // 忽略错误，避免阻断后续兜底逻辑
      } finally {
        // 无论成功或失败，都结束初始深链加载动画；若后续成功进入题目，会通过 currentItem 渲染实际内容
        setInitialDeepLinkLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当题库列表加载后，如果还未进入题目且存在待选题目ID，则从列表中自动选中
  useEffect(() => {
    try {
      if (currentItem) return;
      const pendingId = pendingItemIdRef.current;
      if (!pendingId) return;
      const target = items.find((x) => x.id === pendingId) || null;
      if (target) {
        loadItem(target);
        pendingItemIdRef.current = null;
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // 监听 URL 中的 item 变化，确保任何时候 URL 指向某题时都自动进入
  useEffect(() => {
    try {
      const params = new URLSearchParams(navSearchParams?.toString() || '');
      const itemId = params.get('item');
      if (!itemId) return;
      if (lastLoadedItemIdRef.current === itemId) return;

      let target = items.find((x) => x.id === itemId) || null;
      const run = async () => {
        if (!target) {
          let headers: HeadersInit | undefined = undefined;
          try {
            if (user) headers = await getAuthHeaders();
          } catch { }
          const resp = await fetch(`/api/shadowing/item?id=${encodeURIComponent(itemId)}`, { headers, credentials: 'include' });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.item) {
              target = {
                ...data.item,
                isPracticed: false,
                stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
              } as ShadowingItem;
              setItems((prev) => {
                const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
                return exists ? prev : [target as ShadowingItem, ...prev];
              });
            }
          }
        }
        if (target) {
          await loadItem(target);
          lastLoadedItemIdRef.current = itemId;
          pendingItemIdRef.current = null;
        }
      };
      run();
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navSearchParams]);

  // 当用户对象就绪后，如果仍存在待进入题目且尚未进入，则带鉴权头重试一次
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        if (currentItem) return;
        const pendingId = pendingItemIdRef.current;
        if (!pendingId) return;
        let headers: HeadersInit | undefined = undefined;
        try {
          headers = await getAuthHeaders();
        } catch { }
        const resp = await fetch(`/api/shadowing/item?id=${encodeURIComponent(pendingId)}`, { headers, credentials: 'include' });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.item) {
            const target = {
              ...data.item,
              isPracticed: false,
              stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
            } as ShadowingItem;
            setItems((prev) => {
              const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
              return exists ? prev : [target as ShadowingItem, ...prev];
            });
            await loadItem(target);
            lastLoadedItemIdRef.current = pendingId;
            pendingItemIdRef.current = null;
          }
        }
      } catch { }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentItem]);

  // 兜底恢复：当 URL 没有 item 参数时，尝试从本地存储读取上次练习的题目
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const hasParamItem = searchParams?.get('item');
        if (hasParamItem) return;

        const keyLang = lang;
        const lastId = typeof window !== 'undefined' ? localStorage.getItem(`shadowing:lastItem:${keyLang}`) : null;
        if (!lastId) return;

        let target = items.find((x) => x.id === lastId) || null;
        if (!target) {
          const headers = await getAuthHeaders();
          const resp = await fetch(`/api/shadowing/item?id=${encodeURIComponent(lastId)}`, { headers, credentials: 'include' });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.item) {
              target = {
                ...data.item,
                isPracticed: false,
                stats: { recordingCount: 0, vocabCount: 0, practiceTime: 0, lastPracticed: null },
              } as ShadowingItem;
              setItems((prev) => {
                const exists = prev.some((p) => p.id === (target as ShadowingItem).id);
                return exists ? prev : [target as ShadowingItem, ...prev];
              });
            }
          } else if (resp.status === 404) {
            // 题目已不存在，清除缓存
            if (typeof window !== 'undefined') {
              localStorage.removeItem(`shadowing:lastItem:${keyLang}`);
            }
          }
        }
        if (target) {
          await loadItem(target);
        }
      } catch { }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lang]);

  // 处理文本选择（当用户选择文本时）
  const handleTextSelection = (word: string, context: string) => {
    setSelectedText({ word, context });
  };
  // 确认添加选中的文本到生词本
  const confirmAddToVocab = async () => {
    if (selectedText && !isAddingToVocab) {
      setIsAddingToVocab(true);
      try {
        await handleWordSelect(selectedText.word, selectedText.context);

        // 显示成功提示
        const message = `${t.shadowing.messages?.added_to_vocab || '已添加到生词本'}："${selectedText.word}"`;
        setSuccessMessage(message);
        setShowSuccessToast(true);

        // 3秒后自动隐藏toast
        setTimeout(() => {
          setShowSuccessToast(false);
        }, 3000);

        setSelectedText(null);
        // 清除文本选择
        setClearSelection(true);
        // 重置清除选择状态
        setTimeout(() => setClearSelection(false), 100);
      } catch (error) {
        console.error('添加生词失败:', error);
        toast.error(t.shadowing.messages?.add_vocab_failed || '添加生词失败，请重试');
      } finally {
        setIsAddingToVocab(false);
      }
    }
  };

  // 取消选择
  const cancelSelection = () => {
    setSelectedText(null);
    // 清除文本选择
    setClearSelection(true);
    // 重置清除选择状态
    setTimeout(() => setClearSelection(false), 100);
  };

  // 处理生词选择
  const handleWordSelect = async (word: string, context: string) => {
    const wordData = { word, context, lang: currentItem?.lang || lang };

    // 检查是否已经在本次选中的生词中
    const existsInSelected = selectedWords.some(
      (item) => item.word === word && item.context === context,
    );

    // 检查是否在之前的生词中
    const existsInPrevious = previousWords.some(
      (item) => item.word === word && item.context === context,
    );

    if (!existsInSelected && !existsInPrevious) {
      // 这是新词，添加到本次选中的生词中
      const newSelectedWords = [...selectedWords, wordData];
      setSelectedWords(newSelectedWords);

      // 立即保存到数据库（合并 previousWords 和 newSelectedWords）
      if (currentItem) {
        try {
          const headers = await getAuthHeaders();
          const allWords = [...previousWords, ...newSelectedWords];
          const saveData = {
            item_id: currentItem.id,
            recordings: currentRecordings,
            vocab_entry_ids: [],
            picked_preview: allWords,
          };

          const response = await fetch('/api/shadowing/session', {
            method: 'POST',
            headers,
            body: JSON.stringify(saveData),
          });

          if (response.ok) {
            // 生词已保存到数据库
          } else {
            console.error('保存生词失败');
          }
        } catch (error) {
          console.error('保存生词时出错:', error);
        }
      }
    }
  };

  // 移除选中的生词
  const removeSelectedWord = async (index: number) => {
    const newSelectedWords = selectedWords.filter((_, i) => i !== index);
    setSelectedWords(newSelectedWords);

    // 立即保存到数据库（合并 previousWords 和 newSelectedWords）
    if (currentItem) {
      try {
        const headers = await getAuthHeaders();
        const allWords = [...previousWords, ...newSelectedWords];
        const saveData = {
          item_id: currentItem.id,
          recordings: currentRecordings,
          vocab_entry_ids: [],
          picked_preview: allWords,
        };

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          // 生词移除已保存到数据库
        } else {
          console.error('保存生词移除失败');
        }
      } catch (error) {
        console.error('保存生词移除时出错:', error);
      }
    }
  };

  // 移除之前的生词
  const removePreviousWord = async (index: number) => {
    const wordToRemove = previousWords[index];
    if (!wordToRemove) return;

    // 确认删除
    if (!confirm((t.shadowing.messages?.confirm_delete_vocab || '确定要删除生词 "{word}" 吗？这将从生词表中永久删除。').replace('{word}', wordToRemove.word))) {
      return;
    }

    const newPreviousWords = previousWords.filter((_, i) => i !== index);
    setPreviousWords(newPreviousWords);

    // 从生词表中删除
    try {
      const headers = await getAuthHeaders();

      // 先查找生词表中的条目
      const searchResponse = await fetch(
        `/api/vocab/search?term=${encodeURIComponent(wordToRemove.word)}`,
        {
          headers,
        },
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.entries && searchData.entries.length > 0) {
          // 删除生词表中的条目
          const deleteResponse = await fetch('/api/vocab/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              entry_ids: searchData.entries.map((entry: { id: string }) => entry.id),
            }),
          });

          if (deleteResponse.ok) {
            // 生词已从生词表中删除
          } else {
            console.error('从生词表删除失败');
          }
        }
      }
    } catch (error) {
      console.error('删除生词表条目时出错:', error);
    }

    // 保存到练习会话数据库（合并 newPreviousWords 和 selectedWords）
    if (currentItem) {
      try {
        const headers = await getAuthHeaders();
        const allWords = [...newPreviousWords, ...selectedWords];
        const saveData = {
          item_id: currentItem.id,
          recordings: currentRecordings,
          vocab_entry_ids: [],
          picked_preview: allWords,
        };

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          // 之前的生词移除已保存到数据库
        } else {
          console.error('保存之前的生词移除失败');
        }
      } catch (error) {
        console.error('保存之前的生词移除时出错:', error);
      }
    }
  };

  // 处理录音添加
  const handleRecordingAdded = async (recording: AudioRecording) => {
    const newRecordings = [...currentRecordings, recording];
    setCurrentRecordings(newRecordings);

    // 自动保存录音到数据库
    if (currentItem) {
      try {
        const headers = await getAuthHeaders();
        const saveData = {
          item_id: currentItem.id, // 使用正确的列名
          recordings: newRecordings,
          vocab_entry_ids: [], // 暂时为空，因为selectedWords没有id字段
          picked_preview: [...previousWords, ...selectedWords], // 保存完整的单词对象
        };

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          const result = await response.json();
          // 录音已自动保存到数据库
        } else {
          const errorText = await response.text();
          console.error('保存录音失败:', response.status, errorText);
        }
      } catch (error) {
        console.error('保存录音时出错:', error);
      }
    }
  };

  // 处理录音删除
  const handleRecordingDeleted = async (recording: AudioRecording) => {
    const newRecordings = currentRecordings.filter((r) => r.url !== recording.url);
    setCurrentRecordings(newRecordings);

    // 同步删除数据库中的录音
    if (currentItem) {
      try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_id: currentItem.id,
            recordings: newRecordings,
            vocab_entry_ids: [], // 暂时为空，因为selectedWords没有id字段
            picked_preview: [...previousWords, ...selectedWords],
          }),
        });

        if (response.ok) {
          // 录音删除已同步到数据库
        } else {
          console.error('删除录音失败:', await response.text());
        }
      } catch (error) {
        console.error('删除录音时出错:', error);
      }
    }
  };

  // 处理转录完成
  const handleTranscriptionReady = (transcription: string) => {
    setCurrentTranscription(transcription);

    // 自动进行评分
    if (currentItem && transcription) {
      setTimeout(() => {
        performScoring(transcription);
      }, 1000); // 给一点时间让UI更新
    }
  };

  // 处理录音选择（用于重新评分）
  const handleRecordingSelected = (recording: AudioRecording) => {
    if (recording.transcription) {
      setCurrentTranscription(recording.transcription);
      performScoring(recording.transcription);
    }
  };

  // 保存草稿
  const saveDraft = async () => {
    if (!currentItem) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          status: 'draft',
          recordings: currentRecordings,
          picked_preview: [...previousWords, ...selectedWords],
          notes: {},
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);

        // 更新当前items状态
        setItems((prev) =>
          prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'draft' } : item)),
        );

        toast.success('草稿已保存');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 检查生词是否已有AI解释
  const checkExistingExplanation = async (word: string) => {
    try {
      const data = await searchVocabWithCache(word, (currentItem?.lang || lang) as 'ja' | 'en' | 'zh' | 'ko', getAuthHeaders);
      if (data?.entries && data.entries.length > 0) {
        const entry = data.entries[0];
        if (entry.explanation) {
          setWordExplanations((prev) => ({
            ...prev,
            [word]: entry.explanation,
          }));
          return true;
        }
      }
    } catch (error) {
      console.error('检查已有解释失败:', error);
    }
    return false;
  };

  // 调试函数：查看单词本数据
  const debugVocabData = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/debug/vocab', { headers });
      if (response.ok) {
        const data = await response.json();
        // 单词本数据已加载
        toast.info(`单词本中有 ${data.entries.length} 个条目`);
      } else {
        console.error('获取单词本数据失败:', response.status);
      }
    } catch (error) {
      console.error('调试单词本数据失败:', error);
    }
  };

  // 批量生成AI解释
  const generateBatchExplanations = async () => {
    if (isGeneratingBatchExplanation || selectedWords.length === 0) return;

    // 过滤出还没有解释的生词
    const wordsNeedingExplanation = selectedWords.filter(
      (item) => !item.explanation && !wordExplanations[item.word],
    );

    if (wordsNeedingExplanation.length === 0) {
      toast.info('所有生词都已经有解释了！');
      return;
    }

    setIsGeneratingBatchExplanation(true);
    setBatchExplanationProgress({
      current: 0,
      total: wordsNeedingExplanation.length,
      status: '准备生成AI解释...',
    });

    try {
      const headers = await getAuthHeaders();

      // 并发处理：为每个生词单独调用API（优先使用 entry_ids，回退到 word_info）
      const explanationPromises = wordsNeedingExplanation.map(async (item, index) => {
        try {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            current: index,
            status: `正在为 "${item.word}" 生成AI解释...`,
          }));

          // 尝试查找已存在的生词条目
          let entryId: string | null = null;
          try {
            const searchRes = await fetch(
              `/api/vocab/search?term=${encodeURIComponent(item.word)}`,
              { headers },
            );
            if (searchRes.ok) {
              const data = await searchRes.json();
              const entries = Array.isArray(data?.entries) ? data.entries : [];
              const matched = entries.find(
                (e: any) => e && e.id && e.term === item.word && (!item.lang || e.lang === item.lang),
              );
              if (matched?.id) entryId = matched.id as string;
            }
          } catch (e) {
            console.warn('批量搜索生词本条目失败，回退到 word_info 模式:', e);
          }

          const payload: any = {
            native_lang: userProfile?.native_lang || language,
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.7,
          };
          if (entryId) {
            payload.entry_ids = [entryId];
          } else {
            payload.entry_ids = [];
            payload.word_info = { term: item.word, lang: item.lang, context: item.context };
          }

          // 预检：AI权限 + API限额
          try {
            const authHeaders = await getAuthHeaders();
            const precheckRes = await fetch('/api/ai/precheck', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ provider: payload.provider, model: payload.model }),
            });
            if (!precheckRes.ok) {
              const j = await precheckRes.json().catch(() => ({} as any));
              const msg = j?.reason || (precheckRes.status === 429 ? 'API 使用已达上限' : '无权限使用所选模型');
              toast.error(String(msg));
              return null;
            }
          } catch (e) {
            console.error('预检失败', e);
            toast.error('暂时无法进行AI生成，请稍后再试');
            return null;
          }

          const response = await fetch('/api/vocab/explain', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.explanations && data.explanations.length > 0) {
              return { word: item.word, explanation: data.explanations[0] };
            }
          }

          return null;
        } catch (error) {
          console.error(`为生词 "${item.word}" 生成AI解释时出错:`, error);
          return null;
        }
      });

      // 等待所有解释生成完成
      const results = await Promise.all(explanationPromises);
      const successfulResults = results.filter((result) => result !== null);

      if (successfulResults.length > 0) {
        // 更新解释缓存
        const newExplanations: Record<
          string,
          {
            gloss_native: string;
            pronunciation?: string;
            pos?: string;
            senses?: Array<{ example_target: string; example_native: string }>;
          }
        > = {};

        // 节流：在批量循环中避免频繁 setState，这里只汇总一次
        for (const r of successfulResults as Array<{ word: string; explanation: any }>) {
          if (r) {
            newExplanations[r.word] = r.explanation;
          }
        }

        setWordExplanations((prev) => ({
          ...prev,
          ...newExplanations,
        }));

        setExplanationCache((prev) => ({
          ...prev,
          ...newExplanations,
        }));

        // 更新selectedWords中的解释
        setSelectedWords((prev) =>
          prev.map((item) => {
            const explanation = newExplanations[item.word];
            return explanation ? { ...item, explanation } : item;
          }),
        );

        setBatchExplanationProgress((prev) => ({
          ...prev,
          current: successfulResults.length,
          status: `成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成解释！`,
        }));

        // 保存到数据库
        if (currentItem) {
          try {
            const updatedSelectedWords = selectedWords.map((item) => {
              const explanation = newExplanations[item.word];
              return explanation ? { ...item, explanation } : item;
            });

            const saveData = {
              item_id: currentItem.id,
              recordings: currentRecordings,
              vocab_entry_ids: [],
              picked_preview: [...previousWords, ...updatedSelectedWords],
            };

            const saveResponse = await fetch('/api/shadowing/session', {
              method: 'POST',
              headers,
              body: JSON.stringify(saveData),
            });

            if (saveResponse.ok) {
              // 批量AI解释已保存到数据库
            }
          } catch (error) {
            console.error('保存批量AI解释时出错:', error);
          }
        }

        // 显示成功提示
        if (successfulResults.length === wordsNeedingExplanation.length) {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            status: `✅ 成功为所有 ${successfulResults.length} 个生词生成解释！`,
          }));
        } else {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            status: `⚠️ 成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成解释`,
          }));
        }

        setTimeout(() => {
          setBatchExplanationProgress({
            current: 0,
            total: 0,
            status: '',
          });
        }, 3000);
      } else {
        toast.warning(t.shadowing.messages?.batch_ai_explanation_none_success || '没有成功生成任何AI解释，请重试');
      }
    } catch (error) {
      console.error('批量生成AI解释失败:', error);
      const errMsg = error instanceof Error ? error.message : (t.common.error || '错误');
      toast.error((t.shadowing.messages?.batch_ai_explanation_failed || '批量生成AI解释失败：{error}').replace('{error}', errMsg));
    } finally {
      setIsGeneratingBatchExplanation(false);
    }
  };
  // 生成AI解释
  const generateWordExplanation = async (word: string, context: string, wordLang: string) => {
    if (isGeneratingExplanation) return;

    // 先检查是否已有解释
    const hasExisting = await checkExistingExplanation(word);
    if (hasExisting) {
      return; // 如果已有解释，直接返回
    }

    setIsGeneratingExplanation(true);
    setGeneratingWord(word);

    try {
      const headers = await getAuthHeaders();

      // 优先使用 entry_ids（写回生词本），找不到再回退到 word_info
      let entryId: string | null = null;
      try {
        const data = await searchVocabWithCache(word, (wordLang || currentItem?.lang || lang) as 'ja' | 'en' | 'zh' | 'ko', getAuthHeaders);
        const entries = Array.isArray(data?.entries) ? data.entries : [];
        const matched = entries.find(
          (e: { id?: string; term?: string; lang?: string }) =>
            e && e.id && e.term === word && (!wordLang || e.lang === wordLang),
        );
        if (matched?.id) entryId = matched.id as string;
      } catch (e) {
        console.warn('搜索生词本条目失败，回退到 word_info 模式:', e);
      }

      const payload: any = {
        native_lang: userProfile?.native_lang || language,
        provider: 'deepseek',
        model: 'deepseek-chat',
        temperature: 0.7,
      };
      if (entryId) {
        payload.entry_ids = [entryId];
      } else {
        payload.entry_ids = [];
        payload.word_info = { term: word, lang: wordLang, context };
      }

      const response = await fetch('/api/vocab/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.explanations && data.explanations.length > 0) {
          const explanation = data.explanations[0];
          setWordExplanations((prev) => ({
            ...prev,
            [word]: explanation,
          }));

          // 更新解释缓存，让DynamicExplanation组件能立即显示
          setExplanationCache((prev) => ({
            ...prev,
            [word]: explanation,
          }));

          // 将解释保存到生词数据中
          setSelectedWords((prev) =>
            prev.map((item) => (item.word === word ? { ...item, explanation } : item)),
          );

          // 同时更新之前的生词中的解释（如果存在）
          setPreviousWords((prev) =>
            prev.map((item) => (item.word === word ? { ...item, explanation } : item)),
          );

          // 立即保存到数据库
          if (currentItem) {
            try {
              const headers = await getAuthHeaders();
              const updatedSelectedWords = selectedWords.map((item) =>
                item.word === word ? { ...item, explanation } : item,
              );
              const saveData = {
                item_id: currentItem.id,
                recordings: currentRecordings,
                vocab_entry_ids: [],
                picked_preview: [...previousWords, ...updatedSelectedWords],
              };

              const saveResponse = await fetch('/api/shadowing/session', {
                method: 'POST',
                headers,
                body: JSON.stringify(saveData),
              });

              if (saveResponse.ok) {
                // AI解释已保存到数据库
              } else {
                console.error('保存AI解释失败');
              }
            } catch (error) {
              console.error('保存AI解释时出错:', error);
            }
          }
        }
      } else {
        const errorData = await response.json();
        toast.error(`${t.shadowing.messages?.generate_explanation_failed || '生成解释失败，请重试'}：${errorData.error}`);
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      toast.error(t.shadowing.messages?.generate_explanation_failed || '生成解释失败，请重试');
    } finally {
      setIsGeneratingExplanation(false);
      setGeneratingWord(null);
    }
  };

  // 播放/暂停音频（统一控制音频播放器）
  const playAudio = () => {
    if (!currentItem?.audio_url) return;
    audioPlayerRef.current?.toggle();
  };
  // 评分功能（支持转录文字和逐句对比）
  const performScoring = async (transcription?: string) => {
    if (!currentItem) {
      console.error('没有当前题目，无法评分');
      return;
    }

    setIsScoring(true);
    try {
      const textToScore = transcription || currentTranscription;

      if (!textToScore) {
        console.error('没有找到转录文字');
        toast.error(t.shadowing.no_recording_yet || '还没有录音');
        return;
      }

      // 获取原文
      const originalText = currentItem.text;

      // 使用句子分析计算整体评分
      const simpleAnalysis = performSimpleAnalysis(originalText, textToScore, t);
      const { overallScore } = simpleAnalysis;

      // 确保准确率在0-1之间
      const normalizedAccuracy = overallScore / 100;
      const scorePercentage = overallScore;

      // 生成更详细的反馈
      let feedback = '';
      const suggestions = [];

      if (scorePercentage >= 80) {
        feedback = `${t.shadowing.feedback_great || '发音准确率: {percent}%，非常棒！'}.replace('{percent}', String(scorePercentage))`;
        suggestions.push(t.shadowing.suggestions?.keep_level || '继续保持这个水平！');
      } else if (scorePercentage >= 60) {
        feedback = `${t.shadowing.feedback_good || '发音准确率: {percent}%，很好！'}.replace('{percent}', String(scorePercentage))`;
        suggestions.push(t.shadowing.suggestions?.clearer_pronunciation || '可以尝试更清晰地发音');
        suggestions.push(t.shadowing.suggestions?.intonation_rhythm || '注意语调和节奏');
      } else if (scorePercentage >= 40) {
        feedback = `${t.shadowing.feedback_ok || '发音准确率: {percent}%，还不错'}.replace('{percent}', String(scorePercentage))`;
        suggestions.push(t.shadowing.suggestions?.listen_more || '建议多听几遍原文');
        suggestions.push(t.shadowing.suggestions?.mind_word_pronunciation || '注意单词的发音');
        suggestions.push(t.shadowing.suggestions?.slow_down || '可以尝试放慢语速');
      } else {
        feedback = `${t.shadowing.feedback_need_improvement || '发音准确率: {percent}%，需要加强练习'}.replace('{percent}', String(scorePercentage))`;
        suggestions.push(t.shadowing.suggestions?.listen_before_practice || '建议先听几遍原文再练习');
        suggestions.push(t.shadowing.suggestions?.each_word_pronunciation || '注意每个单词的发音');
        suggestions.push(t.shadowing.suggestions?.practice_in_sections || '可以分段练习');
        suggestions.push(t.shadowing.suggestions?.practice_more || '多练习几次会更好');
      }

      // 添加转录质量提示
      if (textToScore.length < originalText.length * 0.3) {
        suggestions.push(t.shadowing.suggestions?.transcription_too_short || '转录内容较少，建议重新录音');
      } else if (textToScore.length < originalText.length * 0.6) {
        suggestions.push(t.shadowing.suggestions?.transcription_incomplete || '转录内容不完整，建议重新录音');
      }

      const fullFeedback =
        feedback + (suggestions.length > 0 ? `\n\n${t.shadowing.suggestions_title_text || '建议：'}\n• ` + suggestions.join('\n• ') : '');

      const scoringResult = {
        score: scorePercentage,
        accuracy: normalizedAccuracy,
        feedback: fullFeedback,
        transcription: textToScore,
        originalText: originalText,
      };

      setScoringResult(scoringResult);
      setShowSentenceComparison(false); // 不再显示逐句对比
    } catch (error) {
      console.error('评分失败:', error);
      const errMsg = error instanceof Error ? error.message : (t.shadowing.unknown_error || '未知错误');
      toast.error((t.shadowing.scoring_failed || '评分失败: {error}').replace('{error}', errMsg));
    } finally {
      setIsScoring(false);
    }
  };


  // 统一的完成并保存函数 - 整合session保存和练习结果记录
  const unifiedCompleteAndSave = async (explicitDifficulty?: 'too_easy' | 'just_right' | 'a_bit_hard' | 'too_hard') => {
    // 0. Re-entry guard: 防止重复提交
    if (saving) return;
    if (!currentItem || !user) return;

    const difficultyToUse = explicitDifficulty || selfDifficulty;

    // If difficulty not selected yet, show modal and stop
    if (!difficultyToUse) {
      setShowDifficultyModal(true);
      return;
    }

    // Update state if explicit provided (for UI consistency if we re-render)
    if (explicitDifficulty) {
      setSelfDifficulty(explicitDifficulty);
      setShowDifficultyModal(false);
    }

    setSaving(true);
    // 设置超时保护，防止无限等待
    const timeoutId = setTimeout(() => {
      setSaving(false);
      toast.error((t.shadowing as any).save_timeout || '保存超时，请重试');
    }, 15000); // 15秒超时

    try {
      // 立即更新本地状态，确保UI即时响应
      const practiceTime = practiceStartTime
        ? Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000)
        : 0;

      // 1. 立即更新题库列表状态
      setItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? {
              ...item,
              isPracticed: true,
              stats: {
                ...item.stats,
                recordingCount: currentRecordings.length,
                vocabCount: selectedWords.length,
                practiceTime,
                lastPracticed: new Date().toISOString(),
              },
            }
            : item,
        ),
      );

      // Calculate overall score from sentenceScores
      const scores = Object.values(sentenceScores);
      let overallScore = 0;
      let validCount = 0;

      scores.forEach((s: any) => {
        if (typeof s.score === 'number') {
          overallScore += s.score;
          validCount++;
        }
      });

      const finalScore = validCount > 0 ? (overallScore / validCount) * 100 : 0;

      // Construct scoring result for display
      const newScoringResult = {
        score: finalScore,
        details: scores, // Store sentence details
        originalText: currentItem.text,
        transcription: '',
        accuracy: finalScore / 100,
        feedback: '',
      };

      setScoringResult(newScoringResult);
      setPracticeComplete(true);

      const headers = await getAuthHeaders();

      // Prepare all data upfront before parallel calls
      const allWords = [...previousWords, ...selectedWords];



      // Prepare attempt metrics
      const metrics = {
        overallScore: finalScore,
        sentenceScores: sentenceScores,
        completedAt: new Date().toISOString(),
        accuracy: finalScore,
        score: finalScore,
        complete: true,
        time_sec: practiceTime,
      };

      // Prepare session payload
      const selected_words_payload = allWords.map(w => {
        const explanation = explanationCache[w.word] || userVocab.find(v => v.term === w.word)?.explanation;
        return {
          text: w.word,
          lang: w.lang,
          context: w.context,
          definition: explanation?.gloss_native || '',
          cefr: (explanation as any)?.cefr || null,
          explanation: explanation
        };
      });

      const predictedUnknownWords = [...wordPredictions.entries()]
        .filter(([_, pred]) => pred.probability < predictionThreshold)
        .map(([word]) => word);

      // PARALLEL EXECUTION: Run all critical saves simultaneously
      // Helper for fetching with timeout (simulated by Promise.race)
      const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs: number = 10000) => {
        return Promise.race([
          fetch(url, options),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), timeoutMs)
          )
        ]);
      };

      const savePromises: Promise<any>[] = [];

      // 1. Save attempt
      savePromises.push(
        fetchWithTimeout('/api/shadowing/attempts', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_id: currentItem.id,
            lang: currentItem.lang,
            level: currentItem.level,
            metrics: { ...metrics, selfDifficulty: difficultyToUse },
          }),
        })
      );

      // 3. Save session
      savePromises.push(
        fetchWithTimeout('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_id: currentItem.id,
            status: 'completed',
            self_difficulty: difficultyToUse,
            recordings: currentRecordings,
            picked_preview: allWords,
            selected_words: selected_words_payload,
            notes: {
              sentence_scores: sentenceScores,
              speaking_duration: sessionSpeakingDuration
            },
            quiz_result: quizResult ? {
              answers: quizResult.answers,
              correct_count: quizResult.correctCount,
              total: quizResult.total,
            } : null,
            prediction_stats: predictedUnknownWords.length > 0 ? {
              predictedUnknown: predictedUnknownWords,
              threshold: 0.5,
            } : null,
          }),
        })
      );

      // Wait for all critical saves to complete
      await Promise.all(savePromises);

      // Clear the main timeout if successful
      clearTimeout(timeoutId);

      // Successfully saved, update local state for vocab
      if (selectedWords.length > 0) {
        setPreviousWords((prev) => [...prev, ...selectedWords]);
        setSelectedWords([]);
      }

      setSuccessMessage(t.shadowing.practice_saved || '练习已保存');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      // NON-BLOCKING: Cache invalidate and refresh - fire and forget
      fetch('/api/cache/invalidate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pattern: 'shadowing:catalog*' }),
      }).catch(() => { });

      // Refresh items in background (don't await)
      fetchItems();

    } catch (error) {
      console.error('Save failed:', error);
      // Only show error if not already handled by timeout
      if (saving) {
        toast.error(t.shadowing.save_failed || '保存失败');
      }
    } finally {
      clearTimeout(timeoutId);
      setSaving(false);
    }
  };

  // 批量获取词汇解释
  const batchFetchExplanations = async (words: string[]) => {
    const explanations: Record<string, any> = {};
    const itemLang = (currentItem?.lang || lang) as 'ja' | 'en' | 'zh' | 'ko';

    try {
      // 使用 p-limit 限制并发数为 5，避免过多并发请求导致抖动和失败
      const limit = pLimit(5);

      // 并行获取所有词汇的解释，但限制并发数
      const promises = words.map((word) =>
        limit(async () => {
          try {
            const data = await searchVocabWithCache(word, itemLang, getAuthHeaders);
            if (data?.entries && data.entries.length > 0 && data.entries[0].explanation) {
              explanations[word] = data.entries[0].explanation;
            }
          } catch (error) {
            console.warn(`获取 ${word} 解释失败:`, error);
          }
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('批量获取词汇解释失败:', error);
    }

    return explanations;
  };

  // 导入到生词本
  const importToVocab = async () => {
    if (selectedWords.length === 0) {
      toast.info(t.shadowing.no_new_words_to_import || '没有新的生词可以导入');
      return;
    }

    setIsImporting(true);
    try {
      // 批量获取所有选中词汇的解释
      const wordList = selectedWords.map(item => item.word);
      const explanations = await batchFetchExplanations(wordList);

      // 更新选中词汇的解释
      const updatedSelectedWords = selectedWords.map(item => ({
        ...item,
        explanation: item.explanation || explanations[item.word] || null
      }));

      const entries = updatedSelectedWords.map((item) => ({
        term: item.word,
        lang: item.lang,
        native_lang: language, // 使用界面语言作为母语
        source: 'shadowing',
        source_id: currentItem?.id,
        context: item.context,
        tags: [],
        explanation: item.explanation || null, // 使用生词数据中的解释
      }));

      const headers = await getAuthHeaders();
      const response = await fetch('/api/vocab/bulk_create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entries }),
      });

      if (response.ok) {
        toast.success((t.shadowing.import_success || '成功导入 {count} 个生词到生词本！').replace('{count}', String(entries.length)));

        // 将本次选中的生词移动到之前的生词中
        setPreviousWords((prev) => [...prev, ...selectedWords]);
        setSelectedWords([]);

        // 保存到数据库
        if (currentItem) {
          try {
            const headers = await getAuthHeaders();
            const allWords = [...previousWords, ...selectedWords];
            const saveData = {
              item_id: currentItem.id,
              recordings: currentRecordings,
              vocab_entry_ids: [],
              picked_preview: allWords,
            };

            const saveResponse = await fetch('/api/shadowing/session', {
              method: 'POST',
              headers,
              body: JSON.stringify(saveData),
            });

            if (saveResponse.ok) {
              console.log('导入后状态已保存到数据库');
            }
          } catch (error) {
            console.error('保存导入后状态时出错:', error);
          }
        }
      } else {
        const errorData = await response.json();
        toast.error((t.shadowing.import_failed || '导入失败: {error}').replace('{error}', String(errorData.error)));
      }
    } catch (error) {
      console.error('导入生词失败:', error);
      toast.error((t.shadowing.import_failed || '导入失败: {error}').replace('{error}', String((error as Error)?.message || '')));
    } finally {
      setIsImporting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 确保对话角色 A:/B: 前自动换行（若未换行）
  const formatSpeakerBreaks = (text: string): string => {
    if (!text) return '';
    let out = text;
    out = out.replace(/([^\n])\s*(A\s*[:：])/g, '$1\n$2');
    out = out.replace(/([^\n])\s*(B\s*[:：])/g, '$1\n$2');
    return out;
  };

  // 统一侧边栏状态：移动端使用抽屉式，桌面端默认打开（通过CSS控制）

  // 引导提示状态
  const [showGuide, setShowGuide] = useState(false);

  // 步骤提示展开状态
  const [stepTipExpanded, setStepTipExpanded] = useState(false);

  // 主内容区域引用
  const mainContentRef = useRef<HTMLDivElement>(null);

  // 桌面端初始化时自动打开侧边栏（但如果从每日一题进入或已指定题目，则不自动打开）
  useEffect(() => {
    if (!actualIsMobile) {
      // 检查是否从每日一题进入（src=daily）或已指定题目（item参数存在）
      const src = navSearchParams?.get('src');
      const itemId = navSearchParams?.get('item');
      // 如果是从每日一题进入或已指定题目，不自动打开侧边栏
      if (src !== 'daily' && !itemId) {
        setMobileSidebarOpen(true);
      }
    }
  }, [actualIsMobile, navSearchParams]);

  // 检查是否首次访问，显示引导提示
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('shadowing-guide-seen');
    if (!hasSeenGuide && !currentItem) {
      // 延迟1秒显示，让用户先看到页面
      const timer = setTimeout(() => {
        setShowGuide(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentItem]);

  // 隐藏引导提示
  const hideGuide = () => {
    setShowGuide(false);
    localStorage.setItem('shadowing-guide-seen', 'true');
  };

  // 如果正在检查认证或用户未登录，显示相应提示
  if (authLoading) {
    return (
      <main className="p-6">
        <Container>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>{t.common.checking_login || '检查登录状态...'}</p>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="p-6">
        <Container>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">
                {t.common.login_required || '需要登录'}
              </h2>
              <p className="text-gray-600 mb-6">
                {t.shadowing.login_required_message || '请先登录以访问Shadowing练习功能'}
              </p>
              <a
                href="/auth"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {t.common.login || '登录'}
              </a>
            </div>
          </div>
        </Container>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* 从首页“每日一题”等入口自动跳转到具体题目时的整页加载遮罩 */}
      {initialDeepLinkLoading && !currentItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/75 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">
              {storylineSource.isFromStoryline
                ? '正在加载练习内容...'
                : (t.shadowing.daily_loading || '正在为你加载今日题目...')}
            </p>
          </div>
        </div>
      )}
      {/* 保存中的全屏遮罩 - 阻止用户操作 */}
      {saving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="w-12 h-12 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              正在保存...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              请稍候，不要关闭或刷新页面
            </p>
          </div>
        </div>
      )}
      <Container>
        <Breadcrumbs items={[{ href: '/', label: t.nav.home }, { label: t.shadowing.title }]} />

        {/* 统一响应式布局 */}
        <div className="space-y-6" ref={mainContentRef}>
          {/* 顶部工具栏 - 所有设备显示 */}
          <div className="sticky top-0 z-30">
            <div className="flex items-center justify-between bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/20">
              <div className="flex items-center gap-2">
                {/* 返回故事线按钮 */}
                {storylineSource.isFromStoryline && (
                  <Link
                    href={`/shadowing/storyline${storylineSource.themeId ? `?expandTheme=${storylineSource.themeId}` : ''}`}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <MapIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">返回故事线</span>
                  </Link>
                )}
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {t.shadowing.shadowing_practice || 'Shadowing 练习'}
                  </h1>
                </div>
              </div>

              {/* 排序 + 题库按钮 */}
              <div className="flex items-center gap-3">
                {/* 排序选择器 */}
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-white/70" title="排序">
                  <ArrowUpDown className="w-4 h-4 text-gray-500" />
                  <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
                    <SelectTrigger className="h-8 w-[7rem] border-0 shadow-none text-xs">
                      <SelectValue placeholder="推荐" />
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="recommended">推荐</SelectItem>
                      <SelectItem value="recent">最近练习</SelectItem>
                      <SelectItem value="completion">完成度优先</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 题库按钮 */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMobileSidebarOpen(true);
                      hideGuide();
                    }}
                    className={`flex items-center justify-center bg-white/50 hover:bg-white/80 border-white/30 h-9 w-9 p-0 transition-all ${showGuide
                      ? 'shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/30 ring-offset-2'
                      : 'shadow-md'
                      }`}
                    aria-label={t.shadowing.shadowing_vocabulary}
                    title={t.shadowing.shadowing_vocabulary}
                  >
                    <Menu className="w-4 h-4" />
                  </Button>

                  {/* 呼吸光效 */}
                  {showGuide && (
                    <div className="absolute inset-0 rounded-lg animate-pulse pointer-events-none">
                      <div className="absolute inset-0 rounded-lg bg-blue-400/20 blur-md"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 步骤栏 - 移动端显示 */}
          {gatingActive && (
            <Card className="p-4 bg-white border-0 shadow-sm md:hidden">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <PracticeStepper
                  size="sm"
                  currentStep={step}
                  onStepChange={(s) => setStep(s)}
                  maxStepAllowed={step}
                  labels={[t.shadowing.step1_tip, t.shadowing.step2_tip, t.shadowing.step3_tip, t.shadowing.step5_tip].map(x => String(x || 'Step'))}
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStep((s) => (Math.max(1, (s as number) - 1) as 1 | 2 | 3 | 4))} disabled={step === 1} title={t.common.back}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={() => setStep((s) => (Math.min(4, (s as number) + 1) as 1 | 2 | 3 | 4))} disabled={step === 4} title={t.common.next}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-700">
                {step === 1 && t.shadowing.step1_tip}
                {step === 2 && t.shadowing.step2_tip}
                {step === 3 && t.shadowing.step3_tip}
                {step === 4 && t.shadowing.step5_tip}
              </div>
            </Card>
          )}

          {/* 侧边栏遮罩 */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
              onClick={() => setMobileSidebarOpen(false)}
            />
          )}

          {/* 侧边栏 - 统一抽屉式 */}
          <div
            className={`fixed top-0 left-0 h-full w-[90vw] max-w-[360px] bg-white/95 backdrop-blur-xl z-50 transform transition-all duration-300 shadow-2xl border-r border-white/20 ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
          >
            <div className="h-full flex flex-col">
              {/* 侧边栏头部 - 美化 */}
              <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                      <Filter className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-lg">
                      {t.shadowing.shadowing_vocabulary || 'Shadowing 题库'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchItems()}
                      className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/20 transition-colors"
                      title={t.shadowing.refresh_vocabulary || '刷新题库'}
                      aria-label={t.shadowing.refresh_vocabulary || '刷新题库'}
                      disabled={loading}
                    >
                      <div className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>🔄</div>
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileSidebarOpen(false)}
                      className="text-white hover:bg-white/20"
                      aria-label="关闭侧边栏"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* 侧边栏内容 - 优化版 */}
              <div className="flex-1 overflow-y-auto bg-gray-50/50" ref={mobileListScrollRef}>
                {/* 过滤器 - 使用折叠式布局 */}
                <div className="p-4 space-y-4">
                  {/* 基础筛选 - 默认展开 */}
                  <CollapsibleFilterSection
                    title={t.shadowing.filter || '筛选'}
                    icon={<Filter className="w-3 h-3 text-blue-600" />}
                    defaultOpen={true}
                  >
                    {/* 语言选择 */}
                    <FilterLanguageSelector
                      value={lang}
                      onChange={setLang}
                      allowedLanguages={permissions.allowed_languages}
                      className="h-10"
                    />

                    {/* 等级选择 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.level}
                      </Label>
                      <Select
                        value={level?.toString() || 'all'}
                        onValueChange={(v) => setLevel(v === 'all' ? null : parseInt(v))}
                      >
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                          <SelectValue placeholder={t.shadowing.all_levels} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                          <SelectItem value="all" className="rounded-lg">
                            {t.shadowing.all_levels}
                          </SelectItem>
                          {permissions.allowed_levels.includes(1) && (
                            <SelectItem value="1" className="rounded-lg">
                              L1 - 初级
                            </SelectItem>
                          )}
                          {permissions.allowed_levels.includes(2) && (
                            <SelectItem value="2" className="rounded-lg">
                              L2 - 初中级
                            </SelectItem>
                          )}
                          {permissions.allowed_levels.includes(3) && (
                            <SelectItem value="3" className="rounded-lg">
                              L3 - 中级
                            </SelectItem>
                          )}
                          {permissions.allowed_levels.includes(4) && (
                            <SelectItem value="4" className="rounded-lg">
                              L4 - 中高级
                            </SelectItem>
                          )}
                          {permissions.allowed_levels.includes(5) && (
                            <SelectItem value="5" className="rounded-lg">
                              L5 - 高级
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 练习状态 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.practice_status}
                      </Label>
                      <Select
                        value={practiced}
                        onValueChange={(v: 'all' | 'practiced' | 'unpracticed') => setPracticed(v)}
                      >
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                          <SelectItem value="all" className="rounded-lg">
                            {t.shadowing.all_status}
                          </SelectItem>
                          <SelectItem value="unpracticed" className="rounded-lg">
                            {t.shadowing.unpracticed}
                          </SelectItem>
                          <SelectItem value="practiced" className="rounded-lg">
                            {t.shadowing.practiced}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleFilterSection>

                  {/* 高级筛选 - 可折叠 */}
                  <CollapsibleFilterSection
                    title="高级筛选"
                    icon={<Target className="w-3 h-3 text-blue-600" />}
                    defaultOpen={false}
                  >
                    {/* 体裁筛选 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.genre}
                      </Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                          {GENRE_OPTIONS.map((option) => (
                            <SelectItem
                              key={option.value}
                              value={option.value}
                              className="rounded-lg"
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 大主题筛选 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.major_theme}
                      </Label>
                      <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                        <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                          <SelectItem value="all" className="rounded-lg">
                            {t.shadowing.all_major_themes}
                          </SelectItem>
                          {themes.map((theme) => (
                            <SelectItem key={theme.id} value={theme.id} className="rounded-lg">
                              {theme.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 小主题筛选 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.minor_theme}
                      </Label>
                      <Select
                        value={selectedSubtopicId}
                        onValueChange={setSelectedSubtopicId}
                        disabled={selectedThemeId === 'all'}
                      >
                        <SelectTrigger
                          className={`h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow ${selectedThemeId === 'all' ? 'opacity-50' : ''}`}
                        >
                          <SelectValue
                            placeholder={
                              selectedThemeId === 'all'
                                ? t.shadowing.select_major_theme_first
                                : t.shadowing.all_minor_themes
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                          <SelectItem value="all" className="rounded-lg">
                            {t.shadowing.all_minor_themes}
                          </SelectItem>
                          {subtopics.map((subtopic) => (
                            <SelectItem
                              key={subtopic.id}
                              value={subtopic.id}
                              className="rounded-lg"
                            >
                              {subtopic.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 搜索 */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700">
                        {t.shadowing.search}
                      </Label>
                      <Input
                        placeholder={t.shadowing.search_placeholder}
                        value={searchQuery}
                        onChange={(e) => startTransition(() => setSearchQuery(e.target.value))}
                        className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </CollapsibleFilterSection>

                  {/* 快捷操作 */}
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={getRandomUnpracticed}
                      className="flex-1 h-10 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center"
                      title={t.shadowing.random}
                    >
                      <Shuffle className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={getNextUnpracticed}
                      className="flex-1 h-10 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-violet-100 hover:border-purple-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center"
                      title={t.shadowing.next_question}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 统计信息 - 紧凑横向卡片 */}
                <CompactStatsCards
                  totalCount={listStats.totalCount}
                  completedCount={listStats.completedCount}
                  draftCount={listStats.draftCount}
                  unstartedCount={listStats.unstartedCount}
                />

                {/* 题目列表 */}
                <div>
                  {loading ? (
                    <div className="space-y-3 p-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="p-4 rounded-2xl border border-gray-200 bg-white">
                          <Skeleton className="h-6 w-48 mb-3" />
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-5/6 mb-2" />
                          <div className="flex gap-2">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-12 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">
                        {t.shadowing.no_questions_found || '没有找到题目'}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4">
                      <Virtuoso
                        customScrollParent={mobileListScrollRef.current ?? undefined}
                        data={filteredItems}
                        computeItemKey={(index, item) => (item as ShadowingItem).id}
                        increaseViewportBy={{ top: 200, bottom: 400 }}
                        overscan={5}
                        itemContent={(index, item) => {
                          const it = item as ShadowingItem;
                          return (
                            <div
                              key={it.id}
                              className={`p-4 mb-3 rounded-2xl cursor-pointer transition-all duration-200 ${currentItem?.id === it.id
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-lg transform scale-[1.02]'
                                : it.isPracticed
                                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:from-green-100 hover:to-emerald-100 hover:shadow-md'
                                  : it.status === 'draft'
                                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 hover:from-yellow-100 hover:to-amber-100 hover:shadow-md'
                                    : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:border-gray-300'
                                }`}
                              onClick={() => { loadItem(it); setMobileSidebarOpen(false); }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                      {it.isPracticed ? (
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                          <CheckCircle className="w-4 h-4 text-green-600" />
                                        </div>
                                      ) : it.status === 'draft' ? (
                                        <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                                          <FileText className="w-4 h-4 text-yellow-600" />
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                          <Circle className="w-4 h-4 text-gray-400" />
                                        </div>
                                      )}
                                      <span className="text-sm text-gray-500 font-bold min-w-[2rem]">{index + 1}.</span>
                                    </div>
                                    <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">
                                      {it.subtopic ? it.subtopic.title : it.title}
                                    </h4>
                                  </div>
                                  {/* Scene Tags */}
                                  {it.top_scenes && it.top_scenes.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                      {it.top_scenes.map((scene) => (
                                        <Badge
                                          key={scene.id}
                                          variant="secondary"
                                          className="text-[10px] px-1.5 py-0 h-5 bg-slate-100 text-slate-600 border-none"
                                        >
                                          {scene.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {(() => {
                                    const pref = it.theme_id ? themePrefs[it.theme_id] : undefined;
                                    // Use vocabUnknownRate in recommendation logic
                                    const recResult = getNextRecommendedItem(
                                      currentItem?.id || '',
                                      [it],
                                      themePrefs,
                                      recommendedLevel,
                                      lang || 'zh',
                                      vocabUnknownRate
                                    );
                                    const reason = recResult?.reason;

                                    // Calculate estimated unknown rate for this item
                                    // Use lex_profile for precise calculation, fallback to level-based interpolation
                                    const itemLexProfile = it.lex_profile || it.notes?.lex_profile;
                                    let estimatedRate: number;

                                    if (itemLexProfile && bayesianProfile) {
                                      // Precise calculation using article's vocabulary distribution
                                      estimatedRate = calculatePreciseUnknownRate(
                                        itemLexProfile as ArticleLexProfile,
                                        bayesianProfile
                                      );
                                    } else {
                                      // Fallback: interpolate between CEFR bands based on article level
                                      const level = it.level || 1;
                                      if (level <= 1) {
                                        estimatedRate = vocabUnknownRate['A1_A2'] || 0;
                                      } else if (level <= 2) {
                                        const low = vocabUnknownRate['A1_A2'] || 0;
                                        const high = vocabUnknownRate['B1_B2'] || 0;
                                        estimatedRate = low + (high - low) * (level - 1);
                                      } else if (level <= 3) {
                                        estimatedRate = vocabUnknownRate['B1_B2'] || 0;
                                      } else if (level <= 4) {
                                        const low = vocabUnknownRate['B1_B2'] || 0;
                                        const high = vocabUnknownRate['C1_plus'] || 0;
                                        estimatedRate = low + (high - low) * (level - 3);
                                      } else {
                                        estimatedRate = vocabUnknownRate['C1_plus'] || 0;
                                      }
                                    }

                                    const ratePercent = Math.round(estimatedRate * 100);

                                    // Color coding based on rate
                                    let rateColor = 'bg-green-50 text-green-700 border-green-100';
                                    if (ratePercent > 20) rateColor = 'bg-red-50 text-red-700 border-red-100';
                                    else if (ratePercent > 10) rateColor = 'bg-yellow-50 text-yellow-700 border-yellow-100';

                                    return (
                                      <>
                                        {/* Prediction Badge - shows estimated unknown rate */}
                                        <div className="mb-1">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${rateColor}`}>
                                            📊 预测生词率: {ratePercent}%
                                          </span>
                                        </div>
                                        {/* Recommendation reason */}
                                        {reason && (
                                          <div className="mb-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                              <Sparkles className="w-3 h-3 mr-1" />
                                              {reason}
                                            </span>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  <div className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">{it.text.substring(0, 60)}...</div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${it.lang === 'en' ? 'bg-blue-100 text-blue-700' : it.lang === 'ja' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{(t.vocabulary.language_labels as any)[it.lang]}</span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">L{it.level}</span>
                                    {it.cefr && (<span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">{it.cefr}</span>)}
                                    {it.tokens && (<span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{it.tokens}词</span>)}
                                  </div>
                                  {it.isPracticed && (<div className="flex items-center gap-1 mt-2"><span className="text-xs text-green-600 font-medium">已完成练习</span></div>)}
                                  {it.status === 'draft' && (<div className="flex items-center gap-1 mt-2"><span className="text-xs text-yellow-600 font-medium">草稿状态</span></div>)}
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 主内容区域 */}
          <div className="space-y-4 md:space-y-6">
            {!currentItem ? (
              <Card className="p-8 bg-gradient-to-br from-white to-gray-50 border-0 shadow-xl rounded-3xl">
                <div className="text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {t.shadowing.select_question_to_start || '选择题目开始练习'}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {t.shadowing.click_vocabulary_button || '点击上方"题库"按钮选择题目'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* 手机端步骤导航与提示（未完成时显示）- 紧凑折叠式 */}
                {gatingActive && (
                  <Card className="bg-white border-0 shadow-sm overflow-hidden">
                    <button
                      onClick={() => setStepTipExpanded(!stepTipExpanded)}
                      className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                      aria-expanded={stepTipExpanded}
                    >
                      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
                        <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>1 盲听</span>
                        <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>2 生词</span>
                        <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>3 原文+翻译</span>
                        <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step === 4 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>4 录音</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-gray-500">{stepTipExpanded ? '收起' : '展开'}</span>
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${stepTipExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* 展开的详细内容 */}
                    <div className={`transition-all duration-200 ${stepTipExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                      <div className="px-4 pb-3 space-y-2">
                        <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                          💡 {stepTips[step]}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStep((s) => (Math.max(1, (s as number) - 1) as 1 | 2 | 3 | 4))}
                            disabled={step === 1}
                            className="flex-1 h-8 text-xs flex items-center justify-center"
                            title={t.common.back}
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setStep((s) => (Math.min(4, (s as number) + 1) as 1 | 2 | 3 | 4))}
                            disabled={step === 4}
                            className="flex-1 h-8 text-xs flex items-center justify-center"
                            title={t.common.next}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
                {/* 题目信息 */}
                <Card className="p-4 md:p-8 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-lg rounded-2xl">
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                          {currentItem.title}
                        </h2>
                        {/* 标签 - 横向滚动布局 */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          <span
                            className={`snap-start flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium ${currentItem.lang === 'en'
                              ? 'bg-blue-100 text-blue-700'
                              : currentItem.lang === 'ja'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                              }`}
                          >
                            {(t.vocabulary.language_labels as any)[currentItem.lang]}
                          </span>
                          <span className="snap-start flex-shrink-0 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            {t.shadowing.level} L{currentItem.level}
                          </span>
                          {currentItem.cefr && (
                            <span className="snap-start flex-shrink-0 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              {currentItem.cefr}
                            </span>
                          )}
                          {currentItem.tokens && (
                            <span className="snap-start flex-shrink-0 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                              {currentItem.tokens} {t.shadowing.words || '词'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Button
                        onClick={playAudio}
                        variant="outline"
                        size="lg"
                        className={`h-14 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all ${highlightPlay ? 'animate-pulse ring-2 ring-blue-400' : ''}`}
                        title={isPlaying ? '暂停' : t.shadowing.play_audio}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6" />
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="lg"
                        onClick={saveDraft}
                        disabled={saving}
                        aria-busy={saving}
                        aria-disabled={saving}
                        aria-label={saving ? '保存草稿中' : '保存草稿'}
                        className="h-14 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        title={t.shadowing.save_draft}
                      >
                        {saving ? <div className="animate-spin w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full" /> : <Save className="w-6 h-6" />}
                      </Button>

                      {(!gatingActive || step === 4) && (
                        <Button
                          size="lg"
                          onClick={() => unifiedCompleteAndSave()}
                          disabled={saving}
                          aria-busy={saving}
                          aria-disabled={saving}
                          aria-label={saving ? '完成并保存中' : '完成练习'}
                          className="h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                          title={t.shadowing.complete_and_save}
                        >
                          {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle className="w-6 h-6" />}
                        </Button>
                      )}
                    </div>

                    {/* 理解题测试 - 内联模块（仅步骤1且未完成时显示） */}
                    {step === 1 && currentItem?.quiz_questions && currentItem.quiz_questions.length > 0 && !quizCompleted && (
                      <Card className="bg-white border-gray-200 shadow-md overflow-hidden">
                        <div className="p-4">
                          {/* 标题 */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                                <span className="text-xl text-white">📝</span>
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-gray-800">理解力测试</h3>
                                <p className="text-xs text-gray-500">听完音频后，完成测试进入下一步</p>
                              </div>
                            </div>
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">{currentItem.quiz_questions.length} 道题</Badge>
                          </div>

                          {/* 问题列表 */}
                          <div className="space-y-3">
                            {currentItem.quiz_questions.map((q, idx) => (
                              <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="font-medium text-gray-800 mb-3 text-sm">
                                  {idx + 1}. {q.question}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                                    const isSelected = selectedQuizAnswers[idx] === opt;
                                    const isSubmitted = quizResult !== null;
                                    const isCorrect = q.answer === opt;

                                    let className = "p-3 rounded-lg border text-left text-sm transition-all ";
                                    if (isSubmitted) {
                                      if (isCorrect) {
                                        className += "border-green-400 bg-green-50 text-green-700";
                                      } else if (isSelected && !isCorrect) {
                                        className += "border-red-400 bg-red-50 text-red-700";
                                      } else {
                                        className += "border-gray-200 bg-white text-gray-400";
                                      }
                                    } else {
                                      className += isSelected
                                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50";
                                    }

                                    return (
                                      <button
                                        key={opt}
                                        onClick={() => !isSubmitted && setSelectedQuizAnswers(prev => ({ ...prev, [idx]: opt }))}
                                        disabled={isSubmitted}
                                        className={className}
                                      >
                                        <span className="font-semibold mr-2 text-gray-600">{opt}.</span>
                                        {q.options[opt]}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* 提交按钮 */}
                          {!quizResult ? (
                            <Button
                              onClick={() => {
                                const questions = currentItem.quiz_questions!;
                                const answers = questions.map((q, idx) => ({
                                  questionIndex: idx,
                                  selected: selectedQuizAnswers[idx] || '',
                                  correct: selectedQuizAnswers[idx] === q.answer
                                }));
                                const correctCount = answers.filter(a => a.correct).length;
                                setQuizResult({ answers, correctCount, total: questions.length });
                              }}
                              disabled={Object.keys(selectedQuizAnswers).length < currentItem.quiz_questions.length}
                              className="w-full mt-4 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-md font-medium"
                            >
                              提交答案
                            </Button>
                          ) : (
                            <div className="mt-4 space-y-3">
                              <div className={`p-3 rounded-xl text-center font-medium ${quizResult.correctCount === quizResult.total ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                {quizResult.correctCount === quizResult.total
                                  ? '🎉 全部正确！'
                                  : `答对 ${quizResult.correctCount}/${quizResult.total} 题`}
                              </div>
                              <Button
                                onClick={() => {
                                  setQuizCompleted(true);
                                  setStep(2);
                                }}
                                className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-md font-medium"
                              >
                                继续下一步 →
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    )}

                    {/* Quiz 完成提示 */}
                    {step === 1 && quizCompleted && currentItem?.quiz_questions && (
                      <Card className="bg-green-50 border-green-200 p-3 text-center text-green-700 shadow-sm">
                        ✅ 理解题已完成 ({quizResult?.correctCount}/{quizResult?.total})
                      </Card>
                    )}

                    {/* 生词选择模式切换（仅步骤2显示） */}
                    {(!gatingActive || step === 2) && (
                      <div className="mb-4 space-y-3">
                        <Button
                          variant={isVocabMode ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsVocabMode(!isVocabMode)}
                          className={`w-full ${highlightVocab ? 'animate-pulse ring-2 ring-amber-400' : ''}`}
                          title={isVocabMode ? t.shadowing.vocab_mode_on : t.shadowing.vocab_mode_off}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            <span>{isVocabMode ? 'ON' : 'OFF'}</span>
                          </div>
                        </Button>

                        {/* ACU 模式切换（仅在生词模式开启时显示） */}
                        {isVocabMode && currentItem?.notes?.acu_units && (
                          <div className="flex gap-2">
                            <Button
                              variant={isACUMode ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setIsACUMode(!isACUMode)}
                              className="flex-1"
                            >
                              {isACUMode ? 'ACU 选词' : '自由框选'}
                            </Button>
                          </div>
                        )}

                        {isVocabMode && (
                          <div className="mt-2 space-y-2">
                            {isACUMode && currentItem?.notes?.acu_units ? (
                              <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                                💡 <strong>ACU 选词模式：</strong>
                                点击预分割的语义块来选择生词，支持多选相邻块合并
                              </div>
                            ) : (
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                                💡 <strong>选词提示：</strong>
                                拖拽选择单词或短语，松开鼠标后稍等（不超过50个字符），选择完成后会显示确认按钮
                              </div>
                            )}
                            <p className="text-sm text-blue-600">
                              {t.shadowing.click_words_to_select || '点击文本中的单词来选择生词'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 文本内容（步骤>=2显示；步骤5也需显示原文） */}
                    {(!gatingActive || step >= 2) && (
                      <div id="shadowing-text" className="relative">
                        <div className="px-6 py-4 bg-amber-50/30 rounded-xl max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                          {/* 移除顶部翻译块，翻译在下方专用模块中展示 */}
                          {(isVocabMode || step >= 2) ? (
                            <>
                              {/* Lex Profile 词汇分词模式（优先）或 ACU 模式（仅在步骤2时显示） */}
                              {step === 2 && currentItem?.lex_profile?.tokenList && currentItem.lex_profile.tokenList.length > 0 ? (
                                <LexText
                                  text={currentItem.text}
                                  lang={currentItem.lang}
                                  tokenList={currentItem.lex_profile.tokenList}
                                  onConfirm={(word, context, jlptLevel) => {
                                    // Store JLPT level in wordData for later use
                                    handleWordSelect(word, context);
                                    // Note: jlptLevel will be captured from the token when saving
                                  }}
                                  selectedWords={[...previousWords, ...selectedWords]}
                                  wordPredictions={wordPredictions}
                                />
                              ) : isACUMode && currentItem?.notes?.acu_units && step === 2 ? (
                                <AcuText
                                  text={currentItem.text}
                                  lang={currentItem.lang}
                                  units={currentItem.notes.acu_units}
                                  onConfirm={handleWordSelect}
                                  selectedWords={[...previousWords, ...selectedWords]}
                                  wordPredictions={wordPredictions}
                                />
                              ) : (
                                <div className="text-lg leading-[2.05]">
                                  {/* 第3步：原文行内逐句播放 */}
                                  {step === 3 && currentItem?.audio_url ? (
                                    <SentenceInlinePlayer
                                      text={currentItem.text}
                                      language={currentItem.lang}
                                      sentenceTimeline={(currentItem as unknown as { sentence_timeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }> })?.sentence_timeline}
                                      onPlaySentence={(i) => playSentenceByIndex(i)}
                                      enablePractice
                                      showCompactProgress
                                      acuUnits={currentItem?.notes?.acu_units}
                                      translationText={currentItem.translations?.[translationLang]}
                                      translationLanguage={translationLang as 'en' | 'ja' | 'zh' | 'ko'}
                                      renderText={(line: string) => {
                                        // 基于当前已选与生词本构造 allSelectedWords
                                        const picked = [...previousWords, ...selectedWords];
                                        const vocab = userVocab.map(v => ({
                                          word: v.term,
                                          explanation: v.explanation,
                                          fromVocab: true,
                                          vocabId: v.id,
                                        }));
                                        const wordMap = new Map<string, any>();
                                        picked.forEach(w => wordMap.set(w.word, w));
                                        vocab.forEach(v => { if (!wordMap.has(v.word)) wordMap.set(v.word, v); });
                                        const allSelectedWords = Array.from(wordMap.values());

                                        // 按中/日/韩处理：韩语也开启匹配
                                        const isZh = currentItem?.lang === 'zh';
                                        const isJa = currentItem?.lang === 'ja';
                                        const isKo = currentItem?.lang === 'ko';
                                        if (!isZh && !isJa && !isKo) return line;
                                        const chars = line.split('');
                                        const result: React.ReactNode[] = [];
                                        for (let i = 0; i < chars.length; i++) {
                                          let isHighlighted = false;
                                          let highlightLength = 0;
                                          for (const selectedWord of allSelectedWords) {
                                            const w = selectedWord.word;
                                            if (!w) continue;
                                            if (i + w.length <= chars.length) {
                                              const substring = chars.slice(i, i + w.length).join('');
                                              if (substring === w) {
                                                isHighlighted = true;
                                                highlightLength = w.length;
                                                break;
                                              }
                                            }
                                          }
                                          if (isHighlighted && highlightLength > 0) {
                                            const word = chars.slice(i, i + highlightLength).join('');
                                            const wordData = allSelectedWords.find((item) => item.word === word);
                                            const explanation = wordData?.explanation;
                                            result.push(
                                              <HoverExplanation
                                                key={`inline-${line}-${i}`}
                                                word={word}
                                                explanation={explanation}
                                                fromVocab={wordData?.fromVocab}
                                                vocabId={wordData?.vocabId}
                                                onRefresh={handleRefreshExplanation}
                                                lang={currentItem?.lang || 'ja'}
                                              >
                                                {word}
                                              </HoverExplanation>
                                            );
                                            i += highlightLength - 1;
                                          } else {
                                            result.push(<span key={`c-${i}`}>{chars[i]}</span>);
                                          }
                                        }
                                        return <span>{result}</span>;
                                      }}
                                    />
                                  ) : (
                                    (() => {
                                      // 格式化对话文本，按说话者分行
                                      const formatDialogueText = (text: string): string => {
                                        if (!text) return '';

                                        // 处理AI返回的\n换行符
                                        const formatted = text.replace(/\\n/g, '\n');

                                        // 如果已经包含换行符，保持格式并清理
                                        if (formatted.includes('\n')) {
                                          return formatted
                                            .split('\n')
                                            .map((line) => line.trim())
                                            .filter((line) => line.length > 0)
                                            .join('\n');
                                        }

                                        // 尝试按说话者分割 - 匹配 A: 或 B: 等格式
                                        const speakerPattern = /([A-Z]):\s*/g;
                                        const parts = formatted.split(speakerPattern);

                                        if (parts.length > 1) {
                                          let result = '';
                                          for (let i = 1; i < parts.length; i += 2) {
                                            if (parts[i] && parts[i + 1]) {
                                              const speaker = parts[i].trim();
                                              const content = parts[i + 1].trim();
                                              if (speaker && content) {
                                                result += `${speaker}: ${content}\n`;
                                              }
                                            }
                                          }
                                          if (result.trim()) {
                                            return result.trim();
                                          }
                                        }

                                        // 默认返回原文本
                                        return formatted;
                                      };

                                      const formattedText = formatDialogueText(currentItem.text);

                                      // 获取所有已选择的生词（包括之前的、本次的和生词本中的）
                                      // 合并当前题目的临时生词和生词本中的词汇
                                      const picked = [...previousWords, ...selectedWords];
                                      const vocab = userVocab.map(v => ({
                                        word: v.term,
                                        explanation: v.explanation,
                                        fromVocab: true,
                                        vocabId: v.id
                                      }));

                                      // 去重：picked优先（上下文更准确）
                                      const wordMap = new Map();
                                      picked.forEach(w => wordMap.set(w.word, w));
                                      vocab.forEach(v => {
                                        if (!wordMap.has(v.word)) {
                                          wordMap.set(v.word, v);
                                        }
                                      });

                                      const allSelectedWords = Array.from(wordMap.values());
                                      const selectedWordSet = new Set(
                                        allSelectedWords.map((item) => item.word),
                                      );


                                      // 检查是否为中文文本
                                      const isChinese = /[\u4e00-\u9fff]/.test(formattedText);

                                      if (isChinese) {
                                        // 中文处理：先按行分割，再按字符分割
                                        const lines = formattedText.split('\n');

                                        return lines.map((line, lineIndex) => {
                                          const chars = line.split('');
                                          const result = [];

                                          for (let i = 0; i < chars.length; i++) {
                                            let isHighlighted = false;
                                            let highlightLength = 0;

                                            // 检查从当前位置开始的多个字符是否组成已选择的生词
                                            for (const selectedWord of allSelectedWords) {
                                              if (i + selectedWord.word.length <= chars.length) {
                                                const substring = chars
                                                  .slice(i, i + selectedWord.word.length)
                                                  .join('');
                                                if (substring === selectedWord.word) {
                                                  isHighlighted = true;
                                                  highlightLength = selectedWord.word.length;
                                                  break;
                                                }
                                              }
                                            }

                                            if (isHighlighted && highlightLength > 0) {
                                              // 高亮显示整个生词
                                              const word = chars.slice(i, i + highlightLength).join('');
                                              const wordData = allSelectedWords.find(
                                                (item) => item.word === word,
                                              );
                                              const explanation = wordData?.explanation;

                                              result.push(
                                                <HoverExplanation
                                                  key={`${lineIndex}-${i}`}
                                                  word={word}
                                                  explanation={explanation}
                                                  fromVocab={wordData?.fromVocab}
                                                  vocabId={wordData?.vocabId}
                                                  onRefresh={handleRefreshExplanation}
                                                  lang={currentItem?.lang || 'ja'}
                                                >
                                                  {word}
                                                </HoverExplanation>,
                                              );
                                              i += highlightLength - 1; // 跳过已处理的字符
                                            } else {
                                              // 普通字符
                                              result.push(<span key={`${lineIndex}-${i}`}>{chars[i]}</span>);
                                            }
                                          }

                                          return (
                                            <div key={lineIndex} className="mb-2 cursor-pointer hover:bg-blue-50/50 rounded" onClick={() => playSentenceByIndex(lineIndex)}>
                                              {result}
                                            </div>
                                          );
                                        });
                                      } else {
                                        // 英文处理：先按行分割，再按单词分割
                                        const lines = formattedText.split('\n');

                                        return lines.map((line, lineIndex) => {
                                          const chars = line.split('');
                                          const result = [] as React.ReactNode[];

                                          for (let i = 0; i < chars.length; i++) {
                                            let isHighlighted = false;
                                            let highlightLength = 0;

                                            for (const selectedWord of allSelectedWords) {
                                              const w = selectedWord.word;
                                              if (!w) continue;
                                              const wLower = w.toLowerCase();
                                              if (i + w.length <= chars.length) {
                                                const substring = chars.slice(i, i + w.length).join('');
                                                if (substring.toLowerCase() === wLower) {
                                                  const isAtWordBoundary = isEnglishWordBoundary(chars, i, w.length, i + w.length);
                                                  if (isAtWordBoundary) {
                                                    isHighlighted = true;
                                                    highlightLength = w.length;
                                                    break;
                                                  }
                                                }
                                              }
                                            }

                                            if (isHighlighted && highlightLength > 0) {
                                              const word = chars.slice(i, i + highlightLength).join('');
                                              const wordData = allSelectedWords.find((item) => item.word === word);
                                              const explanation = wordData?.explanation;

                                              result.push(
                                                <HoverExplanation
                                                  key={`${lineIndex}-${i}`}
                                                  word={word}
                                                  explanation={explanation}
                                                  fromVocab={wordData?.fromVocab}
                                                  vocabId={wordData?.vocabId}
                                                  onRefresh={handleRefreshExplanation}
                                                  lang={currentItem?.lang || 'ja'}
                                                >
                                                  {word}
                                                </HoverExplanation>,
                                              );
                                              i += highlightLength - 1;
                                            } else {
                                              result.push(<span key={`${lineIndex}-${i}`}>{chars[i]}</span>);
                                            }
                                          }

                                          return (
                                            <div key={lineIndex} className="mb-2 cursor-pointer hover:bg-blue-50/50 rounded" onClick={() => playSentenceByIndex(lineIndex)}>
                                              {result}
                                            </div>
                                          );
                                        });
                                      }
                                    })()
                                  )}
                                </div>
                              )}
                              {selectedText && (
                                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                                    <input
                                      type="text"
                                      value={selectedText.word}
                                      onChange={(e) => setSelectedText({ ...selectedText, word: e.target.value })}
                                      className="w-full px-2 py-1 text-blue-600 font-semibold mb-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                    <div className="text-xs text-gray-600 mb-2">
                                      {selectedText.context}
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={confirmAddToVocab}
                                        disabled={isAddingToVocab || !selectedText.word.trim()}
                                        className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {isAddingToVocab ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                            {t.shadowing.adding_to_vocab || '添加中...'}
                                          </>
                                        ) : (
                                          t.shadowing.acu_text?.confirm_add_to_vocab || '确认添加到生词本'
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={cancelSelection}
                                        disabled={isAddingToVocab}
                                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {t.shadowing.acu_text?.cancel || '取消'}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-lg leading-loose">
                              {/* 文本渲染逻辑保持不变 */}
                              {(() => {
                                // 格式化对话文本，按说话者分行
                                const formatDialogueText = (text: string): string => {
                                  if (!text) return '';
                                  // 处理AI返回的\n换行符
                                  const formatted = text.replace(/\\n/g, '\n');
                                  // 如果已经包含换行符，保持格式并清理
                                  if (formatted.includes('\n')) {
                                    return formatted
                                      .split('\n')
                                      .map((line) => line.trim())
                                      .filter((line) => line.length > 0)
                                      .join('\n');
                                  }
                                  // 尝试按说话者分割 - 匹配 A: 或 B: 等格式
                                  const speakerPattern = /([A-Z]):\s*/g;
                                  const parts = formatted.split(speakerPattern);
                                  if (parts.length > 1) {
                                    let result = '';
                                    for (let i = 1; i < parts.length; i += 2) {
                                      if (parts[i] && parts[i + 1]) {
                                        const speaker = parts[i].trim();
                                        const content = parts[i + 1].trim();
                                        if (speaker && content) {
                                          result += `${speaker}: ${content}\n`;
                                        }
                                      }
                                    }
                                    if (result.trim()) {
                                      return result.trim();
                                    }
                                  }
                                  // 默认返回原文本
                                  return formatted;
                                };

                                // 获取所有已选择的生词（包括之前的、本次的和生词本中的）
                                const picked = [...previousWords, ...selectedWords];
                                const vocab = userVocab.map(v => ({
                                  word: v.term,
                                  explanation: v.explanation,
                                  fromVocab: true,
                                  vocabId: v.id
                                }));

                                // 去重：picked优先（上下文更准确）
                                const wordMap = new Map();
                                picked.forEach(w => wordMap.set(w.word, w));
                                vocab.forEach(v => {
                                  if (!wordMap.has(v.word)) {
                                    wordMap.set(v.word, v);
                                  }
                                });

                                const allSelectedWords = Array.from(wordMap.values());

                                // 渲染高亮节点的通用函数
                                const renderHighlightedNodes = (text: string, keyPrefix: string) => {
                                  const chars = text.split('');
                                  const result = [] as React.ReactNode[];
                                  const isChinese = /[\u4e00-\u9fff]/.test(text);
                                  const isKorean = /[\uac00-\ud7af]/.test(text);

                                  for (let i = 0; i < chars.length; i++) {
                                    let isHighlighted = false;
                                    let highlightLength = 0;

                                    for (const selectedWord of allSelectedWords) {
                                      const w = selectedWord.word;
                                      if (!w) continue;

                                      if (i + w.length <= chars.length) {
                                        const substring = chars.slice(i, i + w.length).join('');

                                        // 匹配检查
                                        let isMatch = false;
                                        if (isChinese || isKorean) {
                                          isMatch = substring === w;
                                        } else {
                                          isMatch = substring.toLowerCase() === w.toLowerCase();
                                        }

                                        if (isMatch) {
                                          // 边界检查
                                          let isAtWordBoundary = true;
                                          if (isKorean) {
                                            isAtWordBoundary = isKoreanWordBoundary(chars, i, w.length, i + w.length);
                                          } else if (!isChinese) {
                                            // 英文/其他
                                            isAtWordBoundary = isEnglishWordBoundary(chars, i, w.length, i + w.length);
                                          }

                                          if (isAtWordBoundary) {
                                            isHighlighted = true;
                                            highlightLength = w.length;
                                            break;
                                          }
                                        }
                                      }
                                    }

                                    if (isHighlighted && highlightLength > 0) {
                                      const word = chars.slice(i, i + highlightLength).join('');
                                      const wordData = allSelectedWords.find((item) => item.word === word || item.word.toLowerCase() === word.toLowerCase());
                                      const explanation = wordData?.explanation;

                                      result.push(
                                        <HoverExplanation
                                          key={`${keyPrefix}-${i}`}
                                          word={word}
                                          explanation={explanation}
                                          fromVocab={wordData?.fromVocab}
                                          vocabId={wordData?.vocabId}
                                          onRefresh={handleRefreshExplanation}
                                          lang={currentItem?.lang || 'ja'}
                                        >
                                          {word}
                                        </HoverExplanation>,
                                      );
                                      i += highlightLength - 1;
                                    } else {
                                      result.push(<span key={`${keyPrefix}-${i}`}>{chars[i]}</span>);
                                    }
                                  }
                                  return result;
                                };

                                // 优先使用 sentence_timeline 进行渲染
                                const timeline = (currentItem as any)?.sentence_timeline;

                                if (Array.isArray(timeline) && timeline.length > 0) {
                                  return timeline.map((seg: any, idx: number) => {
                                    const displayText = seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text;
                                    const targetIndex = seg.index ?? idx;
                                    return (
                                      <div key={targetIndex} className="mb-3 cursor-pointer hover:bg-blue-50/50 rounded p-1 transition-colors" onClick={() => playSentenceByIndex(targetIndex)}>
                                        {renderHighlightedNodes(displayText, `seg-${targetIndex}`)}
                                      </div>
                                    );
                                  });
                                }

                                // 回退到基于文本的渲染 - 增强版分句逻辑
                                let formattedText = formatDialogueText(currentItem.text);
                                let lines = formattedText.split('\n');

                                // 如果只有一行且包含标点符号，尝试按标点分句（模拟 timeline 效果）
                                if (lines.length === 1 && /[。！？.!?]/.test(lines[0])) {
                                  // 简单的分句逻辑，保留标点
                                  const splitByPunctuation = (text: string) => {
                                    return text.replace(/([。！？.!?]+)/g, '$1\n').split('\n').filter(l => l.trim());
                                  };
                                  lines = splitByPunctuation(lines[0]);
                                }

                                return lines.map((line, lineIndex) => (
                                  <div key={lineIndex} className="mb-3 cursor-pointer hover:bg-blue-50/50 rounded p-1 transition-colors" onClick={() => playSentenceByIndex(lineIndex)}>
                                    {renderHighlightedNodes(line, `line-${lineIndex}`)}
                                  </div>
                                ));
                              })()}
                            </div>
                          )}
                          {/* 底部渐变遮罩提示有更多内容 */}
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent pointer-events-none rounded-b-xl"></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 音频播放器 - 优化版 */}
                  {currentItem.audio_url && (
                    <div className="mt-4" ref={mainAudioContainerRef}>
                      <div className="mb-2 px-1">
                        <span className="text-sm font-medium text-gray-700">
                          {t.shadowing.original_audio_text || '原音频'}
                        </span>
                      </div>
                      <EnhancedAudioPlayer
                        ref={audioPlayerRef}
                        audioUrl={currentItem.audio_url}
                        onPlayStateChange={(playing) => {
                          setIsPlaying(playing);
                          if (playing) {
                            try {
                              if (audioRecorderRef.current && typeof audioRecorderRef.current.suspendMicForPlayback === 'function') {
                                audioRecorderRef.current.suspendMicForPlayback();
                              }
                            } catch { }
                          }
                        }}
                        onSegmentComplete={(start, end) => {
                          // 找到对应的句子索引
                          const timeline = (currentItem as unknown as { sentence_timeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }> })?.sentence_timeline;
                          if (timeline && Array.isArray(timeline)) {
                            const seg = timeline.find(s =>
                              typeof s.start === 'number' && typeof s.end === 'number' &&
                              Math.abs(s.start - start) < 0.1 && Math.abs(s.end - end) < 0.1
                            );
                            if (seg && typeof seg.index === 'number') {
                              setCompletedSegmentIndex(seg.index);
                            }
                          }
                        }}
                        duration_ms={currentItem.duration_ms}
                      />
                    </div>
                  )}
                </Card>

                {/* 生词区域 - 折叠式 */}
                {previousWords.length > 0 && (
                  <CollapsibleCard
                    title="之前的生词"
                    icon={<BookOpen className="w-5 h-5 text-gray-600" />}
                    badge={<span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{previousWords.length}</span>}
                    summary={`${previousWords.length}个生词`}
                    defaultOpen={step === 2}
                    className="border-0 shadow-sm"
                    contentClassName="pt-2"
                  >
                    <div className="space-y-2">
                      {previousWords.map((item, index) => (
                        <div
                          key={`prev-${index}`}
                          className="p-3 bg-gray-50 rounded border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <WordWithPronunciation
                                  word={item.word}
                                  explanation={item.explanation || wordExplanations[item.word]}
                                  lang={currentItem?.lang || item.lang || 'en'}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => speakWord(item.word, currentItem?.lang || 'en')}
                                  className="text-blue-500 hover:text-blue-700 p-1"
                                  title={t.shadowing.pronounce || '发音'}
                                >
                                  🔊
                                </Button>
                              </div>
                              <div className="text-sm text-gray-600 mt-1">{item.context}</div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  generateWordExplanation(
                                    item.word,
                                    item.context,
                                    currentItem?.lang || 'en',
                                  )
                                }
                                disabled={isGeneratingExplanation}
                                className="text-xs"
                              >
                                {generatingWord === item.word
                                  ? (t.shadowing.generating || '生成中...')
                                  : (t.shadowing.ai_explanation_button || 'AI解释')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removePreviousWord(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                {t.shadowing.remove || '删除'}
                              </Button>
                            </div>
                          </div>

                          {/* AI解释显示 */}
                          <div className="mt-3 p-3 bg-white rounded border border-gray-100">
                            <DynamicExplanation
                              word={item.word}
                              fallbackExplanation={item.explanation}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}
                {/* 本次选中的生词 - 折叠式 */}
                {selectedWords.length > 0 && (
                  <CollapsibleCard
                    title="本次选中的生词"
                    icon={<Sparkles className="w-5 h-5 text-blue-600" />}
                    badge={<span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">{selectedWords.length}</span>}
                    summary={`${selectedWords.length}个生词待处理`}
                    defaultOpen={true}
                    className="border-0 shadow-sm"
                    contentClassName="pt-2"
                  >
                    <div className="flex gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={generateBatchExplanations}
                        disabled={isGeneratingBatchExplanation}
                        className="text-green-600 hover:text-green-800 border-green-300"
                      >
                        {isGeneratingBatchExplanation
                          ? (t.shadowing.generating || '生成中...')
                          : (t.shadowing.ai_explanation_batch_button || '一键AI解释')}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedWords([])}>
                        {t.shadowing.clear || '清空'}
                      </Button>
                      <Button size="sm" onClick={importToVocab} disabled={isImporting}>
                        {isImporting ? (t.shadowing.adding_to_vocab || '添加中...') : (t.shadowing.import_to_vocab || '导入到生词本')}
                      </Button>
                    </div>

                    {/* 批量AI解释进度显示 */}
                    {isGeneratingBatchExplanation && batchExplanationProgress.total > 0 && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-green-700">{t.shadowing.ai_explanation_generation_progress || 'AI解释生成进度'}</span>
                            <span className="text-green-600">
                              {batchExplanationProgress.current} /{' '}
                              {batchExplanationProgress.total}
                            </span>
                          </div>
                          <div className="w-full bg-green-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${(batchExplanationProgress.current / batchExplanationProgress.total) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <div className="text-sm text-green-600">
                            {batchExplanationProgress.status}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {selectedWords.map((item, index) => (
                        <div
                          key={`selected-${item.word}-${index}`}
                          className="p-3 bg-blue-50 rounded border border-blue-200"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <WordWithPronunciation
                                  word={item.word}
                                  explanation={item.explanation || wordExplanations[item.word]}
                                  lang={currentItem?.lang || item.lang || 'en'}
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => speakWord(item.word, item.lang)}
                                  className="text-blue-500 hover:text-blue-700 p-1"
                                  title={t.shadowing.pronounce || '发音'}
                                >
                                  🔊
                                </Button>
                              </div>
                              <div className="text-sm text-blue-600 mt-1">{item.context}</div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  generateWordExplanation(item.word, item.context, item.lang)
                                }
                                disabled={isGeneratingExplanation}
                                className="text-xs"
                              >
                                {generatingWord === item.word
                                  ? (t.shadowing.generating || '生成中...')
                                  : (t.shadowing.ai_explanation_button || 'AI解释')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSelectedWord(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                移除
                              </Button>
                            </div>
                          </div>

                          {/* AI解释显示 */}
                          {(item.explanation || wordExplanations[item.word]) && (
                            <div className="mt-3 p-3 bg-white rounded border border-blue-100">
                              <DynamicExplanation
                                word={item.word}
                                fallbackExplanation={
                                  item.explanation || wordExplanations[item.word]
                                }
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CollapsibleCard>
                )}

                {/* 翻译模块 */}
                {currentItem && (!gatingActive || step === 3) && (
                  <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-xl rounded-2xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <span className="text-white text-lg">🌐</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {t.shadowing.translation || '翻译'}
                        </h3>
                        <p className="text-sm text-gray-600">{t.shadowing.translation_support_hint || '多语言翻译支持'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer p-3 bg-white/80 rounded-xl border border-indigo-200 hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={showTranslation}
                            onChange={(e) => setShowTranslation(e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="font-medium">
                            {t.shadowing.show_translation || '显示翻译'}
                          </span>
                        </label>
                        <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer p-3 bg-white/80 rounded-xl border border-indigo-200 hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={showRubyPronunciation}
                            onChange={(e) => setShowRubyPronunciation(e.target.checked)}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="font-medium">
                            {'显示读音注音（zh/ja/ko）'}
                          </span>
                        </label>
                        {showTranslation && (
                          <select
                            className="h-11 px-4 py-2 bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium w-full"
                            value={translationLang}
                            onChange={(e) =>
                              setTranslationLang(e.target.value as 'en' | 'ja' | 'zh' | 'ko')
                            }
                          >
                            {getTargetLanguages(currentItem.lang).map((lang) => (
                              <option key={lang} value={lang}>
                                {getLangName(lang)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {showTranslation &&
                        currentItem.translations &&
                        currentItem.translations[translationLang] ? (
                        <div className="p-4 bg-white rounded-xl border border-indigo-200 shadow-sm">
                          <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                            {formatSpeakerBreaks(currentItem.translations[translationLang])}
                          </div>
                        </div>
                      ) : showTranslation ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">📝</span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">{t.shadowing.translation_none_title || '暂无翻译'}</h3>
                          <p className="text-gray-500">{t.shadowing.translation_none_desc || '可能尚未生成翻译内容'}</p>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🌐</span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            {t.shadowing.translation_enable_action || '开启翻译功能'}
                          </h3>
                          <p className="text-gray-500">{t.shadowing.translation_enable_hint || '勾选上方选项以显示翻译内容'}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* 练习模式切换 */}
                {(!gatingActive || step >= 4) && renderPracticeModeSwitcher()}

                {/* 逐句/分角色/跟读练习 - 统一使用 SentencePractice */}
                {(!gatingActive || step >= 4) && (
                  <SentencePractice
                    originalText={currentItem?.text}
                    language={currentItem?.lang || 'ja'}
                    audioUrl={currentItem?.audio_url || null}
                    sentenceTimeline={Array.isArray((currentItem as unknown as { sentence_timeline?: Array<{ index: number; text: string; start: number; end: number; speaker?: string }> })?.sentence_timeline)
                      ? (currentItem as unknown as { sentence_timeline: Array<{ index: number; text: string; start: number; end: number; speaker?: string }> }).sentence_timeline
                      : undefined}
                    practiceMode={practiceMode}
                    activeRole={selectedRole}
                    roleSegments={roleSegments}
                    onRoleRoundComplete={handleRoleRoundComplete}
                    acuUnits={currentItem?.notes?.acu_units}
                    onSpeakingDurationUpdate={setSessionSpeakingDuration}
                    // 统一使用顶部主音频播放器进行分段播放
                    onPlaySentence={(i) => playSentenceByIndex(i)}
                    completedSegmentIndex={completedSegmentIndex}
                    onSentenceScoreUpdate={(index, score) => {
                      setSentenceScores(prev => ({
                        ...prev,
                        [index]: score
                      }));
                    }}
                    sentenceScores={sentenceScores} // Pass shared scores
                  />
                )}

                {practiceMode === 'role' && nextRoleSuggestion && (
                  <Card className="p-4 border border-emerald-200 bg-emerald-50 text-emerald-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      {t.shadowing?.role_suggestion_text || '切换到其他角色继续练习：'}
                      <span className="font-semibold ml-1">{nextRoleSuggestion}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedRole(nextRoleSuggestion);
                        setNextRoleSuggestion(null);
                      }}
                    >
                      {t.shadowing?.role_switch_now || '立即切换'}
                    </Button>
                  </Card>
                )}

                {/* 录音练习区域 - 已移除 */}
                {/* 评分区域 - 已移除 */}

                {/* 评分结果区域 */}
                {practiceMode !== 'role' && scoringResult && (
                  <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-xl rounded-2xl">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">🎯</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.scoring_result || '评分结果'}
                          </h3>
                          <p className="text-sm text-gray-600">{t.shadowing.ai_analysis_done || 'AI智能分析完成'}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => performScoring(currentTranscription)}
                        disabled={isScoring}
                        aria-busy={isScoring}
                        aria-disabled={isScoring}
                        aria-label={isScoring ? '重新评分进行中' : '重新评分'}
                        variant="outline"
                        size="sm"
                        className="h-8 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 rounded-lg"
                      >
                        {isScoring
                          ? t.shadowing.re_scoring_in_progress || '重新评分中...'
                          : t.shadowing.re_score || '重新评分'}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6" aria-live="polite" aria-atomic="true">
                      <div className="p-4 bg-white rounded-xl border border-green-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                            <span className="text-green-600 text-sm">🏆</span>
                          </div>
                          <div className="text-sm font-medium text-green-700">
                            {t.shadowing.overall_score}
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-green-600">
                          {(scoringResult.score || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                            <span className="text-blue-600 text-sm">🎯</span>
                          </div>
                          <div className="text-sm font-medium text-blue-700">
                            {t.shadowing.pronunciation_accuracy}
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {(scoringResult.score || 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {scoringResult.feedback && (
                      <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200 shadow-sm mb-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <span className="text-yellow-600 text-sm">💡</span>
                          </div>
                          <div className="text-sm font-medium text-yellow-700">
                            {t.shadowing.improvement_suggestions}
                          </div>
                        </div>
                        <p className="text-yellow-800 text-sm leading-relaxed">
                          {scoringResult.feedback}
                        </p>
                      </div>
                    )}

                    {/* 转录文字和原文对比 - 手机端优化 */}
                    {scoringResult.transcription && scoringResult.originalText && (
                      <div className="mt-4">
                        <h4 className="text-lg font-semibold mb-3">
                          {t.shadowing.practice_comparison}
                        </h4>
                        <div className="space-y-3">
                          <div className="border rounded-lg p-3">
                            <div className="space-y-3">
                              <div>
                                <div className="text-sm text-gray-500 mb-2">
                                  {t.shadowing.original_text}
                                </div>
                                <div className="p-3 bg-gray-50 rounded border text-sm">
                                  {scoringResult.originalText}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500 mb-2">
                                  {t.shadowing.your_pronunciation}
                                </div>
                                <div
                                  className={`p-3 rounded border text-sm ${(scoringResult.score || 0) >= 80
                                    ? 'bg-green-50 border-green-200'
                                    : (scoringResult.score || 0) >= 60
                                      ? 'bg-yellow-50 border-yellow-200'
                                      : 'bg-red-50 border-red-200'
                                    }`}
                                >
                                  {scoringResult.transcription}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 详细分析 - 手机端 */}
                          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                            <div className="text-sm text-blue-600 mb-2">
                              {t.shadowing.detailed_analysis || '详细分析'}
                            </div>
                            <div className="text-sm text-gray-700">
                              {(() => {
                                // 处理中文文本，按字符分割而不是按单词分割
                                const details = (scoringResult as any).details;
                                if (!details) return null;

                                return (
                                  <div className="space-y-2">
                                    {details.map((detail: any, idx: number) => (
                                      <div key={idx} className="flex items-start gap-2">
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${detail.score >= 80 ? 'bg-green-100 text-green-700' :
                                          detail.score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                          {detail.score}
                                        </span>
                                        <span className="text-gray-700">{detail.char || detail.word}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* 评分结果区域 - 恢复的逻辑 */}
                {practiceMode !== 'role' && scoringResult && scoringResult.originalText && scoringResult.transcription && (
                  <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-0 shadow-xl rounded-2xl">
                    {(() => {
                      const simpleAnalysis = performSimpleAnalysis(
                        scoringResult.originalText!,
                        scoringResult.transcription!,
                        t
                      );
                      const { sentenceAnalysis, overallScore } = simpleAnalysis;

                      return (
                        <div>
                          {/* 整体评分 */}
                          <div className="mb-4 p-3 bg-white rounded border">
                            <div className="text-sm font-medium mb-2">{t.shadowing.overall_score}:</div>
                            <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
                          </div>

                          {/* 句子分析 */}
                          <div className="space-y-3">
                            {sentenceAnalysis.map((sentence, idx) => (
                              <div key={idx} className={`p-3 rounded border ${sentence.status === 'correct' ? 'bg-green-50 border-green-200' :
                                sentence.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                  'bg-red-50 border-red-200'
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="text-sm font-medium">
                                    {sentence.status === 'correct' && '✓ '}
                                    {sentence.status === 'partial' && '⚠ '}
                                    {sentence.status === 'missing' && '❌ '}
                                    {t.shadowing.sentence || '句子'} {idx + 1}
                                  </div>
                                  <div className="text-sm font-bold">{sentence.score}%</div>
                                </div>
                                <div className="text-sm mb-2">
                                  <span className="font-medium">{t.shadowing.original_text}:</span>
                                  <span className="text-gray-700 ml-1">&ldquo;{sentence.sentence}&rdquo;</span>
                                </div>
                                {sentence.issues.length > 0 && (
                                  <div className="text-xs text-red-600">
                                    <div className="font-medium">{t.shadowing.issues || '问题'}:</div>
                                    <ul className="list-disc list-inside">
                                      {sentence.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                )}


                {/* 下一条推荐卡片 */}
                {scoringResult && nextRecommendation && (
                  <div className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <NextPracticeCard
                      recommendation={nextRecommendation}
                      onStart={handleStartNext}
                    />
                  </div>
                )}



                {!practiceComplete && (!gatingActive || step === 4) && (
                  <div className="flex items-center gap-2 w-full mt-2">
                    <Button
                      onClick={() => unifiedCompleteAndSave()}
                      className="flex-1 h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t.shadowing.complete_and_save}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 h-11"
                      onClick={() => {
                        setPracticeComplete(false);
                        setStep(1);
                        setScoringResult(null);
                        setIsVocabMode(false);
                        setShowTranslation(false);
                      }}
                    >
                      {t.shadowing.practice_again}
                    </Button>
                  </div>
                )}

                {/* 完成后成功状态卡片 - 详细统计版 */}
                {
                  practiceComplete && (
                    <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">✅</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t.shadowing.practice_done_title || '练习已完成'}</h3>
                          <p className="text-sm text-gray-600">{t.shadowing.practice_done_desc || '成绩与生词已保存，你可以选择继续提升'}</p>
                        </div>
                      </div>

                      {/* 整体统计概览 */}
                      <div className="mb-6 bg-white/60 rounded-xl p-4 border border-green-100">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.shadowing.stats_overview || '练习统计概览'}</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {/* 整体准确率 */}
                          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-green-600">
                              {scoringResult ? (scoringResult.score || 0).toFixed(1) : (() => {
                                const scores = Object.values(sentenceScores);
                                if (scores.length === 0) return '0';
                                const avg = (scores as any[]).reduce((sum, s) => sum + (s.score || 0), 0) / scores.length;
                                return (avg * 100).toFixed(1);
                              })()}%
                            </div>
                            <div className="text-xs text-gray-500">{t.shadowing.overall_accuracy || '整体准确率'}</div>
                          </div>
                          {/* 平均首次得分 */}
                          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-blue-600">
                              {(() => {
                                const scores = Object.values(sentenceScores);
                                if (scores.length === 0) return '0';
                                const avgFirst = (scores as any[]).reduce((sum, s) => sum + ((s.firstScore ?? s.score ?? 0) * 100), 0) / scores.length;
                                return avgFirst.toFixed(1);
                              })()}%
                            </div>
                            <div className="text-xs text-gray-500">{t.shadowing.avg_first_score || '平均首次得分'}</div>
                          </div>
                          {/* 总尝试次数 */}
                          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-purple-600">
                              {Object.values(sentenceScores).reduce((sum, s: any) => sum + (s.attempts || 1), 0)}
                            </div>
                            <div className="text-xs text-gray-500">{t.shadowing.total_attempts || '总尝试次数'}</div>
                          </div>
                          {/* 理解题准确率 */}
                          {quizResult && (
                            <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                              <div className="text-2xl font-bold text-amber-600">
                                {quizResult.correctCount}/{quizResult.total}
                              </div>
                              <div className="text-xs text-gray-500">{t.shadowing.comprehension_accuracy || '理解准确率'}</div>
                            </div>
                          )}
                          {/* 选中生词数 */}
                          {(selectedWords.length > 0 || previousWords.length > 0) && (
                            <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                              <div className="text-2xl font-bold text-pink-600">
                                {selectedWords.length + previousWords.length}
                              </div>
                              <div className="text-xs text-gray-500">{t.shadowing.vocab_selected || '选中生词'}</div>
                            </div>
                          )}
                          {/* 开口时长 */}
                          <div className="text-center p-2 bg-white rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-teal-600">
                              {(() => {
                                const seconds = Math.floor(sessionSpeakingDuration / 1000);
                                const m = Math.floor(seconds / 60);
                                const s = seconds % 60;
                                return `${m}m ${s}s`;
                              })()}
                            </div>
                            <div className="text-xs text-gray-500">{(t.shadowing as any).speaking_duration || '开口时长'}</div>
                          </div>
                        </div>
                      </div>

                      {/* 句子详情 */}
                      {Object.keys(sentenceScores).length > 0 && (
                        <div className="mb-6 bg-white/60 rounded-xl p-4 border border-green-100">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">{t.shadowing.sentence_details || '句子详情'}</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {/* 表头 */}
                            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-2 pb-1 border-b border-gray-200">
                              <div className="col-span-5">{t.shadowing.sentence || '句子'}</div>
                              <div className="col-span-2 text-center">{t.shadowing.first_attempt_score || '首次得分'}</div>
                              <div className="col-span-2 text-center">{t.shadowing.final_score || '最终得分'}</div>
                              <div className="col-span-3 text-center">{t.shadowing.attempts_count || '尝试次数'}</div>
                            </div>
                            {/* 句子行 */}
                            {Object.entries(sentenceScores).map(([idx, score]: [string, any]) => {
                              const firstScorePercent = ((score.firstScore ?? score.score ?? 0) * 100).toFixed(0);
                              const finalScorePercent = ((score.bestScore ?? score.score ?? 0) * 100).toFixed(0);
                              const attempts = score.attempts || 1;
                              const sentenceText = score.finalText || (t.shadowing.sentence_fallback || '句子 {n}').replace('{n}', String(Number(idx) + 1));
                              return (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm p-2 bg-white rounded border border-gray-100">
                                  <div className="col-span-5 text-gray-600 truncate" title={sentenceText}>
                                    {sentenceText}
                                  </div>
                                  <div className="col-span-2 text-center">
                                    <Badge variant={Number(firstScorePercent) >= 80 ? 'default' : Number(firstScorePercent) >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                                      {firstScorePercent}%
                                    </Badge>
                                  </div>
                                  <div className="col-span-2 text-center">
                                    <Badge variant={Number(finalScorePercent) >= 80 ? 'default' : Number(finalScorePercent) >= 60 ? 'secondary' : 'destructive'} className="text-xs">
                                      {finalScorePercent}%
                                    </Badge>
                                  </div>
                                  <div className="col-span-3 text-center text-gray-500">
                                    {attempts} {attempts > 1 && <span className="text-green-600">↑</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 flex-wrap">
                        <Button
                          onClick={() => {
                            setPracticeComplete(false);
                            setStep(1);
                            setScoringResult(null);
                            setSentenceScores({}); // Clear scores
                            setIsVocabMode(false);
                            setShowTranslation(false);
                            setSentenceScores({});
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {t.shadowing.practice_again || '再练一次'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrentItem(null);
                          }}
                        >
                          {t.shadowing.back_to_catalog || '返回题库'}
                        </Button>
                      </div>
                    </Card>
                  )
                }
              </div >
            )}
          </div >

        </div >
      </Container >

      {/* 成功提示Toast */}
      {
        showSuccessToast && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-right duration-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{successMessage}</span>
            <button
              onClick={() => setShowSuccessToast(false)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      }

      {/* Difficulty Rating Modal */}
      {
        showDifficultyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
              <h3 className="text-xl font-bold text-center mb-2 text-gray-900">
                {t.shadowing.difficulty_rating_title || '觉得这个练习怎么样？'}
              </h3>
              <p className="text-center text-gray-500 mb-6">
                {t.shadowing.difficulty_rating_desc || '您的反馈将帮助我们为您推荐更合适的内容'}
              </p>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="h-12 text-lg hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                  onClick={() => unifiedCompleteAndSave('too_easy')}
                >
                  😄 {t.shadowing.difficulty_too_easy || '太简单了'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all"
                  onClick={() => unifiedCompleteAndSave('just_right')}
                >
                  😊 {t.shadowing.difficulty_just_right || '刚刚好'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-lg hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-200 transition-all"
                  onClick={() => unifiedCompleteAndSave('a_bit_hard')}
                >
                  😅 {t.shadowing.difficulty_bit_hard || '有点难'}
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-lg hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
                  onClick={() => unifiedCompleteAndSave('too_hard')}
                >
                  😫 {t.shadowing.difficulty_too_hard || '太难了'}
                </Button>
              </div>
            </Card>
          </div>
        )
      }
    </main >
  );
}
