"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import SelectablePassage from "@/components/SelectablePassage";
import useUserPermissions from "@/hooks/useUserPermissions";
import AudioRecorder from "@/components/AudioRecorder";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANG_LABEL } from "@/types/lang";
import { useMobile } from "@/contexts/MobileContext";
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
  X
} from "lucide-react";

// 题目数据类型
interface ShadowingItem {
  id: string;
  lang: "ja" | "en" | "zh";
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
    title_cn: string;
    one_line_cn?: string;
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


export default function ShadowingPage() {
  const { t, language, setLanguageFromUserProfile } = useLanguage();
  const { permissions } = useUserPermissions();
  
  // 过滤和筛选状态
  const [lang, setLang] = useState<"ja" | "en" | "zh">("ja");
  const [level, setLevel] = useState<number | null>(null);
  const [practiced, setPracticed] = useState<"all" | "practiced" | "unpracticed">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState<string>("all");
  const [selectedThemeId, setSelectedThemeId] = useState<string>("all");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string>("all");

  // 体裁选项（基于6级难度设计）
  const GENRE_OPTIONS = [
    { value: "all", label: t.shadowing.all_genres },
    { value: "dialogue", label: t.shadowing.dialogue },
    { value: "monologue", label: t.shadowing.monologue },
    { value: "news", label: t.shadowing.news },
    { value: "lecture", label: t.shadowing.lecture }
  ];

  // 题库相关状态
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentItem, setCurrentItem] = useState<ShadowingItem | null>(null);
  const [currentSession, setCurrentSession] = useState<ShadowingSession | null>(null);
  
  // 主题数据状态
  const [themes, setThemes] = useState<Array<{id: string, title: string, desc?: string}>>([]);
  const [subtopics, setSubtopics] = useState<Array<{id: string, title_cn: string, one_line_cn?: string}>>([]);
  
  // 练习相关状态
  const [selectedWords, setSelectedWords] = useState<Array<{word: string, context: string, lang: string, explanation?: {
    gloss_native: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  }}>>([]);
  const [previousWords, setPreviousWords] = useState<Array<{word: string, context: string, lang: string, explanation?: {
    gloss_native: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  }}>>([]);
  const [isVocabMode, setIsVocabMode] = useState(false);
  const [selectedText, setSelectedText] = useState<{word: string, context: string} | null>(null);
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
  
  // AI解释相关状态
  const [wordExplanations, setWordExplanations] = useState<Record<string, {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  }>>({});
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [isGeneratingBatchExplanation, setIsGeneratingBatchExplanation] = useState(false);
  const [batchExplanationProgress, setBatchExplanationProgress] = useState({
    current: 0,
    total: 0,
    status: ''
  });
  
  // 解释缓存
  const [explanationCache, setExplanationCache] = useState<Record<string, {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{example_target: string, example_native: string}>;
  }>>({});
  
  // 用户个人资料状态
  const [userProfile, setUserProfile] = useState<{native_lang?: string} | null>(null);
  
  // 翻译相关状态
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<'en'|'ja'|'zh'>('en');

  // 获取目标语言
  const getTargetLanguages = (sourceLang: string): string[] => {
    switch (sourceLang) {
      case 'zh': return ['en', 'ja'];
      case 'en': return ['ja', 'zh'];
      case 'ja': return ['en', 'zh'];
      default: return [];
    }
  };

  // 获取语言名称
  const getLangName = (lang: string): string => {
    const names = {
      'en': 'English',
      'ja': '日本語',
      'zh': '简体中文'
    };
    return names[lang as keyof typeof names] || lang;
  };

  // 获取用户个人资料
  const fetchUserProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      setTranslationLang(targetLangs[0] as 'en'|'ja'|'zh');
    }
  }, [currentItem]);
  
  // 发音功能
  const speakWord = (word: string, lang: string) => {
    speakTextUtil(word, lang, {
      rate: 0.8, // 稍慢一点，便于学习
      pitch: 1,
      volume: 1
    });
  };
  
  
  // 悬停/点击解释组件
  const HoverExplanation = ({ word, explanation, children }: { 
    word: string,
    explanation?: {gloss_native: string, senses?: Array<{example_target: string, example_native: string}>}, 
    children: React.ReactNode 
  }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [latestExplanation, setLatestExplanation] = useState(explanation);
    
    // 当悬停时，异步获取最新解释（不阻塞显示）
    const handleMouseEnter = async () => {
      setShowTooltip(true);
      
      // 总是获取最新解释，确保与DynamicExplanation同步
      const timer = setTimeout(async () => {
        try {
          const headers = await getAuthHeaders();
          const response = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`, {
            headers
          });
          const data = await response.json();
          
          if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
            const fetchedExplanation = data.entries[0].explanation;
            setLatestExplanation(fetchedExplanation);
            // 不更新缓存，避免循环
          }
        } catch (error) {
          console.error(`获取 ${word} 解释失败:`, error);
        }
      }, 300); // 300ms防抖延迟
      
      return () => clearTimeout(timer);
    };
    
    const tooltipText = latestExplanation?.gloss_native || "已选择的生词";
    
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
  const WordWithPronunciation = ({ word, explanation }: { word: string, explanation?: {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{example_target: string, example_native: string}>;
  } }) => {
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
  const DynamicExplanation = ({ word, fallbackExplanation }: { word: string, fallbackExplanation?: {
    gloss_native: string;
    pronunciation?: string;
    pos?: string;
    senses?: Array<{example_target: string, example_native: string}>;
  } }) => {
    // 优先使用缓存中的最新解释，其次使用fallback解释
    const [latestExplanation, setLatestExplanation] = useState<{
      gloss_native: string;
      pronunciation?: string;
      pos?: string;
      senses?: Array<{example_target: string, example_native: string}>;
    } | undefined>(explanationCache[word] || fallbackExplanation);
    const [loading, setLoading] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    
     // 刷新解释函数 - 强制从数据库获取最新数据
     const refreshExplanation = useCallback(async () => {
       setLoading(true);
       try {
         const headers = await getAuthHeaders();
         const response = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`, { // 添加时间戳避免缓存
           headers
         });
         const data = await response.json();
         
         if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
           const explanation = data.entries[0].explanation;
           setLatestExplanation(explanation);
           // 更新缓存
           setExplanationCache(prev => ({
             ...prev,
             [word]: explanation
           }));
         } else {
           // 如果没有找到解释，清除缓存
           setLatestExplanation(undefined);
           setExplanationCache(prev => {
             const newCache = { ...prev };
             delete newCache[word];
             return newCache;
           });
         }
       } catch (error) {
         console.error(`获取 ${word} 解释失败:`, error);
       } finally {
         setLoading(false);
       }
     }, [word]);
    
     // 初始化时获取最新解释
     useEffect(() => {
       if (!hasInitialized) {
         setHasInitialized(true);
         // 总是获取最新解释，不管缓存中是否有旧解释
         // 直接调用API，避免依赖refreshExplanation
         const fetchInitialExplanation = async () => {
           setLoading(true);
           try {
             const headers = await getAuthHeaders();
             const response = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}&_t=${Date.now()}`, {
               headers
             });
             const data = await response.json();
             
             if (data.entries && data.entries.length > 0 && data.entries[0].explanation) {
               const explanation = data.entries[0].explanation;
               setLatestExplanation(explanation);
               // 不更新缓存，避免循环
             }
           } catch (error) {
             console.error(`获取 ${word} 解释失败:`, error);
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
          <span>{t.shadowing.no_explanation || "暂无解释"}</span>
          <button 
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title="刷新解释"
          >
            🔄
          </button>
        </div>
      );
    }
    
    return (
      <div className="text-sm text-gray-700">
        <div className="mb-2 flex items-center gap-2">
          <strong>{t.shadowing.explanation || "解释"}：</strong>{latestExplanation.gloss_native}
          <button 
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title="刷新解释"
            disabled={loading}
          >
            🔄
          </button>
        </div>
        
        {/* 显示词性信息 */}
        {latestExplanation.pos && (
          <div className="mb-2 text-sm text-gray-600">
            <strong>{t.shadowing.part_of_speech || "词性"}：</strong>{latestExplanation.pos}
          </div>
        )}
        
        {latestExplanation.senses && latestExplanation.senses.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>{t.shadowing.example_sentence || "例句"}：</strong>
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
  const [user, setUser] = useState<{id: string, email?: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recommendedLevel, setRecommendedLevel] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState(false);
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
  
  // 获取认证头
  const getAuthHeaders = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('getAuthHeaders - session:', session ? 'exists' : 'null');
      console.log('getAuthHeaders - access_token:', session?.access_token ? 'exists' : 'null');
      console.log('getAuthHeaders - error:', error);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
        console.log('getAuthHeaders - Authorization header set');
      } else {
        console.log('getAuthHeaders - No access token, using cookie auth');
        // 尝试刷新session
        if (session?.refresh_token) {
          console.log('getAuthHeaders - Attempting to refresh session...');
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshedSession?.access_token) {
            headers['Authorization'] = `Bearer ${refreshedSession.access_token}`;
            console.log('getAuthHeaders - Session refreshed, Authorization header set');
          } else {
            console.log('getAuthHeaders - Session refresh failed:', refreshError);
          }
        }
      }
      
      return headers;
    } catch (error) {
      console.error('getAuthHeaders error:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  };

  // 加载主题数据
  const loadThemes = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/shadowing/themes?lang=${lang}&level=${level || ''}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setThemes(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, [lang, level]);

  // 加载子主题数据
  const loadSubtopics = useCallback(async (themeId: string) => {
    if (themeId === "all") {
      setSubtopics([]);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/admin/shadowing/subtopics?theme_id=${themeId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setSubtopics(data.items || []);
      }
    } catch (error) {
      console.error('Failed to load subtopics:', error);
    }
  }, []);




  // 获取推荐等级
  const fetchRecommendedLevel = useCallback(async () => {
    if (!user) return;
    
      try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/recommended?lang=${lang}`, { headers });
        if (response.ok) {
          const data = await response.json();
          setRecommendedLevel(data.recommended);
        }
      } catch (error) {
      console.error('Failed to fetch recommended level:', error);
    }
  }, [lang, user]);

  // 获取题库列表
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lang) params.set('lang', lang);
      if (level) params.set('level', level.toString());
      if (practiced !== 'all') params.set('practiced', practiced === 'practiced' ? 'true' : 'false');

      const headers = await getAuthHeaders();
      const response = await fetch(`/api/shadowing/catalog?${params.toString()}`, { headers });
      if (response.ok) {
        const data = await response.json();
        const newItems = data.items || [];
        setItems(newItems);
      } else {
        console.error('Failed to fetch items:', response.status, await response.text());
        }
      } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  }, [lang, level, practiced]);

  // 检查用户认证状态
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);
        setAuthLoading(false);
        
        // 如果用户已登录，获取用户个人资料
        if (session?.user) {
          await fetchUserProfile();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthLoading(false);
      }
    };
    
    // 初始检查
    checkAuth();
    
    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed in shadowing:', event, session?.user?.email);
      setUser(session?.user || null);
      
      // 如果用户登录了，获取用户个人资料
      if (session?.user) {
        await fetchUserProfile();
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // 初始加载题库（仅在用户已登录时）
  useEffect(() => {
    if (!authLoading && user) {
      fetchItems();
    fetchRecommendedLevel();
    }
  }, [fetchItems, fetchRecommendedLevel, authLoading, user]);

  // 筛选条件变化时立即刷新题库
  useEffect(() => {
    if (!authLoading && user) {
      fetchItems();
    }
  }, [lang, level, practiced, authLoading, user, fetchItems]);

  // 加载主题数据
  useEffect(() => {
    if (!authLoading && user) {
      loadThemes();
    }
  }, [lang, level, authLoading, user, loadThemes]);

  // 当选择大主题时，加载对应的子主题
  useEffect(() => {
    if (selectedThemeId !== "all") {
      loadSubtopics(selectedThemeId);
    } else {
      setSubtopics([]);
      setSelectedSubtopicId("all");
    }
  }, [selectedThemeId, loadSubtopics]);



  // 过滤显示的题目
  const filteredItems = items.filter(item => {
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (
        item.title.toLowerCase().includes(query) ||
        item.text.toLowerCase().includes(query)
      );
      if (!matchesSearch) return false;
    }

    // 体裁筛选（基于 genre 字段或等级推断的体裁筛选）
    if (theme !== "all") {
      let itemGenre = item.genre || item.meta?.genre || item.meta?.theme || 
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
          6: ['lecture', 'news']
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
    if (selectedThemeId !== "all") {
      // 调试日志
      console.log('大主题筛选:', {
        selectedThemeId,
        itemThemeId: item.theme_id,
        itemTitle: item.title,
        match: item.theme_id === selectedThemeId
      });
      
      if (!item.theme_id || item.theme_id !== selectedThemeId) {
        return false;
      }
    }

    // 小主题筛选（小主题和标题是一对一关系）
    if (selectedSubtopicId !== "all") {
      if (!item.subtopic_id || item.subtopic_id !== selectedSubtopicId) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
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

  // 随机选择未练习的题目
  const getRandomUnpracticed = () => {
    const unpracticed = items.filter(item => !item.isPracticed);
    if (unpracticed.length === 0) {
      alert("所有题目都已练习过！");
        return;
      }
    const randomItem = unpracticed[Math.floor(Math.random() * unpracticed.length)];
    loadItem(randomItem);
  };

  // 顺序下一题（未练习的）
  const getNextUnpracticed = () => {
    const unpracticed = items.filter(item => !item.isPracticed);
    if (unpracticed.length === 0) {
      alert("所有题目都已练习过！");
        return;
      }
    loadItem(unpracticed[0]);
  };

  // 加载题目
  const loadItem = async (item: ShadowingItem) => {
    setCurrentItem(item);
    setSelectedWords([]);
    setPreviousWords([]);
    setCurrentRecordings([]);
    setPracticeStartTime(new Date());
    setPracticeComplete(false);
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
          
          // 将之前的生词设置为 previousWords
          setPreviousWords(data.session.picked_preview || []);
          
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
                
                // 重新生成signed URL
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                
                const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                  .from('tts')
                  .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days
                
                if (signedUrlError) {
                  console.error('重新生成URL失败:', signedUrlError);
                  return recording;
                }
                
                return {
                  ...recording,
                  url: signedUrlData.signedUrl
                };
    } catch (error) {
                console.error('处理录音URL时出错:', error);
                return recording;
              }
            })
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
    const existsInSelected = selectedWords.some(item => 
      item.word === word && item.context === context
    );
    
    // 检查是否在之前的生词中
    const existsInPrevious = previousWords.some(item => 
      item.word === word && item.context === context
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
            picked_preview: allWords
          };
          
          console.log('保存生词到数据库:', saveData);
          
          const response = await fetch('/api/shadowing/session', {
            method: 'POST',
            headers,
            body: JSON.stringify(saveData)
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
          picked_preview: allWords
        };
        
        console.log('移除生词后保存到数据库:', saveData);
        
        const response = await fetch('/api/shadowing/session', {
          method: 'POST',
          headers,
          body: JSON.stringify(saveData)
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
      const searchResponse = await fetch(`/api/vocab/search?term=${encodeURIComponent(wordToRemove.word)}`, {
        headers
      });
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.entries && searchData.entries.length > 0) {
          // 删除生词表中的条目
          const deleteResponse = await fetch('/api/vocab/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              entry_ids: searchData.entries.map((entry: {id: string}) => entry.id)
            })
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
          picked_preview: allWords
        };
        
        console.log('移除之前的生词后保存到数据库:', saveData);
        
        const response = await fetch('/api/shadowing/session', {
        method: 'POST',
          headers,
          body: JSON.stringify(saveData)
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
          picked_preview: [...previousWords, ...selectedWords] // 保存完整的单词对象
        };
        
        console.log('保存录音数据到数据库:', saveData);
        console.log('保存的生词:', selectedWords);
        
        const response = await fetch('/api/shadowing/session', {
        method: 'POST',
          headers,
          body: JSON.stringify(saveData)
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
    const newRecordings = currentRecordings.filter(r => r.url !== recording.url);
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
            picked_preview: [...previousWords, ...selectedWords]
          })
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

  // 处理录音选择（用于重新评分）
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
          notes: ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        
         // 更新当前items状态
         setItems(prev => prev.map(item => 
           item.id === currentItem.id 
             ? { ...item, status: 'draft' }
             : item
         ));
        
        alert('草稿已保存');
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };


  // 检查生词是否已有AI解释
  const checkExistingExplanation = async (word: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/vocab/search?term=${encodeURIComponent(word)}`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.entries && data.entries.length > 0) {
          const entry = data.entries[0];
          if (entry.explanation) {
            setWordExplanations(prev => ({
              ...prev,
              [word]: entry.explanation
            }));
            console.log(`从单词本找到解释: ${word}`, entry.explanation);
            return true;
          }
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
        console.log('单词本数据:', data);
        console.log('中秋节相关条目:', data.entries.filter((entry: {term: string}) => entry.term.includes('中秋')));
        alert(`单词本中有 ${data.entries.length} 个条目`);
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
    const wordsNeedingExplanation = selectedWords.filter(item => 
      !item.explanation && !wordExplanations[item.word]
    );
    
    if (wordsNeedingExplanation.length === 0) {
      alert('所有生词都已经有解释了！');
      return;
    }
    
    setIsGeneratingBatchExplanation(true);
    setBatchExplanationProgress({
      current: 0,
      total: wordsNeedingExplanation.length,
      status: '准备生成AI解释...'
    });
    
    try {
      const headers = await getAuthHeaders();
      
      // 并发处理：为每个生词单独调用API
      const explanationPromises = wordsNeedingExplanation.map(async (item, index) => {
        try {
          setBatchExplanationProgress(prev => ({
            ...prev,
            current: index,
            status: `正在为 "${item.word}" 生成AI解释...`
          }));
          
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
                context: item.context
              }
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.explanations && data.explanations.length > 0) {
              return {
                word: item.word,
                explanation: data.explanations[0]
              };
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
      const successfulResults = results.filter(result => result !== null);
      
      if (successfulResults.length > 0) {
        // 更新解释缓存
        const newExplanations: Record<string, {
          gloss_native: string;
          pronunciation?: string;
          pos?: string;
          senses?: Array<{example_target: string, example_native: string}>;
        }> = {};
        
        successfulResults.forEach(result => {
          if (result) {
            newExplanations[result.word] = result.explanation;
          }
        });
        
        setWordExplanations(prev => ({
          ...prev,
          ...newExplanations
        }));
        
        setExplanationCache(prev => ({
          ...prev,
          ...newExplanations
        }));
        
        // 更新selectedWords中的解释
        setSelectedWords(prev => prev.map(item => {
          const explanation = newExplanations[item.word];
          return explanation ? { ...item, explanation } : item;
        }));
        
        setBatchExplanationProgress(prev => ({
          ...prev,
          current: successfulResults.length,
          status: `成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成解释！`
        }));
        
        // 保存到数据库
        if (currentItem) {
          try {
            const updatedSelectedWords = selectedWords.map(item => {
              const explanation = newExplanations[item.word];
              return explanation ? { ...item, explanation } : item;
            });
            
            const saveData = {
              item_id: currentItem.id,
              recordings: currentRecordings,
              vocab_entry_ids: [],
              picked_preview: [...previousWords, ...updatedSelectedWords]
            };
            
            const saveResponse = await fetch('/api/shadowing/session', {
              method: 'POST',
              headers,
              body: JSON.stringify(saveData)
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
          setBatchExplanationProgress(prev => ({
            ...prev,
            status: `✅ 成功为所有 ${successfulResults.length} 个生词生成解释！`
          }));
        } else {
          setBatchExplanationProgress(prev => ({
            ...prev,
            status: `⚠️ 成功为 ${successfulResults.length}/${wordsNeedingExplanation.length} 个生词生成解释`
          }));
        }
        
        setTimeout(() => {
          setBatchExplanationProgress({
            current: 0,
            total: 0,
            status: ''
          });
        }, 3000);
      } else {
        alert('没有成功生成任何AI解释，请重试');
      }
    } catch (error) {
      console.error('批量生成AI解释失败:', error);
      alert(`批量生成AI解释失败：${error instanceof Error ? error.message : '请重试'}`);
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
      
      const response = await fetch('/api/vocab/explain', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_ids: [], // 空数组，因为我们直接传递单词信息
          native_lang: userProfile?.native_lang || language, // 优先使用用户母语，否则使用界面语言
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.7,
          // 直接传递单词信息
          word_info: {
            term: word,
            lang: wordLang, // 学习语言
            context: context
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.explanations && data.explanations.length > 0) {
          const explanation = data.explanations[0];
          setWordExplanations(prev => ({
            ...prev,
            [word]: explanation
          }));
          
          // 更新解释缓存，让DynamicExplanation组件能立即显示
          setExplanationCache(prev => ({
            ...prev,
            [word]: explanation
          }));
          
          // 将解释保存到生词数据中
          setSelectedWords(prev => prev.map(item => 
            item.word === word ? { ...item, explanation } : item
          ));
          
          // 同时更新之前的生词中的解释（如果存在）
          setPreviousWords(prev => prev.map(item => 
            item.word === word ? { ...item, explanation } : item
          ));
          
          // 立即保存到数据库
          if (currentItem) {
            try {
              const headers = await getAuthHeaders();
              const updatedSelectedWords = selectedWords.map(item => 
                item.word === word ? { ...item, explanation } : item
              );
              const saveData = {
                item_id: currentItem.id,
                recordings: currentRecordings,
                vocab_entry_ids: [],
                picked_preview: [...previousWords, ...updatedSelectedWords]
              };
              
              console.log('保存AI解释到数据库:', saveData);
              
              const saveResponse = await fetch('/api/shadowing/session', {
                method: 'POST',
                headers,
                body: JSON.stringify(saveData)
              });
              
              if (saveResponse.ok) {
                console.log('AI解释已保存到数据库');
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
        alert(`生成解释失败：${errorData.error}`);
      }
    } catch (error) {
      console.error('生成解释失败:', error);
      alert('生成解释失败，请重试');
    } finally {
      setIsGeneratingExplanation(false);
      setGeneratingWord(null);
    }
  };

  // 播放音频
  const playAudio = () => {
    if (!currentItem?.audio_url) return;
    
    const audio = new Audio(currentItem.audio_url);
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      alert('音频播放失败');
    };
    audio.play();
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

      const fullFeedback = feedback + (suggestions.length > 0 ? '\n\n建议：\n• ' + suggestions.join('\n• ') : '');

      const scoringResult = {
        score: scorePercentage,
        accuracy: normalizedAccuracy,
        feedback: fullFeedback,
        transcription: textToScore,
        originalText: originalText
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
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      // 清理转录文本（中文）
      cleanTranscribed = transcribedText
        .replace(/[。！？、，\s]+/g, '')
        .split('')
        .filter(c => c.length > 0);
    } else {
      // 英文处理：按A:, B:分割
      originalSentences = originalText
        .split(/(?=[A-Z]:)/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      // 清理转录文本（英文）
      cleanTranscribed = transcribedText
        .replace(/[.!?,\s]+/g, ' ')
        .split(' ')
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length > 0);
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
          .filter(c => c.length > 0);
      } else {
        // 英文处理：按单词分割
        cleanSentence = sentence
          .replace(/^[A-Z]:\s*/, '') // 移除角色标识符
          .replace(/[.!?,\s]+/g, ' ')
          .split(' ')
          .map(w => w.toLowerCase().trim())
          .filter(w => w.length > 0);
      }
      
      // 计算句子匹配度
      const matchedItems = cleanSentence.filter(item => 
        cleanTranscribed.includes(item)
      );
      
      const matchRatio = cleanSentence.length > 0 ? matchedItems.length / cleanSentence.length : 0;
      
      let status: 'correct' | 'partial' | 'missing';
      const issues: string[] = [];
      
      if (matchRatio >= 0.9) {
        status = 'correct';
      } else if (matchRatio >= 0.5) {
        status = 'partial';
        // 找出遗漏的内容
        const missingItems = cleanSentence.filter(item => !cleanTranscribed.includes(item));
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
        score: Math.round(matchRatio * 100)
      });
    }
    
    const overallScore = sentenceAnalysis.length > 0 
      ? Math.round(sentenceAnalysis.reduce((sum, s) => sum + s.score, 0) / sentenceAnalysis.length)
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
      { original: 'is', error: 'it' }
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
    const practiceTime = practiceStartTime ? 
      Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000) : 0;
    
    // 1. 立即更新题库列表状态
    setItems(prev => prev.map(item => 
      item.id === currentItem.id 
        ? { 
            ...item, 
            isPracticed: true,
            stats: {
              ...item.stats,
              recordingCount: currentRecordings.length,
              vocabCount: selectedWords.length,
              practiceTime,
              lastPracticed: new Date().toISOString()
            }
          }
        : item
    ));
    
    // 2. 立即设置练习完成状态
    setPracticeComplete(true);
    
    try {
      const headers = await getAuthHeaders();
      
      // 3. 自动检查和保存生词
      let savedVocabCount = 0;
      if (selectedWords.length > 0) {
        try {
          const entries = selectedWords.map(item => ({
            term: item.word,
            lang: item.lang,
            native_lang: userProfile?.native_lang || language, // 优先使用用户母语，否则使用界面语言
            source: 'shadowing',
            source_id: currentItem.id,
            context: item.context,
            tags: [],
            explanation: item.explanation || null
          }));

          const vocabResponse = await fetch('/api/vocab/bulk_create', {
            method: 'POST',
            headers,
            body: JSON.stringify({ entries }),
          });

          if (vocabResponse.ok) {
            savedVocabCount = entries.length;
            // 将本次选中的生词移动到之前的生词中
            setPreviousWords(prev => [...prev, ...selectedWords]);
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
      
      if (audioRecorderRef.current && typeof audioRecorderRef.current.uploadCurrentRecording === 'function') {
        // 检查是否有未保存的录音
        const hasUnsavedRecording = audioRecorderRef.current.hasUnsavedRecording?.() || false;
        
        if (hasUnsavedRecording) {
          try {
            // 自动上传未保存的录音
            await audioRecorderRef.current.uploadCurrentRecording();
            
            // 等待录音状态更新
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 重新获取最新的录音数据
            if (currentItem) {
              try {
                const headers = await getAuthHeaders();
                const sessionResponse = await fetch(`/api/shadowing/session?item_id=${currentItem.id}`, {
                  headers
                });
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
          notes: ''
        })
      });
      
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        setCurrentSession(sessionData.session);
      } else {
        const errorText = await sessionResponse.text();
        console.error('保存练习session失败:', {
          status: sessionResponse.status,
          error: errorText
        });
      }
      
      // 5. 如果有评分结果，记录练习结果
      if (scoringResult && practiceStartTime) {
    const metrics = {
      accuracy: scoringResult.score || 0,
      complete: true,
      time_sec: practiceTime,
      scoring_result: scoringResult
    };

        const attemptResponse = await fetch('/api/shadowing/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          lang: currentItem.lang,
          level: currentItem.level,
          metrics
        })
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
              pattern: 'shadowing:catalog*'
            })
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
      const entries = selectedWords.map(item => ({
        term: item.word,
        lang: item.lang,
        native_lang: language, // 使用界面语言作为母语
        source: 'shadowing',
        source_id: currentItem?.id,
        context: item.context,
        tags: [],
        explanation: item.explanation || null // 使用生词数据中的解释
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
        setPreviousWords(prev => [...prev, ...selectedWords]);
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
              picked_preview: allWords
            };
            
            const saveResponse = await fetch('/api/shadowing/session', {
              method: 'POST',
              headers,
              body: JSON.stringify(saveData)
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

  // 移动端检测
  const { actualIsMobile } = useMobile();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 如果正在检查认证或用户未登录，显示相应提示
  if (authLoading) {
    return (
      <main className="p-6">
        <Container>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>{t.common.checking_login || "检查登录状态..."}</p>
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
              <h2 className="text-xl font-semibold mb-4">{t.common.login_required || "需要登录"}</h2>
              <p className="text-gray-600 mb-6">{t.shadowing.login_required_message || "请先登录以访问Shadowing练习功能"}</p>
              <a href="/auth" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                前往登录
              </a>
            </div>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="p-3 sm:p-6">
      <Container>
        <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { label: t.shadowing.title }]} />
        
        
        {/* 移动端布局 */}
        {actualIsMobile ? (
          <div className="space-y-4">
            
            {/* 手机端顶部工具栏 */}
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">{t.shadowing.shadowing_practice || "Shadowing 练习"}</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileSidebarOpen(true)}
                className="flex items-center gap-2"
              >
                <Menu className="w-4 h-4" />
                {t.nav.vocabulary}
              </Button>
            </div>

            {/* 手机端侧边栏遮罩 */}
            {mobileSidebarOpen && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 z-40"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}

            {/* 手机端侧边栏 */}
            <div className={`fixed top-0 left-0 h-full w-80 bg-white z-50 transform transition-transform duration-300 ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
              <div className="h-full flex flex-col">
                {/* 侧边栏头部 */}
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{t.shadowing.shadowing_vocabulary || "Shadowing 题库"}</h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => fetchItems()}
                      className="text-blue-500 hover:text-blue-700 p-2"
                      title={t.shadowing.refresh_vocabulary || "刷新题库"}
                      disabled={loading}
                    >
                      🔄
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMobileSidebarOpen(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 侧边栏内容 */}
                <div className="flex-1 overflow-y-auto">
                  {/* 过滤器 */}
                  <div className="p-4 border-b space-y-4">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.shadowing.filter}</span>
                    </div>
                    
                    {/* 语言选择 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.language}</Label>
                      <Select value={lang} onValueChange={(v: "ja"|"en"|"zh") => setLang(v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {permissions.allowed_languages.includes('ja') && <SelectItem value="ja">{LANG_LABEL.ja}</SelectItem>}
                          {permissions.allowed_languages.includes('en') && <SelectItem value="en">{LANG_LABEL.en}</SelectItem>}
                          {permissions.allowed_languages.includes('zh') && <SelectItem value="zh">{LANG_LABEL.zh}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 等级选择 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.level}</Label>
                      <Select 
                        value={level?.toString() || "all"} 
                        onValueChange={(v) => setLevel(v === "all" ? null : parseInt(v))}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={t.shadowing.all_levels} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.shadowing.all_levels}</SelectItem>
                          {permissions.allowed_levels.includes(1) && <SelectItem value="1">L1</SelectItem>}
                          {permissions.allowed_levels.includes(2) && <SelectItem value="2">L2</SelectItem>}
                          {permissions.allowed_levels.includes(3) && <SelectItem value="3">L3</SelectItem>}
                          {permissions.allowed_levels.includes(4) && <SelectItem value="4">L4</SelectItem>}
                          {permissions.allowed_levels.includes(5) && <SelectItem value="5">L5</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 推荐等级显示 */}
                    {recommendedLevel && (
                      <div className="text-sm text-blue-600">
                        {t.shadowing.recommend_level.replace('{level}', recommendedLevel.toString())}
                        {level !== recommendedLevel && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            onClick={() => setLevel(recommendedLevel)}
                            className="ml-1 h-auto p-0 text-sm"
                          >
                            {t.common.confirm}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* 练习状态 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.practice_status}</Label>
                      <Select value={practiced} onValueChange={(v: "all" | "practiced" | "unpracticed") => setPracticed(v)}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.shadowing.all_status}</SelectItem>
                          <SelectItem value="unpracticed">{t.shadowing.unpracticed}</SelectItem>
                          <SelectItem value="practiced">{t.shadowing.practiced}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 体裁筛选 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.genre}</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 大主题筛选 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.major_theme}</Label>
                      <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.shadowing.all_major_themes}</SelectItem>
                          {themes.map(theme => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 小主题筛选 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.minor_theme}</Label>
                      <Select 
                        value={selectedSubtopicId} 
                        onValueChange={setSelectedSubtopicId}
                        disabled={selectedThemeId === "all"}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={selectedThemeId === "all" ? t.shadowing.select_major_theme_first : t.shadowing.all_minor_themes} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.shadowing.all_minor_themes}</SelectItem>
                          {subtopics.map(subtopic => (
                            <SelectItem key={subtopic.id} value={subtopic.id}>
                              {subtopic.title_cn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 搜索 */}
                    <div>
                      <Label className="text-sm">{t.shadowing.search}</Label>
                      <Input
                        placeholder={t.shadowing.search_placeholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={getRandomUnpracticed} className="flex-1">
                        <Shuffle className="w-4 h-4 mr-1" />
                        {t.shadowing.random}
                      </Button>
                      <Button size="sm" variant="outline" onClick={getNextUnpracticed} className="flex-1">
                        <ArrowRight className="w-4 h-4 mr-1" />
                        {t.shadowing.next_question}
                      </Button>
                    </div>
                  </div>

                  {/* 统计信息 */}
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="text-sm text-gray-600">
                      <div className="mb-2">{t.shadowing.total_questions.replace('{count}', filteredItems.length.toString())}</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>{t.shadowing.completed} {filteredItems.filter(item => item.isPracticed).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>{t.shadowing.draft} {filteredItems.filter(item => item.status === 'draft' && !item.isPracticed).length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span>{t.shadowing.not_started} {filteredItems.filter(item => !item.isPracticed && item.status !== 'draft').length}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 题目列表 */}
                  <div className="flex-1">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">加载中...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">{t.shadowing.no_questions_found || "没有找到题目"}</div>
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
                            onClick={() => {
                              loadItem(item);
                              setMobileSidebarOpen(false);
                            }}
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
                                    {item.subtopic ? item.subtopic.title_cn : item.title}
                                    {item.isPracticed && (
                                      <span className="ml-1 text-green-600">✓</span>
                                    )}
                                    {item.status === 'draft' && (
                                      <span className="ml-1 text-yellow-600">📝</span>
                                    )}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1 ml-8">
                                  {LANG_LABEL[item.lang]} • L{item.level}
                                  {item.cefr && ` • ${item.cefr}`}
                                </div>
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
            <div className="space-y-4">
              {!currentItem ? (
                <Card className="p-6">
                  <div className="text-center">
                    <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{t.shadowing.select_question_to_start || "选择题目开始练习"}</h3>
                    <p className="text-gray-500">{t.shadowing.click_vocabulary_button || "点击上方\"题库\"按钮选择题目"}</p>
                  </div>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* 题目信息 - 手机端优化 */}
                  <Card className="p-4">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold mb-2">{currentItem.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                        <span>{LANG_LABEL[currentItem.lang]}</span>
                        <span>{t.shadowing.level} L{currentItem.level}</span>
                        {currentItem.cefr && <span>{currentItem.cefr}</span>}
                        {currentItem.tokens && <span>{currentItem.tokens} {t.shadowing.words || "词"}</span>}
                      </div>
                      
                      {/* 手机端操作按钮 */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={playAudio}
                          disabled={isPlaying}
                          variant="outline"
                          size="sm"
                          className="flex-1 min-w-0"
                        >
                          {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                          {isPlaying ? t.common.loading : t.shadowing.play_audio}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={saveDraft}
                          disabled={saving}
                          className="flex-1 min-w-0"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {saving ? t.common.loading : t.shadowing.save_draft}
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={unifiedCompleteAndSave}
                          disabled={saving}
                          className="flex-1 min-w-0"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {saving ? '保存中...' : '完成'}
                        </Button>
                      </div>
                    </div>
                    
                    {/* 生词选择模式切换 */}
                    <div className="mb-4">
                      <Button
                        variant={isVocabMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsVocabMode(!isVocabMode)}
                        className="w-full"
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
                            {t.shadowing.click_words_to_select || "点击文本中的单词来选择生词"}
                          </p>
                          {selectedText && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-sm">
                                <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                                <div className="text-blue-600 font-semibold mb-1">{selectedText.word}</div>
                                <div className="text-xs text-gray-600 mb-2">{selectedText.context}</div>
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
                        </div>
                      )}
                    </div>

                    {/* 文本内容 */}
                    <div className="p-4 bg-gray-50 rounded-lg">
                      {isVocabMode ? (
                        <SelectablePassage
                          text={currentItem.text}
                          lang="zh"
                          onSelectionChange={handleTextSelection}
                          clearSelection={clearSelection}
                          disabled={false}
                          className="text-base leading-relaxed"
                        />
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
                                  .map(line => line.trim())
                                  .filter(line => line.length > 0)
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
                            
                            // 获取所有已选择的生词（包括之前的和本次的）
                            const allSelectedWords = [...previousWords, ...selectedWords];
                            const selectedWordSet = new Set(allSelectedWords.map(item => item.word));
                            
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
                                      const substring = chars.slice(i, i + selectedWord.word.length).join('');
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
                                    const wordData = allSelectedWords.find(item => item.word === word);
                                    const explanation = wordData?.explanation;
                                    
                                    result.push(
                                      <HoverExplanation 
                                        key={`${lineIndex}-${i}`}
                                        word={word}
                                        explanation={explanation}
                                      >
                                        {word}
                                      </HoverExplanation>
                                    );
                                    i += highlightLength - 1; // 跳过已处理的字符
                                  } else {
                                    // 普通字符
                                    result.push(
                                      <span key={`${lineIndex}-${i}`}>
                                        {chars[i]}
                                      </span>
                                    );
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
                              
                              return lines.map((line, lineIndex) => (
                                <div key={lineIndex} className="mb-2">
                                  {line.split(/(\s+|[。！？、，.!?,])/).map((word, wordIndex) => {
                                    const cleanWord = word.replace(/[。！？、，.!?,\s]/g, '');
                                    const isSelected = cleanWord && selectedWordSet.has(cleanWord);
                                    
                                    if (isSelected) {
                                      const wordData = allSelectedWords.find(item => item.word === cleanWord);
                                      const explanation = wordData?.explanation;
                                      
                                      return (
                                        <HoverExplanation 
                                          key={`${lineIndex}-${wordIndex}`}
                                          word={word}
                                          explanation={explanation}
                                        >
                                          {word}
                                        </HoverExplanation>
                                      );
                                    } else {
                                      return (
                                        <span key={`${lineIndex}-${wordIndex}`}>
                                          {word}
                                        </span>
                                      );
                                    }
                                  })}
                                </div>
                              ));
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    
                    {/* 音频播放器 */}
                    {currentItem.audio_url && (
                      <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-blue-700">{t.shadowing.original_audio_text}</span>
                          {currentItem.duration_ms && (
                            <span className="text-xs text-blue-600">
                              时长: {Math.round(currentItem.duration_ms / 1000)}秒
                            </span>
                          )}
                        </div>
                        <audio controls src={currentItem.audio_url} className="w-full" />
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
                          <div key={`prev-${index}`} className="p-3 bg-gray-50 rounded border border-gray-200">
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
                                  onClick={() => generateWordExplanation(item.word, item.context, currentItem?.lang || 'en')}
                                  disabled={isGeneratingExplanation}
                                  className="text-xs"
                                >
                                  {generatingWord === item.word ? '生成中...' : 'AI解释'}
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
                            {isGeneratingBatchExplanation ? '生成中...' : '一键AI解释'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedWords([])}
                          >
                            清空
                          </Button>
                          <Button
                            size="sm"
                            onClick={importToVocab}
                            disabled={isImporting}
                          >
                            {isImporting ? '导入中...' : '导入'}
                          </Button>
                        </div>
                      </div>
                      
                      {/* 批量AI解释进度显示 */}
                      {isGeneratingBatchExplanation && batchExplanationProgress.total > 0 && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-green-700">AI解释生成进度</span>
                              <span className="text-green-600">
                                {batchExplanationProgress.current} / {batchExplanationProgress.total}
                              </span>
                            </div>
                            <div className="w-full bg-green-200 rounded-full h-2">
                              <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${(batchExplanationProgress.current / batchExplanationProgress.total) * 100}%` 
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
                          <div key={`selected-${item.word}-${index}`} className="p-3 bg-blue-50 rounded border border-blue-200">
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
                                  onClick={() => generateWordExplanation(item.word, item.context, item.lang)}
                                  disabled={isGeneratingExplanation}
                                  className="text-xs"
                                >
                                  {generatingWord === item.word ? '生成中...' : 'AI解释'}
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
                                  fallbackExplanation={item.explanation || wordExplanations[item.word]}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* 翻译模块 - 移动端 */}
                  {currentItem && (
                    <Card className="p-4">
                      <div className="flex flex-col gap-3 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-600">🌐 {t.shadowing.translation}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={showTranslation} 
                              onChange={e => setShowTranslation(e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            {t.shadowing.show_translation}
                          </label>
                          {showTranslation && (
                            <select 
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                              value={translationLang} 
                              onChange={e => setTranslationLang(e.target.value as 'en'|'ja'|'zh')}
                            >
                              {getTargetLanguages(currentItem.lang).map(lang => (
                                <option key={lang} value={lang}>
                                  {getLangName(lang)}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      
                      {showTranslation && currentItem.translations && currentItem.translations[translationLang] ? (
                        <div className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                          {currentItem.translations[translationLang]}
                        </div>
                      ) : showTranslation ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                            <span>📝</span>
                            （暂无翻译，可能尚未生成）
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  )}

                  {/* 录音练习区域 */}
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
                    />
                  </Card>

                  {/* 评分区域 */}
                  {!scoringResult && (
                    <Card className="p-4">
                      <h3 className="text-lg font-semibold mb-4">{t.shadowing.practice_scoring}</h3>
                      {currentRecordings.length > 0 ? (
                        <div>
                          <p className="text-gray-600 mb-4">{t.shadowing.recording_completed_message || "您已完成录音，点击下方按钮进行评分"}</p>
                          <Button
                            onClick={() => performScoring()}
                            disabled={isScoring}
                            className="bg-blue-600 hover:bg-blue-700 w-full"
                          >
                            {isScoring ? "评分中..." : "开始评分"}
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-600 mb-4">{t.shadowing.complete_recording_first}</p>
                          <Button
                            onClick={() => performScoring()}
                            disabled={isScoring}
                            variant="outline"
                            className="w-full"
                          >
                            {isScoring ? "评分中..." : "开始评分"}
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* 评分结果区域 */}
                  {scoringResult && (
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">{t.shadowing.scoring_result || "评分结果"}</h3>
                        <Button
                          onClick={() => performScoring(currentTranscription)}
                          disabled={isScoring}
                          variant="outline"
                          size="sm"
                        >
                          {isScoring ? "重新评分中..." : "重新评分"}
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-sm text-green-600 mb-1">{t.shadowing.overall_score || "整体评分"}</div>
                          <div className="text-xl font-bold text-green-700">
                            {(scoringResult.score || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-sm text-blue-600 mb-1">{t.shadowing.pronunciation_accuracy || "发音准确性"}</div>
                          <div className="text-xl font-bold text-blue-700">
                            {(scoringResult.score || 0).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {scoringResult.feedback && (
                        <div className="bg-yellow-50 p-3 rounded-lg mb-4">
                          <div className="text-sm text-yellow-600 mb-1">{t.shadowing.improvement_suggestions || "改进建议"}</div>
                          <p className="text-yellow-800 text-sm">{scoringResult.feedback}</p>
                        </div>
                      )}
                      
                      {/* 转录文字和原文对比 - 手机端优化 */}
                      {scoringResult.transcription && scoringResult.originalText && (
                        <div className="mt-4">
                          <h4 className="text-lg font-semibold mb-3">{t.shadowing.practice_comparison || "练习对比"}</h4>
                          <div className="space-y-3">
                            <div className="border rounded-lg p-3">
                              <div className="space-y-3">
                                <div>
                                  <div className="text-sm text-gray-500 mb-2">{t.shadowing.original_text || "原文"}</div>
                                  <div className="p-3 bg-gray-50 rounded border text-sm">
                                    {scoringResult.originalText}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm text-gray-500 mb-2">{t.shadowing.your_pronunciation || "你的发音"}</div>
                                  <div className={`p-3 rounded border text-sm ${
                                    (scoringResult.score || 0) >= 80 ? 'bg-green-50 border-green-200' :
                                    (scoringResult.score || 0) >= 60 ? 'bg-yellow-50 border-yellow-200' :
                                    'bg-red-50 border-red-200'
                                  }`}>
                                    {scoringResult.transcription}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* 详细分析 - 手机端 */}
                            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-sm text-blue-600 mb-2">详细分析</div>
                              <div className="text-sm text-gray-700">
                                {(() => {
                                  // 处理中文文本，按字符分割而不是按单词分割
                                  
                                  // 使用简单句子分析（支持中文和英文）
                                  const simpleAnalysis = performSimpleAnalysis(scoringResult.originalText, scoringResult.transcription);
                                  const { sentenceAnalysis, overallScore } = simpleAnalysis;
                                  
                                  return (
                                    <div>
                                      {/* 整体评分 */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">整体评分：</div>
                                        <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
                                      </div>
                                      
                                      {/* 句子分析 */}
                                      <div className="space-y-3">
                                        {sentenceAnalysis.map((sentence, idx) => (
                                          <div key={`sentence-${idx}-${sentence.sentence.substring(0, 20)}`} className={`p-3 rounded border ${
                                            sentence.status === 'correct' ? 'bg-green-50 border-green-200' :
                                            sentence.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-red-50 border-red-200'
                                          }`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm font-medium">
                                                {sentence.status === 'correct' && '✓ '}
                                                {sentence.status === 'partial' && '⚠ '}
                                                {sentence.status === 'missing' && '❌ '}
                                                句子 {idx + 1}
                                              </div>
                                              <div className="text-sm font-bold">
                                                {sentence.score}%
                                              </div>
                                            </div>
                                            
                                            <div className="text-sm mb-2">
                                              <span className="font-medium">原文：</span>
                                              <span className="text-gray-700">&ldquo;{sentence.sentence}&rdquo;</span>
                                            </div>
                                            
                                            {sentence.issues.length > 0 && (
                                              <div className="text-sm text-red-600">
                                                <div className="font-medium">问题：</div>
                                                <ul className="list-disc list-inside space-y-1">
                                                  {sentence.issues.map((issue, issueIdx) => (
                                                    <li key={`issue-${issueIdx}-${issue.substring(0, 20)}`}>{issue}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      
                                      <div className="mt-4 text-xs text-gray-500">
                                        💡 分析基于句子级别，更直观地显示发音问题
                                      </div>
                                    </div>
                                  );
                                    
                                    return (
                                      <div>
                                        {/* 整体评分 */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">整体评分：</div>
                                          <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
                                        </div>
                                        
                                        {/* 句子分析 */}
                                        <div className="space-y-3">
                                          {sentenceAnalysis.map((sentence, idx) => (
                                            <div key={idx} className={`p-3 rounded border ${
                                              sentence.status === 'correct' ? 'bg-green-50 border-green-200' :
                                              sentence.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                              'bg-red-50 border-red-200'
                                            }`}>
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-medium">
                                                  {sentence.status === 'correct' && '✓ '}
                                                  {sentence.status === 'partial' && '⚠ '}
                                                  {sentence.status === 'missing' && '❌ '}
                                                  句子 {idx + 1}
                                                </div>
                                                <div className="text-sm font-bold">
                                                  {sentence.score}%
                                                </div>
                                              </div>
                                              
                                              <div className="text-sm mb-2">
                                                <span className="font-medium">原文：</span>
                                                <span className="text-gray-700">&ldquo;{sentence.sentence}&rdquo;</span>
                                              </div>
                                              
                                              {sentence.issues.length > 0 && (
                                                <div className="text-xs">
                                                  <span className="font-medium text-red-600">问题：</span>
                                                  <ul className="mt-1 space-y-1">
                                                    {sentence.issues.map((issue, issueIdx) => (
                                                      <li key={`issue-${issueIdx}-${issue.substring(0, 20)}`} className="text-red-600">
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
                                          💡 分析基于句子级别，更直观地显示发音问题
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
                </div>
              )}
            </div>
          </div>
        ) : (
          /* 桌面端布局 - 优化滚动体验 */
          <div className="flex gap-6 min-h-[600px]">
          {/* 左侧题库列表 */}
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} flex-shrink-0 transition-all duration-300 max-h-[80vh] overflow-y-auto`}>
            <Card className="min-h-full flex flex-col">
              {/* 标题和折叠按钮 */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!sidebarCollapsed && <h3 className="font-semibold">{t.shadowing.shadowing_vocabulary || "Shadowing 题库"}</h3>}
                  {!sidebarCollapsed && (
                    <button 
                      onClick={() => fetchItems()}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title={t.shadowing.refresh_vocabulary || "刷新题库"}
                      disabled={loading}
                    >
                      🔄
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                >
                  {sidebarCollapsed ? '→' : '←'}
                </Button>
              </div>

              {!sidebarCollapsed && (
                <>
                  {/* 过滤器 */}
                  <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <span className="text-sm font-medium">{t.shadowing.filter}</span>
                    </div>
                    
                    {/* 语言选择 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.language}</Label>
                      <Select value={lang} onValueChange={(v: "ja"|"en"|"zh") => setLang(v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
            <SelectContent>
              {permissions.allowed_languages.includes('ja') && <SelectItem value="ja">{LANG_LABEL.ja}</SelectItem>}
              {permissions.allowed_languages.includes('en') && <SelectItem value="en">{LANG_LABEL.en}</SelectItem>}
              {permissions.allowed_languages.includes('zh') && <SelectItem value="zh">{LANG_LABEL.zh}</SelectItem>}
            </SelectContent>
          </Select>
        </div>

                    {/* 等级选择 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.level}</Label>
                      <Select 
                        value={level?.toString() || "all"} 
                        onValueChange={(v) => setLevel(v === "all" ? null : parseInt(v))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="全部等级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部等级</SelectItem>
                          {permissions.allowed_levels.includes(1) && <SelectItem value="1">L1</SelectItem>}
                          {permissions.allowed_levels.includes(2) && <SelectItem value="2">L2</SelectItem>}
                          {permissions.allowed_levels.includes(3) && <SelectItem value="3">L3</SelectItem>}
                          {permissions.allowed_levels.includes(4) && <SelectItem value="4">L4</SelectItem>}
                          {permissions.allowed_levels.includes(5) && <SelectItem value="5">L5</SelectItem>}
                        </SelectContent>
                      </Select>
      </div>

                    {/* 推荐等级显示 */}
                    {recommendedLevel && (
                      <div className="text-xs text-blue-600">
                        推荐等级: L{recommendedLevel}
                        {level !== recommendedLevel && (
                          <Button 
                            variant="link" 
                            size="sm" 
                            onClick={() => setLevel(recommendedLevel)}
                            className="ml-1 h-auto p-0 text-xs"
                          >
                            使用
                          </Button>
                        )}
          </div>
        )}
        
                    {/* 练习状态 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.practice_status}</Label>
                      <Select value={practiced} onValueChange={(v: "all" | "practiced" | "unpracticed") => setPracticed(v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部</SelectItem>
                          <SelectItem value="unpracticed">未练习</SelectItem>
                          <SelectItem value="practiced">已练习</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 体裁筛选 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.genre}</Label>
                      <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GENRE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 大主题筛选 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.major_theme}</Label>
                      <Select value={selectedThemeId} onValueChange={setSelectedThemeId}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部大主题</SelectItem>
                          {themes.map(theme => (
                            <SelectItem key={theme.id} value={theme.id}>
                              {theme.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 小主题筛选 */}
                    <div>
                      <Label className="text-xs">{t.shadowing.minor_theme}</Label>
                      <Select 
                        value={selectedSubtopicId} 
                        onValueChange={setSelectedSubtopicId}
                        disabled={selectedThemeId === "all"}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={selectedThemeId === "all" ? "请先选择大主题" : "选择小主题"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部小主题</SelectItem>
                          {subtopics.map(subtopic => (
                            <SelectItem key={subtopic.id} value={subtopic.id}>
                              {subtopic.title_cn}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 搜索 */}
                    <div>
                      <Label className="text-xs">搜索</Label>
                      <Input
                        placeholder="搜索标题、主题..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8"
                      />
      </div>

                    {/* 快捷操作 */}
      <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={getRandomUnpracticed}>
                        <Shuffle className="w-3 h-3 mr-1" />
                        {t.shadowing.random}
                      </Button>
                      <Button size="sm" variant="outline" onClick={getNextUnpracticed}>
                        <ArrowRight className="w-3 h-3 mr-1" />
                        {t.shadowing.next_question}
        </Button>
                    </div>
      </div>

                  {/* 统计信息 */}
                  <div className="px-4 py-2 border-b bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{t.shadowing.total_questions.replace('{count}', filteredItems.length.toString())}</span>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          {t.shadowing.completed} {filteredItems.filter(item => item.isPracticed).length}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          {t.shadowing.draft} {filteredItems.filter(item => item.status === 'draft' && !item.isPracticed).length}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          {t.shadowing.not_started} {filteredItems.filter(item => !item.isPracticed && item.status !== 'draft').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 题目列表 */}
                  <div className="flex-1">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">加载中...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">{t.shadowing.no_questions_found || "没有找到题目"}</div>
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
                                    {item.subtopic ? item.subtopic.title_cn : item.title}
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
                                      <div className="bg-green-500 h-1.5 rounded-full" style={{width: '100%'}}></div>
                                    </div>
                                  </div>
                                )}
                                {!item.isPracticed && (
                                  <div className="mt-2">
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${
                                        item.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-300'
                                      }`} style={{width: item.status === 'draft' ? '50%' : '0%'}}></div>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      {item.status === 'draft' ? t.shadowing.draft : t.shadowing.not_started}
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
          <div className="flex-1 overflow-y-auto">
            {!currentItem ? (
              <Card className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BookOpen className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{t.shadowing.select_question_to_start || "选择题目开始练习"}</h3>
                  <p className="text-gray-500">{t.shadowing.select_from_left_vocabulary || "从左侧题库中选择一个题目开始 Shadowing 练习"}</p>
            </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* 题目信息 */}
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">{currentItem.title}</h2>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>{LANG_LABEL[currentItem.lang]}</span>
                        <span>{t.shadowing.level} L{currentItem.level}</span>
                        {currentItem.cefr && <span>{currentItem.cefr}</span>}
                        {currentItem.tokens && <span>{currentItem.tokens} {t.shadowing.words || "词"}</span>}
                      </div>
                      {currentItem.isPracticed && currentSession && (
                        <div className="flex items-center gap-2 mt-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-600">已完成练习</span>
                          <span className="text-xs text-gray-500">
                            ({new Date(currentSession.created_at).toLocaleString()})
                          </span>
                        </div>
                      )}
                    </div>
      <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={playAudio}
                        disabled={isPlaying}
                        variant="outline"
                        size="sm"
                      >
                        {isPlaying ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                        {isPlaying ? "播放中..." : "播放音频"}
                      </Button>
                      
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveDraft}
                        disabled={saving}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        {saving ? '保存中...' : '保存草稿'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={unifiedCompleteAndSave}
                        disabled={saving}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {saving ? t.common.loading : t.shadowing.complete_and_save}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={debugVocabData}
                      >
                          {t.shadowing.debug_vocab}
                      </Button>
            </div>
          </div>
          

          {/* 生词选择模式切换 */}
                  <div className="mb-4">
            <Button
              variant={isVocabMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsVocabMode(!isVocabMode)}
            >
                      {isVocabMode ? '退出生词模式' : '生词选择模式'}
            </Button>
                    {isVocabMode && (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-blue-600">
                          点击文本中的单词来选择生词
                        </p>
                        {selectedText && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="text-sm">
                              <div className="font-medium text-gray-800 mb-1">已选择的文本：</div>
                              <div className="text-blue-600 font-semibold mb-1">{selectedText.word}</div>
                              <div className="text-xs text-gray-600 mb-2">{selectedText.context}</div>
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
                      </div>
                    )}
          </div>

                  {/* 文本内容 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
            {isVocabMode ? (
              <SelectablePassage
                        text={currentItem.text}
                        lang={currentItem.lang}
                onSelectionChange={handleTextSelection}
                clearSelection={clearSelection}
                disabled={false}
                        className="text-lg leading-relaxed"
              />
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
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
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
                  
                  // 获取所有已选择的生词（包括之前的和本次的）
                  const allSelectedWords = [...previousWords, ...selectedWords];
                  const selectedWordSet = new Set(allSelectedWords.map(item => item.word));
                  
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
                            const substring = chars.slice(i, i + selectedWord.word.length).join('');
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
                          const wordData = allSelectedWords.find(item => item.word === word);
                          const explanation = wordData?.explanation;
                          
                          result.push(
                            <HoverExplanation 
                              key={`${lineIndex}-${i}`}
                              word={word}
                              explanation={explanation}
                            >
                              {word}
                            </HoverExplanation>
                          );
                          i += highlightLength - 1; // 跳过已处理的字符
                        } else {
                          // 普通字符
                          result.push(
                            <span key={`${lineIndex}-${i}`}>
                              {chars[i]}
                            </span>
                          );
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
                    
                    return lines.map((line, lineIndex) => (
                      <div key={lineIndex} className="mb-2">
                        {line.split(/(\s+|[。！？、，.!?,])/).map((word, wordIndex) => {
                          const cleanWord = word.replace(/[。！？、，.!?,\s]/g, '');
                          const isSelected = cleanWord && selectedWordSet.has(cleanWord);
                          
                          if (isSelected) {
                            const wordData = allSelectedWords.find(item => item.word === cleanWord);
                            const explanation = wordData?.explanation;
                            
                            return (
                              <HoverExplanation 
                                key={`${lineIndex}-${wordIndex}`}
                                word={word}
                                explanation={explanation}
                              >
                                {word}
                              </HoverExplanation>
                            );
                          } else {
                            return (
                              <span key={`${lineIndex}-${wordIndex}`}>
                                {word}
                              </span>
                            );
                          }
                        })}
                      </div>
                    ));
                  }
                })()}
            </div>
          )}
          </div>
          

          {/* 音频播放器 */}
                  {currentItem.audio_url && (
                    <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-blue-700">原文音频</span>
                        {currentItem.duration_ms && (
                          <span className="text-xs text-blue-600">
                            时长: {Math.round(currentItem.duration_ms / 1000)}秒
                          </span>
            )}
          </div>
                      <audio controls src={currentItem.audio_url} className="w-full" />
            </div>
          )}
                </Card>

                {/* 翻译模块 */}
                {currentItem && (
                  <Card className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-gray-600">🌐 翻译</span>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={showTranslation} 
                            onChange={e => setShowTranslation(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          显示翻译
                        </label>
                        {showTranslation && (
                          <select 
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-auto bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                            value={translationLang} 
                            onChange={e => setTranslationLang(e.target.value as 'en'|'ja'|'zh')}
                          >
                            {getTargetLanguages(currentItem.lang).map(lang => (
                              <option key={lang} value={lang}>
                                {getLangName(lang)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                    
                    {showTranslation && currentItem.translations && currentItem.translations[translationLang] ? (
                      <div className="text-lg leading-relaxed text-gray-800 whitespace-pre-wrap break-words">
                        {currentItem.translations[translationLang]}
                      </div>
                    ) : showTranslation ? (
                      <div className="text-center py-4">
                        <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                          <span>📝</span>
                          （暂无翻译，可能尚未生成）
                        </div>
                      </div>
                    ) : null}
                  </Card>
                )}

                {/* 之前的生词 */}
                {previousWords.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-600">
                        之前的生词 ({previousWords.length})
                      </h3>
            </div>
                    
                    <div className="grid gap-3">
                      {previousWords.map((item, index) => (
                        <div key={`prev-${index}`} className="p-3 bg-gray-50 rounded border border-gray-200">
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
                              <div className="text-xs text-gray-500">
                                已导入
                    </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => generateWordExplanation(item.word, item.context, currentItem?.lang || 'en')}
                                disabled={isGeneratingExplanation}
                                className="text-xs"
                              >
                                {generatingWord === item.word ? '生成中...' : 'AI解释'}
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

                {/* 本次选中的生词 */}
      {selectedWords.length > 0 && (
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
                {isGeneratingBatchExplanation ? '生成中...' : '一键AI解释'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWords([])}
              >
                          清空
              </Button>
              <Button
                size="sm"
                onClick={importToVocab}
                disabled={isImporting}
              >
                          {isImporting ? '导入中...' : '导入到生词本'}
              </Button>
            </div>
          </div>
          
                    {/* 批量AI解释进度显示 */}
                    {isGeneratingBatchExplanation && batchExplanationProgress.total > 0 && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-green-700">AI解释生成进度</span>
                            <span className="text-green-600">
                              {batchExplanationProgress.current} / {batchExplanationProgress.total}
                            </span>
                          </div>
                          <div className="w-full bg-green-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(batchExplanationProgress.current / batchExplanationProgress.total) * 100}%` 
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
                        <div key={`selected-${item.word}-${index}`} className="p-3 bg-blue-50 rounded border border-blue-200">
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
                                onClick={() => generateWordExplanation(item.word, item.context, item.lang)}
                                disabled={isGeneratingExplanation}
                                className="text-xs"
                              >
                                {generatingWord === item.word ? '生成中...' : 'AI解释'}
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
                                fallbackExplanation={item.explanation || wordExplanations[item.word]}
                              />
                            </div>
                          )}
              </div>
            ))}
                  </div>
                </Card>
              )}

                {/* 录音练习区域 */}
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

                {/* 评分区域 */}
                {!scoringResult && (
                  <Card className="p-4 md:p-6 border-0 shadow-sm bg-gradient-to-r from-purple-50 to-pink-50">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                      <span className="text-purple-600">📊</span>
                      {t.shadowing.practice_scoring}
                    </h3>
                    {currentRecordings.length > 0 ? (
                      <div className="text-center">
                        <p className="text-gray-600 mb-4">您已完成录音，点击下方按钮进行评分</p>
                        <Button
                          onClick={() => performScoring()}
                          disabled={isScoring}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200"
                        >
                          {isScoring ? "评分中..." : "开始评分"}
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-600 mb-4">请先完成录音，然后点击下方按钮进行评分</p>
                        <Button
                          onClick={() => performScoring()}
                          disabled={isScoring}
                          variant="outline"
                          className="border-purple-300 text-purple-600 hover:bg-purple-50 px-6 py-2 rounded-lg font-medium transition-all duration-200"
                        >
                          {isScoring ? "评分中..." : "开始评分"}
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

                {/* 评分结果区域 */}
                {scoringResult && (
                  <Card className="p-4 md:p-6 border-0 shadow-sm bg-gradient-to-r from-orange-50 to-yellow-50">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-orange-600">🏆</span>
                        评分结果
                      </h3>
                      <Button
                        onClick={() => performScoring(currentTranscription)}
                        disabled={isScoring}
                        variant="outline"
                        size="sm"
                        className="border-orange-300 text-orange-600 hover:bg-orange-50 px-4 py-2 rounded-lg font-medium transition-all duration-200"
                      >
                        {isScoring ? "重新评分中..." : "重新评分"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm">
                        <div className="text-sm text-green-600 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          整体评分
                        </div>
                        <div className="text-3xl font-bold text-green-700">
                          {(scoringResult.score || 0).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm">
                        <div className="text-sm text-blue-600 mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          发音准确性
                        </div>
                        <div className="text-3xl font-bold text-blue-700">
                          {(scoringResult.score || 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    {scoringResult.feedback && (
                      <div className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm mb-6">
                        <div className="text-sm text-yellow-600 mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                          改进建议
                        </div>
                        <p className="text-gray-800 leading-relaxed">{scoringResult.feedback}</p>
                      </div>
                    )}
          
                    {/* 转录文字和原文对比 */}
                    {scoringResult.transcription && scoringResult.originalText && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
                          <span className="text-indigo-600">📝</span>
                          练习对比
                        </h4>
                        <div className="space-y-4">
                          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                                  原文
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm leading-relaxed">
                                  {scoringResult.originalText}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  你的发音
                                </div>
                                <div className={`p-3 rounded-lg border text-sm leading-relaxed ${
                                  (scoringResult.score || 0) >= 80 ? 'bg-green-50 border-green-200' :
                                  (scoringResult.score || 0) >= 60 ? 'bg-yellow-50 border-yellow-200' :
                                  'bg-red-50 border-red-200'
                                }`}>
                                  {scoringResult.transcription}
                                </div>
                              </div>
                            </div>
                            
                            {/* 详细对比分析 */}
                            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                              <div className="text-sm text-blue-600 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                详细分析
                              </div>
                              <div className="text-sm text-gray-700">
                                {(() => {
                                  // 处理中文文本，按字符分割而不是按单词分割
                                  
                                  // 使用简单句子分析（支持中文和英文）
                                  const simpleAnalysis = performSimpleAnalysis(scoringResult.originalText, scoringResult.transcription);
                                  const { sentenceAnalysis, overallScore } = simpleAnalysis;
                                  
                                  return (
                                    <div>
                                      {/* 整体评分 */}
                                      <div className="mb-4 p-3 bg-white rounded border">
                                        <div className="text-sm font-medium mb-2">整体评分：</div>
                                        <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
                                      </div>
                                      
                                      {/* 句子分析 */}
                                      <div className="space-y-3">
                                        {sentenceAnalysis.map((sentence, idx) => (
                                          <div key={`sentence-${idx}-${sentence.sentence.substring(0, 20)}`} className={`p-3 rounded border ${
                                            sentence.status === 'correct' ? 'bg-green-50 border-green-200' :
                                            sentence.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                            'bg-red-50 border-red-200'
                                          }`}>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm font-medium">
                                                {sentence.status === 'correct' && '✓ '}
                                                {sentence.status === 'partial' && '⚠ '}
                                                {sentence.status === 'missing' && '❌ '}
                                                句子 {idx + 1}
                                              </div>
                                              <div className="text-sm font-bold">
                                                {sentence.score}%
                                              </div>
                                            </div>
                                            
                                            <div className="text-sm mb-2">
                                              <span className="font-medium">原文：</span>
                                              <span className="text-gray-700">&ldquo;{sentence.sentence}&rdquo;</span>
                                            </div>
                                            
                                            {sentence.issues.length > 0 && (
                                              <div className="text-sm text-red-600">
                                                <div className="font-medium">问题：</div>
                                                <ul className="list-disc list-inside space-y-1">
                                                  {sentence.issues.map((issue, issueIdx) => (
                                                    <li key={`issue-${issueIdx}-${issue.substring(0, 20)}`}>{issue}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                      
                                      <div className="mt-4 text-xs text-gray-500">
                                        💡 分析基于句子级别，更直观地显示发音问题
                                      </div>
                                    </div>
                                  );
                                    
                                    return (
                                      <div>
                                        {/* 整体评分 */}
                                        <div className="mb-4 p-3 bg-white rounded border">
                                          <div className="text-sm font-medium mb-2">整体评分：</div>
                                          <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
                                        </div>
                                        
                                        {/* 句子分析 */}
                                        <div className="space-y-3">
                                          {sentenceAnalysis.map((sentence, idx) => (
                                            <div key={idx} className={`p-3 rounded border ${
                                              sentence.status === 'correct' ? 'bg-green-50 border-green-200' :
                                              sentence.status === 'partial' ? 'bg-yellow-50 border-yellow-200' :
                                              'bg-red-50 border-red-200'
                                            }`}>
                                              <div className="flex items-center justify-between mb-2">
                                                <div className="text-sm font-medium">
                                                  {sentence.status === 'correct' && '✓ '}
                                                  {sentence.status === 'partial' && '⚠ '}
                                                  {sentence.status === 'missing' && '❌ '}
                                                  句子 {idx + 1}
                                                </div>
                                                <div className="text-sm font-bold">
                                                  {sentence.score}%
                                                </div>
                                              </div>
                                              
                                              <div className="text-sm mb-2">
                                                <span className="font-medium">原文：</span>
                                                <span className="text-gray-700">&ldquo;{sentence.sentence}&rdquo;</span>
                                              </div>
                                              
                                              {sentence.issues.length > 0 && (
                                                <div className="text-xs">
                                                  <span className="font-medium text-red-600">问题：</span>
                                                  <ul className="mt-1 space-y-1">
                                                    {sentence.issues.map((issue, issueIdx) => (
                                                      <li key={`issue-${issueIdx}-${issue.substring(0, 20)}`} className="text-red-600">
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
                                          💡 分析基于句子级别，更直观地显示发音问题
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
                          <p className="text-sm leading-relaxed">
                            {currentItem.text}
                          </p>
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
