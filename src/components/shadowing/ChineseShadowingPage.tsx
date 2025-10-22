'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo, useDeferredValue, RefObject } from 'react';

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
import { Virtuoso } from 'react-virtuoso';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import SelectablePassage from '@/components/SelectablePassage';
import AcuText from '@/components/shadowing/AcuText';
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
import { speakText as speakTextUtil } from '@/lib/speechUtils';
import CollapsibleFilterSection from './CollapsibleFilterSection';
import CompactStatsCards from './CompactStatsCards';
import EnhancedAudioPlayer, { type EnhancedAudioPlayerRef } from './EnhancedAudioPlayer';
import DesktopThreeColumnLayout from './DesktopThreeColumnLayout';
import RightPanelTabs from './RightPanelTabs';
import ShortcutsHelpModal from './ShortcutsHelpModal';
import DesktopLayout from './DesktopLayout';
import { useKeyboardShortcuts, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import CollapsibleCard from './CollapsibleCard';
import FloatingActionButtons from './FloatingActionButtons';
import BottomNavBar from './BottomNavBar';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCached, setCached } from '@/lib/clientCache';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { loadFilters as loadShadowingFilters, saveFilters as saveShadowingFilters } from '@/lib/shadowingFilterStorage';

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
  notes?: {
    acu_marked?: string;
    acu_units?: Array<{ span: string; start: number; end: number; sid: number }>;
    [key: string]: any;
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
const globalVocabCache = new Map<string, { data: { entries?: Array<{ explanation?: any }> }; timestamp: number }>();
const CACHE_DURATION = 30000; // 30秒缓存
const pendingRequests = new Map<string, Promise<any>>(); // 请求去重

// 增强的词汇搜索函数，包含请求去重和持久化缓存
const searchVocabWithCache = async (word: string, getAuthHeaders: () => Promise<HeadersInit>): Promise<any> => {
  const cacheKey = word.toLowerCase().trim();
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
        `/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`,
        { headers }
      );
      const data = await response.json();
      
      // 更新缓存
      globalVocabCache.set(cacheKey, { data, timestamp: now });
      
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
  
  
  // 语言切换时清理缓存，避免不同语言间的缓存冲突
  useEffect(() => {
    globalVocabCache.clear();
    pendingRequests.clear();
    
    // 清理sessionStorage中的词汇缓存
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('vocab_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      // sessionStorage可能不可用，忽略错误
    }
  }, [lang]);
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
    } catch {}
    return 1;
  });
  const [practiced, setPracticed] = useState<'all' | 'practiced' | 'unpracticed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<string>('all');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('all');
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>('all');
  const [practiceMode, setPracticeMode] = useState<'default' | 'role'>('default');
  const [selectedRole, setSelectedRole] = useState<string>('A');
  const [completedRoleList, setCompletedRoleList] = useState<string[]>([]);
  const [nextRoleSuggestion, setNextRoleSuggestion] = useState<string | null>(null);

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

    // 如果 URL 未提供，则尝试本地持久化
    const persisted = loadShadowingFilters();
    if (persisted) {
      if (!urlLang && persisted.lang && persisted.lang !== lang) setLang(persisted.lang);
      if (!urlLevel && typeof persisted.level !== 'undefined') setLevel(persisted.level ?? null);
      if (!urlPracticed && persisted.practiced) setPracticed(persisted.practiced);
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
    saveShadowingFilters({ lang, level, practiced });

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
  }, [lang, level, practiced, practiceMode, selectedRole, pathname, router]);

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

  // 题库相关状态
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentItem, setCurrentItem] = useState<ShadowingItem | null>(null);
  const [currentSession, setCurrentSession] = useState<ShadowingSession | null>(null);

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
  const [isImporting, setIsImporting] = useState(false);

  // 录音组件引用
  const audioRecorderRef = useRef<{
    uploadCurrentRecording: () => Promise<void>;
    hasUnsavedRecording: () => boolean;
    stopPlayback: () => void;
  } | null>(null);
  
  // 请求中止控制器
  const abortRef = useRef<AbortController | null>(null);

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
    (_result: unknown) => {
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

  // 发音功能
  const speakWord = (word: string, lang: string) => {
    speakTextUtil(word, lang, {
      rate: 0.8, // 稍慢一点，便于学习
      pitch: 1,
      volume: 1,
    });
  };

  // 悬停/点击解释组件
  const HoverExplanation = ({
    word,
    explanation,
    children,
    fromVocab = false,
    vocabId,
    onRefresh,
    lang = 'zh',
  }: {
    word: string;
    explanation?: {
      gloss_native: string;
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
    const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const handleMouseEnter = async () => {
      setShowTooltip(true);
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
      
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
          const data = await searchVocabWithCache(word, getAuthHeaders);
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
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    };

    // 点击发音功能
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // 切换tooltip显示状态
      setShowTooltip(!showTooltip);
      
      // 调用浏览器发音
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
          utterance.lang = langMap[lang] || 'zh-CN';
          utterance.rate = 0.6; // 稍慢的语速，便于听清
          utterance.pitch = 1.0;
          
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('语音合成失败:', error);
        }
      }
    };

    useEffect(() => {
      return () => {
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
        if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
      };
    }, []);

    const tooltipText = latestExplanation?.gloss_native || '已选择的生词';

    return (
      <span
        className="bg-yellow-200 text-yellow-800 px-1 rounded font-medium cursor-pointer relative hover:bg-yellow-300 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onTouchStart={(e) => {
          // 防止触摸时触发双击缩放
          e.preventDefault();
        }}
        onTouchEnd={(e) => {
          // 处理触摸结束事件
          e.preventDefault();
          e.stopPropagation();
          // 直接调用发音功能，不传递事件参数
          if (word && word.trim()) {
            speakWord(word, lang);
          }
        }}
        title={`点击发音: ${word}`}
      >
        {children}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg w-32 z-50">
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
  const WordWithPronunciation = ({
    word,
    explanation,
  }: {
    word: string;
    explanation?: {
      gloss_native: string;
      pronunciation?: string;
      pos?: string;
      senses?: Array<{ example_target: string; example_native: string }>;
    };
  }) => {
    return (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-700">{word}</span>
        {explanation?.pronunciation && (
          <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs text-gray-600">
            {explanation.pronunciation}
          </span>
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
    };
  }) => {
    // 优先使用缓存中的最新解释，其次使用fallback解释
    const [latestExplanation, setLatestExplanation] = useState<
      | {
          gloss_native: string;
          pronunciation?: string;
          pos?: string;
          senses?: Array<{ example_target: string; example_native: string }>;
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
        globalVocabCache.delete(word.toLowerCase().trim());
        const data = await searchVocabWithCache(word, getAuthHeaders);

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

    // 初始化时获取最新解释
    useEffect(() => {
      if (!hasInitialized) {
        setHasInitialized(true);
        // 只有在页面加载完成后才允许搜索
        if (!pageLoaded) {
          return;
        }
        
        // 使用全局缓存机制获取解释
        const fetchInitialExplanation = async () => {
          setExplanationLoading(true);
          try {
            const data = await searchVocabWithCache(word, getAuthHeaders);
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
    }, [hasInitialized, word, pageLoaded, searchVocabWithCache]);

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
  const [generatingWord, setGeneratingWord] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // UI 状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [recommendedLevel, setRecommendedLevel] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<EnhancedAudioPlayerRef | null>(null);
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

  // 桌面端分步骤练习（仅在未完成状态下启用）
  // 桌面端分步骤练习（仅在未完成状态下启用）
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [highlightPlay, setHighlightPlay] = useState(false);
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [highlightScore, setHighlightScore] = useState(false);

  // ACU 模式状态
  const [isACUMode, setIsACUMode] = useState(true); // 默认使用 ACU 模式


  const stepTips: Record<number, string> = {
    1: t.shadowing.step1_tip,
    2: t.shadowing.step2_tip,
    3: t.shadowing.step3_tip,
    4: t.shadowing.step5_tip,
  };

  // 步骤切换时的联动：自动开/关生词模式与翻译偏好
  useEffect(() => {
    if (!currentItem) return;
    // 只在第3步开启生词模式，其余步骤关闭
    setIsVocabMode(step === 3);

    if (step === 2) {
      setShowTranslation(true);
      const available = currentItem.translations ? Object.keys(currentItem.translations) : [];
      const uiLang = (language as 'en' | 'ja' | 'zh' | 'ko');
      const pref = (userProfile?.native_lang as 'en' | 'ja' | 'zh' | 'ko' | undefined) || undefined;
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
  }, [step, currentItem, userProfile, language]);

  // 关键按钮短暂高亮引导
  useEffect(() => {
    if (practiceComplete) return;
    let timeoutId: number | undefined;
    if (step === 1) {
      setHighlightPlay(true);
      timeoutId = window.setTimeout(() => setHighlightPlay(false), 2000);
    } else if (step === 3) {
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

  // 认证头由 useAuth 提供的 getAuthHeaders 统一处理

  // 重复定义的 loadThemes/loadSubtopics 已移除（保留下方新版本）
  // 获取推荐等级
  const fetchRecommendedLevel = useCallback(async () => {
    if (!user) return;

    try {
      let headers = await getAuthHeaders();
      let response = await fetch(`/api/shadowing/recommended?lang=${lang}`, { headers });
      if (response.status === 401) {
        try {
          await supabase.auth.refreshSession();
          headers = await getAuthHeaders();
          response = await fetch(`/api/shadowing/recommended?lang=${lang}`, { headers });
        } catch {}
      }
      if (response.ok) {
        const data = await response.json();
        setRecommendedLevel(data.recommended);
      }
    } catch (error) {
      console.error('Failed to fetch recommended level:', error);
    }
  }, [lang, user, getAuthHeaders]);

  // 获取题库列表
  const fetchItems = useCallback(async () => {
    // 取消之前的请求
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {}
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
      if (level) params.set('level', level.toString());
      if (practiced !== 'all') params.set('practiced', practiced === 'practiced' ? 'true' : 'false');
      params.set('limit', '100');

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
  }, [lang, level, practiced, getAuthHeaders]);

  // 加载主题列表
  const loadThemes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level?.toString() || '');
      const response = await fetch(`/api/admin/shadowing/themes?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setThemes((data.items || data.themes) ?? []);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, [lang, level]);

  // 加载某主题下的小主题
  const loadSubtopics = useCallback(async (themeId: string) => {
    try {
      const params = new URLSearchParams();
      params.set('theme_id', themeId);
      const response = await fetch(`/api/admin/shadowing/subtopics?${params.toString()}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSubtopics((data.items || data.subtopics) ?? []);
      }
    } catch (error) {
      console.error('Failed to load subtopics:', error);
    }
  }, []);

  // 鉴权由 AuthContext 统一处理

  // 加载题库（初始加载和筛选条件变化时）
  useEffect(() => {
    // 等待认证完成且用户已登录
    if (authLoading || !user) return;
    
    // 防抖延迟，避免快速切换时多次请求
    const t = setTimeout(() => {
      fetchItems();
      // 只在初始加载时获取推荐等级（level为null时）
      if (level === null) {
        fetchRecommendedLevel();
      }
    }, 50);
    
    return () => clearTimeout(t);
    // 依赖筛选条件和fetchItems函数，确保条件变化时重新加载
  }, [lang, level, practiced, authLoading, user, fetchItems, fetchRecommendedLevel]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      // 清理定时器
      if (replaceTimerRef.current) clearTimeout(replaceTimerRef.current);
      // 清理请求
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch {}
        abortRef.current = null;
      }
    };
  }, []);


  // 加载主题数据
  useEffect(() => {
    if (!authLoading && user) {
      loadThemes();
    }
  }, [lang, level, authLoading, user, loadThemes]);

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

  // 过滤显示的题目（记忆化）
  const filteredItems = useMemo(() => {
    const list = items
      .filter((item) => {
        // 搜索筛选
        if (deferredSearchQuery) {
          const query = deferredSearchQuery.toLowerCase();
          const matchesSearch =
            item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query);
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
      })
      .sort((a, b) => {
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

    return list;
  }, [items, deferredSearchQuery, theme, selectedThemeId, selectedSubtopicId]);

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
    } catch {}
    // 停止页面音频播放并复位
    try {
      audioPlayerRef.current?.pause();
      audioPlayerRef.current?.reset();
    } catch {}
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
  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const itemId = searchParams?.get('item');
        const auto = searchParams?.get('autostart') === '1';
        if (!itemId || !auto) return;
        let target = items.find((x) => x.id === itemId) || null;
        if (!target) {
          const headers = await getAuthHeaders();
          let resp = await fetch(`/api/shadowing/item?id=${itemId}`, { headers, credentials: 'include' });
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
            // 回退到每日一题接口，保证能打开今日题
            resp = await fetch(`/api/shadowing/daily?lang=${lang}`, { headers, credentials: 'include' });
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
        }
        if (target) {
          await loadItem(target);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        const message = `"${selectedText.word}" 已成功添加到生词本！`;
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
      const data = await searchVocabWithCache(word, getAuthHeaders);
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

        successfulResults.forEach((result) => {
          if (result) {
            newExplanations[result.word] = result.explanation;
          }
        });

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
        const data = await searchVocabWithCache(word, getAuthHeaders);
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
        alert(`${t.shadowing.messages?.generate_explanation_failed || '生成解释失败，请重试'}：${errorData.error}`);
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      alert(t.shadowing.messages?.generate_explanation_failed || '生成解释失败，请重试');
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
        alert(t.shadowing.no_recording_yet || '还没有录音');
        return;
      }

      // 获取原文
      const originalText = currentItem.text;

      // 使用句子分析计算整体评分
      const simpleAnalysis = performSimpleAnalysis(originalText, textToScore);
      const { overallScore } = simpleAnalysis;

      // 确保准确率在0-1之间
      const normalizedAccuracy = overallScore / 100;
      const scorePercentage = overallScore;

      // 生成更详细的反馈
      let feedback = '';
      const suggestions = [];

      if (scorePercentage >= 80) {
        feedback = `发音准确率: ${scorePercentage}%，非常棒！`;
        suggestions.push('继续保持这个水平！');
      } else if (scorePercentage >= 60) {
        feedback = `发音准确率: ${scorePercentage}%，很好！`;
        suggestions.push('可以尝试更清晰地发音');
        suggestions.push('注意语调和节奏');
      } else if (scorePercentage >= 40) {
        feedback = `发音准确率: ${scorePercentage}%，还不错`;
        suggestions.push('建议多听几遍原文');
        suggestions.push('注意单词的发音');
        suggestions.push('可以尝试放慢语速');
      } else {
        feedback = `发音准确率: ${scorePercentage}%，需要加强练习`;
        suggestions.push('建议先听几遍原文再练习');
        suggestions.push('注意每个单词的发音');
        suggestions.push('可以分段练习');
        suggestions.push('多练习几次会更好');
      }

      // 添加转录质量提示
      if (textToScore.length < originalText.length * 0.3) {
        suggestions.push('转录内容较少，建议重新录音');
      } else if (textToScore.length < originalText.length * 0.6) {
        suggestions.push('转录内容不完整，建议重新录音');
      }

      const fullFeedback =
        feedback + (suggestions.length > 0 ? '\n\n建议：\n• ' + suggestions.join('\n• ') : '');

      // Recompute feedback via i18n to avoid hardcoded copy
      let feedback2 = '';
      const suggestions2: string[] = [];
      if (scorePercentage >= 80) {
        feedback2 = (t.shadowing.feedback_great || '发音准确率: {percent}%，非常棒！').replace('{percent}', String(scorePercentage));
        suggestions2.push(t.shadowing.suggestions?.keep_level || '继续保持这个水平！');
      } else if (scorePercentage >= 60) {
        feedback2 = (t.shadowing.feedback_good || '发音准确率: {percent}%，很好！').replace('{percent}', String(scorePercentage));
        suggestions2.push(t.shadowing.suggestions?.clearer_pronunciation || '可以尝试更清晰地发音');
        suggestions2.push(t.shadowing.suggestions?.intonation_rhythm || '注意语调和节奏');
      } else if (scorePercentage >= 40) {
        feedback2 = (t.shadowing.feedback_ok || '发音准确率: {percent}%，还不错').replace('{percent}', String(scorePercentage));
        suggestions2.push(t.shadowing.suggestions?.listen_more || '建议多听几遍原文');
        suggestions2.push(t.shadowing.suggestions?.mind_word_pronunciation || '注意单词的发音');
        suggestions2.push(t.shadowing.suggestions?.slow_down || '可以尝试放慢语速');
      } else {
        feedback2 = (t.shadowing.feedback_need_improvement || '发音准确率: {percent}%，需要加强练习').replace('{percent}', String(scorePercentage));
        suggestions2.push(t.shadowing.suggestions?.listen_before_practice || '建议先听几遍原文再练习');
        suggestions2.push(t.shadowing.suggestions?.each_word_pronunciation || '注意每个单词的发音');
        suggestions2.push(t.shadowing.suggestions?.practice_in_sections || '可以分段练习');
        suggestions2.push(t.shadowing.suggestions?.practice_more || '多练习几次会更好');
      }
      if (textToScore.length < originalText.length * 0.3) {
        suggestions2.push(t.shadowing.suggestions?.transcription_too_short || '转录内容较少，建议重新录音');
      } else if (textToScore.length < originalText.length * 0.6) {
        suggestions2.push(t.shadowing.suggestions?.transcription_incomplete || '转录内容不完整，建议重新录音');
      }
      const fullFeedback_i18n = feedback2 + (suggestions2.length > 0 ? `\n\n${t.shadowing.suggestions_title_text || '建议：'}\n• ` + suggestions2.join('\n• ') : '');

      const scoringResult = {
        score: scorePercentage,
        accuracy: normalizedAccuracy,
        feedback: fullFeedback_i18n,
        transcription: textToScore,
        originalText: originalText,
      };

      setScoringResult(scoringResult);
      setShowSentenceComparison(false); // 不再显示逐句对比
    } catch (error) {
      console.error('评分失败:', error);
      const errMsg = error instanceof Error ? error.message : (t.shadowing.unknown_error || '未知错误');
      alert((t.shadowing.scoring_failed || '评分失败: {error}').replace('{error}', errMsg));
    } finally {
      setIsScoring(false);
    }
  };

  // 简单直观的句子对比分析
  const performSimpleAnalysis = (originalText: string, transcribedText: string) => {
    // 检查是否为中文
    const isChinese = /[\u4e00-\u9fff]/.test(originalText);

    let originalSentences: string[];
    let cleanTranscribed: string[];

    if (isChinese) {
      // 中文处理：按A:, B:分割对话
      originalSentences = originalText
        .split(/(?=[AB]:)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // 清理转录文本（中文）
      cleanTranscribed = transcribedText
        .replace(/[。！？、，\s]+/g, '')
        .split('')
        .filter((c) => c.length > 0);
    } else {
      // 英文处理：按A:, B:分割
      originalSentences = originalText
        .split(/(?=[A-Z]:)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      // 清理转录文本（英文）
      cleanTranscribed = transcribedText
        .replace(/[.!?,\s]+/g, ' ')
        .split(' ')
        .map((w) => w.toLowerCase().trim())
        .filter((w) => w.length > 0);
    }

    const sentenceAnalysis: Array<{
      sentence: string;
      status: 'correct' | 'partial' | 'missing';
      issues: string[];
      score: number;
    }> = [];

    // 分析每个句子
    for (const sentence of originalSentences) {
      let cleanSentence: string[];

      if (isChinese) {
        // 中文处理：按字符分割，移除角色标识符
        cleanSentence = sentence
          .replace(/^[AB]:\s*/, '') // 移除角色标识符
          .replace(/[。！？、，\s]+/g, '')
          .split('')
          .filter((c) => c.length > 0);
      } else {
        // 英文处理：按单词分割
        cleanSentence = sentence
          .replace(/^[A-Z]:\s*/, '') // 移除角色标识符
          .replace(/[.!?,\s]+/g, ' ')
          .split(' ')
          .map((w) => w.toLowerCase().trim())
          .filter((w) => w.length > 0);
      }

      // 计算句子匹配度
      const matchedItems = cleanSentence.filter((item) => cleanTranscribed.includes(item));

      const matchRatio = cleanSentence.length > 0 ? matchedItems.length / cleanSentence.length : 0;

      let status: 'correct' | 'partial' | 'missing';
      const issues: string[] = [];

      if (matchRatio >= 0.9) {
        status = 'correct';
      } else if (matchRatio >= 0.5) {
        status = 'partial';
        // 找出遗漏的内容
        const missingItems = cleanSentence.filter((item) => !cleanTranscribed.includes(item));
        if (missingItems.length > 0) {
          if (isChinese) {
            issues.push((t.shadowing.issue_missing_chars || '遗漏字符: {items}').replace('{items}', missingItems.join('')));
          } else {
            issues.push((t.shadowing.issue_missing_words || '遗漏单词: {items}').replace('{items}', missingItems.join(', ')));
          }
        }
      } else {
        status = 'missing';
        issues.push(t.shadowing.issue_most_missing || '大部分内容未说出');
      }

      // 检查发音错误（仅英文）
      if (!isChinese) {
        const pronunciationErrors = checkPronunciationErrors(cleanSentence, cleanTranscribed);
        if (pronunciationErrors.length > 0) {
          issues.push(...pronunciationErrors);
        }
      }

      sentenceAnalysis.push({
        sentence: sentence.replace(/^[AB]:\s*/, ''), // 移除角色标识符
        status,
        issues,
        score: Math.round(matchRatio * 100),
      });
    }

    const overallScore =
      sentenceAnalysis.length > 0
        ? Math.round(
            sentenceAnalysis.reduce((sum, s) => sum + s.score, 0) / sentenceAnalysis.length,
          )
        : 0;

    return { sentenceAnalysis, overallScore };
  };

  // 检查发音错误
  const checkPronunciationErrors = (originalWords: string[], transcribedWords: string[]) => {
    const errors: string[] = [];

    // 常见发音错误检查
    const commonErrors = [
      { original: 'today', error: 'tomorrow' },
      { original: 'tomorrow', error: 'today' },
      { original: 'no', error: 'now' },
      { original: 'now', error: 'no' },
      { original: 'it', error: 'is' },
      { original: 'is', error: 'it' },
    ];

    for (const error of commonErrors) {
      if (originalWords.includes(error.original) && transcribedWords.includes(error.error)) {
        const msg = (t.shadowing.pronounced_as || '"{original}" 说成了 "{error}"')
          .replace('{original}', error.original)
          .replace('{error}', error.error);
        errors.push(msg);
      }
    }

    return errors;
  };

  // 统一的完成并保存函数 - 整合session保存和练习结果记录
  const unifiedCompleteAndSave = async () => {
    if (!currentItem) return;

    setSaving(true);

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

    // 2. 立即设置练习完成状态
    setPracticeComplete(true);

    try {
      const headers = await getAuthHeaders();

      // 3. 自动检查和保存生词
      let savedVocabCount = 0;
      if (selectedWords.length > 0) {
        try {
          const entries = selectedWords.map((item) => ({
            term: item.word,
            lang: item.lang,
            native_lang: userProfile?.native_lang || language, // 优先使用用户母语，否则使用界面语言
            source: 'shadowing',
            source_id: currentItem.id,
            context: item.context,
            tags: [],
            explanation: item.explanation || null,
          }));

          const vocabResponse = await fetch('/api/vocab/bulk_create', {
            method: 'POST',
            headers,
            body: JSON.stringify({ entries }),
          });

          if (vocabResponse.ok) {
            savedVocabCount = entries.length;
            // 将本次选中的生词移动到之前的生词中
            setPreviousWords((prev) => [...prev, ...selectedWords]);
            setSelectedWords([]);
            // 自动保存了生词
          } else {
            console.warn('自动保存生词失败');
          }
        } catch (vocabError) {
          console.warn('自动保存生词时出错:', vocabError);
        }
      }

      // 4. 异步保存练习session（包含所有数据）
      const allWords = [...previousWords, ...selectedWords];

      // 检查并处理录音保存
      let finalRecordings = [...currentRecordings];

      if (
        audioRecorderRef.current &&
        typeof audioRecorderRef.current.uploadCurrentRecording === 'function'
      ) {
        // 检查是否有未保存的录音
        const hasUnsavedRecording = audioRecorderRef.current.hasUnsavedRecording?.() || false;

        if (hasUnsavedRecording) {
          try {
            // 自动上传未保存的录音
            await audioRecorderRef.current.uploadCurrentRecording();

            // 等待录音状态更新
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // 重新获取最新的录音数据
            if (currentItem) {
              try {
                const headers = await getAuthHeaders();
                const sessionResponse = await fetch(
                  `/api/shadowing/session?item_id=${currentItem.id}`,
                  {
                    headers,
                  },
                );
                if (sessionResponse.ok) {
                  const sessionData = await sessionResponse.json();
                  if (sessionData.session?.recordings) {
                    // 更新本地状态和使用最新的录音数据
                    setCurrentRecordings(sessionData.session.recordings);
                    finalRecordings = sessionData.session.recordings;
                  }
                }
              } catch (error) {
                console.warn('刷新录音状态失败:', error);
              }
            }
          } catch (error) {
            console.warn('录音保存失败:', error);
          }
        }
      }

      const sessionResponse = await fetch('/api/shadowing/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          status: 'completed',
          recordings: finalRecordings,
          picked_preview: allWords,
          notes: {},
        }),
      });

      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setCurrentSession(sessionData.session);
      } else {
        const errorText = await sessionResponse.text();
        console.error('保存练习session失败:', {
          status: sessionResponse.status,
          error: errorText,
        });
      }

      // 5. 如果有评分结果，记录练习结果
      if (scoringResult && practiceStartTime) {
        const metrics = {
          accuracy: scoringResult.score || 0,
          complete: true,
          time_sec: practiceTime,
          scoring_result: scoringResult,
        };

        const attemptResponse = await fetch('/api/shadowing/attempts', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_id: currentItem.id,
            lang: currentItem.lang,
            level: currentItem.level,
            metrics,
          }),
        });

        if (!attemptResponse.ok) {
          console.warn('记录练习结果失败，但本地状态已更新');
        }
      }

      // 6. 显示完成消息（包含保存的详细信息）
      let message = t.shadowing.practice_done_title || '练习已完成';
      const details = [];

      if (currentRecordings.length > 0) {
        details.push(`${currentRecordings.length} 个录音`);
      }
      if (savedVocabCount > 0) {
        details.push(`${savedVocabCount} 个生词`);
      }
      if (scoringResult) {
        details.push(`准确率: ${(scoringResult.score || 0).toFixed(1)}%`);
      }

      if (details.length > 0) {
        message += ` (已保存: ${details.join(', ')})`;
      }

      alert(message);

      // 7. 清除相关缓存并刷新题库列表以确保数据同步
      // 等待一小段时间确保数据库写入完成，然后清除缓存并刷新
      setTimeout(async () => {
        try {
          // 清除shadowing:catalog相关的缓存
          await fetch('/api/cache/invalidate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              pattern: 'shadowing:catalog*',
            }),
          });
        } catch (cacheError) {
          console.warn('Failed to clear cache:', cacheError);
        }
        // 刷新题库列表
        fetchItems();
      }, 500);
    } catch (error) {
      console.error('Failed to save practice data:', error);
      // 即使保存失败，本地状态已经更新，用户体验不受影响
      alert(t.shadowing.messages?.practice_completed_delayed_sync || '练习已完成，但部分数据同步可能延迟');
    } finally {
      setSaving(false);
    }
  };

  // 批量获取词汇解释
  const batchFetchExplanations = async (words: string[]) => {
    const explanations: Record<string, any> = {};
    
    try {
      // 并行获取所有词汇的解释
      const promises = words.map(async (word) => {
        try {
          const data = await searchVocabWithCache(word, getAuthHeaders);
          if (data?.entries && data.entries.length > 0 && data.entries[0].explanation) {
            explanations[word] = data.entries[0].explanation;
          }
        } catch (error) {
          console.warn(`获取 ${word} 解释失败:`, error);
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('批量获取词汇解释失败:', error);
    }
    
    return explanations;
  };

  // 导入到生词本
  const importToVocab = async () => {
    if (selectedWords.length === 0) {
      alert(t.shadowing.no_new_words_to_import || '没有新的生词可以导入');
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
        alert((t.shadowing.import_success || '成功导入 {count} 个生词到生词本！').replace('{count}', String(entries.length)));

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
        alert((t.shadowing.import_failed || '导入失败: {error}').replace('{error}', String(errorData.error)));
      }
    } catch (error) {
      console.error('导入生词失败:', error);
      alert((t.shadowing.import_failed || '导入失败: {error}').replace('{error}', String((error as Error)?.message || '')));
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

  // 移动端检测
  const { actualIsMobile } = useMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // 引导提示状态
  const [showGuide, setShowGuide] = useState(false);
  
  // 快捷键帮助弹窗状态
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // 步骤提示展开状态
  const [stepTipExpanded, setStepTipExpanded] = useState(false);
  
  // 滚动方向检测（用于智能隐藏顶部导航）
  const { scrollDirection, scrollY } = useScrollDirection({
    threshold: 10,
    enabled: actualIsMobile,
  });
  
  // 顶部导航栏显示状态
  const [showHeader, setShowHeader] = useState(true);
  
  // 更新顶部导航栏显示状态
  useEffect(() => {
    if (!actualIsMobile) {
      setShowHeader(true);
      return;
    }
    
    // 在顶部时始终显示
    if (scrollY < 50) {
      setShowHeader(true);
      return;
    }
    
    // 根据滚动方向决定显示/隐藏
    if (scrollDirection === 'down') {
      setShowHeader(false);
    } else if (scrollDirection === 'up') {
      setShowHeader(true);
    }
  }, [scrollDirection, scrollY, actualIsMobile]);
  
  // 主内容区域引用（用于手势检测）
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // 手势检测：左右滑动切换题目
  useSwipeGesture(mainContentRef as RefObject<HTMLElement>, {
    enabled: actualIsMobile && !!currentItem,
    threshold: 80,
    onSwipeLeft: () => {
      // 向左滑动：下一题
      handleNext();
    },
    onSwipeRight: () => {
      // 向右滑动：上一题
      handlePrev();
    },
  });
  
  // 返回顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // 切换到下一题
  const handleNext = () => {
    if (!filteredItems.length || !currentItem) return;
    const currentIndex = filteredItems.findIndex((item) => item.id === currentItem.id);
    if (currentIndex < filteredItems.length - 1) {
      loadItem(filteredItems[currentIndex + 1]);
      scrollToTop();
    }
  };
  
  // 切换到上一题
  const handlePrev = () => {
    if (!filteredItems.length || !currentItem) return;
    const currentIndex = filteredItems.findIndex((item) => item.id === currentItem.id);
    if (currentIndex > 0) {
      loadItem(filteredItems[currentIndex - 1]);
      scrollToTop();
    }
  };
  
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

  // 渲染左侧题库面板内容（桌面端）
  const renderLeftPanelContent = () => {
    return (
      <Card className={`min-h-full flex flex-col bg-white/80 backdrop-blur-sm border-0 rounded-2xl relative transition-all ${
        showGuide && !currentItem && !sidebarCollapsed
          ? 'shadow-[0_0_30px_rgba(139,92,246,0.4)] ring-2 ring-violet-400/30'
          : 'shadow-xl'
      }`}>
        {/* 柔和呼吸光效 */}
        {showGuide && !currentItem && !sidebarCollapsed && (
          <div className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none z-10">
            <div className="absolute inset-0 rounded-2xl bg-violet-400/15 blur-xl"></div>
          </div>
        )}
        
        {/* 标题和折叠按钮 */}
        <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-t-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-xl bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  {t.shadowing.shadowing_vocabulary || 'Shadowing 题库'}
                </h3>
                <p className="text-xs text-white/80 mt-0.5">{t.shadowing.shadowing_practice || 'Shadowing 练习'}</p>
              </div>
            </div>
            <button
              onClick={() => fetchItems()}
              className="text-white/80 hover:text-white p-2.5 rounded-lg hover:bg-white/20 transition-all ml-2 hover:shadow-md"
              title={t.shadowing.refresh_vocabulary || '刷新题库'}
              disabled={loading}
            >
              <div className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>🔄</div>
            </button>
          </div>
        </div>

        {/* 过滤器 */}
        <div className="p-6 bg-gray-50/50 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
              <Filter className="w-3 h-3 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-gray-700">{t.shadowing.filter}</span>
          </div>

          <FilterLanguageSelector
            value={lang}
            onChange={setLang}
            allowedLanguages={permissions.allowed_languages}
            className="h-10"
          />

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.level}</Label>
            <Select
              value={level?.toString() || 'all'}
              onValueChange={(v) => setLevel(v === 'all' ? null : parseInt(v))}
            >
              <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <SelectValue placeholder="全部等级" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                <SelectItem value="all" className="rounded-lg">全部等级</SelectItem>
                {permissions.allowed_levels.includes(1) && <SelectItem value="1" className="rounded-lg">L1 - 初级</SelectItem>}
                {permissions.allowed_levels.includes(2) && <SelectItem value="2" className="rounded-lg">L2 - 初中级</SelectItem>}
                {permissions.allowed_levels.includes(3) && <SelectItem value="3" className="rounded-lg">L3 - 中级</SelectItem>}
                {permissions.allowed_levels.includes(4) && <SelectItem value="4" className="rounded-lg">L4 - 中高级</SelectItem>}
                {permissions.allowed_levels.includes(5) && <SelectItem value="5" className="rounded-lg">L5 - 高级</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {recommendedLevel && (
            <div className="relative p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-xl border-2 border-amber-200 shadow-md overflow-hidden animate-pulse">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-200/30 to-amber-200/30 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                    <Star className="w-4 h-4 text-white fill-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold text-amber-900">为你推荐</span>
                  </div>
                </div>
                <div className="text-lg font-bold text-amber-900 flex items-baseline gap-2 mb-2">
                  <span>等级</span>
                  <span className="text-2xl text-orange-600">L{recommendedLevel}</span>
                </div>
                <p className="text-xs text-amber-700 mb-3">根据你的学习进度推荐</p>
                {level !== recommendedLevel && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLevel(recommendedLevel)}
                    className="h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm"
                  >
                    使用推荐等级
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.practice_status}</Label>
            <Select
              value={practiced}
              onValueChange={(v: 'all' | 'practiced' | 'unpracticed') => setPracticed(v)}
            >
              <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                <SelectItem value="all" className="rounded-lg">全部</SelectItem>
                <SelectItem value="unpracticed" className="rounded-lg">未练习</SelectItem>
                <SelectItem value="practiced" className="rounded-lg">已练习</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.genre}</Label>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                {GENRE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="rounded-lg">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.major_theme}</Label>
            <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
              <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                <SelectItem value="all" className="rounded-lg">全部大主题</SelectItem>
                {themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id} className="rounded-lg">
                    {theme.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.minor_theme}</Label>
            <Select
              value={selectedSubtopicId}
              onValueChange={setSelectedSubtopicId}
              disabled={selectedThemeId === 'all'}
            >
              <SelectTrigger className={`h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow ${selectedThemeId === 'all' ? 'opacity-50' : ''}`}>
                <SelectValue placeholder={selectedThemeId === 'all' ? '请先选择大主题' : '选择小主题'} />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                <SelectItem value="all" className="rounded-lg">全部小主题</SelectItem>
                {subtopics.map((subtopic) => (
                  <SelectItem key={subtopic.id} value={subtopic.id} className="rounded-lg">
                    {subtopic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">{t.shadowing.search || '搜索'}</Label>
            <Input
              placeholder={t.shadowing.search_placeholder || '搜索标题、主题...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={getRandomUnpracticed}
              className="flex-1 h-10 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              {t.shadowing.random}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={getNextUnpracticed}
              className="flex-1 h-10 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-violet-100 hover:border-purple-300 rounded-xl shadow-sm hover:shadow-md transition-all"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              {t.shadowing.next_question}
            </Button>
          </div>
        </div>

        {/* 统计信息 */}
        <div className="p-4 space-y-3 bg-gray-50/50">
          <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium mb-1">总题数</p>
                <p className="text-2xl font-bold text-blue-900">{filteredItems.length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-50 to-green-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs text-green-600 font-medium mb-1">已完成</p>
                <p className="text-2xl font-bold text-green-900">{filteredItems.filter((item) => item.isPracticed).length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="w-full bg-green-200/50 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${filteredItems.length > 0 ? (filteredItems.filter((item) => item.isPracticed).length / filteredItems.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-green-600 mt-1">
              {filteredItems.length > 0 ? Math.round((filteredItems.filter((item) => item.isPracticed).length / filteredItems.length) * 100) : 0}%
            </p>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium mb-1">草稿中</p>
                <p className="text-2xl font-bold text-amber-900">{filteredItems.filter((item) => item.status === 'draft' && !item.isPracticed).length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <FileEdit className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
          
          <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">未开始</p>
                <p className="text-2xl font-bold text-gray-900">{filteredItems.filter((item) => !item.isPracticed && item.status !== 'draft').length}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                <Circle className="w-5 h-5 text-gray-600" />
              </div>
            </div>
          </div>
        </div>

        {/* 题目列表 */}
        <div className="flex-1 overflow-y-auto" ref={desktopListScrollRef}>
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-sm text-gray-600 font-medium animate-pulse">加载中...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t.shadowing.no_questions_found || '没有找到题目'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{t.shadowing.search_adjust_filters_hint || '试试调整筛选条件或搜索关键词'}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLang('zh');
                  setLevel(null);
                  setPracticed('all');
                  setTheme('all');
                  setSelectedThemeId('all');
                  setSelectedSubtopicId('all');
                  setSearchQuery('');
                }}
                className="hover:bg-violet-50 hover:border-violet-300"
              >
                <Filter className="w-4 h-4 mr-2" />
                重置筛选
              </Button>
            </div>
          ) : (
            <div className="p-2">
              <Virtuoso
                customScrollParent={desktopListScrollRef.current ?? undefined}
                data={filteredItems}
                itemContent={(index, item) => {
                  const it = item as any;
                  return (
                    <div
                      key={it.id}
                      className={`p-3 mb-2 rounded border cursor-pointer transition-colors ${
                        currentItem?.id === it.id
                          ? 'bg-blue-50 border-blue-200'
                          : it.isPracticed
                            ? 'bg-green-50 border-green-200 hover:bg-green-100'
                            : it.status === 'draft'
                              ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                              : 'hover:bg-gray-50'
                      }`}
                      onClick={() => loadItem(it)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {it.isPracticed ? (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : it.status === 'draft' ? (
                              <FileText className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            )}
                            <span className="text-sm text-gray-500 font-medium min-w-[1.5rem]">{index + 1}.</span>
                            <span className="text-sm font-medium truncate">
                              {it.subtopic ? it.subtopic.title : it.title}
                              {it.isPracticed && (<span className="ml-1 text-green-600">✓</span>)}
                              {it.status === 'draft' && (<span className="ml-1 text-yellow-600">📝</span>)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {(LANG_LABEL as any)[it.lang]} • L{it.level}
                            {it.cefr && ` • ${it.cefr}`}
                            {it.isPracticed && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{t.shadowing.completed}</span>
                            )}
                            {it.status === 'draft' && !it.isPracticed && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{t.shadowing.draft}</span>
                            )}
                          </div>
                          {it.isPracticed && (
                            <div className="mt-2">
                              <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> {it.stats.recordingCount} 录音</span>
                                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {it.stats.vocabCount} 生词</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(it.stats.practiceTime)}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }} /></div>
                            </div>
                          )}
                          {!it.isPracticed && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${it.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-300'}`} style={{ width: it.status === 'draft' ? '50%' : '0%' }} /></div>
                              <div className="text-xs text-gray-400 mt-1">{it.status === 'draft' ? t.shadowing.draft : t.shadowing.not_started}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </div>
      </Card>
    );
  };

  // 键盘快捷键配置
  const keyboardShortcuts: KeyboardShortcut[] = [
    {
      key: ' ',
      description: '播放/暂停音频',
      category: '音频控制',
      action: () => {
        playAudio();
      },
    },
    {
      key: 'ArrowLeft',
      description: '上一题',
      category: '导航',
      action: () => {
        const currentIndex = filteredItems.findIndex((item) => item.id === currentItem?.id);
        if (currentIndex > 0) {
          loadItem(filteredItems[currentIndex - 1]);
        }
      },
    },
    {
      key: 'ArrowRight',
      description: '下一题',
      category: '导航',
      action: () => {
        const currentIndex = filteredItems.findIndex((item) => item.id === currentItem?.id);
        if (currentIndex >= 0 && currentIndex < filteredItems.length - 1) {
          loadItem(filteredItems[currentIndex + 1]);
        }
      },
    },
    {
      key: 't',
      description: '切换翻译显示',
      category: '显示控制',
      action: () => setShowTranslation((prev) => !prev),
    },
    {
      key: 'v',
      description: '切换生词模式',
      category: '显示控制',
      action: () => setIsVocabMode((prev) => !prev),
    },
    {
      key: 's',
      description: '保存草稿',
      category: '操作',
      action: saveDraft,
    },
    {
      key: 'Enter',
      ctrl: true,
      cmd: true,
      description: '完成并保存',
      category: '操作',
      action: unifiedCompleteAndSave,
    },
    {
      key: '?',
      shift: true,
      description: '显示快捷键帮助',
      category: '帮助',
      action: () => setShowShortcutsHelp(true),
    },
    {
      key: '1',
      description: '跳转到步骤1',
      category: '步骤导航',
      action: () => setStep(1),
    },
    {
      key: '2',
      description: '跳转到步骤2',
      category: '步骤导航',
      action: () => setStep(2),
    },
    {
      key: '3',
      description: '跳转到步骤3',
      category: '步骤导航',
      action: () => setStep(3),
    },
    {
      key: '4',
      description: '跳转到步骤4',
      category: '步骤导航',
      action: () => setStep(4),
    },
    {
      key: '5',
      description: '跳转到步骤5',
      category: '步骤导航',
      action: () => setStep(4),
    },
  ];

  // 使用键盘快捷键（仅在桌面端启用）
  useKeyboardShortcuts({
    shortcuts: keyboardShortcuts,
    enabled: !actualIsMobile && !!currentItem,
  });

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
      <Container>
        <Breadcrumbs items={[{ href: '/', label: t.nav.home }, { label: t.shadowing.title }]} />

        {/* 移动端布局 */}
        {actualIsMobile ? (
          <div className="space-y-6" ref={mainContentRef} style={{ willChange: 'scroll-position' }}>
            {/* 手机端顶部工具栏 - 智能隐藏版 */}
            <div 
              className={`sticky top-0 z-30 transition-transform duration-300 ${
                showHeader ? 'translate-y-0' : '-translate-y-full'
              }`}
              style={{ willChange: 'transform' }}
            >
              <div className="flex items-center justify-between bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-white/20">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {t.shadowing.shadowing_practice || 'Shadowing 练习'}
                  </h1>
                </div>
              </div>
              
              {/* 题库按钮 - 柔和光效引导 */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMobileSidebarOpen(true);
                    hideGuide();
                  }}
                  className={`flex items-center gap-1.5 bg-white/50 hover:bg-white/80 border-white/30 h-9 px-3 transition-all ${
                    showGuide 
                      ? 'shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/30 ring-offset-2' 
                      : 'shadow-md'
                  }`}
                  aria-label={t.shadowing.shadowing_vocabulary}
                >
                  <Menu className="w-4 h-4" />
                  <span className="text-sm">题库</span>
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

            {/* 移动端步骤栏与提示（置于标题下方） */}
            {gatingActive && (
              <Card className="p-4 bg-white border-0 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <PracticeStepper
                    size="sm"
                    currentStep={step}
                    onStepChange={(s)=> setStep(s)}
                    maxStepAllowed={step}
                    labels={[t.shadowing.step1_tip, t.shadowing.step2_tip, t.shadowing.step3_tip, t.shadowing.step5_tip].map(x=> String(x || 'Step'))}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep((s)=> (Math.max(1, (s as number)-1) as 1|2|3|4))} disabled={step===1}>Back</Button>
                    <Button size="sm" onClick={() => setStep((s)=> (Math.min(4, (s as number)+1) as 1|2|3|4))} disabled={step===4}>Next</Button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-700">
                  {step===1 && t.shadowing.step1_tip}
                  {step===2 && t.shadowing.step2_tip}
                  {step===3 && t.shadowing.step3_tip}
                  {step===4 && t.shadowing.step5_tip}
                </div>
              </Card>
            )}

            {/* 手机端侧边栏遮罩 */}
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}

            {/* 手机端侧边栏 - 优化宽度 */}
            <div
              className={`fixed top-0 left-0 h-full w-[90vw] max-w-[360px] bg-white/95 backdrop-blur-xl z-50 transform transition-all duration-300 shadow-2xl border-r border-white/20 ${
                mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                <div className="flex-1 overflow-y-auto bg-gray-50/50">
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

                      {/* 推荐等级显示 - 紧凑版 */}
                      {recommendedLevel && (
                        <div className="relative p-3 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-xl border border-amber-200 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                                <Star className="w-3 h-3 text-white fill-white" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-amber-900">推荐 L{recommendedLevel}</p>
                                <p className="text-[10px] text-amber-600">根据学习进度</p>
                              </div>
                            </div>
                            {level !== recommendedLevel && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLevel(recommendedLevel)}
                                className="h-7 text-xs px-2 bg-amber-500 hover:bg-amber-600 text-white border-0"
                              >
                                使用
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

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
                          onChange={(e) => setSearchQuery(e.target.value)}
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
                        className="flex-1 h-10 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <Shuffle className="w-4 h-4 mr-2" />
                        {t.shadowing.random}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={getNextUnpracticed}
                        className="flex-1 h-10 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-violet-100 hover:border-purple-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        {t.shadowing.next_question}
                      </Button>
                    </div>
                  </div>

                  {/* 统计信息 - 紧凑横向卡片 */}
                  <CompactStatsCards
                    totalCount={filteredItems.length}
                    completedCount={filteredItems.filter((item) => item.isPracticed).length}
                    draftCount={filteredItems.filter((item) => item.status === 'draft' && !item.isPracticed).length}
                    unstartedCount={filteredItems.filter((item) => !item.isPracticed && item.status !== 'draft').length}
                  />

                  {/* 题目列表 */}
                  <div className="flex-1 overflow-y-auto" ref={mobileListScrollRef}>
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
                          itemContent={(index, item) => {
                            const it = item as any;
                            return (
                              <div
                                key={it.id}
                                className={`p-4 mb-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                                  currentItem?.id === it.id
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
                                    <div className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">{it.text.substring(0, 60)}...</div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${it.lang === 'en' ? 'bg-blue-100 text-blue-700' : it.lang === 'ja' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{(LANG_LABEL as any)[it.lang]}</span>
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

            {/* 手机端主内容区域 */}
            <div className="space-y-4">
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
                          <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step===1?'bg-blue-600 text-white':'bg-gray-100 text-gray-600'}`}>1 盲听</span>
                          <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step===2?'bg-blue-600 text-white':'bg-gray-100 text-gray-600'}`}>2 原文+翻译</span>
                          <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step===3?'bg-blue-600 text-white':'bg-gray-100 text-gray-600'}`}>3 生词</span>
                          <span className={`px-2 py-1 rounded text-[10px] whitespace-nowrap ${step===4?'bg-blue-600 text-white':'bg-gray-100 text-gray-600'}`}>4 录音</span>
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
                              onClick={() => setStep((s)=> (Math.max(1, (s as number)-1) as 1|2|3|4))} 
                              disabled={step===1}
                              className="flex-1 h-8 text-xs"
                            >
                              ← 上一步
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => setStep((s)=> (Math.min(4, (s as number)+1) as 1|2|3|4))} 
                              disabled={step===4}
                              className="flex-1 h-8 text-xs"
                            >
                              下一步 →
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                  {/* 题目信息 - 手机端优化 */}
                  <Card className="p-4 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-lg rounded-2xl">
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                            {currentItem.title}
                          </h2>
                          {/* 标签 - 横向滚动布局 */}
                          <div className="flex items-center gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                            <span
                              className={`snap-start flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium ${
                                currentItem.lang === 'en'
                                  ? 'bg-blue-100 text-blue-700'
                                  : currentItem.lang === 'ja'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {LANG_LABEL[currentItem.lang]}
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

                      {/* 手机端操作按钮 - 统一高度h-14 */}
                      <div className="grid grid-cols-1 gap-3">
                        <Button
                          onClick={playAudio}
                          variant="outline"
                          size="lg"
                          className={`h-14 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all ${highlightPlay ? 'animate-pulse ring-2 ring-blue-400' : ''}`}
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 mr-2" />
                          ) : (
                            <Play className="w-5 h-5 mr-2" />
                          )}
                          {isPlaying ? '暂停' : t.shadowing.play_audio}
                        </Button>

                        <div className={`grid ${(!gatingActive || step === 4) ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={saveDraft}
                            disabled={saving}
                            className="h-14 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                          >
                            <Save className="w-5 h-5 mr-2" />
                            {saving ? t.common.loading : t.shadowing.save_draft}
                          </Button>

                          {(!gatingActive || step === 4) && (
                            <Button
                              size="lg"
                              onClick={unifiedCompleteAndSave}
                              disabled={saving}
                              className="h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
            {saving ? (t.shadowing.saving_modal_title || '保存中...') : '完成'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 生词选择模式切换（步骤2和3显示或完成后） */}
                    {(!gatingActive || step >= 2) && (
                    <div className="mb-4 space-y-3">
                      <Button
                        variant={isVocabMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsVocabMode(!isVocabMode)}
                        className={`w-full ${highlightVocab ? 'animate-pulse ring-2 ring-amber-400' : ''}`}
                      >
                        {isVocabMode ? t.shadowing.vocab_mode_on : t.shadowing.vocab_mode_off}
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
                      {step === 2 && currentItem.translations && currentItem.translations[translationLang] && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                          <div className="text-sm text-gray-600 mb-1">{t.shadowing.translation || '翻译'}</div>
                          <div className="whitespace-pre-wrap text-base text-gray-800">{currentItem.translations[translationLang]}</div>
                        </div>
                      )}
                      {isVocabMode ? (
                        <>
                          {/* ACU 模式或自由框选模式 */}
                          {isACUMode && currentItem?.notes?.acu_units ? (
                            <AcuText
                              text={currentItem.text}
                              lang={currentItem.lang}
                              units={currentItem.notes.acu_units}
                              onConfirm={handleWordSelect}
                              selectedWords={[...previousWords, ...selectedWords]}
                            />
                          ) : (
                            <SelectablePassage
                              text={(() => {
                                const normalize = (t: string) => {
                                  let s = (t || '')
                                    .replace(/\r\n/g, '\n')
                                    .replace(/\r/g, '\n')
                                    .replace(/<br\s*\/?\s*>/gi, '\n')
                                    .replace(/&#10;|&#13;/g, '\n');
                                  for (let i = 0; i < 3 && /\\\n/.test(s); i += 1) s = s.replace(/\\\n/g, '\n');
                                  return s;
                                };
                                return normalize(currentItem.text);
                              })()}
                              lang="zh"
                              onSelectionChange={handleTextSelection}
                              clearSelection={clearSelection}
                              disabled={false}
                              className="text-lg leading-loose"
                            />
                          )}
                          {selectedText && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-sm">
                                <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                                <div className="text-blue-600 font-semibold mb-1">
                                  {selectedText.word}
                                </div>
                                <div className="text-xs text-gray-600 mb-2">
                                  {selectedText.context}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={confirmAddToVocab}
                                    disabled={isAddingToVocab}
                                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isAddingToVocab ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                        添加中...
                                      </>
                                    ) : (
                                      '确认添加到生词本'
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelSelection}
                                    disabled={isAddingToVocab}
                                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    取消
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
                                        lang={currentItem?.lang || 'zh'}
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
                                  <div key={lineIndex} className="mb-2">
                                    {result}
                                  </div>
                                );
                              });
                            } else {
                              // 检查是否为韩语文本
                              const isKorean = /[\uac00-\ud7af]/.test(formattedText);
                              
                              if (isKorean) {
                                // 韩语文本处理：使用词边界检测
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
                                      if (i + w.length <= chars.length) {
                                        const substring = chars.slice(i, i + w.length).join('');
                                        if (substring === w) {
                                          // 韩语词边界检测：检查是否在词边界
                                          const isAtWordBoundary = isKoreanWordBoundary(
                                            chars, i, w.length, i + w.length
                                          );
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
                                          lang={currentItem?.lang || 'zh'}
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
                                    <div key={lineIndex} className="mb-2">
                                      {result}
                                    </div>
                                  );
                                });
                              } else {
                                // 英文文本也支持多词/整句短语高亮（按字符滑窗匹配）
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
                                          key={`${lineIndex}-${i}`} 
                                          word={word} 
                                          explanation={explanation}
                                          fromVocab={wordData?.fromVocab}
                                          vocabId={wordData?.vocabId}
                                          onRefresh={handleRefreshExplanation}
                                          lang={currentItem?.lang || 'zh'}
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
                                    <div key={lineIndex} className="mb-2">
                                      {result}
                                    </div>
                                  );
                                });
                              }
                            }
                          })()}
                        </div>
                      )}
                      </div>
                      {/* 底部渐变遮罩提示有更多内容 */}
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/80 to-transparent pointer-events-none rounded-b-xl"></div>
                    </div>
                    )}

                    {/* 音频播放器 - 优化版 */}
                    {currentItem.audio_url && (
                      <div className="mt-4">
                        <div className="mb-2 px-1">
                          <span className="text-sm font-medium text-gray-700">
                            {t.shadowing.original_audio_text || '原音频'}
                          </span>
                        </div>
                        <EnhancedAudioPlayer
                          ref={audioPlayerRef}
                          audioUrl={currentItem.audio_url}
                          onPlayStateChange={(playing) => setIsPlaying(playing)}
                          duration_ms={currentItem.duration_ms}
                        />
                      </div>
                    )}
                  </Card>

                  {/* 生词区域 - 手机端优化 - 折叠式 */}
                  {previousWords.length > 0 && (
                    <CollapsibleCard
                      title="之前的生词"
                      icon={<BookOpen className="w-5 h-5 text-gray-600" />}
                      badge={<span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{previousWords.length}</span>}
                      summary={`${previousWords.length}个生词`}
                      defaultOpen={false}
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
                            {isImporting ? (t.shadowing.importing || '导入中...') : (t.shadowing.import_to_vocab || '导入到生词本')}
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

                  {/* 翻译模块 - 移动端（仅步骤2显示或完成后） */}
                  {currentItem && (!gatingActive || step === 2) && (
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

                  {/* 逐句/分角色练习 */}
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

                  {/* 录音练习区域（移动端；仅步骤5或完成后） */}
                  {practiceMode !== 'role' && (!gatingActive || step >= 4) && (
                  <Card className="p-4">
                    <AudioRecorder
                      ref={audioRecorderRef}
                      sessionId={currentSession?.id}
                      existingRecordings={currentRecordings}
                      onRecordingAdded={handleRecordingAdded}
                      onRecordingDeleted={handleRecordingDeleted}
                      onTranscriptionReady={handleTranscriptionReady}
                      onRecordingSelected={handleRecordingSelected}
                      originalText={currentItem?.text}
                      language={currentItem?.lang || 'ja'}
                      scrollTargetId="shadowing-text"
                    />
                  </Card>
                  )}

                  {/* 评分区域（仅步骤5显示或完成后） */}
                  {!scoringResult && practiceMode !== 'role' && (!gatingActive || step >= 4) && (
                    <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">📊</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.practice_scoring || '练习评分'}
                          </h3>
                          <p className="text-sm text-gray-600">{t.shadowing.ai_scoring_subtitle || 'AI智能评分，精准分析发音'}</p>
                        </div>
                      </div>

                      {currentRecordings.length > 0 ? (
                        <div className="text-center space-y-4">
                          <div className="p-4 bg-white/80 rounded-xl border border-purple-200">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-gray-700 font-medium mb-2">
                              {t.shadowing.recording_completed || '录音完成！'}
                            </p>
                            <p className="text-sm text-gray-600">
                              {t.shadowing.recording_completed_message}
                            </p>
                          </div>
                          <Button
                            onClick={() => performScoring()}
                            disabled={isScoring}
                            className={`h-12 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all w-full ${highlightScore ? 'animate-pulse ring-2 ring-purple-400' : ''}`}
                          >
                            {isScoring ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {t.shadowing.scoring_in_progress || '评分中...'}
                              </>
                            ) : (
                              <>
                                <span className="mr-2">🚀</span>
                                {t.shadowing.start_scoring || '开始评分'}
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mic className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            {t.shadowing.no_recording_yet || '还没有录音'}
                          </h3>
                          <p className="text-gray-500 leading-relaxed">
                            {t.shadowing.complete_recording_first}
                          </p>
                        </div>
                      )}
                    </Card>
                  )}

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
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 rounded-lg"
                        >
                          {isScoring
                            ? t.shadowing.re_scoring_in_progress || '重新评分中...'
                            : t.shadowing.re_score || '重新评分'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-6">
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
                                    className={`p-3 rounded border text-sm ${
                                      (scoringResult.score || 0) >= 80
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

                                  // 使用简单句子分析（支持中文和英文）
                                  const simpleAnalysis = performSimpleAnalysis(
                                    scoringResult.originalText,
                                    scoringResult.transcription,
                                  );
                                  const { sentenceAnalysis, overallScore } = simpleAnalysis;

                                  return (
                                    <div>
                                      {/* 整体评分 */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">
                                          {t.shadowing.overall_score}:
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                          {overallScore}%
                                        </div>
                                      </div>

                                      {/* 句子分析 */}
                                      <div className="space-y-3">
                                        {sentenceAnalysis.map((sentence, idx) => (
                                          <div
                                            key={`sentence-${idx}-${sentence.sentence.substring(0, 20)}`}
                                            className={`p-3 rounded border ${
                                              sentence.status === 'correct'
                                                ? 'bg-green-50 border-green-200'
                                                : sentence.status === 'partial'
                                                  ? 'bg-yellow-50 border-yellow-200'
                                                  : 'bg-red-50 border-red-200'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm font-medium">
                                                {sentence.status === 'correct' && '✓ '}
                                                {sentence.status === 'partial' && '⚠ '}
                                                {sentence.status === 'missing' && '❌ '}
                                                {t.shadowing.sentence || '句子'} {idx + 1}
                                              </div>
                                              <div className="text-sm font-bold">
                                                {sentence.score}%
                                              </div>
                                            </div>

                                            <div className="text-sm mb-2">
                                              <span className="font-medium">
                                                {t.shadowing.original_text}:
                                              </span>
                                              <span className="text-gray-700">
                                                &ldquo;{sentence.sentence}&rdquo;
                                              </span>
                                            </div>

                                            {sentence.issues.length > 0 && (
                                              <div className="text-sm text-red-600">
                                                <div className="font-medium">
                                                  {t.shadowing.issues || '问题'}:
                                                </div>
                                                <ul className="list-disc list-inside space-y-1">
                                                  {sentence.issues.map((issue, issueIdx) => (
                                                    <li
                                                      key={`issue-${issueIdx}-${issue.substring(0, 20)}`}
                                                    >
                                                      {issue}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      <div className="mt-4 text-xs text-gray-500">
                                        💡{' '}
                                        {t.shadowing.analysis_based_on_sentence_level ||
                                          '分析基于句子级别，更直观地显示发音问题'}
                                      </div>
                                    </div>
                                  );

                                  return (
                                    <div>
                                      {/* 整体评分 */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">
                                          {t.shadowing.overall_score}:
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                          {overallScore}%
                                        </div>
                                      </div>

                                      {/* 句子分析 */}
                                      <div className="space-y-3">
                                        {sentenceAnalysis.map((sentence, idx) => (
                                          <div
                                            key={idx}
                                            className={`p-3 rounded border ${
                                              sentence.status === 'correct'
                                                ? 'bg-green-50 border-green-200'
                                                : sentence.status === 'partial'
                                                  ? 'bg-yellow-50 border-yellow-200'
                                                  : 'bg-red-50 border-red-200'
                                            }`}
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm font-medium">
                                                {sentence.status === 'correct' && '✓ '}
                                                {sentence.status === 'partial' && '⚠ '}
                                                {sentence.status === 'missing' && '❌ '}
                                                {t.shadowing.sentence || '句子'} {idx + 1}
                                              </div>
                                              <div className="text-sm font-bold">
                                                {sentence.score}%
                                              </div>
                                            </div>

                                            <div className="text-sm mb-2">
                                              <span className="font-medium">
                                                {t.shadowing.original_text}:
                                              </span>
                                              <span className="text-gray-700">
                                                &ldquo;{sentence.sentence}&rdquo;
                                              </span>
                                            </div>

                                            {sentence.issues.length > 0 && (
                                              <div className="text-xs">
                                                <span className="font-medium text-red-600">
                                                  {t.shadowing.issues || '问题'}:
                                                </span>
                                                <ul className="mt-1 space-y-1">
                                                  {sentence.issues.map((issue, issueIdx) => (
                                                    <li
                                                      key={`issue-${issueIdx}-${issue.substring(0, 20)}`}
                                                      className="text-red-600"
                                                    >
                                                      • {issue}
                                                    </li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      <div className="mt-3 text-xs text-gray-600">
                                        💡{' '}
                                        {t.shadowing.analysis_based_on_sentence_level ||
                                          '分析基于句子级别，更直观地显示发音问题'}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!practiceComplete && (!gatingActive || step === 4) && (
                        <div className="flex items-center gap-2 w-full mt-2">
                          <Button
                            onClick={unifiedCompleteAndSave}
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
                    </Card>
                  )}

                  {/* 完成后成功状态卡片：再练一次 / 返回题库（仅桌面端） */}
                  {practiceComplete && !actualIsMobile && (
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
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          onClick={() => {
                            setPracticeComplete(false);
                            setStep(1);
                            setScoringResult(null);
                            setIsVocabMode(false);
                            setShowTranslation(false);
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
                  )}
                </div>
              )}
            </div>
            {/* 底部悬浮迷你控制条（移动端；步骤<5显示） */}
            {currentItem && gatingActive && step < 5 && (
              <>
                <div className="h-16" />
                <div className="fixed bottom-3 left-0 right-0 z-40 px-4">
                  <div className="mx-auto max-w-[680px]">
                    <div className="bg-white/90 backdrop-blur border border-gray-200 shadow-lg rounded-2xl p-2 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep((s) => (Math.max(1, (s as number) - 1) as 1 | 2 | 3 | 4))}
                        disabled={step === 1}
                        className="flex items-center gap-2"
                        aria-label={t.shadowing.prev_step || '上一步'}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {t.shadowing.prev_step || '上一步'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={playAudio}
                        className="px-6"
                        aria-label={isPlaying ? (t.shadowing.pause || '暂停') : (t.shadowing.play || '播放')}
                      >
                        {isPlaying ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" /> {t.shadowing.pause || '暂停'}
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" /> {t.shadowing.play || '播放'}
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setStep((s) => (Math.min(4, (s as number) + 1) as 1 | 2 | 3 | 4))}
                        disabled={step === 4}
                        className="flex items-center gap-2"
                        aria-label={t.shadowing.next_step || '下一步'}
                      >
                        {t.shadowing.next_step || '下一步'}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 底部导航栏 - 仅在有题目时显示 */}
            {currentItem && (
              <BottomNavBar
                onPrevious={handlePrev}
                onNext={handleNext}
                onRecord={() => {
                  // 滚动到录音区域
                  const recordingSection = document.getElementById('recording-section');
                  recordingSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                onComplete={unifiedCompleteAndSave}
                isRecording={false}
                showPrevious={true}
                showNext={true}
                showRecord={step === 4 && !practiceComplete}
                showComplete={(!gatingActive || step === 4) && !practiceComplete}
                disabled={saving}
              />
            )}

            {/* 浮动操作按钮 */}
            {currentItem && (
              <FloatingActionButtons
                showVocabButton={step === 3 && !practiceComplete}
                isVocabMode={isVocabMode}
                onToggleVocabMode={() => setIsVocabMode(!isVocabMode)}
                showTranslationButton={step === 2 && !practiceComplete}
                showTranslation={showTranslation}
                onToggleTranslation={() => setShowTranslation(!showTranslation)}
                showScrollToTop={scrollY > 300}
                onScrollToTop={scrollToTop}
              />
            )}
          </div>
        ) : (
          /* 桌面端布局 - 优化滚动体验 */
          <div className="flex gap-6 min-h-[700px]">
            {/* 左侧题库列表 */}
            <div
              className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex-shrink-0 transition-all duration-300 max-h-[85vh] overflow-y-auto`}
            >
              <Card className={`min-h-full flex flex-col bg-white/80 backdrop-blur-sm border-0 rounded-2xl relative transition-all ${
                showGuide && !currentItem && !sidebarCollapsed
                  ? 'shadow-[0_0_30px_rgba(139,92,246,0.4)] ring-2 ring-violet-400/30'
                  : 'shadow-xl'
              }`}>
                {/* 柔和呼吸光效 */}
                {showGuide && !currentItem && !sidebarCollapsed && (
                  <div className="absolute inset-0 rounded-2xl animate-pulse pointer-events-none z-10">
                    <div className="absolute inset-0 rounded-2xl bg-violet-400/15 blur-xl"></div>
                  </div>
                )}
                {/* 标题和折叠按钮 - 美化版 */}
                <div className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-t-2xl relative overflow-hidden">
                  {/* 装饰性背景光晕 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
                  
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {!sidebarCollapsed && (
                        <>
                          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shadow-lg backdrop-blur-sm">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                              {t.shadowing.shadowing_vocabulary || 'Shadowing 题库'}
                            </h3>
                          <p className="text-xs text-white/80 mt-0.5">{t.shadowing.shadowing_practice || 'Shadowing 练习'}</p>
                          </div>
                        </>
                      )}
                      {!sidebarCollapsed && (
                        <button
                          onClick={() => fetchItems()}
                          className="text-white/80 hover:text-white p-2.5 rounded-lg hover:bg-white/20 transition-all ml-2 hover:shadow-md"
                          title={t.shadowing.refresh_vocabulary || '刷新题库'}
                          disabled={loading}
                        >
                          <div className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}>🔄</div>
                        </button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                      className="text-white hover:bg-white/20 hover:shadow-md transition-all"
                      aria-label={sidebarCollapsed ? (t.common.expand || '展开') : (t.common.collapse || '折叠')}
                    >
                      {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>

                {!sidebarCollapsed && (
                  <>
                    {/* 过滤器 */}
                    <div className="p-6 bg-gray-50/50 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Filter className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {t.shadowing.filter}
                        </span>
                      </div>

                      {/* 语言选择 */}
                      <FilterLanguageSelector
                        value={lang}
                        onChange={setLang}
                        allowedLanguages={permissions.allowed_languages}
                        className="h-10"
                      />

                      {/* 等级选择 */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          {t.shadowing.level}
                        </Label>
                        <Select
                          value={level?.toString() || 'all'}
                          onValueChange={(v) => setLevel(v === 'all' ? null : parseInt(v))}
                        >
                          <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <SelectValue placeholder="全部等级" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                            <SelectItem value="all" className="rounded-lg">
                              全部等级
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

                      {/* 推荐等级显示 - 美化版 */}
                      {recommendedLevel && (
                        <div className="relative p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 rounded-xl border-2 border-amber-200 shadow-md overflow-hidden animate-pulse">
                          {/* 装饰性闪光效果 */}
                          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-200/30 to-amber-200/30 rounded-full blur-2xl" />
                          
                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                <Star className="w-4 h-4 text-white fill-white" />
                              </div>
                              <div className="flex items-center gap-1">
                                <Sparkles className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-bold text-amber-900">为你推荐</span>
                              </div>
                            </div>
                            <div className="text-lg font-bold text-amber-900 flex items-baseline gap-2 mb-2">
                              <span>等级</span>
                              <span className="text-2xl text-orange-600">L{recommendedLevel}</span>
                            </div>
                            <p className="text-xs text-amber-700 mb-3">根据你的学习进度推荐</p>
                            {level !== recommendedLevel && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setLevel(recommendedLevel)}
                                className="h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm"
                              >
                                使用推荐等级
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 练习状态 */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
                          {t.shadowing.practice_status}
                        </Label>
                        <Select
                          value={practiced}
                          onValueChange={(v: 'all' | 'practiced' | 'unpracticed') =>
                            setPracticed(v)
                          }
                        >
                          <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                            <SelectItem value="all" className="rounded-lg">
                              全部
                            </SelectItem>
                            <SelectItem value="unpracticed" className="rounded-lg">
                              未练习
                            </SelectItem>
                            <SelectItem value="practiced" className="rounded-lg">
                              已练习
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 体裁筛选 */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-700">
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
                        <Label className="text-sm font-medium text-gray-700">
                          {t.shadowing.major_theme}
                        </Label>
                        <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                          <SelectTrigger className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                            <SelectItem value="all" className="rounded-lg">
                              全部大主题
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
                        <Label className="text-sm font-medium text-gray-700">
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
                                selectedThemeId === 'all' ? '请先选择大主题' : '选择小主题'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-gray-200 shadow-lg">
                            <SelectItem value="all" className="rounded-lg">
                              全部小主题
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
                        <Label className="text-sm font-medium text-gray-700">{t.shadowing.search || '搜索'}</Label>
                        <Input
                          placeholder={t.shadowing.search_placeholder || '搜索标题、主题...'}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-10 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {/* 快捷操作 */}
                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={getRandomUnpracticed}
                          className="flex-1 h-10 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                          <Shuffle className="w-4 h-4 mr-2" />
                          {t.shadowing.random}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={getNextUnpracticed}
                          className="flex-1 h-10 bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-violet-100 hover:border-purple-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                          <ArrowRight className="w-4 h-4 mr-2" />
                          {t.shadowing.next_question}
                        </Button>
                      </div>
                    </div>

                    {/* 统计信息 - 卡片化设计 */}
                    <div className="p-4 space-y-3 bg-gray-50/50">
                      {/* 总题数卡片 */}
                      <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-blue-600 font-medium mb-1">总题数</p>
                            <p className="text-2xl font-bold text-blue-900">{filteredItems.length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                      </div>
                      
                      {/* 已完成卡片 */}
                      <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-green-50 to-green-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs text-green-600 font-medium mb-1">已完成</p>
                            <p className="text-2xl font-bold text-green-900">{filteredItems.filter((item) => item.isPracticed).length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        </div>
                        {/* 进度条 */}
                        <div className="w-full bg-green-200/50 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${filteredItems.length > 0 ? (filteredItems.filter((item) => item.isPracticed).length / filteredItems.length) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-green-600 mt-1">
                          {filteredItems.length > 0 ? Math.round((filteredItems.filter((item) => item.isPracticed).length / filteredItems.length) * 100) : 0}%
                        </p>
                      </div>
                      
                      {/* 草稿中卡片 */}
                      <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-amber-600 font-medium mb-1">草稿中</p>
                            <p className="text-2xl font-bold text-amber-900">{filteredItems.filter((item) => item.status === 'draft' && !item.isPracticed).length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <FileEdit className="w-5 h-5 text-amber-600" />
                          </div>
                        </div>
                      </div>
                      
                      {/* 未开始卡片 */}
                      <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-gray-50 to-gray-100/50 p-3 transition-all hover:shadow-md hover:scale-105">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-600 font-medium mb-1">未开始</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredItems.filter((item) => !item.isPracticed && item.status !== 'draft').length}</p>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-gray-500/10 flex items-center justify-center">
                            <Circle className="w-5 h-5 text-gray-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 题目列表 */}
                    <div className="flex-1" ref={desktopListScrollRef}>
                      {loading ? (
                        <div className="p-6 text-center">
                          <div className="animate-spin w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                          <p className="text-sm text-gray-600 font-medium animate-pulse">加载中...</p>
                        </div>
                      ) : filteredItems.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {t.shadowing.no_questions_found || '没有找到题目'}
                          </h3>
                            <p className="text-sm text-gray-500 mb-4">{t.shadowing.search_adjust_filters_hint || '试试调整筛选条件或搜索关键词'}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLang('zh');
                              setLevel(null);
                              setPracticed('all');
                              setTheme('all');
                              setSelectedThemeId('all');
                              setSelectedSubtopicId('all');
                              setSearchQuery('');
                            }}
                            className="hover:bg-violet-50 hover:border-violet-300"
                          >
                            <Filter className="w-4 h-4 mr-2" />
                            重置筛选
                          </Button>
                        </div>
                      ) : (
                        <div className="p-2">
                          <Virtuoso
                            customScrollParent={desktopListScrollRef.current ?? undefined}
                            data={filteredItems}
                            itemContent={(index, item) => {
                              const it = item as any;
                              return (
                                <div
                                  key={it.id}
                                  className={`p-3 mb-2 rounded border cursor-pointer transition-colors ${
                                    currentItem?.id === it.id
                                      ? 'bg-blue-50 border-blue-200'
                                      : it.isPracticed
                                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                        : it.status === 'draft'
                                          ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                          : 'hover:bg-gray-50'
                                  }`}
                                  onClick={() => loadItem(it)}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        {it.isPracticed ? (
                                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                        ) : it.status === 'draft' ? (
                                          <FileText className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                        ) : (
                                          <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        )}
                                        <span className="text-sm text-gray-500 font-medium min-w-[1.5rem]">{index + 1}.</span>
                                        <span className="text-sm font-medium truncate">
                                          {it.subtopic ? it.subtopic.title : it.title}
                                          {it.isPracticed && (<span className="ml-1 text-green-600">✓</span>)}
                                          {it.status === 'draft' && (<span className="ml-1 text-yellow-600">📝</span>)}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {(LANG_LABEL as any)[it.lang]} • L{it.level}
                                        {it.cefr && ` • ${it.cefr}`}
                                        {it.isPracticed && (
                                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{t.shadowing.completed}</span>
                                        )}
                                        {it.status === 'draft' && !it.isPracticed && (
                                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{t.shadowing.draft}</span>
                                        )}
                                      </div>
                                      {it.isPracticed && (
                                        <div className="mt-2">
                                          <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                            <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> {it.stats.recordingCount} 录音</span>
                                            <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {it.stats.vocabCount} 生词</span>
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(it.stats.practiceTime)}</span>
                                          </div>
                                          <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-green-500 h-1.5 rounded-full" style={{ width: '100%' }} /></div>
                                        </div>
                                      )}
                                      {!it.isPracticed && (
                                        <div className="mt-2">
                                          <div className="w-full bg-gray-200 rounded-full h-1.5"><div className={`h-1.5 rounded-full ${it.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-300'}`} style={{ width: it.status === 'draft' ? '50%' : '0%' }} /></div>
                                          <div className="text-xs text-gray-400 mt-1">{it.status === 'draft' ? t.shadowing.draft : t.shadowing.not_started}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* 右侧练习区域 */}
            <div className="flex-1 overflow-y-auto max-h-[85vh]">
              {!currentItem ? (
                <Card className="h-full flex items-center justify-center bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl">
                  <div className="text-center p-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <BookOpen className="w-12 h-12 text-blue-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      {t.shadowing.select_question_to_start || '选择题目开始练习'}
                    </h3>
                    <p className="text-gray-600 leading-relaxed max-w-md">
                      {t.shadowing.select_from_left_vocabulary ||
                        '从左侧题库中选择一个题目开始 Shadowing 练习'}
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-6">
                  {/* 步骤导航与提示（仅桌面端未完成时显示） */}
                  {gatingActive && (
                    <Card className="p-4 bg-white border-0 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <PracticeStepper
                          size="md"
                          currentStep={step}
                          onStepChange={(s)=> setStep(s)}
                          maxStepAllowed={step}
                          labels={[
                            t.shadowing.step_labels?.blind_listen || '盲听',
                            t.shadowing.step_labels?.read_text || '看原文+翻译',
                            t.shadowing.step_labels?.select_words || '选生词',
                            t.shadowing.step_labels?.record_scoring || '录音评分',
                          ]}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStep((s)=> (Math.max(1, (s as number)-1) as 1|2|3|4))}
                            disabled={step===1}
                            aria-label={t.shadowing.prev_step || '上一步'}
                          >{t.shadowing.prev_step || '上一步'}</Button>
                          <Button
                            size="sm"
                            onClick={() => setStep((s)=> (Math.min(4, (s as number)+1) as 1|2|3|4))}
                            disabled={step===4}
                            aria-label={t.shadowing.next_step || '下一步'}
                          >{t.shadowing.next_step || '下一步'}</Button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-700">{stepTips[step]}</div>
                    </Card>
                  )}

                  {/* 步骤详细引导（仅桌面端未完成时显示） */}
                  {gatingActive && (
                    <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-0 shadow-sm">
                      {step === 1 && (
                        <div className="text-sm text-gray-700 space-y-2">
                          <div className="font-medium">{t.shadowing.guide_blind_listen_title || '如何高效盲听：'}</div>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>放松不要急，先整体感知节奏与停顿</li>
                            <li>不要看原文，尝试抓关键词与语气</li>
                            <li>{t.shadowing.guide_blind_listen_tip1 || '准备好后点击“下一步”，再看原文跟读'}</li>
                          </ul>
                        </div>
                      )}
                      {step === 2 && (
                        <div className="text-sm text-gray-700 space-y-2">
                          <div className="font-medium">{t.shadowing.step_labels?.read_text || '看原文+翻译'} + {t.shadowing.follow_recording || '跟读'}：</div>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>{t.shadowing.guide_read_text_tip1 || '先快速浏览一遍原文结构与段落'}</li>
                            <li>{t.shadowing.guide_read_text_tip2 || '再次播放音频，对照原文跟读（注意连读/重音）'}</li>
                            <li>{t.shadowing.guide_read_text_tip3 || '跟读时轻声起步，逐步提升音量与流畅度'}</li>
                            <li>可以同时查看翻译来理解内容含义</li>
                          </ul>
                        </div>
                      )}
                      {step === 3 && (
                        <div className="text-sm text-gray-700 space-y-2">
                          <div className="font-medium">{t.shadowing.guide_select_words_title || '选生词 + AI 解释：'}</div>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>{t.shadowing.guide_select_words_tip1 || '点击原文中的词语即可加入生词'}</li>
                            <li>{t.shadowing.guide_select_words_tip2 || `点击“${t.shadowing.ai_explanation_button || 'AI解释'}”为生词生成本地化释义与例句`}</li>
                            <li>{t.shadowing.guide_select_words_tip3 || '建议聚焦于影响理解的关键词汇，避免一次选太多'}</li>
                          </ul>
                        </div>
                      )}
                      {step === 4 && (
                        <div className="text-sm text-gray-700 space-y-2">
                          <div className="font-medium">{t.shadowing.record_and_score_title || '录音与评分：'}</div>
                          <ul className="list-disc pl-5 space-y-1">
                            <li>{t.shadowing.guide_record_tip1 || '对照原文逐句录音，尽量贴合节奏与停顿'}</li>
                            <li>{t.shadowing.guide_record_tip2 || '录完保存后点击评分，查看整体与逐句分析'}</li>
                            <li>{t.shadowing.guide_record_tip3 || '根据问题提示再次练习可显著提升分数'}</li>
                          </ul>
                        </div>
                      )}
                    </Card>
                  )}
                  {/* 题目信息 */}
                  <Card className="p-8 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl">
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
                          {currentItem.title}
                        </h2>
                        <div className="flex items-center gap-4 flex-wrap mb-4">
                          <span
                            className={`px-4 py-2 rounded-full text-sm font-medium ${
                              currentItem.lang === 'en'
                                ? 'bg-blue-100 text-blue-700'
                                : currentItem.lang === 'ja'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {LANG_LABEL[currentItem.lang]}
                          </span>
                          <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                            {t.shadowing.level} L{currentItem.level}
                          </span>
                          {currentItem.cefr && (
                            <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                              {currentItem.cefr}
                            </span>
                          )}
                          {currentItem.tokens && (
                            <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                              {currentItem.tokens} {t.shadowing.words || '词'}
                            </span>
                          )}
                        </div>
                        {currentItem.isPracticed && currentSession && (
                          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700">已完成练习</span>
                            <span className="text-xs text-green-600">
                              ({new Date(currentSession.created_at).toLocaleString()})
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {!(gatingActive && step === 4) && (
                          <Button
                            onClick={playAudio}
                            variant="outline"
                            size="sm"
                            className={`h-11 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all ${highlightPlay ? 'animate-pulse ring-2 ring-blue-400' : ''}`}
                          >
                            {isPlaying ? (
                              <Pause className="w-5 h-5 mr-2" />
                            ) : (
                              <Play className="w-5 h-5 mr-2" />
                            )}
                            {isPlaying ? '暂停' : '播放音频'}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={saveDraft}
                          disabled={saving}
                          className="h-11 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                          <Save className="w-5 h-5 mr-2" />
                          {saving ? (t.shadowing.saving_modal_title || '保存中...') : (t.shadowing.save_draft || '保存草稿')}
                        </Button>

                        {(!gatingActive || step === 4) && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={unifiedCompleteAndSave}
                              disabled={saving}
                              className="h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              {saving ? t.common.loading : t.shadowing.complete_and_save}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
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
                      </div>
                    </div>

                    {/* 生词选择模式切换（步骤2和3显示；完成或移动端保持原样） */}
                    {(!gatingActive || step >= 2) && (
                      <div className="mb-4 space-y-3">
                        <Button
                          variant={isVocabMode ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setIsVocabMode(!isVocabMode)}
                          className={highlightVocab ? 'animate-pulse ring-2 ring-amber-400' : ''}
                        >
                          {isVocabMode
                            ? (t.shadowing.vocab_mode_on || '退出选词模式')
                            : (t.shadowing.vocab_mode_off || '开启选词模式')}
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
                              <p className="text-sm text-green-600">ACU 选词模式：点击预分割的语义块来选择生词</p>
                            ) : (
                              <p className="text-sm text-blue-600">{t.shadowing.click_words_to_select || '点击文本中的单词来选择生词'}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 桌面端第4步翻译外置卡片移除，改为内嵌到正文模块顶部的黄色框 */}

                    {/* 文本内容（步骤>=2显示；完成或移动端保持原样；步骤5也需显示原文以便录音评分） */}
                    {(!gatingActive || step >= 2) && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        {/* 桌面端第4步：在正文模块内部顶部显示黄色翻译框 */}
                        {!actualIsMobile && step === 2 && showTranslation && currentItem && currentItem.translations && currentItem.translations[translationLang] && (
                          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-sm text-gray-600 mb-1">{t.shadowing.translation || '翻译'}</div>
                            <div className="whitespace-pre-wrap text-base text-gray-800">
                              {formatSpeakerBreaks(currentItem.translations[translationLang])}
                            </div>
                          </div>
                        )}
                      {isVocabMode ? (
                        <>
                          {/* ACU 模式或自由框选模式 */}
                          {isACUMode && currentItem?.notes?.acu_units ? (
                            <AcuText
                              text={currentItem.text}
                              lang={currentItem.lang}
                              units={currentItem.notes.acu_units}
                              onConfirm={handleWordSelect}
                              selectedWords={[...previousWords, ...selectedWords]}
                            />
                          ) : (
                            <SelectablePassage
                              text={currentItem.text}
                              lang={currentItem.lang}
                              onSelectionChange={handleTextSelection}
                              clearSelection={clearSelection}
                              disabled={false}
                              className="text-lg leading-relaxed"
                            />
                          )}
                          {selectedText && (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-sm">
                                <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                                <div className="text-blue-600 font-semibold mb-1">
                                  {selectedText.word}
                                </div>
                                <div className="text-xs text-gray-600 mb-2">
                                  {selectedText.context}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={confirmAddToVocab}
                                    disabled={isAddingToVocab}
                                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isAddingToVocab ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                                        添加中...
                                      </>
                                    ) : (
                                      '确认添加到生词本'
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelSelection}
                                    disabled={isAddingToVocab}
                                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    取消
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-lg leading-relaxed">
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
                                        lang={currentItem?.lang || 'zh'}
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
                                  <div key={lineIndex} className="mb-2">
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
                                        key={`${lineIndex}-${i}`} 
                                        word={word} 
                                        explanation={explanation}
                                        fromVocab={wordData?.fromVocab}
                                        vocabId={wordData?.vocabId}
                                        onRefresh={handleRefreshExplanation}
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
                                  <div key={lineIndex} className="mb-2">
                                    {result}
                                  </div>
                                );
                              });
                            }
                          })()}
                        </div>
                      )}
                      </div>
                    )}

                    {/* 音频播放器（步骤4隐藏；完成或移动端保持原样） - 使用增强版 */}
                    {currentItem.audio_url && (!gatingActive || step !== 4) && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-700">{t.shadowing.original_audio_text || '原文音频'}</span>
                        </div>
                        <EnhancedAudioPlayer
                          audioUrl={currentItem.audio_url}
                          duration_ms={currentItem.duration_ms}
                          onPlayStateChange={(playing) => setIsPlaying(playing)}
                        />
                      </div>
                    )}
                  </Card>

                  {/* 翻译模块（仅步骤2显示；完成或移动端保持原样） */}
                  {currentItem && (!gatingActive || step === 2) && (
                    <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">🌐</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">翻译</h3>
                          <p className="text-sm text-gray-600">{t.shadowing.translation_support_hint || '多语言翻译支持'}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer p-3 bg-white/80 rounded-xl border border-indigo-200 hover:bg-white transition-colors">
                            <input
                              type="checkbox"
                              checked={showTranslation}
                              onChange={(e) => setShowTranslation(e.target.checked)}
                              className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="font-medium">显示翻译</span>
                          </label>
                          {showTranslation && (
                            <select
                              className="h-11 px-4 py-2 bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium"
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
                              {currentItem.translations[translationLang]}
                            </div>
                          </div>
                        ) : showTranslation ? (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                              <span className="text-2xl">📝</span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">{t.shadowing.translation_none_title || '暂无翻译'}</h3>
                            <p className="text-gray-500">可能尚未生成翻译内容</p>
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

                  {/* 之前的生词（步骤2和3显示；完成或移动端保持原样） */}
                  {previousWords.length > 0 && (!gatingActive || step >= 2) && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-600">
                          {(t.shadowing.previous_words_title || '之前的生词 ({count})').replace('{count}', String(previousWords.length))}
                        </h3>
                      </div>

                      <div className="grid gap-3">
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
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-500">{t.shadowing.imported || '已导入'}</div>
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
                    </Card>
                  )}

                  {/* 本次选中的生词（步骤2和3显示；完成或移动端保持原样） */}
                  {selectedWords.length > 0 && (!gatingActive || step >= 2) && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-blue-600">
                          {(t.shadowing.selected_words_title || '本次选中的生词 ({count})').replace('{count}', String(selectedWords.length))}
                        </h3>
                        <div className="flex gap-2">
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
                            {isImporting ? (t.shadowing.importing || '导入中...') : (t.shadowing.import_to_vocab || '导入到生词本')}
                          </Button>
                        </div>
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

                      <div className="grid gap-3">
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
                    </Card>
                  )}

                  {/* 取消第5步顶部额外播放器，沿用下方通用播放器 */}

                  {/* 练习模式切换 */}
                  {(!gatingActive || step >= 4) && renderPracticeModeSwitcher()}

                  {/* 逐句/分角色练习 */}
                  {(!gatingActive || step >= 4) && (() => {
                    try {
                      if (currentItem && (!currentItem.audio_url || !(currentItem as unknown as { sentence_timeline?: unknown }).sentence_timeline)) {
                        (async () => {
                          try {
                            const headers = await getAuthHeaders();
                            const r = await fetch(`/api/shadowing/item?id=${currentItem!.id}`, { headers, credentials: 'include' });
                            if (r.ok) {
                              const data = await r.json();
                              if (data?.item && data.item.id === currentItem!.id) {
                                setCurrentItem((prev) => (prev && prev.id === data.item.id ? { ...prev, ...data.item } as any : prev));
                              }
                            }
                          } catch {}
                        })();
                      }
                    } catch {}
                    return null;
                  })()}
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

                  {/* 录音练习区域（仅步骤5显示；完成或移动端保持原样） */}
                  {practiceMode !== 'role' && (!gatingActive || step >= 4) && (
                  <Card className="p-4 md:p-6 border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-green-600">🎤</span>
                        {t.shadowing.recording_practice}
                      </h3>
                    </div>
                    <AudioRecorder
                      ref={audioRecorderRef}
                      sessionId={currentSession?.id}
                      existingRecordings={currentRecordings}
                      onRecordingAdded={handleRecordingAdded}
                      onRecordingDeleted={handleRecordingDeleted}
                      onTranscriptionReady={handleTranscriptionReady}
                      onRecordingSelected={handleRecordingSelected}
                      originalText={currentItem?.text}
                      language={currentItem?.lang || 'ja'}
                    />
                  </Card>
                  )}

                  {/* 评分区域（仅步骤5显示；完成或移动端保持原样） */}
                  {!scoringResult && practiceMode !== 'role' && (!gatingActive || step >= 4) && (
                    <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">📊</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.practice_scoring || '练习评分'}
                          </h3>
                          <p className="text-sm text-gray-600">{t.shadowing.ai_scoring_subtitle || 'AI智能评分，精准分析发音'}</p>
                        </div>
                      </div>

                      {currentRecordings.length > 0 ? (
                        <div className="text-center space-y-4">
                          <div className="p-4 bg-white/80 rounded-xl border border-purple-200">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-gray-700 font-medium mb-2">
                              {t.shadowing.recording_completed}
                            </p>
                            <p className="text-sm text-gray-600">
                              {t.shadowing.recording_completed_message}
                            </p>
                          </div>
                          <Button
                            onClick={() => performScoring()}
                            disabled={isScoring}
                            className="h-12 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all w-full"
                          >
                            {isScoring ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {t.shadowing.scoring_in_progress || '评分中...'}
                              </>
                            ) : (
                              <>
                                <span className="mr-2">🚀</span>
                                开始评分
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mic className="w-10 h-10 text-gray-400" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            {t.shadowing.no_recording_yet}
                          </h3>
                          <p className="text-gray-500 leading-relaxed">
                            {t.shadowing.complete_recording_first}
                          </p>
                        </div>
                      )}
                    </Card>
                  )}

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
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 rounded-lg"
                        >
                          {isScoring ? (t.shadowing.re_scoring_in_progress || '重新评分中...') : (t.shadowing.re_score || '重新评分')}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="p-4 bg-white rounded-xl border border-green-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                              <span className="text-green-600 text-sm">🏆</span>
                            </div>
                            <div className="text-sm font-medium text-green-700">
                              {t.shadowing.overall_score}
                            </div>
                          </div>
                          <div className="text-3xl font-bold text-green-600">
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
                          <div className="text-3xl font-bold text-blue-600">
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

                      {/* 转录文字和原文对比 */}
                      {scoringResult.transcription && scoringResult.originalText && (
                        <div className="mt-6">
                          <h4 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                            <span className="text-indigo-600">📝</span>
                            {t.shadowing.practice_comparison}
                          </h4>
                          <div className="space-y-4">
                            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                                    {t.shadowing.original_text}
                                  </div>
                                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed">
                                    {scoringResult.originalText}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    {t.shadowing.your_pronunciation}
                                  </div>
                                  <div
                                    className={`p-3 rounded-lg border text-sm leading-relaxed ${
                                      (scoringResult.score || 0) >= 80
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

                              {/* 详细对比分析 */}
                              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                                <div className="text-sm text-blue-600 mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  {t.shadowing.detailed_analysis}
                                </div>
                                <div className="text-sm text-gray-700">
                                  {(() => {
                                    // 处理中文文本，按字符分割而不是按单词分割

                                    // 使用简单句子分析（支持中文和英文）
                                    const simpleAnalysis = performSimpleAnalysis(
                                      scoringResult.originalText,
                                      scoringResult.transcription,
                                    );
                                    const { sentenceAnalysis, overallScore } = simpleAnalysis;

                                    return (
                                      <div>
                                        {/* 整体评分 */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">
                                            {t.shadowing.overall_score}:
                                          </div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {overallScore}%
                                          </div>
                                        </div>

                                        {/* 句子分析 */}
                                        <div className="space-y-3">
                                          {sentenceAnalysis.map((sentence, idx) => (
                                            <div
                                              key={`sentence-${idx}-${sentence.sentence.substring(0, 20)}`}
                                              className={`p-3 rounded border ${
                                                sentence.status === 'correct'
                                                  ? 'bg-green-50 border-green-200'
                                                  : sentence.status === 'partial'
                                                    ? 'bg-yellow-50 border-yellow-200'
                                                    : 'bg-red-50 border-red-200'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-medium">
                                                  {sentence.status === 'correct' && '✓ '}
                                                  {sentence.status === 'partial' && '⚠ '}
                                                  {sentence.status === 'missing' && '❌ '}
                                                  {t.shadowing.sentence || '句子'} {idx + 1}
                                                </div>
                                                <div className="text-sm font-bold">
                                                  {sentence.score}%
                                                </div>
                                              </div>

                                              <div className="text-sm mb-2">
                                                <span className="font-medium">
                                                  {t.shadowing.original_text}:
                                                </span>
                                                <span className="text-gray-700">
                                                  &ldquo;{sentence.sentence}&rdquo;
                                                </span>
                                              </div>

                                              {sentence.issues.length > 0 && (
                                                <div className="text-sm text-red-600">
                                                  <div className="font-medium">
                                                    {t.shadowing.issues || '问题'}:
                                                  </div>
                                                  <ul className="list-disc list-inside space-y-1">
                                                    {sentence.issues.map((issue, issueIdx) => (
                                                      <li
                                                        key={`issue-${issueIdx}-${issue.substring(0, 20)}`}
                                                      >
                                                        {issue}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        <div className="mt-4 text-xs text-gray-500">
                                          💡{' '}
                                          {t.shadowing.analysis_based_on_sentence_level ||
                                            '分析基于句子级别，更直观地显示发音问题'}
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <div>
                                        {/* 整体评分 */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">
                                            {t.shadowing.overall_score}:
                                          </div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {overallScore}%
                                          </div>
                                        </div>

                                        {/* 句子分析 */}
                                        <div className="space-y-3">
                                          {sentenceAnalysis.map((sentence, idx) => (
                                            <div
                                              key={idx}
                                              className={`p-3 rounded border ${
                                                sentence.status === 'correct'
                                                  ? 'bg-green-50 border-green-200'
                                                  : sentence.status === 'partial'
                                                    ? 'bg-yellow-50 border-yellow-200'
                                                    : 'bg-red-50 border-red-200'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-medium">
                                                  {sentence.status === 'correct' && '✓ '}
                                                  {sentence.status === 'partial' && '⚠ '}
                                                  {sentence.status === 'missing' && '❌ '}
                                                  {t.shadowing.sentence || '句子'} {idx + 1}
                                                </div>
                                                <div className="text-sm font-bold">
                                                  {sentence.score}%
                                                </div>
                                              </div>

                                              <div className="text-sm mb-2">
                                                <span className="font-medium">
                                                  {t.shadowing.original_text}:
                                                </span>
                                                <span className="text-gray-700">
                                                  &ldquo;{sentence.sentence}&rdquo;
                                                </span>
                                              </div>

                                              {sentence.issues.length > 0 && (
                                                <div className="text-xs">
                                                  <span className="font-medium text-red-600">
                                                    {t.shadowing.issues || '问题'}:
                                                  </span>
                                                  <ul className="mt-1 space-y-1">
                                                    {sentence.issues.map((issue, issueIdx) => (
                                                      <li
                                                        key={`issue-${issueIdx}-${issue.substring(0, 20)}`}
                                                        className="text-red-600"
                                                      >
                                                        • {issue}
                                                      </li>
                                                    ))}
                                                  </ul>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        <div className="mt-3 text-xs text-gray-600">
                                          💡{' '}
                                          {t.shadowing.analysis_based_on_sentence_level ||
                                            '分析基于句子级别，更直观地显示发音问题'}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!practiceComplete && (!gatingActive || step === 4) && (
                        <Button
                          onClick={unifiedCompleteAndSave}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t.shadowing.complete_and_save}
                        </Button>
                      )}
                    </Card>
                  )}

                  {/* 练习总结区域 */}
                  {scoringResult && showSentenceComparison && currentItem && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">练习总结</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowSentenceComparison(false)}
                        >
                          隐藏
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2 text-green-700">练习内容</h4>
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-sm leading-relaxed">{currentItem.text}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Container>

      {/* 成功提示Toast */}
      {showSuccessToast && (
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
      )}
      
      {/* 快捷键帮助弹窗 */}
      {!actualIsMobile && (
        <ShortcutsHelpModal
          isOpen={showShortcutsHelp}
          onClose={() => setShowShortcutsHelp(false)}
          shortcuts={keyboardShortcuts}
        />
      )}
    </main>
  );
}
