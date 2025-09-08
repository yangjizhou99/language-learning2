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
import { useTranslation } from "@/contexts/LanguageContext";
import { LANG_LABEL } from "@/types/lang";
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
  shadowing_item_id: string;
  status: 'draft' | 'completed';
  recordings: Array<{
    url: string;
    fileName: string;
    size: number;
    type: string;
    duration: number;
    created_at: string;
  }>;
  selected_words: Array<{
    word: string;
    context: string;
    lang: string;
  }>;
  imported_vocab_ids: string[];
  practice_time_seconds: number;
  notes: string;
  created_at: string;
  updated_at: string;
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
  const t = useTranslation();
  
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
  const [selectedWords, setSelectedWords] = useState<Array<{word: string, context: string, lang: string}>>([]);
  const [isVocabMode, setIsVocabMode] = useState(false);
  const [practiceStartTime, setPracticeStartTime] = useState<Date | null>(null);
  const [currentRecordings, setCurrentRecordings] = useState<AudioRecording[]>([]);
  const [isImporting, setIsImporting] = useState(false);
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
        setItems(data.items || []);
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
          setCurrentSession(data.session);
          setSelectedWords(data.session.picked_preview || []);
          
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
  const handleWordSelect = (word: string, context: string) => {
    const wordData = { word, context, lang };
    const exists = selectedWords.some(item => 
      item.word === word && item.context === context
    );
    
    if (!exists) {
      setSelectedWords(prev => [...prev, wordData]);
    }
  };

  // 移除选中的生词
  const removeSelectedWord = (index: number) => {
    setSelectedWords(prev => prev.filter((_, i) => i !== index));
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
          picked_preview: selectedWords // 保存完整的单词对象
        };
        
        console.log('保存录音数据到数据库:', saveData);
        
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
            picked_preview: selectedWords
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
      const practiceTime = practiceStartTime ? 
        Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000) : 0;

      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shadowing_item_id: currentItem.id,
          status: 'draft',
          recordings: currentRecordings,
          selected_words: selectedWords,
          practice_time_seconds: practiceTime,
          notes: ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
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
      const practiceTime = practiceStartTime ? 
        Math.floor((new Date().getTime() - practiceStartTime.getTime()) / 1000) : 0;

      const headers = await getAuthHeaders();
      const response = await fetch('/api/shadowing/session', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shadowing_item_id: currentItem.id,
          status: 'completed',
          recordings: currentRecordings,
          selected_words: selectedWords,
          practice_time_seconds: practiceTime,
          notes: ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setCurrentSession(data.session);
        
        // 更新题库列表中的状态
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

  // 智能分割文本函数
  const smartSplitText = (text: string) => {
    const segments = [text];
    
    // 按常见的日语连接词和短语分割
    const splitPatterns = [
      /(ねえ|はい|いいね|そう|うん|ええ|ああ)/g,  // 常见的对话开头词
      /(はじめまして|よろしく|最近|仕事|ジョギング|週に|それは)/g,  // 常见短语
      /(おはよう|こんにちは|こんばんは|おやすみ)/g,  // 问候语
      /(起きた|眠かった|朝ご飯|朝ごはん|トースト|コーヒー)/g,  // 日常生活词汇
      /(土曜日|日曜日|月曜日|火曜日|水曜日|木曜日|金曜日)/g,  // 星期
      /(映画|本|勉強|仕事|学校|家|友達|家族)/g,  // 常见名词
    ];
    
    // 尝试按模式分割
    for (const pattern of splitPatterns) {
      const newSegments = [];
      for (const segment of segments) {
        const matches = [...segment.matchAll(pattern)];
        if (matches.length > 1) {
          // 找到多个匹配，尝试分割
          let lastIndex = 0;
          for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (i > 0) {
              const beforeMatch = segment.substring(lastIndex, match.index).trim();
              if (beforeMatch.length > 5) {
                newSegments.push(beforeMatch);
              }
            }
            lastIndex = match.index;
          }
          const lastSegment = segment.substring(lastIndex).trim();
          if (lastSegment.length > 5) {
            newSegments.push(lastSegment);
          }
          if (newSegments.length > 1) {
            segments.splice(0, segments.length, ...newSegments);
            break;
          }
        }
      }
    }
    
    return segments.filter(s => s.length > 5);
  };

  // 逐句对比功能
  const performSentenceComparison = async (originalText: string, transcribedText: string) => {
    console.log('逐句对比 - 原文:', originalText);
    console.log('逐句对比 - 转录:', transcribedText);
    
    // 改进的句子分割，考虑对话格式
    const originalSentences = originalText
      .split(/[。！？\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // 对于转录文本，使用更智能的分割方法
    let transcribedSentences = [];
    
    // 首先尝试按标点符号分割
    transcribedSentences = transcribedText
      .split(/[。！？\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // 如果分割后只有一句但内容很长，尝试按关键词分割
    if (transcribedSentences.length === 1 && transcribedSentences[0].length > 30) {
      const longText = transcribedSentences[0];
      console.log('长转录文本，尝试智能分割:', longText);
      
      // 尝试按常见的日语连接词和短语分割
      const splitPatterns = [
        /(ねえ|はい|いいね|そう|うん|ええ|ああ)/g,  // 常见的对话开头词
        /(土曜日|日曜日|月曜日|火曜日|水曜日|木曜日|金曜日)/g,  // 星期
        /(映画|本|勉強|仕事|学校|家|友達|家族)/g,  // 常见名词
      ];
      
      // 特殊处理：如果文本以"ねえ"开头，先分割出第一句
      if (longText.startsWith('ねえ')) {
        // 尝试多种分割点
        const splitPoints = [
          '土曜日', 'はじめまして', '最近', '仕事', 'ジョギング', '週に', 'それは'
        ];
        
        let bestSplitPoint = '';
        let bestSplitIndex = -1;
        
        // 找到第一个出现的分割点
        for (const point of splitPoints) {
          const index = longText.indexOf(point);
          if (index > 10 && index < longText.length - 10) { // 确保分割点不在开头或结尾
            bestSplitPoint = point;
            bestSplitIndex = index;
            break;
          }
        }
        
        if (bestSplitIndex > 0) {
          const firstSentence = longText.substring(0, bestSplitIndex).trim();
          const remainingText = longText.substring(bestSplitIndex).trim();
          console.log('特殊分割 - 第一句:', firstSentence);
          console.log('特殊分割 - 剩余:', remainingText);
          
          // 对剩余文本进行更智能的分割
          const remainingSegments = smartSplitText(remainingText);
          
          transcribedSentences = [firstSentence, ...remainingSegments.filter(s => s.length > 5)];
          console.log('特殊分割结果:', transcribedSentences);
        }
      } else {
        // 对于其他长文本，直接使用智能分割
        console.log('非ねえ开头文本，使用智能分割');
        const smartSegments = smartSplitText(longText);
        if (smartSegments.length > 1) {
          transcribedSentences = smartSegments;
          console.log('智能分割结果:', transcribedSentences);
        }
      }
      
      let segments = [longText];
      
      // 尝试按模式分割
      for (const pattern of splitPatterns) {
        const newSegments = [];
        for (const segment of segments) {
          const matches = [...segment.matchAll(pattern)];
          if (matches.length > 1) {
            // 找到多个匹配，尝试分割
            let lastIndex = 0;
            for (let i = 0; i < matches.length; i++) {
              const match = matches[i];
              if (i > 0) {
                const beforeMatch = segment.substring(lastIndex, match.index).trim();
                if (beforeMatch.length > 5) {
                  newSegments.push(beforeMatch);
                }
              }
              lastIndex = match.index;
            }
            const lastSegment = segment.substring(lastIndex).trim();
            if (lastSegment.length > 5) {
              newSegments.push(lastSegment);
            }
            if (newSegments.length > 1) {
              segments = newSegments;
              break;
            }
          }
        }
      }
      
      // 如果智能分割成功，使用分割结果
      if (segments.length > 1) {
        transcribedSentences = segments.filter(s => s.length > 5);
        console.log('智能分割结果:', transcribedSentences);
      }
    }
    
    console.log('原文句子数:', originalSentences.length);
    console.log('转录句子数:', transcribedSentences.length);
    console.log('原文句子:', originalSentences);
    console.log('转录句子:', transcribedSentences);
    
    const comparison = [];
    
    // 如果转录内容很长（包含多句话），尝试分段匹配
    if (transcribedSentences.length > 1) {
      console.log('多句转录，开始分段匹配...');
      
      // 为每个转录句子找到最佳匹配的原文句子
      const matches = [];
      
      for (let i = 0; i < transcribedSentences.length; i++) {
        const transcribed = transcribedSentences[i];
        console.log(`匹配第${i+1}句转录:`, transcribed);
        
        let bestMatch = { original: '', transcribed, accuracy: 0, originalIndex: -1 };
        
        // 在原文中寻找最佳匹配
        for (let j = 0; j < originalSentences.length; j++) {
          const original = originalSentences[j];
          const accuracy = calculateSimilarity(original, transcribed);
          console.log(`  与原文第${j+1}句对比:`, original, '准确率:', accuracy);
          
          if (accuracy > bestMatch.accuracy) {
            bestMatch = { original, transcribed, accuracy, originalIndex: j };
          }
        }
        
        console.log(`第${i+1}句最佳匹配:`, bestMatch);
        
        // 如果找到合理匹配（准确率>5%），添加到匹配列表
        if (bestMatch.accuracy > 0.05) {
          matches.push({
            original: bestMatch.original,
            transcribed: bestMatch.transcribed,
            accuracy: bestMatch.accuracy,
            originalIndex: bestMatch.originalIndex,
            transcribedIndex: i
          });
          console.log(`添加匹配结果:`, matches[matches.length - 1]);
        }
      }
      
      // 按原文顺序排序匹配结果
      matches.sort((a, b) => a.originalIndex - b.originalIndex);
      
      // 添加到最终对比结果
      for (const match of matches) {
        comparison.push({
          original: match.original,
          transcribed: match.transcribed,
          accuracy: match.accuracy
        });
      }
      
      console.log('按原文顺序的最终匹配结果:', comparison);
      
      // 如果转录内容很长但没有找到匹配，尝试整体匹配
      if (comparison.length === 0) {
        console.log('分段匹配失败，尝试整体匹配...');
        const fullTranscription = transcribedSentences.join(' ');
        let bestMatch = { original: '', transcribed: fullTranscription, accuracy: 0, originalIndex: -1 };
        
        for (let j = 0; j < originalSentences.length; j++) {
          const original = originalSentences[j];
          const accuracy = calculateSimilarity(original, fullTranscription);
          if (accuracy > bestMatch.accuracy) {
            bestMatch = { original, transcribed: fullTranscription, accuracy, originalIndex: j };
          }
        }
        
        if (bestMatch.accuracy > 0.05) {
          comparison.push({
            original: bestMatch.original,
            transcribed: bestMatch.transcribed,
            accuracy: bestMatch.accuracy
          });
        }
      }
    } else {
      // 如果转录内容较短，尝试与整个原文进行匹配
      const transcribed = transcribedSentences[0] || transcribedText;
      let bestMatch = { original: '', transcribed, accuracy: 0, originalIndex: -1 };
      
      // 在原文中寻找最佳匹配
      for (let j = 0; j < originalSentences.length; j++) {
        const original = originalSentences[j];
        const accuracy = calculateSimilarity(original, transcribed);
        if (accuracy > bestMatch.accuracy) {
          bestMatch = { original, transcribed, accuracy, originalIndex: j };
        }
      }
      
      // 如果找到合理匹配，添加到对比结果
      if (bestMatch.accuracy > 0.05) {
        comparison.push({
          original: bestMatch.original,
          transcribed: bestMatch.transcribed,
          accuracy: bestMatch.accuracy
        });
      }
    }
    
    // 如果没有找到任何匹配，显示转录内容与第一个原文句子的对比
    if (comparison.length === 0 && transcribedSentences.length > 0) {
      comparison.push({
        original: originalSentences[0] || '无原文',
        transcribed: transcribedSentences.join(' '),
        accuracy: calculateSimilarity(originalSentences[0] || '', transcribedSentences.join(' '))
      });
    }
    
    console.log('对比结果:', comparison);
    return comparison;
  };

  // 计算文本相似度
  const calculateSimilarity = (text1: string, text2: string) => {
    if (!text1 || !text2) return 0;
    
    // 预处理：去除标点符号和空格，转换为小写
    const normalize = (text: string) => text.replace(/[。！？、，\s]/g, '').toLowerCase();
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);
    
    if (normalized1 === normalized2) return 1;
    
    // 使用Levenshtein距离计算相似度
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    
    if (maxLength === 0) return 1;
    
    const similarity = 1 - (distance / maxLength);
    
    // 对于日语，考虑假名和汉字的相似性
    // 如果包含相同的假名或汉字，给予额外加分
    const hiragana1 = (normalized1.match(/[\u3040-\u309F]/g) || []) as string[];
    const hiragana2 = (normalized2.match(/[\u3040-\u309F]/g) || []) as string[];
    const katakana1 = (normalized1.match(/[\u30A0-\u30FF]/g) || []) as string[];
    const katakana2 = (normalized2.match(/[\u30A0-\u30FF]/g) || []) as string[];
    const kanji1 = (normalized1.match(/[\u4E00-\u9FAF]/g) || []) as string[];
    const kanji2 = (normalized2.match(/[\u4E00-\u9FAF]/g) || []) as string[];
    
    // 计算字符重叠度
    const hiraganaOverlap = hiragana1.filter(char => hiragana2.includes(char)).length;
    const katakanaOverlap = katakana1.filter(char => katakana2.includes(char)).length;
    const kanjiOverlap = kanji1.filter(char => kanji2.includes(char)).length;
    
    const totalOverlap = hiraganaOverlap + katakanaOverlap + kanjiOverlap;
    const totalChars = hiragana1.length + katakana1.length + kanji1.length + 
                      hiragana2.length + katakana2.length + kanji2.length;
    
    const overlapBonus = totalChars > 0 ? (totalOverlap / totalChars) * 0.3 : 0;
    
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
    if (selectedWords.length === 0) return;
    
    setIsImporting(true);
    try {
      const entries = selectedWords.map(item => ({
        term: item.word,
        lang: item.lang,
        native_lang: 'zh',
        source: 'shadowing',
        source_id: currentItem?.id,
        context: item.context,
        tags: []
      }));

      const headers = await getAuthHeaders();
      const response = await fetch('/api/vocab/bulk_create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entries }),
      });

      if (response.ok) {
        alert(`已成功导入 ${entries.length} 个生词`);
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
                {!sidebarCollapsed && <h3 className="font-semibold">Shadowing 题库</h3>}
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
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => loadItem(item)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {item.isPracticed ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  )}
                                  <span className="text-sm font-medium truncate">
                                    {item.title}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {LANG_LABEL[item.lang]} • L{item.level}
                                  {item.cefr && ` • ${item.cefr}`}
                                </div>
                                {item.isPracticed && (
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">
                                      <Mic className="w-3 h-3" />
                                      {item.stats.recordingCount}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />
                                      {item.stats.vocabCount}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatTime(item.stats.practiceTime)}
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
                            ({new Date(currentSession.updated_at).toLocaleString()})
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
                      <p className="whitespace-pre-wrap text-lg leading-relaxed">
                        {currentItem.text}
                      </p>
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

                {/* 选中的生词 */}
                {selectedWords.length > 0 && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">
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
                        <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded border border-blue-200">
                          <div className="flex-1">
                            <div className="font-medium text-blue-700">{item.word}</div>
                            <div className="text-sm text-blue-600 mt-1">{item.context}</div>
            </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSelectedWord(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            移除
                          </Button>
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