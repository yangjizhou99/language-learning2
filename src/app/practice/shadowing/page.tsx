"use client";
import React, { useEffect, useState, useRef } from "react";

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
  lang, 
  value, 
  onChange, 
  recommended 
}: { 
  lang: string; 
  value: number; 
  onChange: (level: number) => void; 
  recommended: number | null; 
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">难度等级：</span>
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
              推荐
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function ShadowingPage() {
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
  const [sentenceAnalysis, setSentenceAnalysis] = useState<Array<{
    sentence: string;
    isCorrect: boolean;
    accuracy: number;
    feedback: string;
  }>>([]);
  
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
        console.error("获取推荐等级失败:", error);
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
    setSentenceAnalysis([]);
    setAudioBlob(null);
    setAudioUrl("");
    setRecordingTime(0);
    setRecognizedText("");
    setRecognitionError("");
    
    try {
      const response = await fetch(`/api/shadowing/next?lang=${lang}&level=${level}`);
      if (!response.ok) {
        const errorData = await response.json();
        setErr(errorData.error || "获取题目失败");
        return;
      }
      
      const result = await response.json();
      setData(result.item);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "网络错误");
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
      setErr("无法访问麦克风，请检查权限设置");
    }
  };

  // 开始语音识别
  const startSpeechRecognition = () => {
    try {
      // 检查浏览器支持
      const SR = (window as unknown as WindowWithSpeech).SpeechRecognition || (window as unknown as WindowWithSpeech).webkitSpeechRecognition;
      if (!SR) {
        setRecognitionError("当前浏览器不支持语音识别");
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
        generateRealSentenceAnalysis(data.text, recognizedText, result);
      } else {
        setErr("评分失败，请重试");
      }
    } catch (error) {
      setErr("评分出错：" + String(error));
    } finally {
      setIsScoring(false);
    }
  };

  // 生成真实的逐句分析
  const generateRealSentenceAnalysis = (originalText: string, recognizedText: string, result: { score: number; accuracy: number; fluency: number; feedback: string }) => {
    // 按句号、问号、感叹号分割句子
    const sentences = originalText.split(/[。！？.!?]/).filter(s => s.trim().length > 0);
    
    // 生成逐句逐字比对
    const diffs = buildSentenceDiffs(sentences, recognizedText, lang);
    setDiffRows(diffs);

    const analysis = sentences.map((sentence, index) => {
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
    
    setSentenceAnalysis(analysis);
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
    if (score >= 0.9) return { level: "优秀", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
    if (score >= 0.8) return { level: "良好", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
    if (score >= 0.7) return { level: "中等", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" };
    if (score >= 0.6) return { level: "及格", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" };
    return { level: "需改进", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Shadowing 跟读练习（真实语音识别）</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="flex items-center gap-2">
          <span className="w-24">语言</span>
          <select 
            value={lang} 
            onChange={e => {
              const v = e.target.value as "ja"|"en"|"zh"; 
              setLang(v); 
            }} 
            className="border rounded px-2 py-1"
          >
            <option value="ja">日语</option>
            <option value="en">英语</option>
            <option value="zh">中文</option>
          </select>
        </label>
      </div>

      {/* 等级选择器 */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <LevelPicker 
          lang={lang} 
          value={level} 
          onChange={setLevel} 
          recommended={recommendedLevel} 
        />
        {recommendedLevel !== null && recommendedLevel !== level && (
          <div className="mt-2 text-sm text-amber-600">
            建议选择 L{recommendedLevel} 等级进行练习
          </div>
        )}
        
        {/* 生成题库链接 */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600 mb-2">
            需要更多练习内容？
          </div>
          <a 
            href="/admin/shadowing/ai" 
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <span>🤖 AI 生成题库</span>
            <span className="text-xs opacity-80">→</span>
          </a>
          <div className="text-xs text-gray-500 mt-1">
            使用 AI 生成更多适合你当前等级的练习内容
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button 
          onClick={getNextQuestion} 
          disabled={loading} 
          className="px-3 py-1 rounded bg-black text-white disabled:opacity-60"
        >
          {loading ? "加载中..." : "获取下一题"}
        </button>
      </div>

      {err && <div className="text-red-600 text-sm">{err}</div>}

      {data && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-4">
          <div className="flex justify-between items-start">
            <div className="text-sm text-gray-600">
              标题：{data.title} · 语言：{data.lang} · 等级：L{data.level}
            </div>
            <button 
              onClick={getNextQuestion}
              className="text-sm text-blue-600 hover:underline"
            >
              换一题
            </button>
          </div>
          
          {/* 原文显示 */}
          <div className="p-3 bg-gray-50 rounded">
            <p className="whitespace-pre-wrap text-lg">{data.text}</p>
          </div>
          
          {/* 音频播放器 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">原音频：</span>
            <audio controls src={data.audio_url} className="flex-1" />
          </div>
          
          {/* 录音控制 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">跟读录音：</span>
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                开始录音
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                停止录音 ({formatTime(recordingTime)})
              </button>
            )}
          </div>
          
          {/* 语音识别状态 */}
          {isRecognizing && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-700">正在识别语音...</span>
              </div>
            </div>
          )}
          
          {/* 识别结果显示 */}
          {recognizedText && (
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <div className="text-sm font-medium text-green-700 mb-2">🎤 语音识别结果：</div>
              <div className="text-sm text-green-600 whitespace-pre-wrap">{recognizedText}</div>
            </div>
          )}
          
          {/* 识别错误显示 */}
          {recognitionError && (
            <div className="p-3 bg-red-50 rounded border border-red-200">
              <div className="text-sm text-red-700">{recognitionError}</div>
            </div>
          )}
          
          {/* 录音播放器 */}
          {audioUrl && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">你的录音：</span>
              <audio controls src={audioUrl} className="flex-1" />
              <button
                onClick={evaluateRecording}
                disabled={isScoring}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isScoring ? "评分中..." : "开始评分"}
              </button>
            </div>
          )}
          
          {/* 逐句对照表 */}
          {/* 已移除：逐句发音对照表（基于真实识别） */}

          {/* 逐句逐字比对（去标点） */}
          {diffRows.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">🔤 逐句逐字比对（识别不含标点）</h3>
              <div className="space-y-3">
                {diffRows.map((row, i) => (
                  <div key={i} className="p-3 rounded border">
                    <div className="text-xs text-gray-500 mb-1">原文</div>
                    <div className="text-sm flex flex-wrap gap-1">
                      {row.refTokens.map((t, idx) => (
                        <span key={idx} className={row.refFlags[idx] ? "text-emerald-700" : "text-red-600"}>{t}</span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2 mb-1">识别</div>
                    <div className="text-sm flex flex-wrap gap-1">
                      {row.hypTokens.map((t, idx) => (
                        <span key={idx} className={row.hypFlags[idx] ? "text-emerald-700" : "text-red-600"}>{t}</span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">准确度：{Math.round(row.accuracy * 100)}%</div>
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
    </main>
  );
}
