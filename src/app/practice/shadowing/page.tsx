"use client";
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import SelectablePassage from "@/components/SelectablePassage";
import AudioRecorder from "@/components/AudioRecorder";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANG_LABEL } from "@/types/lang";
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
  Pause
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
  meta?: Record<string, unknown>;
  created_at: string;
  isPracticed: boolean;
  status?: 'draft' | 'completed';
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
  const { t, language } = useLanguage();
  
  // 过滤和筛选状态
  const [lang, setLang] = useState<"ja" | "en" | "zh">("ja");
  const [level, setLevel] = useState<number | null>(null);
  const [practiced, setPracticed] = useState<"all" | "practiced" | "unpracticed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 题库相关状态
  const [items, setItems] = useState<ShadowingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentItem, setCurrentItem] = useState<ShadowingItem | null>(null);
  const [currentSession, setCurrentSession] = useState<ShadowingSession | null>(null);
  
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
  const [practiceStartTime, setPracticeStartTime] = useState<Date | null>(null);
  const [currentRecordings, setCurrentRecordings] = useState<AudioRecording[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  // AI解释相关状态
  const [wordExplanations, setWordExplanations] = useState<Record<string, {
    gloss_native: string;
    senses?: Array<{
      example_target: string;
      example_native: string;
    }>;
  }>>({});
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  
  // 解释缓存
  const [explanationCache, setExplanationCache] = useState<Record<string, {gloss_native: string, senses?: Array<{example_target: string, example_native: string}>}>>({});
  
  
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
  // 动态解释组件
  const DynamicExplanation = ({ word, fallbackExplanation }: { word: string, fallbackExplanation?: {gloss_native: string, senses?: Array<{example_target: string, example_native: string}>} }) => {
    // 优先使用缓存中的最新解释，其次使用fallback解释
    const [latestExplanation, setLatestExplanation] = useState<{gloss_native: string, senses?: Array<{example_target: string, example_native: string}>} | undefined>(explanationCache[word] || fallbackExplanation);
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
          <span>暂无解释</span>
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
          <strong>解释：</strong>{latestExplanation.gloss_native}
          <button 
            onClick={refreshExplanation}
            className="text-xs text-blue-500 hover:text-blue-700"
            title="刷新解释"
            disabled={loading}
          >
            🔄
          </button>
        </div>
        {latestExplanation.senses && latestExplanation.senses.length > 0 && (
          <div className="text-sm text-gray-600">
            <strong>例句：</strong>
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
    const { data: { session } } = await supabase.auth.getSession();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  };




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
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

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



  // 过滤显示的题目
  const filteredItems = items.filter(item => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.text.toLowerCase().includes(query)
      );
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
    
    // 相同状态按标题排序
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

  // 处理生词选择
  const handleWordSelect = async (word: string, context: string) => {
    const wordData = { word, context, lang };
    
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
    console.log('转录完成:', transcription);
    
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

  // 完成并保存
  const completeAndSave = async () => {
    if (!currentItem) return;
    
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          status: 'completed',
          recordings: currentRecordings,
          picked_preview: [...previousWords, ...selectedWords],
          notes: ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        
        // 更新题库列表中的状态
        const practiceTime = practiceStartTime ? 
          Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000) : 0;
        
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
        
         // 更新当前items状态
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
        
        alert('练习完成并保存！');
      }
    } catch (error) {
      console.error('Failed to complete practice:', error);
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
          native_lang: language, // 使用界面语言作为母语
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
          
          // 将解释保存到生词数据中
          setSelectedWords(prev => prev.map(item => 
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
    console.log('开始评分，参数:', { transcription, currentTranscription, currentItem: !!currentItem });
    
    if (!currentItem) {
      console.error('没有当前题目，无法评分');
      return;
    }
    
    setIsScoring(true);
    try {
      const textToScore = transcription || currentTranscription;
      console.log('用于评分的文字:', textToScore);
      
      if (!textToScore) {
        console.error('没有找到转录文字');
        alert('没有找到转录文字，无法进行评分');
        return;
      }

      // 获取原文
      const originalText = currentItem.text;
      console.log('原文:', originalText);
      
      // 简化的整体相似度计算
      const overallAccuracy = calculateSimilarity(originalText, textToScore);
      console.log('整体相似度:', overallAccuracy);

      // 确保准确率在0-1之间
      const normalizedAccuracy = Math.max(0, Math.min(1, overallAccuracy));
      const scorePercentage = Math.round(normalizedAccuracy * 100);

      // 生成反馈
      let feedback = '';
      if (scorePercentage >= 80) {
        feedback = '发音准确率: ' + scorePercentage + '%，非常棒！';
      } else if (scorePercentage >= 60) {
        feedback = '发音准确率: ' + scorePercentage + '%，很好！继续努力！';
      } else if (scorePercentage >= 40) {
        feedback = '发音准确率: ' + scorePercentage + '%，还不错，继续练习！';
      } else {
        feedback = '发音准确率: ' + scorePercentage + '%，需要多练习，加油！';
      }

      const scoringResult = {
        score: scorePercentage,
        accuracy: normalizedAccuracy,
        feedback: feedback,
        transcription: textToScore,
        originalText: originalText
      };

      console.log('评分结果:', scoringResult);
      setScoringResult(scoringResult);
      setShowSentenceComparison(false); // 不再显示逐句对比
    } catch (error) {
      console.error('评分失败:', error);
      alert(`评分失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsScoring(false);
    }
  };



  // 计算文本相似度
  const calculateSimilarity = (text1: string, text2: string) => {
    if (!text1 || !text2) return 0;
    
    // 预处理：去除标点符号和空格，转换为小写，忽略大小写
    const normalize = (text: string) => {
      return text
        .replace(/[。！？、，.!?,\s]/g, '') // 去除标点符号和空格
        .toLowerCase() // 转换为小写
        .trim();
    };
    
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);
    
    if (normalized1 === normalized2) return 1;
    
    // 使用Levenshtein距离计算相似度
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength === 0) return 1;
    
    const similarity = 1 - (distance / maxLength);
    
    // 对于多语言，考虑字符相似性
    // 如果包含相同的字符，给予额外加分
    const chars1 = normalized1.split('');
    const chars2 = normalized2.split('');
    
    // 计算字符重叠度
    const overlap = chars1.filter(char => chars2.includes(char)).length;
    const totalChars = chars1.length + chars2.length;
    
    const overlapBonus = totalChars > 0 ? (overlap / totalChars) * 0.2 : 0;
    
    return Math.min(1, similarity + overlapBonus);
  };

  // 计算编辑距离
  const levenshteinDistance = (str1: string, str2: string) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // 记录练习结果到数据库
  const recordPracticeResult = async () => {
    if (!currentItem || !practiceStartTime || !scoringResult) return;
    
    const practiceTime = Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000);
    
    const metrics = {
      accuracy: scoringResult.score || 0,
      complete: true,
      time_sec: practiceTime,
      scoring_result: scoringResult
    };

    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/attempts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          item_id: currentItem.id,
          lang: currentItem.lang,
          level: currentItem.level,
          metrics
        })
      });

      if (response.ok) {
        setPracticeComplete(true);
        alert(`练习完成！准确率: ${(scoringResult.score || 0).toFixed(1)}%`);
        // 刷新题库列表以更新练习状态
        fetchItems();
      } else {
        const errorData = await response.json();
        alert(`记录练习结果失败: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Failed to record practice result:', error);
      alert('记录练习结果失败');
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

  // 如果正在检查认证或用户未登录，显示相应提示
  if (authLoading) {
    return (
      <main className="p-6">
        <Container>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>检查登录状态...</p>
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
              <h2 className="text-xl font-semibold mb-4">需要登录</h2>
              <p className="text-gray-600 mb-6">请先登录以访问Shadowing练习功能</p>
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
    <main className="p-6">
      <Container>
      <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { label: t.shadowing.title }]} />
        
        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* 左侧题库列表 */}
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} flex-shrink-0 transition-all duration-300`}>
            <Card className="h-full flex flex-col">
              {/* 标题和折叠按钮 */}
              <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
                  {!sidebarCollapsed && <h3 className="font-semibold">Shadowing 题库</h3>}
                   {!sidebarCollapsed && (
                     <button 
                       onClick={() => fetchItems()}
                       className="text-blue-500 hover:text-blue-700 p-1"
                       title="刷新题库"
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
                      <span className="text-sm font-medium">筛选</span>
                    </div>
                    
                    {/* 语言选择 */}
                    <div>
                      <Label className="text-xs">语言</Label>
                      <Select value={lang} onValueChange={(v: "ja"|"en"|"zh") => setLang(v)}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
            <SelectContent>
              <SelectItem value="ja">{LANG_LABEL.ja}</SelectItem>
              <SelectItem value="en">{LANG_LABEL.en}</SelectItem>
              <SelectItem value="zh">{LANG_LABEL.zh}</SelectItem>
            </SelectContent>
          </Select>
        </div>

                    {/* 等级选择 */}
                    <div>
                      <Label className="text-xs">等级</Label>
                      <Select 
                        value={level?.toString() || "all"} 
                        onValueChange={(v) => setLevel(v === "all" ? null : parseInt(v))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="全部等级" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">全部等级</SelectItem>
                          <SelectItem value="1">L1</SelectItem>
                          <SelectItem value="2">L2</SelectItem>
                          <SelectItem value="3">L3</SelectItem>
                          <SelectItem value="4">L4</SelectItem>
                          <SelectItem value="5">L5</SelectItem>
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
                      <Label className="text-xs">练习状态</Label>
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
                        随机
                      </Button>
                      <Button size="sm" variant="outline" onClick={getNextUnpracticed}>
                        <ArrowRight className="w-3 h-3 mr-1" />
                        下一题
        </Button>
                    </div>
      </div>

                  {/* 统计信息 */}
                  <div className="px-4 py-2 border-b bg-gray-50">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>共 {filteredItems.length} 题</span>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          已完成 {filteredItems.filter(item => item.isPracticed).length}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          草稿中 {filteredItems.filter(item => item.status === 'draft' && !item.isPracticed).length}
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          未开始 {filteredItems.filter(item => !item.isPracticed && item.status !== 'draft').length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 题目列表 */}
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-center text-gray-500">加载中...</div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">没有找到题目</div>
                    ) : (
                      <div className="space-y-2 p-2">
                        {filteredItems.map((item) => (
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
                                  <span className="text-sm font-medium truncate">
                                    {item.title}
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
                                      已完成
                                    </span>
                                  )}
                                  {item.status === 'draft' && !item.isPracticed && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      草稿中
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
                                      {item.status === 'draft' ? '草稿中' : '未开始'}
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
                  <h3 className="text-lg font-medium text-gray-900 mb-2">选择题目开始练习</h3>
                  <p className="text-gray-500">从左侧题库中选择一个题目开始 Shadowing 练习</p>
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
                        <span>等级 L{currentItem.level}</span>
                        {currentItem.cefr && <span>{currentItem.cefr}</span>}
                        {currentItem.tokens && <span>{currentItem.tokens} 词</span>}
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
                        onClick={completeAndSave}
                        disabled={saving}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        {saving ? '保存中...' : '完成并保存'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={debugVocabData}
                      >
                        调试单词本
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
                      <p className="text-sm text-blue-600 mt-2">
                        点击文本中的单词来选择生词
                      </p>
                    )}
          </div>

                  {/* 文本内容 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
            {isVocabMode ? (
              <SelectablePassage
                        text={currentItem.text}
                        lang={currentItem.lang}
                onWordSelect={handleWordSelect}
                disabled={false}
                        className="text-lg leading-relaxed"
              />
            ) : (
              <div className="text-lg leading-relaxed">
                {(() => {
                  // 获取所有已选择的生词（包括之前的和本次的）
                  const allSelectedWords = [...previousWords, ...selectedWords];
                  const selectedWordSet = new Set(allSelectedWords.map(item => item.word));
                  
                  // 检查是否为中文文本
                  const isChinese = /[\u4e00-\u9fff]/.test(currentItem.text);
                  
                  if (isChinese) {
                    // 中文处理：按字符分割，但需要检查连续字符是否组成已选择的生词
                    const chars = currentItem.text.split('');
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
                            key={i}
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
                          <span key={i}>
                            {chars[i]}
                          </span>
                        );
                      }
                    }
                    
                    return result;
                  } else {
                    // 英文处理：按单词分割
                    const words = currentItem.text.split(/(\s+|[。！？、，.!?,])/);
                    
                    return words.map((word, index) => {
                      const cleanWord = word.replace(/[。！？、，.!?,\s]/g, '');
                      const isSelected = cleanWord && selectedWordSet.has(cleanWord);
                      
                      if (isSelected) {
                        const wordData = allSelectedWords.find(item => item.word === cleanWord);
                        const explanation = wordData?.explanation;
                        
                        return (
                          <HoverExplanation 
                            key={index}
                            word={word}
                            explanation={explanation}
                          >
                            {word}
                          </HoverExplanation>
                        );
                      } else {
                        return (
                          <span key={index}>
                            {word}
                          </span>
                        );
                      }
                    });
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
                              <div className="font-medium text-gray-700">{item.word}</div>
                              <div className="text-sm text-gray-600 mt-1">{item.context}</div>
                    </div>
                            <div className="flex items-center gap-2">
                              <div className="text-xs text-gray-500">
                                已导入
                    </div>
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
          
                    <div className="grid gap-3">
            {selectedWords.map((item, index) => (
                        <div key={index} className="p-3 bg-blue-50 rounded border border-blue-200">
                          <div className="flex items-center justify-between mb-2">
                <div className="flex-1">
                              <div className="font-medium text-blue-700">{item.word}</div>
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
                <Card className="p-6">
                  <AudioRecorder
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
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold mb-4">练习评分</h3>
                    {currentRecordings.length > 0 ? (
                      <div>
                        <p className="text-gray-600 mb-4">您已完成录音，点击下方按钮进行评分</p>
                        <Button
                          onClick={() => performScoring()}
                          disabled={isScoring}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isScoring ? "评分中..." : "开始评分"}
                        </Button>
            </div>
                    ) : (
                      <div>
                        <p className="text-gray-600 mb-4">请先完成录音，然后点击下方按钮进行评分</p>
                        <Button
                          onClick={() => performScoring()}
                          disabled={isScoring}
                          variant="outline"
                        >
                          {isScoring ? "评分中..." : "开始评分"}
              </Button>
            </div>
                    )}
                  </Card>
                )}

                {/* 评分结果区域 */}
                {scoringResult && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">评分结果</h3>
                      <Button
                        onClick={() => performScoring(currentTranscription)}
                        disabled={isScoring}
                        variant="outline"
                        size="sm"
                      >
                        {isScoring ? "重新评分中..." : "重新评分"}
              </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-sm text-green-600 mb-1">整体评分</div>
                        <div className="text-2xl font-bold text-green-700">
                          {(scoringResult.score || 0).toFixed(1)}%
                    </div>
                  </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-sm text-blue-600 mb-1">发音准确性</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {(scoringResult.score || 0).toFixed(1)}%
              </div>
              </div>
                    </div>
                    
                    {scoringResult.feedback && (
                      <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                        <div className="text-sm text-yellow-600 mb-1">改进建议</div>
                        <p className="text-yellow-800">{scoringResult.feedback}</p>
            </div>
          )}
          
                    {/* 转录文字和原文对比 */}
                    {scoringResult.transcription && scoringResult.originalText && (
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold mb-4">练习对比</h4>
                        <div className="space-y-4">
                          <div className="border rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-500 mb-2">原文</div>
                                <div className="p-3 bg-gray-50 rounded border text-sm">
                                  {scoringResult.originalText}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500 mb-2">你的发音</div>
                                <div className={`p-3 rounded border text-sm ${
                                  (scoringResult.score || 0) >= 80 ? 'bg-green-50 border-green-200' :
                                  (scoringResult.score || 0) >= 60 ? 'bg-yellow-50 border-yellow-200' :
                                  'bg-red-50 border-red-200'
                                }`}>
                                  {scoringResult.transcription}
                                </div>
                              </div>
                            </div>
                            
                            {/* 详细对比分析 */}
                            <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                              <div className="text-sm text-blue-600 mb-2">详细分析</div>
                              <div className="text-sm text-gray-700">
                                {(() => {
                                  // 处理中文文本，按字符分割而不是按单词分割
                                  const isChinese = /[\u4e00-\u9fff]/.test(scoringResult.originalText);
                                  
                                  if (isChinese) {
                                    // 中文处理：按字符分割，但需要忽略标点符号和空格
                                    const originalText = scoringResult.originalText.replace(/[。！？、，\s]/g, '');
                                    const transcribedText = scoringResult.transcription.replace(/[。！？、，\s]/g, '');
                                    
                                    const originalChars = originalText.split('');
                                    const transcribedChars = transcribedText.split('');
                                    
                                    // 找出不匹配的字符索引
                                    const mismatchedIndices = new Set<number>();
                                    const maxLength = Math.max(originalChars.length, transcribedChars.length);
                                    
                                    for (let i = 0; i < maxLength; i++) {
                                      const origChar = originalChars[i] || '';
                                      const transChar = transcribedChars[i] || '';
                                      
                                      if (origChar !== transChar) {
                                        mismatchedIndices.add(i);
                                      }
                                    }
                                    
                                    if (mismatchedIndices.size === 0) {
                                      return <span className="text-green-600">✓ 完全匹配！</span>;
                                    } else {
                                      return (
                                        <div>
                                          <div className="text-red-600 mb-2">不匹配的字符（红色标记）：</div>
                                          <div className="p-3 bg-white rounded border text-sm leading-relaxed">
                                            {originalChars.map((char, index) => {
                                              const isMismatched = mismatchedIndices.has(index);
                                              const transcribedChar = transcribedChars[index] || '';
                                              
                                              return (
                                                <span 
                                                  key={index}
                                                  className={isMismatched ? 'bg-red-200 text-red-800 px-1 rounded' : ''}
                                                  title={isMismatched ? `你说成了: "${transcribedChar}"` : ''}
                                                >
                                                  {char}
                                                </span>
                                              );
                                            })}
                                          </div>
                                          <div className="mt-2 text-xs text-gray-600">
                                            红色标记的字符与你的发音不匹配，鼠标悬停可查看你说的内容
                                          </div>
                                        </div>
                                      );
                                    }
                                  } else {
                                    // 英文处理：按单词分割
                                    const originalWords = scoringResult.originalText.split(/\s+/);
                                    const transcribedWords = scoringResult.transcription.split(/\s+/);
                                    
                                    // 找出不匹配的单词索引
                                    const mismatchedIndices = new Set<number>();
                                    const maxLength = Math.max(originalWords.length, transcribedWords.length);
                                    
                                    for (let i = 0; i < maxLength; i++) {
                                      const origWord = (originalWords[i] || '').toLowerCase().replace(/[.!?,\s]/g, '');
                                      const transWord = (transcribedWords[i] || '').toLowerCase().replace(/[.!?,\s]/g, '');
                                      
                                      if (origWord !== transWord) {
                                        mismatchedIndices.add(i);
                                      }
                                    }
                                    
                                    if (mismatchedIndices.size === 0) {
                                      return <span className="text-green-600">✓ 完全匹配！</span>;
                                    } else {
                                      return (
                                        <div>
                                          <div className="text-red-600 mb-2">不匹配的单词（红色标记）：</div>
                                          <div className="p-3 bg-white rounded border text-sm leading-relaxed">
                                            {originalWords.map((word, index) => {
                                              const isMismatched = mismatchedIndices.has(index);
                                              const transcribedWord = transcribedWords[index] || '';
                                              
                                              return (
                                                <span key={index}>
                                                  <span 
                                                    className={isMismatched ? 'bg-red-200 text-red-800 px-1 rounded' : ''}
                                                    title={isMismatched ? `你说成了: "${transcribedWord}"` : ''}
                                                  >
                                                    {word}
                                                  </span>
                                                  {index < originalWords.length - 1 && ' '}
                                                </span>
                                              );
                                            })}
                                          </div>
                                          <div className="mt-2 text-xs text-gray-600">
                                            红色标记的单词与你的发音不匹配，鼠标悬停可查看你说的内容
                                          </div>
                                        </div>
                                      );
                                    }
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
          
                    {!practiceComplete && (
              <Button
                        onClick={recordPracticeResult}
                        className="bg-green-600 hover:bg-green-700"
              >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        完成练习并保存
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
          
                      <div>
                        <h4 className="font-medium mb-2 text-blue-700">练习记录</h4>
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <p className="text-sm leading-relaxed">
                            录音次数: {currentRecordings.length} 次<br/>
                            练习时长: {practiceStartTime ? Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000) : 0} 秒
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
      </Container>
    </main>
  );
}
