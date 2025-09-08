"use client";
import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import SelectablePassage from "@/components/SelectablePassage";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "@/contexts/LanguageContext";
import { LANG_LABEL } from "@/types/lang";
import type { Translations } from "@/lib/i18n";

// Web Speech 类型定义，避免 any
interface WebSpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface WebSpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface WebSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: (event: WebSpeechRecognitionEvent) => void;
  onerror: (event: WebSpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => WebSpeechRecognition;
  webkitSpeechRecognition?: new () => WebSpeechRecognition;
};

type ShadowingData = { 
  id: string;
  text: string; 
  lang: "ja"|"en"|"zh"; 
  title: string;
  level: number;
  audio_url: string;
};

// 等级选择器组件
function LevelPicker({ 
  value, 
  onChange, 
  recommended,
  t
}: { 
  value: number; 
  onChange: (level: number) => void; 
  recommended: number | null;
  t: Translations;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">{t.shadowing.difficulty_level}</span>
      {[1, 2, 3, 4, 5].map(l => (
        <button
          key={l}
          className={`px-3 py-1 rounded border transition-colors ${
            value === l 
              ? 'bg-black text-white' 
              : 'hover:bg-gray-100'
          }`}
          onClick={() => onChange(l)}
        >
          L{l}
          {recommended === l && (
            <span className="ml-1 text-xs px-1 rounded bg-amber-200 text-amber-900">
              {t.shadowing.recommended}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function ShadowingPage() {
  const t = useTranslation();
  const [lang, setLang] = useState<"ja"|"en"|"zh">("ja");
  const [level, setLevel] = useState(2);
  const [recommendedLevel, setRecommendedLevel] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ShadowingData|null>(null);
  const [err, setErr] = useState("");
  
  // 练习相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [score, setScore] = useState<number | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  
  // 语音识别相关状态
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string>("");
  
  // 逐句分析状态
  // 已去除未使用的逐句分析状态
  
  // 生词选择相关状态
  const [isVocabMode, setIsVocabMode] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Array<{word: string, context: string}>>([]);
  const [isImporting, setIsImporting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const [diffRows, setDiffRows] = useState<Array<{
    refText: string;
    hypText: string;
    refTokens: string[];
    refFlags: boolean[];
    hypTokens: string[];
    hypFlags: boolean[];
    accuracy: number;
  }>>([]);

  // 获取推荐等级
  useEffect(() => {
    const fetchRecommendedLevel = async () => {
      try {
        const response = await fetch(`/api/shadowing/recommended?lang=${lang}`);
        if (response.ok) {
          const data = await response.json();
          setRecommendedLevel(data.recommended);
          if (level !== data.recommended) {
            setLevel(data.recommended);
          }
        }
      } catch (error) {
        console.error("Failed to get recommended level:", error);
      }
    };

    fetchRecommendedLevel();
  }, [lang, level]);

  // 获取下一道题
  const getNextQuestion = async () => {
    setErr("");
    setLoading(true);
    setData(null);
    setScore(null);
    // 清理上一次的逐句分析（已移除专用状态）
    setAudioBlob(null);
    setAudioUrl("");
    setRecordingTime(0);
    setRecognizedText("");
    setRecognitionError("");
    
    try {
      const response = await fetch(`/api/shadowing/next?lang=${lang}&level=${level}`);
      if (!response.ok) {
        const errorData = await response.json();
        setErr(errorData.error || t.common.error);
        return;
      }
      
      const result = await response.json();
      setData(result.item);
    } catch (error) {
      setErr(error instanceof Error ? error.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  // 开始录音和语音识别
  const startRecording = async () => {
    try {
      // 开始录音
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 开始语音识别
      startSpeechRecognition();
      
    } catch (error) {
      console.error("录音失败:", error);
      setErr("Cannot access microphone, please check permissions");
    }
  };

  // 开始语音识别
  const startSpeechRecognition = () => {
    try {
      // 检查浏览器支持
      const SR = (window as unknown as WindowWithSpeech).SpeechRecognition || (window as unknown as WindowWithSpeech).webkitSpeechRecognition;
      if (!SR) {
        setRecognitionError("Speech recognition not supported in current browser");
        return;
      }

      const recognition = new SR();
      recognitionRef.current = recognition;
      
      // 设置语言
      recognition.lang = lang === "ja" ? "ja-JP" : lang === "zh" ? "zh-CN" : "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      
      let finalTranscript = "";
      
      recognition.onresult = (event: WebSpeechRecognitionEvent) => {
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        setRecognizedText(finalTranscript + interimTranscript);
      };
      
      recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
        console.error("语音识别错误:", event.error);
        setRecognitionError(`语音识别错误: ${event.error}`);
      };
      
      recognition.onend = () => {
        setIsRecognizing(false);
        // 保存最终识别结果
        setRecognizedText(finalTranscript);
      };
      
      recognition.start();
      setIsRecognizing(true);
      setRecognitionError("");
      
    } catch (error) {
      console.error("启动语音识别失败:", error);
      setRecognitionError("启动语音识别失败");
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    // 停止语音识别
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecognizing(false);
    }
  };

  // 评分
  const evaluateRecording = async () => {
    if (!audioBlob || !data) return;
    
    setIsScoring(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('text', data.text);
      formData.append('lang', data.lang);
      // 传递浏览器端识别文本，便于后端进行更准确的比对评分
      if (recognizedText && recognizedText.trim()) {
        formData.append('recognized', recognizedText);
      }
      
      const response = await fetch('/api/eval', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setScore(result.score);
        
        // 生成真实的逐句分析
        generateRealSentenceAnalysis(data.text, recognizedText);
      } else {
        setErr("Scoring failed, please try again");
      }
    } catch (error) {
      setErr("Scoring error: " + String(error));
    } finally {
      setIsScoring(false);
    }
  };

  // 生成真实的逐句分析
  const generateRealSentenceAnalysis = (originalText: string, recognizedText: string) => {
    // 按句号、问号、感叹号分割句子
    const sentences = originalText.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    
    // 生成逐句逐字比对
    const diffs = buildSentenceDiffs(sentences, recognizedText, lang);
    setDiffRows(diffs);

    const analysis = sentences.map((sentence) => {
      // 计算每句话的识别准确度
      const sentenceAccuracy = calculateSentenceAccuracy(sentence.trim(), recognizedText);
      const isCorrect = sentenceAccuracy >= 0.8;
      
      let feedback = "";
      if (sentenceAccuracy >= 0.9) {
        feedback = "发音完美！";
      } else if (sentenceAccuracy >= 0.8) {
        feedback = "发音很好，继续保持！";
      } else if (sentenceAccuracy >= 0.7) {
        feedback = "发音不错，注意语调变化";
      } else if (sentenceAccuracy >= 0.6) {
        feedback = "发音基本正确，需要多练习";
      } else {
        feedback = "发音需要改进，建议重复练习";
      }
      
      return {
        sentence: sentence.trim(),
        isCorrect,
        accuracy: sentenceAccuracy,
        feedback
      };
    });
    
    void analysis;
  };

  // 计算句子准确度
  const calculateSentenceAccuracy = (original: string, recognized: string): number => {
    if (!recognized || recognized.trim() === "") return 0;
    
    // 简单的字符串相似度计算
    const originalWords = original.split(/\s+/).filter(w => w.length > 0);
    const recognizedWords = recognized.split(/\s+/).filter(w => w.length > 0);
    
    if (originalWords.length === 0) return 0;
    
    let correctWords = 0;
    for (const word of originalWords) {
      if (recognizedWords.some(rw => rw.includes(word) || word.includes(rw))) {
        correctWords++;
      }
    }
    
    return correctWords / originalWords.length;
  };

  // 逐句逐字比对：去标点、分词、LCS 对齐
  function buildSentenceDiffs(refSentences: string[], hypRaw: string, langCode: "ja"|"en"|"zh") {
    const diffs: Array<{ refText: string; hypText: string; refTokens: string[]; refFlags: boolean[]; hypTokens: string[]; hypFlags: boolean[]; accuracy: number; }> = [];
    // 识别文本：去标点再分词
    const hypAllTokens = tokenize(removePunct(hypRaw), langCode);
    let cursor = 0;
    for (const ref of refSentences) {
      const refTokens = tokenize(removePunct(ref.trim()), langCode);
      const { start, end, aFlags, bFlags, matched, windowTokens } = findBestAlignmentWindow(hypAllTokens, cursor, refTokens, langCode);
      const acc = refTokens.length ? matched / refTokens.length : 0;
      diffs.push({
        refText: ref.trim(),
        hypText: windowTokens.join(langCode === "en" ? " " : ""),
        refTokens,
        refFlags: aFlags,
        hypTokens: windowTokens,
        hypFlags: bFlags,
        accuracy: acc,
      });
      // 前进游标：防止“吃到下一句”，将窗口长度限制在合理范围
      // 若匹配很差，谨慎推进；若匹配良好，推进到窗口尾部
      if (acc >= 0.5) {
        cursor = Math.min(end, hypAllTokens.length);
      } else {
        cursor = Math.min(start + Math.max(1, Math.floor((end - start) * 0.5)), hypAllTokens.length);
      }
    }
    return diffs;
  }

  // 在识别 token 序列中为一条参考句寻找“最佳窗口”
  function findBestAlignmentWindow(
    hypAll: string[],
    startIdx: number,
    refTokens: string[],
    langCode: "ja"|"en"|"zh"
  ): { start: number; end: number; aFlags: boolean[]; bFlags: boolean[]; matched: number; windowTokens: string[] } {
    const hypLen = hypAll.length;
    const refLen = refTokens.length || 1;
    // 限制窗口长度，避免把下一句吞进去
    const minWin = Math.max(1, Math.floor(refLen * 0.6));
    const maxWin = Math.max(minWin, Math.ceil(refLen * (langCode === "en" ? 1.4 : 1.2)));
    const lookahead = Math.min(hypLen - startIdx, Math.max(refLen * 2, 8));

    let bestScore = -1;
    let bestStart = startIdx;
    let bestEnd = Math.min(startIdx + refLen, hypLen);
    let bestAFlags: boolean[] = new Array<boolean>(refLen).fill(false);
    let bestBFlags: boolean[] = new Array<boolean>(Math.max(1, Math.min(refLen, hypLen - startIdx))).fill(false);
    let bestMatched = 0;

    for (let s = startIdx; s < Math.min(startIdx + lookahead, hypLen); s++) {
      const maxEnd = Math.min(s + maxWin, hypLen);
      const minEnd = Math.min(s + minWin, hypLen);
      for (let e = minEnd; e <= maxEnd; e++) {
        const windowTokens = hypAll.slice(s, e);
        const { aFlags, bFlags } = lcsFlagsTokens(refTokens, windowTokens);
        const matched = aFlags.filter(Boolean).length;
        const ratio = matched / refLen;
        // 对过长窗口施加轻微惩罚，避免吞并下一句
        const lenPenalty = 0.1 * Math.abs(windowTokens.length - refLen) / refLen;
        const score = ratio - lenPenalty;
        if (score > bestScore) {
          bestScore = score;
          bestStart = s;
          bestEnd = e;
          bestAFlags = aFlags;
          bestBFlags = bFlags;
          bestMatched = matched;
        }
      }
    }

    const windowTokens = hypAll.slice(bestStart, bestEnd);
    return { start: bestStart, end: bestEnd, aFlags: bestAFlags, bFlags: bestBFlags, matched: bestMatched, windowTokens };
  }

  function removePunct(text: string): string {
    // 保留字母、数字与空白，去除标点（适配中英日）
    return text.normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, "");
  }

  function tokenize(text: string, langCode: "ja"|"en"|"zh"): string[] {
    if (langCode === "en") {
      return text.toLowerCase().split(/\s+/).filter(Boolean);
    }
    // 中文/日文：按字符切分（去空白）
    return Array.from(text.replace(/\s+/g, ""));
  }

  function lcsFlagsTokens(a: string[], b: string[]): { aFlags: boolean[]; bFlags: boolean[] } {
    const n = a.length, m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1; else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const aFlags = new Array<boolean>(n).fill(false);
    const bFlags = new Array<boolean>(m).fill(false);
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) { aFlags[i - 1] = true; bFlags[j - 1] = true; i--; j--; }
      else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
    }
    return { aFlags, bFlags };
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取评分等级
  const getScoreLevel = (score: number) => {
    if (score >= 0.9) return { level: t.shadowing.score_excellent, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
    if (score >= 0.8) return { level: t.shadowing.score_good, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
    if (score >= 0.7) return { level: t.shadowing.score_average, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" };
    if (score >= 0.6) return { level: t.shadowing.score_pass, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" };
    return { level: t.shadowing.score_needs_improvement, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
  };

  // 处理生词选择
  const handleWordSelect = (word: string, context: string) => {
    // 检查是否已存在
    const exists = selectedWords.some(item => item.word === word && item.context === context);
    if (!exists) {
      setSelectedWords(prev => [...prev, { word, context }]);
    }
  };

  // 移除选中的生词
  const removeSelectedWord = (index: number) => {
    setSelectedWords(prev => prev.filter((_, i) => i !== index));
  };

  // 导入到生词本
  const importToVocab = async () => {
    if (selectedWords.length === 0) return;
    
    setIsImporting(true);
    try {
      const entries = selectedWords.map(item => ({
        term: item.word,
        lang: lang,
        native_lang: 'zh', // 默认中文，用户可以在生词本页面修改
        source: 'shadowing',
        source_id: data?.id || undefined, // 确保是有效的 UUID 或 undefined
        context: item.context,
        tags: []
      }));

      // 获取当前会话的 access token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      console.log('发送的生词数据:', { entries });
      
      const response = await fetch('/api/vocab/bulk_create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ entries }),
      });

      if (response.ok) {
        setSelectedWords([]);
        alert(t.shadowing.import_success.replace('{count}', entries.length.toString()));
      } else {
        const errorData = await response.json();
        console.error('导入失败详情:', errorData);
        alert(t.shadowing.import_failed.replace('{error}', errorData.error + (errorData.details ? '\n' + errorData.details : '')));
      }
    } catch (error) {
      console.error('导入生词失败:', error);
      alert(t.shadowing.import_failed.replace('{error}', ''));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="p-6">
      <Container>
      <Breadcrumbs items={[{ href: "/", label: t.nav.home }, { label: t.shadowing.title }]} />
      <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-semibold">{t.shadowing.title}{t.shadowing.real_speech_recognition}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="flex items-center gap-2">
          <Label className="w-24">{t.common.language}</Label>
          <Select value={lang} onValueChange={(v: "ja"|"en"|"zh")=> setLang(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t.common.language} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ja">{LANG_LABEL.ja}</SelectItem>
              <SelectItem value="en">{LANG_LABEL.en}</SelectItem>
              <SelectItem value="zh">{LANG_LABEL.zh}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 等级选择器 */}
      <div className="p-4 bg-muted rounded-lg">
        <LevelPicker 
          value={level} 
          onChange={setLevel} 
          recommended={recommendedLevel}
          t={t}
        />
        {recommendedLevel !== null && recommendedLevel !== level && (
          <div className="mt-2 text-sm text-amber-600">
            {t.shadowing.recommend_level.replace('{level}', recommendedLevel.toString())}
          </div>
        )}
        
        {/* 生成题库链接 */}
        <div className="mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground mb-2">
            {t.shadowing.need_more_content}
          </div>
          <a href="/admin/shadowing/ai" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
            <span>{t.shadowing.ai_generate_bank}</span>
            <span className="text-xs opacity-80">→</span>
          </a>
          <div className="text-xs text-muted-foreground mt-1">
            {t.shadowing.ai_generate_desc}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={getNextQuestion} disabled={loading}>
          {loading ? t.shadowing.loading : t.shadowing.get_next_question}
        </Button>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      {data && (
        <section className="p-4 rounded-2xl border bg-card text-card-foreground space-y-4">
          <div className="flex justify-between items-start">
            <div className="text-sm text-muted-foreground">
              标题：{data.title} · 语言：{data.lang} · 等级：L{data.level}
            </div>
            <Button variant="link" className="px-0" onClick={getNextQuestion}>{t.shadowing.change_question}</Button>
          </div>
          
          {/* 生词选择模式切换 */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded border border-blue-200">
            <Button
              variant={isVocabMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsVocabMode(!isVocabMode)}
            >
              {isVocabMode ? t.shadowing.vocab_mode_on : t.shadowing.vocab_mode_off}
            </Button>
            <span className="text-sm text-blue-700">
              {isVocabMode ? t.shadowing.vocab_mode_desc_on : t.shadowing.vocab_mode_desc_off}
            </span>
          </div>

          {/* 原文显示 */}
          <div className="p-3 bg-muted rounded">
            {isVocabMode ? (
              <SelectablePassage
                text={data.text}
                lang={data.lang}
                onWordSelect={handleWordSelect}
                disabled={false}
                className="text-lg"
              />
            ) : (
              <p className="whitespace-pre-wrap text-lg">{data.text}</p>
            )}
          </div>
          
          {/* 音频播放器 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t.shadowing.original_audio}</span>
            <audio controls src={data.audio_url} className="flex-1" />
          </div>
          
          {/* 录音控制 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t.shadowing.follow_recording}</span>
            {!isRecording ? (
              <Button variant="destructive" onClick={startRecording}>{t.shadowing.start_recording}</Button>
            ) : (
              <Button variant="secondary" onClick={stopRecording}>{t.shadowing.stop_recording} ({formatTime(recordingTime)})</Button>
            )}
          </div>
          
          {/* 语音识别状态 */}
          {isRecognizing && (
            <div className="p-3 rounded border bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700">{t.shadowing.recognizing_speech}</span>
              </div>
            </div>
          )}
          
          {/* 识别结果显示 */}
          {recognizedText && (
            <div className="p-3 rounded border bg-green-50 border-green-200">
              <div className="text-sm font-medium text-green-700 mb-2">{t.shadowing.recognition_result}</div>
              <div className="text-sm text-green-600 whitespace-pre-wrap">{recognizedText}</div>
            </div>
          )}
          
          {/* 识别错误显示 */}
          {recognitionError && (
            <div className="p-3 rounded border bg-red-50 border-red-200">
              <div className="text-sm text-red-700">{recognitionError}</div>
            </div>
          )}
          
          {/* 录音播放器 */}
          {audioUrl && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{t.shadowing.your_recording}</span>
              <audio controls src={audioUrl} className="flex-1" />
              <Button onClick={evaluateRecording} disabled={isScoring}>
                {isScoring ? t.shadowing.scoring : t.shadowing.start_scoring}
              </Button>
            </div>
          )}
          
          {/* 逐句对照表 */}
          {/* 已移除：逐句发音对照表（基于真实识别） */}

          {/* 逐句逐字比对（去标点） */}
          {diffRows.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">{t.shadowing.word_by_word_comparison}</h3>
              <div className="space-y-3">
                {diffRows.map((row, i) => (
                  <div key={i} className="p-3 rounded border">
                    <div className="text-xs text-gray-500 mb-1">{t.shadowing.original_text}</div>
                    <div className="text-sm flex flex-wrap gap-1">
                      {row.refTokens.map((t, idx) => (
                        <span key={idx} className={row.refFlags[idx] ? "text-emerald-700" : "text-red-600"}>{t}</span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 mb-1">{t.shadowing.recognized}</div>
                    <div className="text-sm flex flex-wrap gap-1">
                      {row.hypTokens.map((t, idx) => (
                        <span key={idx} className={row.hypFlags[idx] ? "text-emerald-700" : "text-red-600"}>{t}</span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">{t.shadowing.accuracy}{Math.round(row.accuracy * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 总体评分结果 */}
          {score !== null && (
            <div className={`p-4 rounded border ${getScoreLevel(score).bg} ${getScoreLevel(score).border}`}>
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreLevel(score).color}`}>
                  {Math.round(score * 100)}%
                </div>
                <div className={`text-lg font-medium ${getScoreLevel(score).color} mt-1`}>
                  {getScoreLevel(score).level}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 选中的生词列表 */}
      {selectedWords.length > 0 && (
        <section className="mt-6 p-4 rounded-2xl border bg-card text-card-foreground">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium">{t.shadowing.selected_words} ({selectedWords.length})</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedWords([])}
              >
                {t.shadowing.clear}
              </Button>
              <Button
                size="sm"
                onClick={importToVocab}
                disabled={isImporting}
              >
                {isImporting ? t.shadowing.importing : t.shadowing.import_to_vocab}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            {selectedWords.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded">
                <div className="flex-1">
                  <div className="font-medium text-blue-600">{item.word}</div>
                  <div className="text-sm text-gray-600 mt-1">{item.context}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSelectedWord(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  {t.shadowing.remove}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}
      </div>
      </Container>
    </main>
  );
}
