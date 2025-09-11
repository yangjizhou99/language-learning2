"use client";
import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import VoiceManager from "@/components/VoiceManager";
import CandidateVoiceSelector from "@/components/CandidateVoiceSelector";

type Item = { id:string; lang:"en"|"ja"|"zh"; level:number; genre:string; title:string; status:string; created_at:string; notes?: any; text?: string };

// 格式化对话文本，按说话者分行
function formatDialogueText(text: string): string {
  if (!text) return '';
  
  // 处理AI返回的\n换行符
  let formatted = text.replace(/\\n/g, '\n');
  
  // 如果已经包含换行符，保持格式并清理
  if (formatted.includes('\n')) {
    return formatted
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }
  
  // 尝试按说话者分割 - 匹配 A: 或 B: 等格式
  // 使用更简单有效的方法
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
  
  // 尝试按引号分割对话
  if (formatted.includes('"')) {
    const quotedParts = formatted.match(/"([^"]+)"/g);
    if (quotedParts && quotedParts.length > 1) {
      return quotedParts
        .map((part, index) => {
          const content = part.replace(/"/g, '').trim();
          const speaker = String.fromCharCode(65 + index); // A, B, C, D...
          return `${speaker}: ${content}`;
        })
        .join('\n');
    }
  }
  
  // 尝试按句子分割并分配说话者
  if (formatted.includes('.') || formatted.includes('!') || formatted.includes('?')) {
    const sentences = formatted
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length > 1) {
      return sentences
        .map((sentence, index) => {
          const speaker = String.fromCharCode(65 + (index % 2)); // 交替使用 A 和 B
          return `${speaker}: ${sentence}`;
        })
        .join('\n');
    }
  }
  
  // 如果文本很短，直接分配说话者
  if (formatted.length < 200) {
    const words = formatted.split(' ');
    if (words.length > 10) {
      const midPoint = Math.ceil(words.length / 2);
      const firstPart = words.slice(0, midPoint).join(' ');
      const secondPart = words.slice(midPoint).join(' ');
      return `A: ${firstPart}\nB: ${secondPart}`;
    }
  }
  
  // 默认返回原文本
  return formatted;
}

export default function ShadowingReviewList(){
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<"all"|"en"|"ja"|"zh">("all");
  const [genre, setGenre] = useState("all");
  const [level, setLevel] = useState<"all"|"1"|"2"|"3"|"4"|"5">("all");
  const [status, setStatus] = useState<"all"|"draft"|"approved">("draft");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ttsLoading, setTtsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ttsTotal, setTtsTotal] = useState(0);
  const [ttsDone, setTtsDone] = useState(0);
  const [ttsCurrent, setTtsCurrent] = useState("");
  const [currentOperation, setCurrentOperation] = useState<"tts" | "publish" | "delete">("tts");
  // 移除ttsProvider状态，改为通过音色管理器选择
  
  // 音色管理相关状态
  const [selectedVoice, setSelectedVoice] = useState<any>(null);
  const [showVoiceManager, setShowVoiceManager] = useState(false);
  
  // 随机生成相关状态
  const [candidateVoices, setCandidateVoices] = useState<any[]>([]);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [log, setLog] = useState("");
  
  // 批量翻译相关状态
  const [transRunning, setTransRunning] = useState(false);
  const [transProgress, setTransProgress] = useState({ done: 0, total: 0 });
  const [transLogs, setTransLogs] = useState<string[]>([]);
  const [transProvider, setTransProvider] = useState('deepseek');
  const [transModel, setTransModel] = useState('openai/gpt-4o-mini');
  const [transTemperature, setTransTemperature] = useState(0.3);
  const [transConcurrency, setTransConcurrency] = useState(4);
  const [transRetries, setTransRetries] = useState(2);
  const [transThrottle, setTransThrottle] = useState(200);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);
  
  // 性能优化参数
  const [concurrency, setConcurrency] = useState(3);
  const [retries, setRetries] = useState(2);
  const [throttle, setThrottle] = useState(200);
  const [timeout, setTimeout] = useState(60); // TTS超时时间（秒）
  
  // 性能监控状态
  const [performanceStats, setPerformanceStats] = useState({
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    currentLoad: 0,
    recommendedConcurrency: 3
  });
  
  // 性能历史记录
  const [performanceHistory, setPerformanceHistory] = useState<Array<{
    timestamp: number;
    concurrency: number;
    successRate: number;
    avgResponseTime: number;
    totalRequests: number;
  }>>([]);
  
  // 统计信息
  const stats = useMemo(() => {
    const total = items.length;
    const dialogueCount = items.filter(item => isDialogueFormat(item.text || '')).length;
    const monologueCount = total - dialogueCount;
    const selectedCount = selected.size;
    
    return {
      total,
      dialogueCount,
      monologueCount,
      selectedCount
    };
  }, [items, selected]);

  useEffect(()=>{ (async()=>{
    const params = new URLSearchParams({ status: status === "all" ? "draft" : status });
    if (lang !== 'all') params.set('lang', lang);
    if (genre !== 'all') params.set('genre', genre);
    if (level !== 'all') params.set('level', level);
    if (q.trim()) params.set('q', q.trim());
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const r = await fetch(`/api/admin/shadowing/drafts?${params}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
    const j = await r.json();
    console.log('加载的草稿数据:', j.items?.length || 0, '个草稿');
    // 检查第一个草稿的音频URL
    if (j.items && j.items.length > 0) {
      console.log('第一个草稿的音频URL:', j.items[0].notes?.audio_url);
    }
    setItems(j.items||[]);
  })(); }, [q, lang, genre, level, status]);

  // 加载可用模型
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  function isAllSelected(): boolean {
    if (items.length === 0) return false;
    return items.every(it => selected.has(it.id));
  }
  function toggleSelectAll(){
    setSelected(prev => {
      if (items.length === 0) return new Set();
      const all = new Set<string>();
      if (!isAllSelected()) items.forEach(it => all.add(it.id));
      return isAllSelected() ? new Set() : all;
    });
  }
  function toggleSelect(id: string){
    setSelected(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  // 检测是否为对话格式
  function isDialogueFormat(text: string): boolean {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    return lines.some(line => /^[A-Z]:\s/.test(line));
  }


  async function deleteOne(id: string){
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'DELETE', headers: token? { Authorization: `Bearer ${token}` } : undefined });
  }

  async function deleteSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true); // 复用发布状态显示进度
    setCurrentOperation("delete");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理删除
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
        const it = items.find(x => x.id === id);
        setTtsCurrent(it?.title || "");
          try {
            const startTime = Date.now();
            await deleteOne(id);
            const responseTime = Date.now() - startTime;
            
            // 更新性能统计
            updatePerformanceStats(true, responseTime);
            
        setTtsDone(v => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`删除失败 ${id}:`, error);
            const responseTime = Date.now() - Date.now();
            
            // 更新性能统计
            updatePerformanceStats(false, responseTime);
            
            setTtsDone(v => v + 1);
            return { id, success: false };
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          if (throttle > 0) {
            await new Promise<void>(resolve => {
              (globalThis as any).setTimeout(() => {
                resolve();
              }, throttle);
            });
          }
        }
      }
      
      toast.success(`批量删除完成：${ids.length - fail}/${ids.length}`);
    setSelected(new Set());
    // 刷新
      setQ(q => q);
    } catch (e) {
      toast.error("批量删除失败，请重试");
    } finally {
      setTtsCurrent("");
      setPublishing(false);
    }
  }

  async function publishOne(id: string){
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, { method: "POST", headers: { "Content-Type": "application/json", ...(token? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "publish" }) });
  }

  async function publishSelected(){
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true);
    setCurrentOperation("publish");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理发布
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
          const it = items.find(x => x.id === id);
          setTtsCurrent(it?.title || "");
          try {
            const startTime = Date.now();
            await publishOne(id);
            const responseTime = Date.now() - startTime;
            
            // 更新性能统计
            updatePerformanceStats(true, responseTime);
            
            setTtsDone(v => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`发布失败 ${id}:`, error);
            const responseTime = Date.now() - Date.now();
            
            // 更新性能统计
            updatePerformanceStats(false, responseTime);
            
            setTtsDone(v => v + 1);
            return { id, success: false };
          }
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          if (throttle > 0) {
            await new Promise<void>(resolve => {
              (globalThis as any).setTimeout(() => {
                resolve();
              }, throttle);
            });
          }
        }
      }
      
      toast.success(`批量发布完成：${ids.length - fail}/${ids.length}`);
    setSelected(new Set());
    // 刷新
    setQ(q => q);
    } catch (e) {
      toast.error("批量发布失败，请重试");
    } finally {
      setTtsCurrent("");
      setPublishing(false);
    }
  }

  // 随机生成流程：使用备选音色进行批量TTS生成
  const startRandomGeneration = () => {
    if (candidateVoices.length === 0) {
      toast.error("请先设置备选音色");
      return;
    }
    if (selected.size === 0) {
      toast.error("请先选择要处理的草稿");
      return;
    }

    // 计算预估花费和参数
    const selectedDraftsArray = Array.from(selected);
    const actualDrafts = selectedDraftsArray.map(id => items.find(item => item.id === id)).filter(Boolean);
    
    // 为每个草稿随机分配音色
    const draftsWithVoices = actualDrafts.map(draft => {
      if (!draft) return null;
      const textContent = draft.text || draft.title || '';
      const isDialogue = /^[A-Z]:/.test(textContent);
      
      return {
        ...draft,
        textContent,
        isDialogue
      };
    }).filter(Boolean);

    // 计算总字符数
    const totalCharacters = draftsWithVoices.reduce((total, draft) => {
      return total + (draft?.textContent?.length || 0);
    }, 0);

    // 计算预估花费（Google TTS: $4/M字符）
    const estimatedCost = (totalCharacters / 1000000) * 4;
    const estimatedCostCNY = estimatedCost * 7.2;

    // 统计对话和独白数量
    const dialogueCount = draftsWithVoices.filter(d => d?.isDialogue).length;
    const monologueCount = draftsWithVoices.filter(d => !d?.isDialogue).length;

    // 显示确认对话框
    const confirmed = window.confirm(
      `🎲 随机生成参数确认：\n\n` +
      `• 选中草稿：${selectedDraftsArray.length} 个\n` +
      `  - 对话：${dialogueCount} 个 (A=男声, B=女声)\n` +
      `  - 独白：${monologueCount} 个 (随机音色)\n` +
      `• 备选音色：${candidateVoices.length} 个\n` +
      `• 总字符数：${totalCharacters.toLocaleString()} 字符\n` +
      `• 预估花费：$${estimatedCost.toFixed(4)} (约¥${estimatedCostCNY.toFixed(2)})\n` +
      `• 性能参数：并发${concurrency}，重试${retries}次，延迟${throttle}ms\n\n` +
      `是否开始随机生成？`
    );

    if (!confirmed) {
      return;
    }

    setShowCandidateSelector(false);
    setLog("开始随机生成流程...");
    
    // 开始批量TTS生成
    synthSelectedWithRandomVoices();
  };

  // 使用随机音色分配进行批量TTS生成
  const synthSelectedWithRandomVoices = async () => {
    if (selected.size === 0) return;
    
    const ids = Array.from(selected);
    setTtsLoading(true);
    setCurrentOperation("tts");
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;
    
    try {
      // 并发处理
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id) => {
          const it = items.find(x => x.id === id);
          setTtsCurrent(it?.title || "");
          
          const startTime = Date.now();
          // 使用随机音色分配进行TTS生成
          const ok = await synthOneWithRandomVoices(id);
          const responseTime = Date.now() - startTime;
          
          // 更新性能统计
          updatePerformanceStats(ok, responseTime);
          
          setTtsDone(v => v + 1);
          return { id, success: ok };
        });
        
        const results = await Promise.all(promises);
        return results.filter(r => !r.success).length;
      };
      
      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchFail = await processBatch(batch);
        fail += batchFail;
        
        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          if (throttle > 0) {
            await new Promise<void>(resolve => {
              (globalThis as any).setTimeout(() => {
                resolve();
              }, throttle);
            });
          }
        }
      }
      
      toast.success(`随机TTS合成完成：${ids.length - fail}/${ids.length}`);
      setLog(`随机TTS合成完成：${ids.length - fail}/${ids.length} 个草稿`);
      // 触发刷新
      setQ(q => q + ' '); // 添加空格确保值变化
    } catch (e) {
      toast.error("随机批量合成失败，请重试");
      setLog("随机批量合成失败，请重试");
    } finally {
      setTtsCurrent("");
      setTtsLoading(false);
    }
  };

  // 使用随机音色分配进行单个TTS生成
  const synthOneWithRandomVoices = async (id: string) => {
    const it = items.find(x => x.id === id);
    if (!it) return false;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const detail = await fetch(`/api/admin/shadowing/drafts/${id}`, { headers: token? { Authorization: `Bearer ${token}` } : undefined });
      if (!detail.ok) throw new Error(`获取草稿失败(${detail.status})`);
      const dj = await detail.json();
      const draft = dj.draft;
      
      // 检查是否为对话格式
      const isDialogue = isDialogueFormat(draft.text);
      
      // 根据对话格式分配音色
      let selectedVoice = null;
      let processedText = draft.text;
      
      if (isDialogue) {
        // 对话格式：分别合成每个说话者的音频
        console.log('对话格式，使用多音色对话合成');
        
        // 为对话文本分配音色
        const speakerVoices = getSpeakerVoices(draft.text);
        console.log('说话者音色分配:', speakerVoices);
        
        if (!speakerVoices) {
          throw new Error('无法分配说话者音色');
        }
        
        // 分别合成每个说话者的音频
        const audioUrls = await synthDialogueWithDifferentVoices(draft.text, speakerVoices, draft.lang, draft?.notes?.speakingRate || 1.0, draft?.notes?.pitch || 0, token || null);
        
        if (audioUrls && audioUrls.length > 0) {
          // 保存合并后的音频地址
          const next = {
            ...draft,
            notes: {
              ...(draft.notes || {}),
              audio_url: audioUrls[0], // 使用第一个音频（合并后的）
              is_dialogue: true,
              dialogue_count: Object.keys(speakerVoices).length,
              speakers: Object.keys(speakerVoices),
              tts_provider: 'Google',
              random_voice_assignment: speakerVoices
            }
          };
          
          console.log('准备保存的音频URL:', audioUrls[0]);
          console.log('准备保存的notes:', next.notes);
          
          const save = await fetch(`/api/admin/shadowing/drafts/${draft.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json', 
              ...(token ? { Authorization: `Bearer ${token}` } : {}) 
            },
            body: JSON.stringify({ notes: next.notes })
          });
          
          if (!save.ok) {
            const errorText = await save.text();
            console.error('保存失败响应:', errorText);
            throw new Error(`保存音频地址失败(${save.status}): ${errorText}`);
          }
          
          const saveResult = await save.json();
          console.log('保存成功响应:', saveResult);
          
          console.log('多音色对话合成保存成功');
          
          // 直接更新本地状态，避免等待页面刷新
          setItems(prevItems => 
            prevItems.map(item => 
              item.id === draft.id 
                ? { ...item, notes: { ...item.notes, audio_url: audioUrls[0] } }
                : item
            )
          );
          
          // 触发页面刷新以显示新的音频
          setQ(q => q + ' '); // 添加空格确保值变化
          return true;
        } else {
          throw new Error('多音色对话合成失败');
        }
      } else {
        // 独白格式：随机选择一个音色
        selectedVoice = getRandomVoice();
        processedText = draft.text;
        console.log('独白格式，使用随机音色:', selectedVoice);
      }
      
      // 使用分配的音色进行TTS合成
      const apiEndpoint = '/api/admin/shadowing/synthesize';
      
      console.log(`使用随机音色分配进行TTS合成: ${draft.title}`);
      
      // 创建AbortController用于超时控制
      const controller = new AbortController();
      const timeoutId = (globalThis as any).setTimeout(() => controller.abort(), timeout * 1000); // 使用配置的超时时间
      
      let j: any;
      try {
        const r = await fetch(apiEndpoint, { 
          method:'POST', 
          headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, 
          body: JSON.stringify({ 
            text: processedText, 
            lang: draft.lang, 
            voice: selectedVoice,
            speakingRate: draft?.notes?.speakingRate || 1.0,
            pitch: draft?.notes?.pitch || 0
          }),
          signal: controller.signal
        });
        
        (globalThis as any).clearTimeout(timeoutId);
        j = await r.json();
        if (!r.ok) throw new Error(j?.error || "TTS 失败");
      } catch (error) {
        (globalThis as any).clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`TTS合成超时（${timeout}秒）`);
        }
        throw error;
      }
      
      // 写入 notes.audio_url 并保存
      const next = { 
        ...draft, 
        notes: { 
          ...(draft.notes||{}), 
          audio_url: j.audio_url,
          is_dialogue: j.is_dialogue || isDialogue,
          dialogue_count: j.dialogue_count || null,
          speakers: j.speakers || null,
          tts_provider: j.provider || 'google',
          random_voice_assignment: selectedVoice // 记录随机音色分配
        } 
      };
      const save = await fetch(`/api/admin/shadowing/drafts/${id}`, { method:'PUT', headers:{ 'Content-Type':'application/json', ...(token? { Authorization:`Bearer ${token}` }: {}) }, body: JSON.stringify({ notes: next.notes }) });
      if (!save.ok) throw new Error(`保存音频地址失败(${save.status})`);
      
      // 直接更新本地状态，避免等待页面刷新
      setItems(prevItems => 
        prevItems.map(item => 
          item.id === id 
            ? { ...item, notes: { ...item.notes, audio_url: j.audio_url } }
            : item
        )
      );
      
      // 触发页面刷新以显示新的音频
      setQ(q => q + ' '); // 添加空格确保值变化
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // 获取说话者音色分配
  const getSpeakerVoices = (text: string) => {
    // 分析说话者标识符
    const speakerPattern = /^[A-Z]:/gm;
    const matches = text.match(speakerPattern);
    if (!matches) return null;
    
    const speakers = Array.from(new Set(matches.map(m => m.replace(':', ''))));
    const speakerVoices: Record<string, string> = {};
    
    // 按规则分配音色
    speakers.forEach((speaker, index) => {
      if (speaker === 'A') {
        // A说话者：选择男声
        const maleVoice = getRandomMaleVoice();
        speakerVoices[speaker] = maleVoice || 'cmn-CN-Standard-B';
      } else if (speaker === 'B') {
        // B说话者：选择女声
        const femaleVoice = getRandomFemaleVoice();
        speakerVoices[speaker] = femaleVoice || 'cmn-CN-Standard-A';
      } else {
        // C、D等：随机选择
        const randomVoice = getRandomVoice();
        speakerVoices[speaker] = randomVoice || 'cmn-CN-Standard-A';
      }
    });
    
    return speakerVoices;
  };

  // 获取随机音色
  const getRandomVoice = () => {
    console.log('getRandomVoice - candidateVoices:', candidateVoices);
    if (candidateVoices.length === 0) {
      console.log('getRandomVoice - 没有备选音色');
      return null;
    }
    const randomIndex = Math.floor(Math.random() * candidateVoices.length);
    const selectedVoice = candidateVoices[randomIndex].name;
    console.log('getRandomVoice - 选择的音色:', selectedVoice);
    return selectedVoice;
  };

  // 合并多个音频文件
  const mergeAudioFiles = async (audioUrls: string[], token: string | null): Promise<string> => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        console.log(`开始合并音频文件 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, audioUrls);
        
        // 调用后端API合并音频
        const response = await fetch('/api/admin/shadowing/merge-audio', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            ...(token ? { Authorization: `Bearer ${token}` } : {}) 
          },
          body: JSON.stringify({ 
            audioUrls: audioUrls
          })
        });
        
        if (response.status === 429) {
          // 服务器繁忙，等待后重试
          const waitTime = Math.pow(2, retryCount) * 1000; // 指数退避
          console.log(`服务器繁忙，${waitTime}ms后重试...`);
          await new Promise<void>(resolve => (globalThis as any).setTimeout(() => resolve(), waitTime));
          retryCount++;
          continue;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('音频合并API错误:', response.status, errorText);
          throw new Error(`音频合并失败: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          console.error('音频合并失败:', result.error, result.details);
          throw new Error(`音频合并失败: ${result.error} - ${result.details}`);
        }
        
        console.log('音频合并成功:', result.mergedAudioUrl);
        return result.mergedAudioUrl;
        
      } catch (error) {
        retryCount++;
        if (retryCount > maxRetries) {
          console.error('音频合并失败，超过最大重试次数:', error);
          // 如果合并失败，返回第一个音频作为备选
          console.warn('使用第一个音频片段作为备选方案');
          return audioUrls[0];
        }
        
        const waitTime = Math.pow(2, retryCount) * 1000; // 指数退避
        console.log(`音频合并失败，${waitTime}ms后重试... (${retryCount}/${maxRetries})`);
        await new Promise<void>(resolve => (globalThis as any).setTimeout(() => resolve(), waitTime));
      }
    }
    
    // 理论上不会到达这里，但为了类型安全
    return audioUrls[0];
  };

  // 多音色对话合成函数
  const synthDialogueWithDifferentVoices = async (text: string, speakerVoices: Record<string, string>, lang: string, speakingRate: number, pitch: number, token: string | null): Promise<string[]> => {
    try {
      console.log('开始多音色对话合成:', { text: text.substring(0, 100) + '...', speakerVoices, lang });
      
      // 解析对话文本，分离每个说话者的内容
      const lines = text.split('\n').filter(line => line.trim());
      const speakerSegments: { speaker: string; text: string; voice: string }[] = [];
      
      for (const line of lines) {
        const match = line.match(/^([A-Z]):\s*(.+)$/);
        if (match) {
          const speaker = match[1];
          const content = match[2].trim();
          const voice = speakerVoices[speaker];
          
          if (voice && content) {
            speakerSegments.push({ speaker, text: content, voice });
          }
        }
      }
      
      console.log('解析的说话者片段:', speakerSegments);
      
      if (speakerSegments.length === 0) {
        throw new Error('没有找到有效的对话片段');
      }
      
      // 分别合成每个说话者的音频
      const audioPromises = speakerSegments.map(async (segment, index) => {
        console.log(`合成第${index + 1}个片段: ${segment.speaker} - ${segment.text.substring(0, 50)}...`);
        
        const response = await fetch('/api/admin/shadowing/synthesize', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            ...(token ? { Authorization: `Bearer ${token}` } : {}) 
          },
          body: JSON.stringify({ 
            text: segment.text, 
            lang: lang, 
            voice: segment.voice,
            speakingRate: speakingRate
          })
        });
        
        if (!response.ok) {
          throw new Error(`TTS合成失败: ${response.status}`);
        }
        
        const result = await response.json();
        console.log(`第${index + 1}个片段合成成功:`, result.audio_url);
        return result.audio_url;
      });
      
      // 等待所有音频合成完成
      const audioUrls = await Promise.all(audioPromises);
      console.log('所有音频合成完成:', audioUrls);
      
      // 合并音频：使用ffmpeg将多个音频合并成一个完整的对话音频
      const mergedAudioUrl = await mergeAudioFiles(audioUrls, token);
      console.log('音频合并完成:', mergedAudioUrl);
      
      return [mergedAudioUrl];
      
    } catch (error) {
      console.error('多音色对话合成失败:', error);
      throw error;
    }
  };

  // 获取随机男声音色
  const getRandomMaleVoice = () => {
    const maleVoices = candidateVoices.filter(voice => {
      const gender = voice.ssml_gender || voice.ssmlGender || '';
      return gender.toLowerCase() === 'male' || gender.toLowerCase().includes('男');
    });
    if (maleVoices.length === 0) {
      return getRandomVoice(); // 如果没有男声，随机选择
    }
    const randomIndex = Math.floor(Math.random() * maleVoices.length);
    const selectedVoice = maleVoices[randomIndex].name;
    return selectedVoice;
  };

  // 获取随机女声音色
  const getRandomFemaleVoice = () => {
    const femaleVoices = candidateVoices.filter(voice => {
      const gender = voice.ssml_gender || voice.ssmlGender || '';
      return gender.toLowerCase() === 'female' || gender.toLowerCase().includes('女');
    });
    if (femaleVoices.length === 0) {
      return getRandomVoice(); // 如果没有女声，随机选择
    }
    const randomIndex = Math.floor(Math.random() * femaleVoices.length);
    const selectedVoice = femaleVoices[randomIndex].name;
    return selectedVoice;
  };

  // 开始批量翻译
  const startBatchTranslation = async () => {
    if (transRunning) return;
    
    // 检查是否有选中的项目
    if (selected.size === 0) {
      toast.error("请先选择要翻译的草稿");
      return;
    }
    
    try {
      setTransRunning(true);
      setTransProgress({ done: 0, total: 0 });
      setTransLogs([]);
      
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/admin/shadowing/translate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          scope: 'drafts',
          provider: transProvider,
          model: transModel,
          temperature: transTemperature,
          concurrency: transConcurrency,
          retries: transRetries,
          throttle_ms: transThrottle,
          onlyMissing,
          selectedIds: Array.from(selected), // 传递选中的ID列表
          filters: {
            status: status === 'all' ? 'draft' : status,
            lang: lang === 'all' ? undefined : lang,
            level: level === 'all' ? undefined : level,
            genre: genre === 'all' ? undefined : genre,
            q: q.trim() || undefined
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('批量翻译请求失败');
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                setTransProgress({ done: 0, total: data.total });
                setTransLogs([data.message]);
              } else if (data.type === 'progress') {
                setTransProgress({ done: data.processed, total: data.total });
                setTransLogs(prev => [...prev, data.message]);
              } else if (data.type === 'complete') {
                setTransProgress({ done: data.processed, total: data.total });
                setTransLogs(prev => [...prev, data.message]);
                toast.success(`批量翻译完成: ${data.success_count}成功, ${data.failed_count}失败`);
                // 刷新列表
                setQ(q => q + ' ');
              } else if (data.type === 'error') {
                setTransLogs(prev => [...prev, data.message]);
                toast.error(data.message);
              }
            } catch (e) {
              console.error('解析SSE数据失败:', e);
            }
          }
        }
      }
      
    } catch (error: any) {
      setTransLogs(prev => [...prev, `错误: ${error.message}`]);
      toast.error('批量翻译失败: ' + error.message);
    } finally {
      setTransRunning(false);
    }
  };

  // 停止批量翻译
  const stopBatchTranslation = () => {
    setTransRunning(false);
    setTransLogs(prev => [...prev, '用户停止翻译']);
  };

  // 获取可用模型
  async function fetchAvailableModels() {
    try {
      setModelsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const response = await fetch('/api/admin/shadowing/translate/models', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (response.ok) {
        const result = await response.json();
        setAvailableModels(result.models);
        
        // 如果当前模型不在新列表中，重置为默认模型
        if (result.models[transProvider] && !result.models[transProvider].includes(transModel)) {
          setTransModel(result.models[transProvider][0] || '');
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
    } finally {
      setModelsLoading(false);
    }
  }

  // 提供商改变时重置模型
  const handleProviderChange = (provider: string) => {
    setTransProvider(provider);
    if (availableModels[provider] && availableModels[provider].length > 0) {
      setTransModel(availableModels[provider][0]);
    }
  };

  // 性能监控和推荐功能
  const updatePerformanceStats = (success: boolean, responseTime: number) => {
    setPerformanceStats(prev => {
      const newTotal = prev.totalRequests + 1;
      const newSuccessRate = ((prev.successRate * prev.totalRequests) + (success ? 1 : 0)) / newTotal;
      const newAvgResponseTime = ((prev.avgResponseTime * prev.totalRequests) + responseTime) / newTotal;
      
      // 计算推荐并发数
      let recommendedConcurrency = prev.recommendedConcurrency;
      if (newSuccessRate > 0.95 && newAvgResponseTime < 2000) {
        recommendedConcurrency = Math.min(8, prev.recommendedConcurrency + 1);
      } else if (newSuccessRate < 0.8 || newAvgResponseTime > 5000) {
        recommendedConcurrency = Math.max(1, prev.recommendedConcurrency - 1);
      }
      
      const newStats = {
        totalRequests: newTotal,
        successRate: newSuccessRate,
        avgResponseTime: newAvgResponseTime,
        currentLoad: Math.min(100, (concurrency / 8) * 100),
        recommendedConcurrency
      };
      
      // 记录性能历史
      setPerformanceHistory(prev => [
        ...prev.slice(-9), // 保留最近10条记录
        {
          timestamp: Date.now(),
          concurrency,
          successRate: newSuccessRate,
          avgResponseTime: newAvgResponseTime,
          totalRequests: newTotal
        }
      ]);
      
      return newStats;
    });
  };

  // 智能推荐配置
  const getRecommendedConfig = () => {
    const { successRate, avgResponseTime, recommendedConcurrency } = performanceStats;
    
    if (successRate > 0.95 && avgResponseTime < 1500) {
      return {
        name: "高速模式",
        concurrency: Math.min(8, recommendedConcurrency + 1),
        retries: 2,
        throttle: 100,
        timeout: 45,
        description: "系统运行良好，可以提升性能"
      };
    } else if (successRate > 0.9 && avgResponseTime < 3000) {
      return {
        name: "平衡模式",
        concurrency: recommendedConcurrency,
        retries: 2,
        throttle: 200,
        timeout: 60,
        description: "当前配置较为合适"
      };
    } else {
      return {
        name: "保守模式",
        concurrency: Math.max(1, recommendedConcurrency - 1),
        retries: 3,
        throttle: 500,
        timeout: 90,
        description: "建议降低并发数以提高稳定性"
      };
    }
  };

  // 应用推荐配置
  const applyRecommendedConfig = () => {
    const config = getRecommendedConfig();
    setConcurrency(config.concurrency);
    setRetries(config.retries);
    setThrottle(config.throttle);
    setTimeout(config.timeout);
    toast.success(`已应用${config.name}配置`);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Shadowing 草稿审核</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>总计: {stats.total}</span>
          <span>•</span>
          <span>对话: {stats.dialogueCount}</span>
          <span>•</span>
          <span>独白: {stats.monologueCount}</span>
      </div>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
              <label className="text-sm font-medium">搜索标题</label>
              <Input 
                placeholder="搜索标题" 
                value={q} 
                onChange={e=> setQ(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-sm font-medium">语言</label>
              <Select value={lang} onValueChange={(value) => setLang(value as "all"|"en"|"ja"|"zh")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">体裁</label>
              <Select value={genre} onValueChange={(value) => setGenre(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部体裁</SelectItem>
                  <SelectItem value="monologue">monologue</SelectItem>
                  <SelectItem value="dialogue">dialogue</SelectItem>
                  <SelectItem value="news">news</SelectItem>
                  <SelectItem value="lecture">lecture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">等级</label>
              <Select value={level} onValueChange={(value) => setLevel(value as "all"|"1"|"2"|"3"|"4"|"5")}>
                <SelectTrigger>
                  <SelectValue />
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
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={status} onValueChange={(value) => setStatus(value as "all"|"draft"|"approved")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="approved">已审核</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 性能优化参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">⚡ 性能优化参数</CardTitle>
          <CardDescription>调整批量操作的性能和稳定性，优化TTS生成效率</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 实时性能监控 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">📊 实时性能监控</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${performanceStats.currentLoad > 80 ? 'bg-red-500' : performanceStats.currentLoad > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                <span className="text-xs text-gray-600">系统负载: {performanceStats.currentLoad.toFixed(0)}%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">总请求数</div>
                <div className="font-medium">{performanceStats.totalRequests}</div>
              </div>
              <div>
                <div className="text-gray-600">成功率</div>
                <div className="font-medium text-green-600">{(performanceStats.successRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-gray-600">平均响应时间</div>
                <div className="font-medium">{performanceStats.avgResponseTime.toFixed(0)}ms</div>
              </div>
              <div>
                <div className="text-gray-600">推荐并发数</div>
                <div className="font-medium text-blue-600">{performanceStats.recommendedConcurrency}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">并发数 (1-8)</label>
              <Input 
                type="number" 
                min={1} 
                max={8} 
                value={concurrency} 
                onChange={e => setConcurrency(Number(e.target.value) || 3)}
                className={concurrency > performanceStats.recommendedConcurrency ? 'border-yellow-500' : ''}
              />
              <p className="text-xs text-gray-500">同时处理的任务数</p>
              {concurrency > performanceStats.recommendedConcurrency && (
                <p className="text-xs text-yellow-600">⚠️ 超过推荐值</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">重试次数 (0-5)</label>
              <Input 
                type="number" 
                min={0} 
                max={5} 
                value={retries} 
                onChange={e => setRetries(Number(e.target.value) || 2)}
              />
              <p className="text-xs text-gray-500">失败重试次数</p>
            </div>
            <div>
              <label className="text-sm font-medium">节流延迟 (ms)</label>
              <Input 
                type="number" 
                min={0} 
                max={2000} 
                value={throttle} 
                onChange={e => setThrottle(Number(e.target.value) || 200)}
              />
              <p className="text-xs text-gray-500">任务间延迟</p>
            </div>
            <div>
              <label className="text-sm font-medium">TTS超时 (秒)</label>
              <Input 
                type="number" 
                min={10} 
                max={300} 
                value={timeout} 
                onChange={e => setTimeout(Number(e.target.value) || 60)}
              />
              <p className="text-xs text-gray-500">单个TTS请求超时时间</p>
            </div>
            <div>
              <label className="text-sm font-medium">快速配置</label>
              <div className="flex flex-col gap-1">
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(2); setRetries(1); setThrottle(500); setTimeout(90); }}>
                  保守模式
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(4); setRetries(2); setThrottle(200); setTimeout(60); }}>
                  平衡模式
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setConcurrency(6); setRetries(3); setThrottle(100); setTimeout(45); }}>
                  高速模式
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  onClick={applyRecommendedConfig}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  🤖 智能推荐
                </Button>
              </div>
            </div>
          </div>
          
          {/* 智能推荐提示 */}
          {performanceStats.totalRequests > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600">💡</span>
                <span className="text-sm font-medium text-blue-800">智能推荐</span>
              </div>
              <p className="text-sm text-blue-700">{getRecommendedConfig().description}</p>
              <div className="mt-2 text-xs text-blue-600">
                建议配置: 并发{getRecommendedConfig().concurrency} | 重试{getRecommendedConfig().retries} | 延迟{getRecommendedConfig().throttle}ms | 超时{getRecommendedConfig().timeout}s
              </div>
            </div>
          )}
          
          {/* 性能历史图表 */}
          {performanceHistory.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium mb-3">📈 性能历史趋势</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-gray-600 mb-1">成功率趋势</div>
                  <div className="flex items-center gap-1">
                    {performanceHistory.slice(-5).map((record, index) => (
                      <div key={index} className="flex-1">
                        <div 
                          className="bg-green-500 rounded-sm" 
                          style={{ height: `${record.successRate * 20}px` }}
                          title={`${(record.successRate * 100).toFixed(1)}%`}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">响应时间趋势</div>
                  <div className="flex items-center gap-1">
                    {performanceHistory.slice(-5).map((record, index) => (
                      <div key={index} className="flex-1">
                        <div 
                          className="bg-blue-500 rounded-sm" 
                          style={{ height: `${Math.min(20, record.avgResponseTime / 100)}px` }}
                          title={`${record.avgResponseTime.toFixed(0)}ms`}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 mb-1">并发数趋势</div>
                  <div className="flex items-center gap-1">
                    {performanceHistory.slice(-5).map((record, index) => (
                      <div key={index} className="flex-1">
                        <div 
                          className="bg-purple-500 rounded-sm" 
                          style={{ height: `${record.concurrency * 2.5}px` }}
                          title={`并发${record.concurrency}`}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 音色管理区域 */}
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium">音色管理</h3>
                <p className="text-xs text-gray-500">选择音色后自动使用对应的TTS提供商</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowVoiceManager(!showVoiceManager)}
                >
                  {showVoiceManager ? "隐藏" : "管理"}音色
                </Button>
                {selectedVoice && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedVoice(null)}
                  >
                    清除选择
                  </Button>
                )}
              </div>
              </div>
              {selectedVoice && (
              <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                已选择: <strong>{selectedVoice.name}</strong> ({selectedVoice.provider === 'gemini' ? 'Gemini' : 'Google'})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 批量翻译面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌐 批量翻译</CardTitle>
          <CardDescription>为选中的草稿生成翻译，支持并发处理。请先选择要翻译的草稿。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">翻译提供商</label>
              <Select value={transProvider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">模型</label>
              <Select 
                value={transModel} 
                onValueChange={setTransModel}
                disabled={modelsLoading || !availableModels[transProvider]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelsLoading ? (
                    <SelectItem value="loading" disabled>加载中...</SelectItem>
                  ) : availableModels[transProvider] ? (
                    availableModels[transProvider].map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>无可用模型</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">温度 (0-1)</label>
              <Input 
                type="number" 
                step="0.1" 
                min="0" 
                max="1" 
                value={transTemperature} 
                onChange={e => setTransTemperature(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">并发数</label>
              <Input 
                type="number" 
                min="1" 
                max="8" 
                value={transConcurrency} 
                onChange={e => setTransConcurrency(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">重试次数</label>
              <Input 
                type="number" 
                min="0" 
                max="5" 
                value={transRetries} 
                onChange={e => setTransRetries(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">节流延迟 (ms)</label>
              <Input 
                type="number" 
                min="0" 
                max="2000" 
                value={transThrottle} 
                onChange={e => setTransThrottle(Number(e.target.value))}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1">
              <Checkbox 
                checked={onlyMissing} 
                onCheckedChange={(checked) => setOnlyMissing(checked === true)}
              />
              仅缺译项
            </label>
            <Button 
              className={`px-3 py-1 rounded ${transRunning ? 'bg-gray-300' : 'bg-black text-white'}`}
              onClick={startBatchTranslation} 
              disabled={transRunning || selected.size === 0}
            >
              开始批量翻译 {selected.size > 0 && `(${selected.size}个选中)`}
            </Button>
            <Button 
              className="px-3 py-1 rounded border" 
              onClick={stopBatchTranslation} 
              disabled={!transRunning}
            >
              停止
            </Button>
            <div>进度：{transProgress.done}/{transProgress.total}</div>
          </div>
          
          {transLogs.length > 0 && (
            <div className="text-xs bg-gray-50 p-2 rounded h-24 overflow-auto whitespace-pre-wrap mt-2">
              {transLogs.map((log, i) => <div key={`trans-log-${i}-${log.substring(0, 20)}`}>{log}</div>)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批量操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">批量操作</CardTitle>
          <CardDescription>已选择 {selected.size} 项草稿</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                checked={isAllSelected()} 
                onCheckedChange={toggleSelectAll}
              />
              <label className="text-sm font-medium">全选</label>
            </div>
            <div className="flex items-center space-x-1">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const dialogueItems = items.filter(item => isDialogueFormat(item.text || ''));
                  setSelected(new Set(dialogueItems.map(item => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择对话格式
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  const regularItems = items.filter(item => !isDialogueFormat(item.text || ''));
                  setSelected(new Set(regularItems.map(item => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择独白格式
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button 
              onClick={() => setShowCandidateSelector(true)} 
              disabled={ttsLoading || publishing || selected.size===0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              🎲 随机生成
            </Button>
            <Button 
              onClick={publishSelected} 
              disabled={publishing || selected.size===0}
              variant="outline"
            >
              {publishing ? "发布中..." : "批量发布选中"}
            </Button>
            <Button 
              onClick={deleteSelected} 
              disabled={selected.size===0}
              variant="destructive"
            >
              删除选中
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* 音色管理器 */}
      {showVoiceManager && (
        <VoiceManager 
          onVoiceSelect={setSelectedVoice}
          selectedVoice={selectedVoice}
          language={level === "all" ? "zh" : level}
        />
      )}
      
      {/* 进度显示 */}
      {(ttsLoading || publishing) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {currentOperation === "tts" && "TTS 合成进度"}
                  {currentOperation === "publish" && "批量发布进度"}
                  {currentOperation === "delete" && "批量删除进度"}
                </span>
                <span>{ttsDone}/{ttsTotal} ({Math.round((ttsDone/ttsTotal)*100)}%)</span>
              </div>
              <Progress value={(ttsDone/ttsTotal)*100} className="w-full" />
              {ttsCurrent && (
                <div className="text-sm text-gray-600">
                  当前处理: {ttsCurrent}
                </div>
              )}
              <div className="text-xs text-gray-500">
                并发数: {concurrency} | 节流延迟: {throttle}ms | 超时: {timeout}s | 成功率: {(performanceStats.successRate * 100).toFixed(1)}% | 平均响应: {performanceStats.avgResponseTime.toFixed(0)}ms
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 随机生成日志 */}
      {log && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">🎲 随机生成日志</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              {log}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 草稿列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">草稿列表</CardTitle>
          <CardDescription>共 {items.length} 项草稿</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无符合条件的草稿</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(it => (
                <div key={it.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox 
                      checked={selected.has(it.id)} 
                      onCheckedChange={() => toggleSelect(it.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{it.lang}</Badge>
                        <Badge variant="secondary">L{it.level}</Badge>
                        <Badge variant="outline">{it.genre}</Badge>
                        {isDialogueFormat(it.text || '') && (
                          <Badge variant="outline" className="text-purple-600 border-purple-300">
                            对话格式
                          </Badge>
                        )}
                        {it?.notes?.audio_url && (
                          <Badge variant="default" className="bg-green-600">
                            已生成音频
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-lg mb-2">{it.title}</div>
                      <div className="text-sm text-gray-500 mb-2">
                        创建时间: {new Date(it.created_at).toLocaleString()}
                      </div>
                      {/* 显示对话文本，按说话者分行 */}
                      {it.text && (
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                          <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {formatDialogueText(it.text)}
          </div>
        </div>
      )}
                {it?.notes?.audio_url && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-1">
                            音频URL: {it.notes.audio_url.substring(0, 50)}...
                          </div>
                          <div className="flex items-center gap-2">
                            <audio 
                              key={`${it.notes.audio_url}-${Date.now()}`} 
                              controls 
                              src={`${it.notes.audio_url}${it.notes.audio_url.includes('?') ? '&' : '?'}t=${Date.now()}`} 
                              className="h-8 w-full max-w-md" 
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                // 强制刷新页面
                                window.location.reload();
                              }}
                            >
                              刷新音频
                            </Button>
                          </div>
                  </div>
                )}
              </div>
            </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link href={`/admin/shadowing/review/${it.id}`}>查看详情</Link>
                    </Button>
                  </div>
          </div>
        ))}
      </div>
          )}
        </CardContent>
      </Card>

      {/* 备选音色设置面板 */}
      {showCandidateSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">设置备选音色</h2>
                <button
                  onClick={() => setShowCandidateSelector(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <CandidateVoiceSelector
                language={lang === "all" ? "zh" : lang}
                onCandidateVoicesSet={setCandidateVoices}
              />
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCandidateSelector(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={startRandomGeneration}
                  disabled={candidateVoices.length === 0 || selected.size === 0}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  🎲 开始随机生成 ({candidateVoices.length} 个备选音色, {selected.size} 个选中草稿)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );

}
