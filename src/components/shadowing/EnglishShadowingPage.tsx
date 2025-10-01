'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo, useDeferredValue } from 'react';
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
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import PracticeStepper from './PracticeStepper';
import SelectablePassage from '@/components/SelectablePassage';
import useUserPermissions from '@/hooks/useUserPermissions';
import dynamic from 'next/dynamic';
const AudioRecorder = dynamic(() => import('@/components/AudioRecorder'), { ssr: false });
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { LANG_LABEL } from '@/types/lang';
import { useMobile } from '@/contexts/MobileContext';
import FilterLanguageSelector from './FilterLanguageSelector';
import { speakText as speakTextUtil } from '@/lib/speechUtils';
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
  Save,
  FileText,
  Play,
  Pause,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCached, setCached } from '@/lib/clientCache';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { loadFilters as loadShadowingFilters, saveFilters as saveShadowingFilters } from '@/lib/shadowingFilterStorage';

// 题目数据类型
interface ShadowingItem {
  id: string;
  lang: 'ja' | 'en' | 'zh';
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
  notes: string;
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

export default function EnglishShadowingPage() {
  const { t, language, setLanguageFromUserProfile } = useLanguage();
  const { permissions } = useUserPermissions();
  const { user, authLoading, getAuthHeaders, profile } = useAuth();

  // 过滤和筛选状态
  const [lang, setLang] = useState<'ja' | 'en' | 'zh'>('en');
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

  // 本地持久化 + URL 同步（仅语言、等级、练习情况）
  const navSearchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filtersReadyRef = useRef(false);

  // 初始化：URL 优先，其次本地存储；不区分语言分桶；跳转（带参）为准
  useEffect(() => {
    const params = new URLSearchParams(navSearchParams?.toString() || '');

    const urlLang = params.get('lang') as 'ja' | 'en' | 'zh' | null;
    if (urlLang && ['ja', 'en', 'zh'].includes(urlLang)) {
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

    // 如果 URL 未提供，则尝试本地持久化
    const persisted = loadShadowingFilters();
    if (persisted) {
      if (!urlLang && persisted.lang && persisted.lang !== lang) setLang(persisted.lang);
      if (!urlLevel && typeof persisted.level !== 'undefined') setLevel(persisted.level ?? null);
      if (!urlPracticed && persisted.practiced) setPracticed(persisted.practiced);
    }
    // 初始化完成
    filtersReadyRef.current = true;
    // 仅初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 状态变化时：写回本地 + 合并更新URL（保留其他参数，例如 item）
  useEffect(() => {
    if (!filtersReadyRef.current) return;
    // 本地保存（3天 TTL 在工具内默认）
    saveShadowingFilters({ lang, level, practiced });

    const params = new URLSearchParams(navSearchParams?.toString() || '');
    params.set('lang', lang);
    if (level !== null && level !== undefined) params.set('level', String(level)); else params.delete('level');
    params.set('practiced', practiced);

    const next = `${pathname}?${params.toString()}`;
    const current = `${pathname}?${navSearchParams?.toString() || ''}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
    // 不依赖 searchParams，避免自身 replace 触发循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, level, practiced, pathname, router]);

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
  } | null>(null);

  // AIExplanation相关状态
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

  // Explanation缓存
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

  // 用户个人资料状态
  const [userProfile, setUserProfile] = useState<{ native_lang?: string } | null>(null);

  // 翻译相关状态
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<'en' | 'ja' | 'zh'>('en');

  // 获取目标语言
  const getTargetLanguages = (sourceLang: string): string[] => {
    switch (sourceLang) {
      case 'zh':
        return ['en', 'ja'];
      case 'en':
        return ['ja', 'zh'];
      case 'ja':
        return ['en', 'zh'];
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
    };
    return names[lang as keyof typeof names] || lang;
  };

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
      setTranslationLang(targetLangs[0] as 'en' | 'ja' | 'zh');
    }
  }, [currentItem]);

  // （移除重复母语加载副作用，统一由步骤联动副作用处理）
  
  // 发音功能
  const speakWord = (word: string, lang: string) => {
    speakTextUtil(word, lang, {
      rate: 0.8, // 稍慢一点，便于学习
      pitch: 1,
      volume: 1,
    });
  };

  // 悬停/点击Explanation组件
  const HoverExplanation = ({
    word,
    explanation,
    children,
  }: {
    word: string;
    explanation?: {
      gloss_native: string;
      senses?: Array<{ example_target: string; example_native: string }>;
    };
    children: React.ReactNode;
  }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [latestExplanation, setLatestExplanation] = useState(explanation);

    // 当悬停时，异步获取最新Explanation（不阻塞显示）
    const handleMouseEnter = async () => {
      setShowTooltip(true);

      // 总是获取最新Explanation，确保与DynamicExplanation同步
      const timer = setTimeout(async () => {
        try {
          const headers = await getAuthHeaders();
          const response = await fetch(
            `/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`,
            {
              headers,
            },
          );
          const data = await response.json();

          if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
            const fetchedExplanation = data.entries[0].explanation;
            setLatestExplanation(fetchedExplanation);
            // 不更新缓存，避免循环
          }
        } catch (error) {
          console.error(`获取 ${word} Explanation失败:`, error);
        }
      }, 300); // 300ms防抖延迟

      return () => clearTimeout(timer);
    };

    const tooltipText = latestExplanation?.gloss_native || 'Selected vocabulary';

    return (
      <span
        className="bg-yellow-200 text-yellow-800 px-1 rounded font-medium cursor-help relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)} // 手机端点击切换
      >
        {children}
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg w-32 z-50">
            {tooltipText}
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

  // 动态Explanation组件
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
    // 优先使用缓存中的最新Explanation，其次使用fallbackExplanation
    const [latestExplanation, setLatestExplanation] = useState<
      | {
          gloss_native: string;
          pronunciation?: string;
          pos?: string;
          senses?: Array<{ example_target: string; example_native: string }>;
        }
      | undefined
    >(explanationCache[word] || fallbackExplanation);
    const [loading, setLoading] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);

    // Refresh explanation函数 - 强制从数据库获取最新数据
    const refreshExplanation = useCallback(async () => {
      setLoading(true);
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(
          `/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`,
          {
            // 添加时间戳避免缓存
            headers,
          },
        );
        const data = await response.json();

        if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
          const explanation = data.entries[0].explanation;
          setLatestExplanation(explanation);
          // 更新缓存
          setExplanationCache((prev) => ({
            ...prev,
            [word]: explanation,
          }));
        } else {
          // 如果没有找到Explanation，清除缓存
          setLatestExplanation(undefined);
          setExplanationCache((prev) => {
            const newCache = { ...prev };
            delete newCache[word];
            return newCache;
          });
        }
      } catch (error) {
        console.error(`获取 ${word} Explanation失败:`, error);
      } finally {
        setLoading(false);
      }
    }, [word]);

    // 初始化时获取最新Explanation
    useEffect(() => {
      if (!hasInitialized) {
        setHasInitialized(true);
        // 总是获取最新Explanation，不管缓存中是否有旧Explanation
        // 直接调用API，避免依赖refreshExplanation
        const fetchInitialExplanation = async () => {
          setLoading(true);
          try {
            const headers = await getAuthHeaders();
            const response = await fetch(
              `/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`,
              {
                headers,
              },
            );
            const data = await response.json();

            if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
              const explanation = data.entries[0].explanation;
              setLatestExplanation(explanation);
              // 不更新缓存，避免循环
            }
          } catch (error) {
            console.error(`获取 ${word} Explanation失败:`, error);
          } finally {
            setLoading(false);
          }
        };
        fetchInitialExplanation();
      }
    }, [hasInitialized, word]);

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
          <span>{t.shadowing.no_explanation || 'No explanation'}</span>
          <button
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title="Refresh explanation"
          >
            🔄
          </button>
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-700">
        <div className="mb-2 flex items-center gap-2">
          <strong>{t.shadowing.explanation || 'Explanation'}：</strong>
          {latestExplanation.gloss_native}
          <button
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title="Refresh explanation"
            disabled={loading}
          >
            🔄
          </button>
        </div>

        {/* 显示Part of speech信息 */}
        {latestExplanation.pos && (
          <div className="mb-2 text-sm text-gray-600">
            <strong>{t.shadowing.part_of_speech || 'Part of speech'}：</strong>
            {latestExplanation.pos}
          </div>
        )}

        {latestExplanation.senses && latestExplanation.senses.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>{t.shadowing.example_sentence || 'Example sentence'}：</strong>
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
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [practiceComplete, setPracticeComplete] = useState(false);
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
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level.toString());
      if (practiced !== 'all') params.set('practiced', practiced === 'practiced' ? 'true' : 'false');
      params.set('limit', '100');

      const key = `shadowing_catalog:${params.toString()}`;
      const cached = getCached<{ items: ShadowingItem[] }>(key);
      if (cached) {
        setItems(cached.items || []);
      } else {
        let headers = await getAuthHeaders();
        let response = await fetch(`/api/shadowing/catalog?${params.toString()}`, { headers, credentials: 'include' });
        if (response.status === 401) {
          try {
            await supabase.auth.refreshSession();
            headers = await getAuthHeaders();
            response = await fetch(`/api/shadowing/catalog?${params.toString()}`, { headers, credentials: 'include' });
          } catch {}
        }
        if (response.ok) {
          const data = await response.json();
          setCached(key, data, 30_000);
          setItems(data.items || []);
        } else {
          console.error('Failed to fetch items:', response.status, await response.text());
        }
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  }, [lang, level, practiced, getAuthHeaders]);

  // 加载主题列表
  const loadThemes = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level?.toString() || '');
      let headers = await getAuthHeaders();
      let response = await fetch(`/api/shadowing/themes?${params.toString()}`, {
        headers,
        credentials: 'include',
      });
      if (response.status === 401) {
        try {
          await supabase.auth.refreshSession();
          headers = await getAuthHeaders();
          response = await fetch(`/api/shadowing/themes?${params.toString()}`, {
            headers,
            credentials: 'include',
          });
        } catch {}
      }
      if (response.ok) {
        const data = await response.json();
        setThemes((data.items || data.themes) ?? []);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, [lang, level, getAuthHeaders]);

  // 加载某主题下的小主题
  const loadSubtopics = useCallback(async (themeId: string) => {
    try {
      const params = new URLSearchParams();
      params.set('theme_id', themeId);
      let headers = await getAuthHeaders();
      let response = await fetch(`/api/shadowing/subtopics?${params.toString()}`, {
        headers,
        credentials: 'include',
      });
      if (response.status === 401) {
        try {
          await supabase.auth.refreshSession();
          headers = await getAuthHeaders();
          response = await fetch(`/api/shadowing/subtopics?${params.toString()}`, {
            headers,
            credentials: 'include',
          });
        } catch {}
      }
      if (response.ok) {
        const data = await response.json();
        setSubtopics((data.items || data.subtopics) ?? []);
      }
    } catch (error) {
      console.error('Failed to load subtopics:', error);
    }
  }, [getAuthHeaders]);

  // 鉴权由 AuthContext 统一处理

  // 初始加载题库（仅在用户已登录时）
  useEffect(() => {
    if (authLoading) return;
    const t = setTimeout(() => {
      if (user) {
        fetchItems();
        fetchRecommendedLevel();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [fetchItems, fetchRecommendedLevel, authLoading, user]);

  // 筛选条件变化时立即刷新题库
  useEffect(() => {
    if (authLoading || !user) return;
    const t = setTimeout(() => fetchItems(), 50);
    return () => clearTimeout(t);
  }, [lang, level, practiced, authLoading, user, fetchItems]);

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
          // 调试日志
          console.log('大主题筛选:', {
            selectedThemeId,
            itemThemeId: item.theme_id,
            itemTitle: item.title,
            match: item.theme_id === selectedThemeId,
          });

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
      alert('All questions have been practiced!');
      return;
    }
    const randomItem = unpracticed[Math.floor(Math.random() * unpracticed.length)];
    loadItem(randomItem);
  };

  // 顺序下一题（未练习的）
  const getNextUnpracticed = () => {
    const unpracticed = items.filter((item) => !item.isPracticed);
    if (unpracticed.length === 0) {
      alert('All questions have been practiced!');
      return;
    }
    loadItem(unpracticed[0]);
  };

  // 加载题目
  const loadItem = async (item: ShadowingItem) => {
    // 切题前停止录音组件的播放，避免串音
    try {
      // @ts-expect-error - 可选链调用录音组件的内部停止播放方法
      audioRecorderRef.current?.stopPlayback?.();
    } catch {}
    // 停止页面音频播放并复位
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.playbackRate = playbackRate;
      }
    } catch {}
    setCurrentItem(item);
    setSelectedWords([]);
    setPreviousWords([]);
    setCurrentRecordings([]);
    setPracticeStartTime(new Date());
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
          console.log('加载到之前的会话数据:', data.session);
          console.log('还原的生词:', data.session.picked_preview);
          setCurrentSession(data.session);
          if (data.session.status === 'completed') {
            setPracticeComplete(true);
          }

          // 将之前的生词设置为 previousWords
          setPreviousWords(data.session.picked_preview || []);

          // 还原AIExplanation - 从数据库获取所有单词的最新Explanation
          // 注意：这里不再并行请求所有Explanation，而是让DynamicExplanation组件按需加载
          // 这样可以避免一次性发起大量API请求

          // 重新生成录音的signed URL，因为之前的URL可能已过期
          const recordingsWithValidUrls = await Promise.all(
            (data.session.recordings || []).map(async (recording: AudioRecording) => {
              try {
                // 从fileName中提取路径
                const filePath = recording.fileName;
                if (!filePath) return recording;

                // 重新生成signed URL
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                );

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
          console.log('没有找到之前的会话数据');
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
        alert('添加生词失败，请重试');
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

          console.log('保存生词到数据库:', saveData);

          const response = await fetch('/api/shadowing/session', {
            method: 'POST',
            headers,
            body: JSON.stringify(saveData),
          });

          if (response.ok) {
            console.log('生词已保存到数据库');
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

        console.log('移除生词后保存到数据库:', saveData);

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          console.log('生词移除已保存到数据库');
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
    if (!confirm(`确定要删除生词 "${wordToRemove.word}" 吗？这将从生词表中永久删除。`)) {
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
            console.log('生词已从生词表中删除');
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

        console.log('移除之前的生词后保存到数据库:', saveData);

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          console.log('之前的生词移除已保存到数据库');
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

        console.log('保存录音数据到数据库:', saveData);
        console.log('保存的生词:', selectedWords);

        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('录音已自动保存到数据库:', result);
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
          console.log('录音删除已同步到数据库');
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

  // 处理录音选择（用于Re-score）
  const handleRecordingSelected = (recording: AudioRecording) => {
    console.log('选择录音进行评分:', recording);
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
          notes: '',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);

        // 更新当前items状态
        setItems((prev) =>
          prev.map((item) => (item.id === currentItem.id ? { ...item, status: 'draft' } : item)),
        );

        alert('草稿已保存');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 检查生词是否已有AIExplanation
  const checkExistingExplanation = async (word: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.entries && data.entries.length > 0) {
          const entry = data.entries[0];
          if (entry.explanation) {
            setWordExplanations((prev) => ({
              ...prev,
              [word]: entry.explanation,
            }));
            console.log(`从单词本找到Explanation: ${word}`, entry.explanation);
            return true;
          }
        }
      }
    } catch (error) {
      console.error('检查已有Explanation失败:', error);
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
        console.log('单词本数据:', data);
        console.log(
          '中秋节相关条目:',
          data.entries.filter((entry: { term: string }) => entry.term.includes('中秋')),
        );
        alert(`单词本中有 ${data.entries.length} 个条目`);
      } else {
        console.error('获取单词本数据失败:', response.status);
      }
    } catch (error) {
      console.error('调试单词本数据失败:', error);
    }
  };

  // 批量生成AIExplanation
  const generateBatchExplanations = async () => {
    if (isGeneratingBatchExplanation || selectedWords.length === 0) return;

    // 过滤出还没有Explanation的生词
    const wordsNeedingExplanation = selectedWords.filter(
      (item) => !item.explanation && !wordExplanations[item.word],
    );

    if (wordsNeedingExplanation.length === 0) {
      alert('所有生词都已经有Explanation了！');
      return;
    }

    setIsGeneratingBatchExplanation(true);
    setBatchExplanationProgress({
      current: 0,
      total: wordsNeedingExplanation.length,
      status: '准备生成AIExplanation...',
    });

    try {
      const headers = await getAuthHeaders();

      // 并发处理：为每个生词单独调用API
      const explanationPromises = wordsNeedingExplanation.map(async (item, index) => {
        try {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            current: index,
            status: `正在为 "${item.word}" 生成AIExplanation...`,
          }));

          // 预检：AI权限 + API限额
          try {
            const authHeaders = await getAuthHeaders();
            const precheckRes = await fetch('/api/ai/precheck', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({ provider: 'deepseek', model: 'deepseek-chat' }),
            });
            if (!precheckRes.ok) {
              const j = await precheckRes.json().catch(() => ({} as Record<string, unknown>));
              const msg = j?.reason || (precheckRes.status === 429 ? 'API 使用已达上限' : '无权限使用所选模型');
              alert(msg);
              return null;
            }
          } catch (e) {
            console.error('预检失败', e);
            alert('暂时无法进行AI生成，请稍后再试');
            return null;
          }

          const response = await fetch('/api/vocab/explain', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              entry_ids: [],
              native_lang: userProfile?.native_lang || language, // 优先使用用户母语，否则使用界面语言
              provider: 'deepseek',
              model: 'deepseek-chat',
              temperature: 0.7,
              word_info: {
                term: item.word,
                lang: item.lang,
                context: item.context,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();

            if (data.explanations && data.explanations.length > 0) {
              return {
                word: item.word,
                explanation: data.explanations[0],
              };
            }
          }

          return null;
        } catch (error) {
          console.error(`为生词 "${item.word}" 生成AIExplanation时出错:`, error);
          return null;
        }
      });

      // 等待所有Explanation生成完成
      const results = await Promise.all(explanationPromises);
      const successfulResults = results.filter((result) => result !== null);

      if (successfulResults.length > 0) {
        // 更新Explanation缓存
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

        // 更新selectedWords中的Explanation
        setSelectedWords((prev) =>
          prev.map((item) => {
            const explanation = newExplanations[item.word];
            return explanation ? { ...item, explanation } : item;
          }),
        );

        setBatchExplanationProgress((prev) => ({
          ...prev,
          current: successfulResults.length,
          status: `成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成Explanation！`,
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
              // 批量AIExplanation已保存到数据库
            }
          } catch (error) {
            console.error('保存批量AIExplanation时出错:', error);
          }
        }

        // 显示成功提示
        if (successfulResults.length === wordsNeedingExplanation.length) {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            status: `✅ 成功为所有 ${successfulResults.length} 个生词生成Explanation！`,
          }));
        } else {
          setBatchExplanationProgress((prev) => ({
            ...prev,
            status: `⚠️ 成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成Explanation`,
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
        alert('没有成功生成任何AIExplanation，请重试');
      }
    } catch (error) {
      console.error('批量生成AIExplanation失败:', error);
      alert(`批量生成AIExplanation失败：${error instanceof Error ? error.message : '请重试'}`);
    } finally {
      setIsGeneratingBatchExplanation(false);
    }
  };

  // 生成AIExplanation
  const generateWordExplanation = async (word: string, context: string, wordLang: string) => {
    if (isGeneratingExplanation) return;

    // 先检查是否已有Explanation
    const hasExisting = await checkExistingExplanation(word);
    if (hasExisting) {
      return; // 如果已有Explanation，直接返回
    }

    setIsGeneratingExplanation(true);
    setGeneratingWord(word);

    try {
      const headers = await getAuthHeaders();

      // 优先使用 entry_ids（写回生词本），找不到再回退到 word_info
      let entryId: string | null = null;
      try {
        const searchRes = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}`, {
          headers,
        });
        if (searchRes.ok) {
          const data = await searchRes.json();
          const entries = Array.isArray(data?.entries) ? data.entries : [];
          const matched = entries.find(
            (e: { id?: string; term?: string; lang?: string }) =>
              e && e.id && e.term === word && (!wordLang || e.lang === wordLang),
          );
          if (matched?.id) entryId = matched.id as string;
        }
      } catch (e) {
        console.warn('搜索生词本条目失败，回退到 word_info 模式:', e);
      }

      const payload: {
        native_lang: string;
        provider: string;
        model: string;
        temperature: number;
        entry_ids?: string[];
        word_info?: { term: string; lang: string; context?: string };
      } = {
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

      // 预检：AI权限 + API限额
      try {
        const authHeaders = await getAuthHeaders();
        const precheckRes = await fetch('/api/ai/precheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ provider: payload.provider, model: payload.model }),
        });
        if (!precheckRes.ok) {
          const j = await precheckRes.json().catch(() => ({} as Record<string, unknown>));
          const msg = j?.reason || (precheckRes.status === 429 ? 'API 使用已达上限' : '无权限使用所选模型');
          alert(msg);
          return;
        }
      } catch (e) {
        console.error('预检失败', e);
        alert('暂时无法进行AI生成，请稍后再试');
        return;
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

          // 更新Explanation缓存，让DynamicExplanation组件能立即显示
          setExplanationCache((prev) => ({
            ...prev,
            [word]: explanation,
          }));

          // 将Explanation保存到生词数据中
          setSelectedWords((prev) =>
            prev.map((item) => (item.word === word ? { ...item, explanation } : item)),
          );

          // 同时更新之前的生词中的Explanation（如果存在）
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

              console.log('保存AIExplanation到数据库:', saveData);

              const saveResponse = await fetch('/api/shadowing/session', {
                method: 'POST',
                headers,
                body: JSON.stringify(saveData),
              });

              if (saveResponse.ok) {
                console.log('AIExplanation已保存到数据库');
              } else {
                console.error('保存AIExplanation失败');
              }
            } catch (error) {
              console.error('保存AIExplanation时出错:', error);
            }
          }
        }
      } else {
        const errorData = await response.json();
        alert(`生成Explanation失败：${errorData.error}`);
      }
    } catch (error) {
      console.error('生成Explanation失败:', error);
      alert('生成Explanation失败，请重试');
    } finally {
      setIsGeneratingExplanation(false);
      setGeneratingWord(null);
    }
  };

  // 播放/暂停音频（统一控制页面 <audio> 元素）
  const playAudio = () => {
    if (!currentItem?.audio_url) return;
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
    } else {
      el.pause();
    }
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
        alert('没有找到转录文字，无法进行评分');
        return;
      }

      // 获取原文
      const originalText = currentItem.text;

      // 使用Sentence分析计算Overall Score
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
      alert(`评分失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsScoring(false);
    }
  };

  // 简单直观的Sentence对比分析
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

    // 分析每个Sentence
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

      // 计算Sentence匹配度
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
            issues.push(`遗漏字符: ${missingItems.join('')}`);
          } else {
            issues.push(`遗漏单词: ${missingItems.join(', ')}`);
          }
        }
      } else {
        status = 'missing';
        issues.push('大部分内容未说出');
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
        errors.push(`"${error.original}" 说成了 "${error.error}"`);
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
            console.log(`自动保存了 ${savedVocabCount} 个生词`);
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
          notes: '',
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
      let message = '练习完成并保存！';
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
      alert('练习已完成，但部分数据同步可能延迟');
    } finally {
      setSaving(false);
    }
  };

  // 导入到生词本
  const importToVocab = async () => {
    if (selectedWords.length === 0) {
      alert('没有新的生词可以导入');
      return;
    }

    setIsImporting(true);
    try {
      const entries = selectedWords.map((item) => ({
        term: item.word,
        lang: item.lang,
        native_lang: language, // 使用界面语言作为母语
        source: 'shadowing',
        source_id: currentItem?.id,
        context: item.context,
        tags: [],
        explanation: item.explanation || null, // 使用生词数据中的Explanation
      }));

      const headers = await getAuthHeaders();
      const response = await fetch('/api/vocab/bulk_create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entries }),
      });

      if (response.ok) {
        alert(`已成功导入 ${entries.length} 个生词`);

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
        alert('导入失败: ' + errorData.error);
      }
    } catch (error) {
      console.error('导入生词失败:', error);
      alert('导入失败');
    } finally {
      setIsImporting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Ensure speaker A:/B: starts on a new line if missing
  const formatSpeakerBreaks = (text: string): string => {
    if (!text) return '';
    let out = text;
    out = out.replace(/([^\n])\s*(A\s*[:：])/g, '$1\n$2');
    out = out.replace(/([^\n])\s*(B\s*[:：])/g, '$1\n$2');
    return out;
  };

  // 移动端检测
  const { actualIsMobile } = useMobile();
  // Enable step gating on both desktop and mobile when not completed
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [highlightPlay, setHighlightPlay] = useState(false);
  const [highlightVocab, setHighlightVocab] = useState(false);
  const [highlightScore, setHighlightScore] = useState(false);
  const gatingActive = !practiceComplete;

  // Step side effects: only enable vocab mode on step 3; auto-disable otherwise
  useEffect(() => {
    if (!currentItem) return;
    setIsVocabMode(step === 3);

    if (step === 4) {
      setShowTranslation(true);
      const available = currentItem.translations ? Object.keys(currentItem.translations) : [];
      const uiLang = (language as 'en' | 'ja' | 'zh');
      const pref = (userProfile?.native_lang as 'en' | 'ja' | 'zh' | undefined) || undefined;
      if (available.includes(uiLang)) {
        setTranslationLang(uiLang);
      } else if (pref && available.includes(pref)) {
        setTranslationLang(pref);
      } else {
        const targets = getTargetLanguages(currentItem.lang);
        if (targets.length > 0) setTranslationLang(targets[0] as 'en' | 'ja' | 'zh');
      }
    } else {
      setShowTranslation(false);
    }
  }, [step, currentItem, userProfile, language]);

  // Button highlight cues per step
  useEffect(() => {
    if (practiceComplete) return;
    let id: number | undefined;
    if (step === 1) {
      setHighlightPlay(true);
      id = window.setTimeout(() => setHighlightPlay(false), 2000);
    } else if (step === 3) {
      setHighlightVocab(true);
      id = window.setTimeout(() => setHighlightVocab(false), 2000);
    } else if (step === 5) {
      setHighlightScore(true);
      id = window.setTimeout(() => setHighlightScore(false), 2000);
    }
    return () => {
      if (id) window.clearTimeout(id);
    };
  }, [step, practiceComplete]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
                前往登录
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
          <div className="space-y-6">
            {/* 手机端顶部工具栏 - 美化 */}
            <div className="flex items-center justify之间 bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    {t.shadowing.shadowing_practice || 'Shadowing 练习'}
                  </h1>
                  <p className="text-xs text-gray-500">跟读练习，提升口语能力</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex items-center gap-2 bg-white/50 hover:bg-white/80 border-white/30 shadow-md"
                aria-label={t.shadowing.shadowing_vocabulary}
              >
                <Menu className="w-4 h-4" />
                {t.shadowing.shadowing_vocabulary}
              </Button>
            </div>

            {/* Mobile stepper and tips */}
            {gatingActive && (
              <Card className="p-4 bg-white border-0 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <PracticeStepper
                    size="sm"
                    currentStep={step}
                    onStepChange={(s)=> setStep(s)}
                    maxStepAllowed={step}
                    labels={[t.shadowing.step1_tip, t.shadowing.step2_tip, t.shadowing.step3_tip, t.shadowing.step4_tip, t.shadowing.step5_tip].map(x=> String(x || 'Step'))}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep((s)=> (Math.max(1, (s as number)-1) as 1|2|3|4|5))} disabled={step===1} aria-label={t.common.back}>{t.common.back}</Button>
                    <Button size="sm" onClick={() => setStep((s)=> (Math.min(5, (s as number)+1) as 1|2|3|4|5))} disabled={step===5} aria-label={t.common.next}>{t.common.next}</Button>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-700">
                  {step===1 && t.shadowing.step1_tip}
                  {step===2 && t.shadowing.step2_tip}
                  {step===3 && t.shadowing.step3_tip}
                  {step===4 && t.shadowing.step4_tip}
                  {step===5 && t.shadowing.step5_tip}
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

            {/* 手机端侧边栏 */}
            <div
              className={`fixed top-0 left-0 h-full w-80 bg-white/95 backdrop-blur-xl z-50 transform transition-all duration-300 shadow-2xl border-r border-white/20 ${
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
                        aria-label={t.common.close || '关闭'}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 侧边栏内容 */}
                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                  {/* 过滤器 */}
                  <div className="p-6 space-y-6">
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
                      className="h-11"
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
                        <SelectTrigger className="h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
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

                    {/* 推荐等级显示 */}
                    {recommendedLevel && (
                      <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                            <span className="text-xs text-white font-bold">!</span>
                          </div>
                          <span className="text-sm font-medium text-blue-700">推荐等级</span>
                        </div>
                        <p className="text-sm text-blue-600 mb-2">
                          {t.shadowing.recommend_level.replace(
                            '{level}',
                            recommendedLevel.toString(),
                          )}
                        </p>
                        {level !== recommendedLevel && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLevel(recommendedLevel)}
                            className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                          >
                            {t.common.confirm}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* 练习状态 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        {t.shadowing.practice_status}
                      </Label>
                      <Select
                        value={practiced}
                        onValueChange={(v: 'all' | 'practiced' | 'unpracticed') => setPracticed(v)}
                      >
                        <SelectTrigger className="h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
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

                    {/* 体裁筛选 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700">
                        {t.shadowing.genre}
                      </Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
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
                        <SelectTrigger className="h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
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
                      <Label className="text-sm font-medium text-gray-700">
                        {t.shadowing.minor_theme}
                      </Label>
                      <Select
                        value={selectedSubtopicId}
                        onValueChange={setSelectedSubtopicId}
                        disabled={selectedThemeId === 'all'}
                      >
                        <SelectTrigger
                          className={`h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow ${selectedThemeId === 'all' ? 'opacity-50' : ''}`}
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
                      <Label className="text-sm font-medium text-gray-700">
                        {t.shadowing.search}
                      </Label>
                      <Input
                        placeholder={t.shadowing.search_placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 bg-white border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                  {/* 统计信息 */}
                  <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                    <div className="text-sm">
                      <div className="mb-3 text-center">
                        <span className="text-lg font-bold text-gray-800">
                          {t.shadowing.total_questions.replace(
                            '{count}',
                            filteredItems.length.toString(),
                          )}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-gray-600 font-medium">
                              {t.shadowing.completed}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-green-600">
                            {filteredItems.filter((item) => item.isPracticed).length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                            <span className="text-gray-600 font-medium">{t.shadowing.draft}</span>
                          </div>
                          <span className="text-lg font-bold text-yellow-600">
                            {
                              filteredItems.filter(
                                (item) => item.status === 'draft' && !item.isPracticed,
                              ).length
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                            <span className="text-gray-600 font-medium">
                              {t.shadowing.not_started}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-gray-600">
                            {
                              filteredItems.filter(
                                (item) => !item.isPracticed && item.status !== 'draft',
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 题目列表 */}
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="p-6 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                        <p className="text-gray-500 font-medium">加载中...</p>
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
                      <div className="space-y-3 p-4">
                        {filteredItems.map((item, index) => (
                          <div
                            key={item.id}
                            className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 ${
                              currentItem?.id === item.id
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-lg transform scale-[1.02]'
                                : item.isPracticed
                                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:from-green-100 hover:to-emerald-100 hover:shadow-md'
                                  : item.status === 'draft'
                                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 hover:from-yellow-100 hover:to-amber-100 hover:shadow-md'
                                    : 'bg-white border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:border-gray-300'
                            }`}
                            onClick={() => {
                              loadItem(item);
                              setMobileSidebarOpen(false);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex items-center gap-2">
                                    {item.isPracticed ? (
                                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                      </div>
                                    ) : item.status === 'draft' ? (
                                      <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-yellow-600" />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                        <Circle className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                    <span className="text-sm text-gray-500 font-bold min-w-[2rem]">
                                      {index + 1}.
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">
                                    {item.subtopic ? item.subtopic.title : item.title}
                                  </h4>
                                </div>

                                <div className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                  {item.text.substring(0, 100)}...
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      item.lang === 'en'
                                        ? 'bg-blue-100 text-blue-700'
                                        : item.lang === 'ja'
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-green-100 text-green-700'
                                    }`}
                                  >
                                    {LANG_LABEL[item.lang]}
                                  </span>
                                  <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                    L{item.level}
                                  </span>
                                  {item.cefr && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                      {item.cefr}
                                    </span>
                                  )}
                                  {item.tokens && (
                                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                      {item.tokens}词
                                    </span>
                                  )}
                                </div>

                                {item.isPracticed && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <span className="text-xs text-green-600 font-medium">
                                      已完成练习
                                    </span>
                                  </div>
                                )}
                                {item.status === 'draft' && (
                                  <div className="flex items-center gap-1 mt-2">
                                    <span className="text-xs text-yellow-600 font-medium">
                                      草稿状态
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 手机端主内容区域 */}
            <div className="space-y-6">
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
                  {/* 题目信息 - 手机端优化 */}
                  <Card className="p-6 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-lg rounded-2xl">
                    <div className="mb-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                            {currentItem.title}
                          </h2>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                currentItem.lang === 'en'
                                  ? 'bg-blue-100 text-blue-700'
                                  : currentItem.lang === 'ja'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {LANG_LABEL[currentItem.lang]}
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                              {t.shadowing.level} L{currentItem.level}
                            </span>
                            {currentItem.cefr && (
                              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                {currentItem.cefr}
                              </span>
                            )}
                            {currentItem.tokens && (
                              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                                {currentItem.tokens} {t.shadowing.words || '词'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 手机端操作按钮 */}
                      <div className="grid grid-cols-1 gap-3">
                        <Button
                          onClick={playAudio}
                          variant="outline"
                          size="sm"
                          className={`h-12 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all ${highlightPlay ? 'animate-pulse ring-2 ring-blue-400' : ''}`}
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 mr-2" />
                          ) : (
                            <Play className="w-5 h-5 mr-2" />
                          )}
                          {isPlaying ? 'Pause' : t.shadowing.play_audio}
                        </Button>

                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={saveDraft}
                            disabled={saving}
                            className="h-12 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                          >
                            <Save className="w-5 h-5 mr-2" />
                            {saving ? t.common.loading : t.shadowing.save_draft}
                          </Button>

                          <div className="flex items-center gap-2 w-full">
                            <Button
                              size="sm"
                              onClick={unifiedCompleteAndSave}
                              disabled={saving}
                              className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              {saving ? '保存中...' : '完成'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-12"
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
                        </div>
                      </div>
                    </div>

                    {/* 生词选择模式切换（仅步骤3或完成后） */}
                    {(!gatingActive || step === 3) && (
                    <div className="mb-4">
                      <Button
                        variant={isVocabMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsVocabMode(!isVocabMode)}
                        className={`w-full ${highlightVocab ? 'animate-pulse ring-2 ring-amber-400' : ''}`}
                      >
                        {isVocabMode ? t.shadowing.vocab_mode_on : t.shadowing.vocab_mode_off}
                      </Button>
                      {isVocabMode && (
                        <div className="mt-2 space-y-2">
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                            💡 <strong>选词提示：</strong>
                            拖拽选择单词或短语，松开鼠标后稍等（不超过50个字符），选择完成后会显示确认按钮
                          </div>
                          <p className="text-sm text-blue-600">
                            {t.shadowing.click_words_to_select || '点击文本中的单词来选择生词'}
                          </p>
                          {/* 确认面板已移动到正文下方 */}
                        </div>
                      )}
                    </div>
                    )}

                    {/* 桌面端第4步翻译外置卡片移除，改为内嵌到正文模块顶部的黄色框 */}
                    {!actualIsMobile && step === 4 && currentItem && (
                      <Card className="hidden">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-white text-lg">🌐</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">{t.shadowing.translation || '翻译'}</h3>
                            <p className="text-sm text-gray-600">多语言翻译支持</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer p-3 bg-white/80 rounded-xl border border-indigo-200 hover:bg白 transition-colors">
                              <input
                                type="checkbox"
                                checked={showTranslation}
                                onChange={(e) => setShowTranslation(e.target.checked)}
                                className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="font-medium">{t.shadowing.show_translation || '显示翻译'}</span>
                            </label>
                            {showTranslation && (
                              <select
                                className="h-11 px-4 py-2 bg白 border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium"
                                value={translationLang}
                                onChange={(e) => setTranslationLang(e.target.value as 'en' | 'ja' | 'zh')}
                              >
                                {getTargetLanguages(currentItem.lang).map((lang) => (
                                  <option key={lang} value={lang}>
                                    {getLangName(lang)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {showTranslation && currentItem.translations && currentItem.translations[translationLang] ? (
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
                              <h3 className="text-lg font-semibold text-gray-700 mb-2">暂无翻译</h3>
                              <p className="text-gray-500">可能尚未生成翻译内容</p>
                            </div>
                          ) : null}
                        </div>
                      </Card>
                    )}

                    {/* 文本内容（步骤>=2或完成后） */}
                    {(!gatingActive || step >= 2) && (
                    <div id="shadowing-text" className="p-4 bg-gray-50 rounded-lg">
                    {/* 第4步：在正文模块内部顶部显示黄色翻译框（与中文一致，无设备与 showTranslation 限制） */}
                    {step === 4 && currentItem && currentItem.translations && currentItem.translations[translationLang] && (
                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <div className="text-sm text-gray-600 mb-1">{t.shadowing.translation || '翻译'}</div>
                        <div className="whitespace-pre-wrap text-base text-gray-800">{formatSpeakerBreaks(currentItem.translations[translationLang])}</div>
                      </div>
                    )}
                      {isVocabMode ? (
                        <>
                          <SelectablePassage
                            text={(() => {
                              // 与普通模式一致的文本格式化：处理 \n 和按说话者分行
                              const formatDialogueText = (text: string): string => {
                                if (!text) return '';

                                // 统一各种换行表示
                                let formatted = text
                                  .replace(/\r\n/g, '\n')
                                  .replace(/\r/g, '\n')
                                  .replace(/<br\s*\/?\s*>/gi, '\n')
                                  .replace(/&#10;|&#13;/g, '\n');
                                for (let i = 0; i < 3 && /\\\n/.test(formatted); i += 1) {
                                  formatted = formatted.replace(/\\\n/g, '\n');
                                }

                                // 如果包含换行符，则清理并保持换行
                                if (formatted.includes('\n')) {
                                  return formatted
                                    .split('\n')
                                    .map((line) => line.trim())
                                    .filter((line) => line.length > 0)
                                    .join('\n');
                                }

                                // 按说话者分割（A: / B: ...）
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

                              return formatDialogueText(currentItem.text);
                            })()}
                            lang="en"
                            onSelectionChange={handleTextSelection}
                            clearSelection={clearSelection}
                            disabled={false}
                            className="text-base leading-relaxed"
                          />
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
                        <div className="text-base leading-relaxed">
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

                            // 获取所有Selected vocabulary（包括之前的和本次的）
                            const allSelectedWords = [...previousWords, ...selectedWords];

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

                                  // 检查从当前位置开始的多个字符是否组成Selected vocabulary
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
                              // 英文处理：支持多词/整句短语高亮（按字符滑窗匹配所选词组）
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
                                      <HoverExplanation key={`${lineIndex}-${i}`} word={word} explanation={explanation}>
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

                    {/* 音频播放器（步骤5隐藏） */}
                    {currentItem.audio_url && (!gatingActive || step !== 5) && (
                      <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-blue-700">
                            {t.shadowing.original_audio_text}
                          </span>
                          {currentItem.duration_ms && (
                            <span className="text-xs text-blue-600">
                              时长: {Math.round(currentItem.duration_ms / 1000)}秒
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-blue-700">Speed</span>
                            <div className="flex flex-wrap gap-1">
                              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((r) => (
                                <button
                                  key={r}
                                  onClick={() => {
                                    setPlaybackRate(r);
                                    if (audioRef.current) audioRef.current.playbackRate = r;
                                  }}
                                  className={`px-2 py-0.5 rounded text-xs border ${
                                    playbackRate === r
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                  }`}
                                >
                                  {r}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <audio
                          controls
                          src={currentItem.audio_url}
                          preload="none"
                          className="w-full"
                          ref={audioRef}
                          onPlay={() => {
                            if (audioRef.current) audioRef.current.playbackRate = playbackRate;
                            setIsPlaying(true);
                          }}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => setIsPlaying(false)}
                        />
                      </div>
                    )}
                  </Card>

                  {/* 生词区域 - 手机端优化 */}
                  {previousWords.length > 0 && (
                    <Card className="p-4">
                      <h3 className="text-lg font-semibold text-gray-600 mb-3">
                        之前的生词 ({previousWords.length})
                      </h3>

                      <div className="space-y-3">
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
                                    title="发音"
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
                                  {generatingWord === item.word ? '生成中...' : 'AIExplanation'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePreviousWord(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  删除
                                </Button>
                              </div>
                            </div>

                            {/* AIExplanation显示 */}
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

                  {/* 本次选中的生词 */}
                  {selectedWords.length > 0 && (
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-blue-600">
                          本次选中的生词 ({selectedWords.length})
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={generateBatchExplanations}
                            disabled={isGeneratingBatchExplanation}
                            className="text-green-600 hover:text-green-800 border-green-300"
                          >
                            {isGeneratingBatchExplanation ? '生成中...' : '一键AIExplanation'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedWords([])}>
                            清空
                          </Button>
                          <Button size="sm" onClick={importToVocab} disabled={isImporting}>
                            {isImporting ? '导入中...' : '导入'}
                          </Button>
                        </div>
                      </div>

                      {/* 批量AIExplanation进度显示 */}
                      {isGeneratingBatchExplanation && batchExplanationProgress.total > 0 && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-green-700">
                                AIExplanation生成进度
                              </span>
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
                                    title="发音"
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
                                  {generatingWord === item.word ? '生成中...' : 'AIExplanation'}
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

                            {/* AIExplanation显示 */}
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

                  {/* 翻译模块 - 移动端（仅步骤4或完成后） */}
                  {currentItem && (!gatingActive || step === 4) && (
                    <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">🌐</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.translation || '翻译'}
                          </h3>
                          <p className="text-sm text-gray-600">多语言翻译支持</p>
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
                                setTranslationLang(e.target.value as 'en' | 'ja' | 'zh')
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
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">暂无翻译</h3>
                            <p className="text-gray-500">可能尚未生成翻译内容</p>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <span className="text-2xl">🌐</span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                              开启翻译功能
                            </h3>
                            <p className="text-gray-500">勾选上方选项以显示翻译内容</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* 录音练习区域（仅步骤5或完成后） */}
                  {(!gatingActive || step >= 5) && (
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

                  {/* 评分区域（仅步骤5或完成后） */}
                  {!scoringResult && (!gatingActive || step >= 5) && (
                    <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">📊</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.practice_scoring || '练习评分'}
                          </h3>
                          <p className="text-sm text-gray-600">AI智能评分，精准分析发音</p>
                        </div>
                      </div>

                      {currentRecordings.length > 0 ? (
                        <div className="text-center space-y-4">
                          <div className="p-4 bg-white/80 rounded-xl border border-purple-200">
                            <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <p className="text-gray-700 font-medium mb-2">
                              {t.shadowing.recording_completed || 'Recording completed!'}
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
                                {t.shadowing.scoring_in_progress || 'Scoring...'}
                              </>
                            ) : (
                              <>
                                <span className="mr-2">🚀</span>
                                {t.shadowing.start_scoring || 'Start scoring'}
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
                            {t.shadowing.no_recording_yet || 'No recording yet'}
                          </h3>
                          <p className="text-gray-500 leading-relaxed">
                            {t.shadowing.complete_recording_first}
                          </p>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* 评分结果区域 */}
                  {scoringResult && (
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
                            <p className="text-sm text-gray-600">AI智能分析完成</p>
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
                            ? t.shadowing.re_scoring_in_progress || '重新Scoring...'
                            : t.shadowing.re_score || 'Re-score'}
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

                            {/* Detailed Analysis - 手机端 */}
                            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-sm text-blue-600 mb-2">
                                {t.shadowing.detailed_analysis || 'Detailed Analysis'}
                              </div>
                              <div className="text-sm text-gray-700">
                                {(() => {
                                  // 处理中文文本，按字符分割而不是按单词分割

                                  // 使用简单Sentence分析（支持中文和英文）
                                  const simpleAnalysis = performSimpleAnalysis(
                                    scoringResult.originalText,
                                    scoringResult.transcription,
                                  );
                                  const { sentenceAnalysis, overallScore } = simpleAnalysis;

                                  return (
                                    <div>
                                      {/* Overall Score */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">
                                          {t.shadowing.overall_score}:
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                          {overallScore}%
                                        </div>
                                      </div>

                                      {/* Sentence分析 */}
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
                                                {t.shadowing.sentence || 'Sentence'} {idx + 1}
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
                                                  {t.shadowing.issues || 'Issues'}:
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
                                          '分析基于Sentence级别，更直观地显示发音Issues'}
                                      </div>
                                    </div>
                                  );

                                  return (
                                    <div>
                                      {/* Overall Score */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">
                                          {t.shadowing.overall_score}:
                                        </div>
                                        <div className="text-2xl font-bold text-blue-600">
                                          {overallScore}%
                                        </div>
                                      </div>

                                      {/* Sentence分析 */}
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
                                                {t.shadowing.sentence || 'Sentence'} {idx + 1}
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
                                                  {t.shadowing.issues || 'Issues'}:
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
                                          '分析基于Sentence级别，更直观地显示发音Issues'}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!practiceComplete && (
                        <Button
                          onClick={unifiedCompleteAndSave}
                          className="bg-green-600 hover:bg-green-700 w-full mt-4"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          {t.shadowing.complete_and_save}
                        </Button>
                      )}
                    </Card>
                  )}

                  {/* 完成后成功状态卡片（仅桌面端） */}
                  {practiceComplete && !actualIsMobile && (
                    <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">✅</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{t.shadowing.practice_done_title}</h3>
                          <p className="text-sm text-gray-600">{t.shadowing.practice_done_desc}</p>
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
                          {t.shadowing.practice_again}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrentItem(null);
                          }}
                        >
                          {t.shadowing.back_to_catalog}
                        </Button>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 桌面端布局 - 优化滚动体验 */
          <div className="flex gap-6 min-h-[700px]">
            {/* 左侧题库列表 */}
            <div
              className={`${sidebarCollapsed ? 'w-16' : 'w-72'} flex-shrink-0 transition-all duration-300 max-h-[85vh] overflow-y-auto`}
            >
              <Card className="min-h-full flex flex-col bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl">
                {/* 标题和折叠按钮 */}
                <div className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {!sidebarCollapsed && (
                        <>
                          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <Filter className="w-4 h-4" />
                          </div>
                          <h3 className="font-bold text-lg">
                            {t.shadowing.shadowing_vocabulary || 'Shadowing 题库'}
                          </h3>
                        </>
                      )}
                      {!sidebarCollapsed && (
                        <button
                          onClick={() => fetchItems()}
                          className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/20 transition-colors"
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
                      className="text-white hover:bg-white/20"
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

                      {/* 推荐等级显示 */}
                      {recommendedLevel && (
                        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-xs text-white font-bold">!</span>
                            </div>
                            <span className="text-sm font-medium text-blue-700">推荐等级</span>
                          </div>
                          <p className="text-sm text-blue-600 mb-2">
                            推荐等级: L{recommendedLevel}
                          </p>
                          {level !== recommendedLevel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLevel(recommendedLevel)}
                              className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                            >
                              使用
                            </Button>
                          )}
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
                        <Label className="text-sm font-medium text-gray-700">搜索</Label>
                        <Input
                          placeholder="搜索标题、主题..."
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

                    {/* 统计信息 */}
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                      <div className="text-sm">
                        <div className="mb-3 text-center">
                          <span className="text-lg font-bold text-gray-800">
                            {t.shadowing.total_questions.replace(
                              '{count}',
                              filteredItems.length.toString(),
                            )}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <span className="text-gray-600 font-medium">
                                {t.shadowing.completed}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-green-600">
                              {filteredItems.filter((item) => item.isPracticed).length}
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <span className="text-gray-600 font-medium">{t.shadowing.draft}</span>
                            </div>
                            <span className="text-lg font-bold text-yellow-600">
                              {
                                filteredItems.filter(
                                  (item) => item.status === 'draft' && !item.isPracticed,
                                ).length
                              }
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                              <span className="text-gray-600 font-medium">
                                {t.shadowing.not_started}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-gray-600">
                              {
                                filteredItems.filter(
                                  (item) => !item.isPracticed && item.status !== 'draft',
                                ).length
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 题目列表 */}
                    <div className="flex-1">
                      {loading ? (
                        <div className="p-4 text-center text-gray-500">加载中...</div>
                      ) : filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {t.shadowing.no_questions_found || '没有找到题目'}
                        </div>
                      ) : (
                        <div className="space-y-2 p-2">
                          {filteredItems.map((item, index) => (
                            <div
                              key={item.id}
                              className={`p-3 rounded border cursor-pointer transition-colors ${
                                currentItem?.id === item.id
                                  ? 'bg-blue-50 border-blue-200'
                                  : item.isPracticed
                                    ? 'bg-green-50 border-green-200 hover:bg-green-100'
                                    : item.status === 'draft'
                                      ? 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
                                      : 'hover:bg-gray-50'
                              }`}
                              onClick={() => loadItem(item)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    {item.isPracticed ? (
                                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                    ) : item.status === 'draft' ? (
                                      <FileText className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    )}
                                    <span className="text-sm text-gray-500 font-medium min-w-[1.5rem]">
                                      {index + 1}.
                                    </span>
                                    <span className="text-sm font-medium truncate">
                                      {item.subtopic ? item.subtopic.title : item.title}
                                      {item.isPracticed && (
                                        <span className="ml-1 text-green-600">✓</span>
                                      )}
                                      {item.status === 'draft' && (
                                        <span className="ml-1 text-yellow-600">📝</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {LANG_LABEL[item.lang]} • L{item.level}
                                    {item.cefr && ` • ${item.cefr}`}
                                    {item.isPracticed && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        {t.shadowing.completed}
                                      </span>
                                    )}
                                    {item.status === 'draft' && !item.isPracticed && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                        {t.shadowing.draft}
                                      </span>
                                    )}
                                  </div>
                                  {item.isPracticed && (
                                    <div className="mt-2">
                                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                        <span className="flex items-center gap-1">
                                          <Mic className="w-3 h-3" />
                                          {item.stats.recordingCount} 录音
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <BookOpen className="w-3 h-3" />
                                          {item.stats.vocabCount} 生词
                                        </span>
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {formatTime(item.stats.practiceTime)}
                                        </span>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                          className="bg-green-500 h-1.5 rounded-full"
                                          style={{ width: '100%' }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                  {!item.isPracticed && (
                                    <div className="mt-2">
                                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            item.status === 'draft'
                                              ? 'bg-yellow-500'
                                              : 'bg-gray-300'
                                          }`}
                                          style={{ width: item.status === 'draft' ? '50%' : '0%' }}
                                        ></div>
                                      </div>
                                      <div className="text-xs text-gray-400 mt-1">
                                        {item.status === 'draft'
                                          ? t.shadowing.draft
                                          : t.shadowing.not_started}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
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
                  {/* Desktop stepper and tips (when not completed) */}
                  {gatingActive && (
                    <Card className="p-4 bg-white border-0 shadow-sm">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                  <PracticeStepper
                    size="md"
                    currentStep={step}
                    onStepChange={(s)=> setStep(s)}
                    maxStepAllowed={step}
                    labels={[t.shadowing.step1_tip, t.shadowing.step2_tip, t.shadowing.step3_tip, t.shadowing.step4_tip, t.shadowing.step5_tip].map(x=> String(x || 'Step'))}
                  />
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setStep((s)=> (Math.max(1, (s as number)-1) as 1|2|3|4|5))} disabled={step===1}>{t.common.back}</Button>
                          <Button size="sm" onClick={() => setStep((s)=> (Math.min(5, (s as number)+1) as 1|2|3|4|5))} disabled={step===5}>{t.common.next}</Button>
                        </div>
                      </div>
                      <div className="mt-3 text-sm text-gray-700">
                        {step===1 && t.shadowing.step1_tip}
                        {step===2 && t.shadowing.step2_tip}
                        {step===3 && t.shadowing.step3_tip}
                        {step===4 && t.shadowing.step4_tip}
                        {step===5 && t.shadowing.step5_tip}
                      </div>
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
                        <Button
                          onClick={playAudio}
                          variant="outline"
                          size="sm"
                          className="h-11 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5 mr-2" />
                          ) : (
                            <Play className="w-5 h-5 mr-2" />
                          )}
                          {isPlaying ? 'Pause' : 'Play Audio'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={saveDraft}
                          disabled={saving}
                          className="h-11 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
                        >
                          <Save className="w-5 h-5 mr-2" />
                          {saving ? '保存中...' : '保存草稿'}
                        </Button>

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

                        
                      </div>
                    </div>

                    {/* 生词选择模式切换（仅步骤3或完成后） */}
                    {(!gatingActive || step === 3) && (
                    <div className="mb-4">
                      <Button
                        variant={isVocabMode ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setIsVocabMode(!isVocabMode)}
                        className={highlightVocab ? 'animate-pulse ring-2 ring-amber-400' : ''}
                      >
                        {isVocabMode ? '退出生词模式' : '生词选择模式'}
                      </Button>
                      {isVocabMode && (
                        <div className="mt-2 space-y-2">
                          <p className="text-sm text-blue-600">点击文本中的单词来选择生词</p>
                          {/* 确认面板已移动到正文下方 */}
                        </div>
                      )}
                    </div>
                    )}

                    {/* 文本内容（步骤>=2或完成后） */}
                    {(!gatingActive || step >= 2) && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      {isVocabMode ? (
                        <>
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
                            lang={currentItem.lang || 'en'}
                            onSelectionChange={handleTextSelection}
                            clearSelection={clearSelection}
                            disabled={false}
                            className="text-lg leading-relaxed"
                          />
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

                            // 获取所有Selected vocabulary（包括之前的和本次的）
                            const allSelectedWords = [...previousWords, ...selectedWords];

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

                                  // 检查从当前位置开始的多个字符是否组成Selected vocabulary
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
                              // 英文处理：支持多词/整句短语高亮（按字符滑窗匹配所选词组）
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
                                      <HoverExplanation key={`${lineIndex}-${i}`} word={word} explanation={explanation}>
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

                    {/* 音频播放器（步骤5隐藏） */}
                    {currentItem.audio_url && (!gatingActive || step !== 5) && (
                      <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-blue-700">原文音频</span>
                          {currentItem.duration_ms && (
                            <span className="text-xs text-blue-600">
                              时长: {Math.round(currentItem.duration_ms / 1000)}秒
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            <span className="text-xs text-blue-700">Speed</span>
                            <div className="flex flex-wrap gap-1">
                              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((r) => (
                                <button
                                  key={r}
                                  onClick={() => {
                                    setPlaybackRate(r);
                                    if (audioRef.current) audioRef.current.playbackRate = r;
                                  }}
                                  className={`px-2 py-0.5 rounded text-xs border ${
                                    playbackRate === r
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                                  }`}
                                >
                                  {r}x
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <audio
                          controls
                          src={currentItem.audio_url}
                          preload="none"
                          className="w-full"
                          ref={audioRef}
                          onPlay={() => {
                            if (audioRef.current) audioRef.current.playbackRate = playbackRate;
                            setIsPlaying(true);
                          }}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => setIsPlaying(false)}
                        />
                      </div>
                    )}
                  </Card>

                    {/* 翻译模块（仅步骤4或完成后） */}
                    {currentItem && (!gatingActive || step === 4) && (
                    <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">🌐</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">翻译</h3>
                          <p className="text-sm text-gray-600">多语言翻译支持</p>
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
                              className="h-11 px-4 py-2 bg-white border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-medium w-full"
                              value={translationLang}
                              onChange={(e) =>
                                setTranslationLang(e.target.value as 'en' | 'ja' | 'zh')
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
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">暂无翻译</h3>
                            <p className="text-gray-500">可能尚未生成翻译内容</p>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <span className="text-2xl">🌐</span>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                              开启翻译功能
                            </h3>
                            <p className="text-gray-500">勾选上方选项以显示翻译内容</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* 之前的生词（仅步骤3或完成后） */}
                  {previousWords.length > 0 && (!gatingActive || step === 3) && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-600">
                          之前的生词 ({previousWords.length})
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
                                    title="发音"
                                  >
                                    🔊
                                  </Button>
                                </div>
                                <div className="text-sm text-gray-600 mt-1">{item.context}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-gray-500">已导入</div>
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
                                  {generatingWord === item.word ? '生成中...' : 'AIExplanation'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePreviousWord(index)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  删除
                                </Button>
                              </div>
                            </div>

                            {/* AIExplanation显示 */}
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

                  {/* 本次选中的生词（仅步骤3或完成后） */}
                  {selectedWords.length > 0 && (!gatingActive || step === 3) && (
                    <Card className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-blue-600">
                          本次选中的生词 ({selectedWords.length})
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={generateBatchExplanations}
                            disabled={isGeneratingBatchExplanation}
                            className="text-green-600 hover:text-green-800 border-green-300"
                          >
                            {isGeneratingBatchExplanation ? '生成中...' : '一键AIExplanation'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedWords([])}>
                            清空
                          </Button>
                          <Button size="sm" onClick={importToVocab} disabled={isImporting}>
                            {isImporting ? '导入中...' : '导入到生词本'}
                          </Button>
                        </div>
                      </div>

                      {/* 批量AIExplanation进度显示 */}
                      {isGeneratingBatchExplanation && batchExplanationProgress.total > 0 && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-green-700">
                                AIExplanation生成进度
                              </span>
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
                                    title="发音"
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
                                  {generatingWord === item.word ? '生成中...' : 'AIExplanation'}
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

                            {/* AIExplanation显示 */}
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

                  {/* 录音练习区域（仅步骤5或完成后） */}
                  {(!gatingActive || step >= 5) && (
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

                  {/* 评分区域（仅步骤5或完成后） */}
                  {!scoringResult && (!gatingActive || step >= 5) && (
                    <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-0 shadow-xl rounded-2xl">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                          <span className="text-white text-lg">📊</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">
                            {t.shadowing.practice_scoring || '练习评分'}
                          </h3>
                          <p className="text-sm text-gray-600">AI智能评分，精准分析发音</p>
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
                                Scoring...
                              </>
                            ) : (
                              <>
                                <span className="mr-2">🚀</span>
                                Start scoring
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
                  {scoringResult && (
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
                            <p className="text-sm text-gray-600">AI智能分析完成</p>
                          </div>
                        </div>
                        <Button
                          onClick={() => performScoring(currentTranscription)}
                          disabled={isScoring}
                          variant="outline"
                          size="sm"
                          className="h-8 bg-white hover:bg-gray-50 border-gray-200 text-gray-700 rounded-lg"
                        >
                          {isScoring ? '重新Scoring...' : 'Re-score'}
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

                                    // 使用简单Sentence分析（支持中文和英文）
                                    const simpleAnalysis = performSimpleAnalysis(
                                      scoringResult.originalText,
                                      scoringResult.transcription,
                                    );
                                    const { sentenceAnalysis, overallScore } = simpleAnalysis;

                                    return (
                                      <div>
                                        {/* Overall Score */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">
                                            {t.shadowing.overall_score}:
                                          </div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {overallScore}%
                                          </div>
                                        </div>

                                        {/* Sentence分析 */}
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
                                                  {t.shadowing.sentence || 'Sentence'} {idx + 1}
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
                                                    {t.shadowing.issues || 'Issues'}:
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
                                            '分析基于Sentence级别，更直观地显示发音Issues'}
                                        </div>
                                      </div>
                                    );

                                    return (
                                      <div>
                                        {/* Overall Score */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">
                                            {t.shadowing.overall_score}:
                                          </div>
                                          <div className="text-2xl font-bold text-blue-600">
                                            {overallScore}%
                                          </div>
                                        </div>

                                        {/* Sentence分析 */}
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
                                                  {t.shadowing.sentence || 'Sentence'} {idx + 1}
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
                                                    {t.shadowing.issues || 'Issues'}:
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
                                            '分析基于Sentence级别，更直观地显示发音Issues'}
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

                      {!practiceComplete && (
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
    </main>
  );
}
