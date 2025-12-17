'use client';
import Link from 'next/link';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import VoiceManager from '@/components/VoiceManager';
import CandidateVoiceSelector from '@/components/CandidateVoiceSelector';
import ThemeBatchProcessor from '@/components/admin/ThemeBatchProcessor';

const DIALOGUE_TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'casual', label: '日常闲聊' },
  { value: 'task', label: '任务导向' },
  { value: 'emotion', label: '情感表达' },
  { value: 'opinion', label: '观点讨论' },
  { value: 'request', label: '请求建议' },
  { value: 'roleplay', label: '角色扮演' },
  { value: 'pattern', label: '句型操练' },
];

type Item = {
  id: string;
  lang: 'en' | 'ja' | 'zh' | 'ko';
  level: number;
  genre: string;
  dialogue_type?: string;
  title: string;
  status: string;
  created_at: string;
  notes?: any;
  text?: string;
  translations?: {
    en?: string;
    ja?: string;
  };
};

// 格式化对话文本，按说话者分行
function formatDialogueText(text: string, genre?: string): string {
  if (!text) return '';

  // 处理AI返回的\n换行符
  const formatted = text.replace(/\\n/g, '\n');

  // 如果不是对话体裁，直接返回原文本
  if (genre !== 'dialogue') {
    return formatted;
  }

  // 如果已经包含换行符，保持格式并清理
  if (formatted.includes('\n')) {
    return formatted
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
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
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

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

export default function ShadowingReviewList() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState<'all' | 'en' | 'ja' | 'zh' | 'ko'>('all');
  const [genre, setGenre] = useState('all');
  const [dialogueType, setDialogueType] = useState('all');
  const [level, setLevel] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [status, setStatus] = useState<'all' | 'draft' | 'approved'>('draft');
  const [audioStatus, setAudioStatus] = useState<'all' | 'no_audio' | 'has_audio'>('all');
  const [acuStatus, setAcuStatus] = useState<'all' | 'no_acu' | 'has_acu'>('all');
  const [voiceStatus, setVoiceStatus] = useState<'all' | 'fallback_voice' | 'custom_voice'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ttsLoading, setTtsLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [ttsTotal, setTtsTotal] = useState(0);
  const [ttsDone, setTtsDone] = useState(0);
  const [ttsCurrent, setTtsCurrent] = useState('');
  const [currentOperation, setCurrentOperation] = useState<
    'tts' | 'publish' | 'revert' | 'delete' | 'clear_audio' | 'acu'
  >('tts');
  // 移除ttsProvider状态，改为通过音色管理器选择

  // 音色管理相关状态
  const [selectedVoice, setSelectedVoice] = useState<any>(null);
  const [showVoiceManager, setShowVoiceManager] = useState(false);

  // 随机生成相关状态
  const [candidateVoices, setCandidateVoices] = useState<any[]>([]);
  const [showCandidateSelector, setShowCandidateSelector] = useState(false);
  const [log, setLog] = useState('');

  // 批量翻译相关状态
  const [transRunning, setTransRunning] = useState(false);
  const [transProgress, setTransProgress] = useState({ done: 0, total: 0 });
  const [transLogs, setTransLogs] = useState<string[]>([]);
  const [transProvider, setTransProvider] = useState('deepseek');
  const [transModel, setTransModel] = useState('deepseek-chat');
  const [transTemperature, setTransTemperature] = useState(0.3);
  const [transConcurrency, setTransConcurrency] = useState(18); // 后端并发，可以设置更高
  const [transRetries, setTransRetries] = useState(2);
  const [transThrottle, setTransThrottle] = useState(200);
  const [transTargetLanguages, setTransTargetLanguages] = useState<string[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [availableModels, setAvailableModels] = useState<Record<string, string[]>>({});
  const [modelsLoading, setModelsLoading] = useState(false);

  // 后端并发处理 - 使用批量API接口

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 默认每页10条
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 性能优化参数
  const [concurrency, setConcurrency] = useState(6); // 后端并发处理，默认使用推荐值
  const [retries, setRetries] = useState(2);
  const [throttle, setThrottle] = useState(200);
  const [timeout, setTimeout] = useState(120); // TTS超时时间（秒），默认120秒
  const voiceAssignmentsRef = useRef<
    Map<
      string,
      | { type: 'dialogue'; mapping: Record<string, string> }
      | { type: 'monologue'; voice: string }
    >
  >(new Map());
  const MAX_TTS_RETRIES = 5;
  const MAX_TTS_ATTEMPTS = MAX_TTS_RETRIES + 1;

  // 性能监控状态
  const [performanceStats, setPerformanceStats] = useState({
    totalRequests: 0,
    successRate: 0,
    avgResponseTime: 0,
    currentLoad: 0,
    recommendedConcurrency: 18,
  });

  // ACU生成专用监控状态
  const [acuPerformanceStats, setAcuPerformanceStats] = useState({
    totalAcuRequests: 0,
    acuSuccessRate: 0,
    avgAcuResponseTime: 0,
    acuCurrentLoad: 0,
    recommendedAcuConcurrency: 6,
    actualConcurrency: 0,
    batchProcessingTime: 0,
  });

  // 性能历史记录
  const [performanceHistory, setPerformanceHistory] = useState<
    Array<{
      timestamp: number;
      concurrency: number;
      successRate: number;
      avgResponseTime: number;
      totalRequests: number;
    }>
  >([]);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = (globalThis as any).setTimeout(() => {
        resolve();
      }, ms);
      if (typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') {
        timer.unref();
      }
    });

  const appendLog = (message: string) => {
    setLog((prev) => (prev ? `${prev}\n${message}` : message));
  };

  // 句级合成（含时间轴）
  const synthesizeSentences = async (id: string, draft: any) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const resp = await fetch('/api/admin/shadowing/synthesize-sentences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id,
          text: draft.text,
          lang: draft.lang,
          voice: selectedVoice?.name || null,
          speakingRate: draft?.notes?.speakingRate || 1.0,
          pitch: draft?.notes?.pitch || 0,
        }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || '句级合成失败');

      // 更新本地状态：使用代理URL
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, notes: { ...(it.notes || {}), audio_url: j.audio_url } } : it)),
      );
      return true;
    } catch (e) {
      console.error('synthesizeSentences failed', e);
      return false;
    }
  };

  // 统计信息
  const stats = useMemo(() => {
    const total = items.length;
    const dialogueCount = items.filter((item) => isDialogueFormat(item.text || '')).length;
    const monologueCount = total - dialogueCount;
    const selectedCount = selected.size;

    return {
      total,
      dialogueCount,
      monologueCount,
      selectedCount,
    };
  }, [items, selected]);

  useEffect(() => {
    (async () => {
      // 处理音频状态和ACU状态筛选 - 需要获取所有数据然后在客户端筛选
      const isAudioStatusFilter = audioStatus === 'no_audio' || audioStatus === 'has_audio';
      const isAcuStatusFilter = acuStatus === 'no_acu' || acuStatus === 'has_acu';
      const isVoiceStatusFilter = voiceStatus === 'fallback_voice' || voiceStatus === 'custom_voice';
      const isClientSideFilter = isAudioStatusFilter || isAcuStatusFilter || isVoiceStatusFilter;

      const params = new URLSearchParams({
        status: status === 'all' ? 'draft' : status,
        page: isClientSideFilter ? '1' : currentPage.toString(), // 客户端筛选时获取所有数据
        pageSize: isClientSideFilter ? '1000' : pageSize.toString(), // 客户端筛选时获取更多数据
      });
      if (lang !== 'all') params.set('lang', lang);
      if (genre !== 'all') params.set('genre', genre);
      if (dialogueType !== 'all') params.set('dialogue_type', dialogueType);
      if (level !== 'all') params.set('level', level);
      if (q.trim()) params.set('q', q.trim());
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const draftsUrl = `/api/admin/shadowing/drafts?${params}`;
      const r = await fetch(draftsUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await r.json();
      console.log('加载的草稿数据:', j.items?.length || 0, '个草稿，第', currentPage, '页');
      // 检查第一个草稿的音频URL
      if (j.items && j.items.length > 0) {
        console.log('第一个草稿的音频URL:', j.items[0].notes?.audio_url);
      }

      let filteredItems = j.items || [];

      // 客户端音频状态筛选
      if (audioStatus === 'no_audio') {
        filteredItems = filteredItems.filter((item: Item) => !item.notes?.audio_url);
      } else if (audioStatus === 'has_audio') {
        filteredItems = filteredItems.filter((item: Item) => item.notes?.audio_url);
      }

      // 客户端ACU状态筛选
      if (acuStatus === 'no_acu') {
        filteredItems = filteredItems.filter((item: Item) => !item.notes?.acu_units || item.notes?.acu_units?.length === 0);
      } else if (acuStatus === 'has_acu') {
        filteredItems = filteredItems.filter((item: Item) => item.notes?.acu_units && item.notes?.acu_units?.length > 0);
      }

      // 客户端音色状态筛选
      // 调试：显示音色分配数据
      if (voiceStatus !== 'all') {
        console.log('音色筛选模式:', voiceStatus);
        console.log('筛选前数据量:', filteredItems.length);
        // 检查多个可能的字段名
        const itemsWithVoice = filteredItems.filter((item: Item) => {
          const notes = item.notes || {};
          return notes.random_voice_assignment || notes.voice_mapping || notes.tts_provider;
        });
        console.log('有音色相关数据的数量:', itemsWithVoice.length);
        if (itemsWithVoice.length > 0) {
          console.log('第一个有音色数据的notes:', itemsWithVoice[0].notes);
        }
      }

      // 辅助函数：获取音色分配数据（兼容多个字段名）
      const getVoiceAssignment = (item: Item) => {
        const notes = item.notes || {};
        return notes.random_voice_assignment || notes.voice_mapping || null;
      };

      // 辅助函数：检查是否包含Standard回退音色
      const hasStandardVoice = (voiceAssignment: any): boolean => {
        if (!voiceAssignment) return false;
        const standardPattern = /Standard|standard/;
        if (typeof voiceAssignment === 'string') {
          return standardPattern.test(voiceAssignment);
        }
        if (typeof voiceAssignment === 'object') {
          return Object.values(voiceAssignment).some(
            (voice) => typeof voice === 'string' && standardPattern.test(voice)
          );
        }
        return false;
      };

      if (voiceStatus === 'fallback_voice') {
        // 只显示使用了回退音色（Standard系列）的草稿
        filteredItems = filteredItems.filter((item: Item) => {
          const voiceAssignment = getVoiceAssignment(item);
          return hasStandardVoice(voiceAssignment);
        });
        console.log('筛选后（回退音色）:', filteredItems.length);
      } else if (voiceStatus === 'custom_voice') {
        // 只显示使用了自定义音色（非Standard，如Chirp3-HD、Neural2等）且有音色数据的草稿
        filteredItems = filteredItems.filter((item: Item) => {
          const voiceAssignment = getVoiceAssignment(item);
          // 必须有音色数据
          if (!voiceAssignment) return false;
          // 如果是对象（voice_mapping），检查是否有任何音色值
          if (typeof voiceAssignment === 'object') {
            const voices = Object.values(voiceAssignment);
            if (voices.length === 0) return false;
            // 全部都不是Standard音色才算自定义音色
            return voices.every(
              (voice) => typeof voice === 'string' && !/Standard|standard/.test(voice)
            );
          }
          // 如果是字符串，检查不是Standard
          if (typeof voiceAssignment === 'string') {
            return !/Standard|standard/.test(voiceAssignment);
          }
          return false;
        });
        console.log('筛选后（自定义音色）:', filteredItems.length);
      }

      // 如果是客户端筛选，需要重新计算分页
      if (isClientSideFilter) {
        const totalFiltered = filteredItems.length;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        filteredItems = filteredItems.slice(startIndex, endIndex);
        setTotalItems(totalFiltered);
        setTotalPages(Math.ceil(totalFiltered / pageSize));
      } else {
        setTotalItems(j.total || 0);
        setTotalPages(j.totalPages || 0);
      }

      setItems(filteredItems);
    })();
  }, [q, lang, genre, dialogueType, level, status, audioStatus, acuStatus, voiceStatus, currentPage, pageSize]);

  // 加载可用模型
  useEffect(() => {
    fetchAvailableModels();
  }, []);

  // 当筛选条件改变时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [q, lang, genre, dialogueType, level, status, audioStatus, acuStatus, voiceStatus]);

  // 分页控制函数
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // 重置到第一页
  };

  function isAllSelected(): boolean {
    if (items.length === 0) return false;
    return items.every((it) => selected.has(it.id));
  }
  function toggleSelectAll() {
    setSelected((prev) => {
      if (items.length === 0) return new Set();
      const all = new Set<string>();
      if (!isAllSelected()) items.forEach((it) => all.add(it.id));
      return isAllSelected() ? new Set() : all;
    });
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // 检测是否为对话格式
  function isDialogueFormat(text: string): boolean {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.some((line) => /^[A-Z]:\s/.test(line));
  }

  // 检测是否使用了回退音色（Standard系列）
  function hasFallbackVoice(item: Item): boolean {
    const notes = item.notes || {};
    const voiceAssignment = notes.random_voice_assignment;

    if (!voiceAssignment) return false;

    // 检查Standard音色模式
    const standardPattern = /Standard|standard/;

    if (typeof voiceAssignment === 'string') {
      return standardPattern.test(voiceAssignment);
    }

    if (typeof voiceAssignment === 'object') {
      return Object.values(voiceAssignment).some(
        (voice) => typeof voice === 'string' && standardPattern.test(voice)
      );
    }

    return false;
  }

  async function deleteOne(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const deleteUrl = `/api/admin/shadowing/drafts/${id}`;
    await fetch(deleteUrl, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true); // 复用发布状态显示进度
    setCurrentOperation('delete');
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;

    try {
      // 并发处理删除
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id, index) => {
          const it = items.find((x) => x.id === id);
          setTtsCurrent(it?.title || '');
          try {
            const startTime = Date.now();
            // 使用多域名轮换
            const apiUrl = `/api/admin/shadowing/drafts/${id}`;
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            await fetch(apiUrl, {
              method: 'DELETE',
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const responseTime = Date.now() - startTime;

            // 更新性能统计
            updatePerformanceStats(true, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`删除失败 ${id}:`, error);
            const responseTime = Date.now() - Date.now();

            // 更新性能统计
            updatePerformanceStats(false, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: false };
          }
        });

        const results = await Promise.all(promises);
        return results.filter((r) => !r.success).length;
      };

      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      console.log(`批量删除并发控制: 总任务${ids.length}个, 批次大小${batchSize}, 并发数${concurrency}`);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(ids.length / batchSize);

        console.log(`删除批次 ${batchNum}/${totalBatches}: ${batch.length}个任务`);
        appendLog(`🔄 删除批次 ${batchNum}/${totalBatches} (${batch.length}个任务)`);

        const startTime = Date.now();
        const batchFail = await processBatch(batch);
        const batchTime = Date.now() - startTime;

        console.log(`删除批次 ${batchNum} 完成，耗时: ${batchTime}ms`);
        appendLog(`✅ 删除批次 ${batchNum} 完成，耗时: ${batchTime}ms`);

        fail += batchFail;

        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          console.log(`批次间延迟: ${throttle}ms`);
          await new Promise<void>((resolve) => {
            (globalThis as any).setTimeout(() => {
              resolve();
            }, throttle);
          });
        }
      }

      toast.success(`批量删除完成：${ids.length - fail}/${ids.length}`);
      setSelected(new Set());
      // 刷新
      setQ((q) => q);
    } catch (e) {
      toast.error('批量删除失败，请重试');
    } finally {
      setTtsCurrent('');
      setPublishing(false);
    }
  }

  async function publishOne(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const publishUrl = `/api/admin/shadowing/drafts/${id}`;
    await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'publish' }),
    });
  }

  async function revertOne(id: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch(`/api/admin/shadowing/drafts/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action: 'revert' }),
    });
  }

  async function revertSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true);
    setCurrentOperation('revert');
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;

    try {
      // 并发处理撤回
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id, index) => {
          const it = items.find((x) => x.id === id);
          setTtsCurrent(it?.title || '');
          try {
            const startTime = Date.now();
            // 使用多域名轮换
            const apiUrl = `/api/admin/shadowing/drafts/${id}`;
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ action: 'revert' }),
            });
            const responseTime = Date.now() - startTime;

            // 更新性能统计
            updatePerformanceStats(true, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`撤回失败 ${id}:`, error);
            const responseTime = Date.now() - Date.now();

            // 更新性能统计
            updatePerformanceStats(false, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: false };
          }
        });

        const results = await Promise.all(promises);
        return results.filter((r) => !r.success).length;
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
            await new Promise<void>((resolve) => {
              (globalThis as any).setTimeout(() => {
                resolve();
              }, throttle);
            });
          }
        }
      }

      toast.success(`批量撤回完成：${ids.length - fail}/${ids.length}`);
      setSelected(new Set());
      // 刷新
      setQ((q) => q);
    } catch (e) {
      toast.error('批量撤回失败，请重试');
    } finally {
      setTtsCurrent('');
      setPublishing(false);
    }
  }

  async function clearAudioSelected() {
    if (selected.size === 0) {
      toast.error('请先选择要清除音频的草稿');
      return;
    }

    const confirmed = window.confirm(
      `确定要清除选中 ${selected.size} 个草稿的音频吗？\n此操作会移除音频URL、时间轴等信息，无法恢复。`,
    );
    if (!confirmed) return;

    const ids = Array.from(selected);
    setTtsLoading(true);
    setCurrentOperation('clear_audio');
    setTtsTotal(ids.length);
    setTtsDone(0);
    setTtsCurrent('');
    let fail = 0;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const clearOne = async (id: string) => {
        const it = items.find((item) => item.id === id);
        setTtsCurrent(it?.title || '');

        try {
          const detailRes = await fetch(`/api/admin/shadowing/drafts/${id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
          if (!detailRes.ok) {
            throw new Error(`获取草稿失败(${detailRes.status})`);
          }
          const detailJson = await detailRes.json();
          const draft = detailJson?.draft;
          if (!draft) {
            throw new Error('草稿不存在或已被删除');
          }

          const sanitizedNotes: Record<string, any> = { ...(draft.notes || {}) };
          delete sanitizedNotes.audio_url;
          delete sanitizedNotes.audio_url_proxy;
          delete sanitizedNotes.sentence_timeline;
          delete sanitizedNotes.sentenceTimeline;
          delete sanitizedNotes.duration_ms;
          delete sanitizedNotes.duration;
          delete sanitizedNotes.random_voice_assignment;
          delete sanitizedNotes.randomVoiceAssignment;
          delete sanitizedNotes.random_voice_assignments;
          delete sanitizedNotes.tts_provider;
          delete sanitizedNotes.appliedSpeakerVoices;
          delete sanitizedNotes.applied_speaker_voices;
          delete sanitizedNotes.dialogue_count;
          delete sanitizedNotes.speakers;

          const saveRes = await fetch(`/api/admin/shadowing/drafts/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ notes: sanitizedNotes }),
          });
          if (!saveRes.ok) {
            const text = await saveRes.text();
            throw new Error(`保存失败(${saveRes.status}): ${text}`);
          }

          voiceAssignmentsRef.current.delete(id);
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                  ...item,
                  notes: {
                    ...sanitizedNotes,
                  },
                }
                : item,
            ),
          );
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('清除音频失败:', { id, message });
          appendLog(`清除音频失败 (${id}): ${message}`);
          return false;
        } finally {
          setTtsDone((v) => v + 1);
        }
      };

      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.all(batch.map((id) => clearOne(id)));
        fail += results.filter((ok) => !ok).length;

        if (throttle > 0 && i + batchSize < ids.length) {
          await wait(throttle);
        }
      }

      if (fail === 0) {
        toast.success(`清除音频完成：${ids.length}/${ids.length}`);
      } else if (fail < ids.length) {
        toast.success(`部分清除成功：${ids.length - fail}/${ids.length}`);
        toast.error(`有 ${fail} 个草稿清除失败，请查看日志`);
      } else {
        toast.error('清除音频失败，请检查日志');
      }

      setSelected(new Set());
      setQ((q) => q + ' ');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`清除音频失败：${message}`);
    } finally {
      setTtsCurrent('');
      setTtsLoading(false);
      setCurrentOperation('tts');
    }
  }

  // ACU 生成功能
  async function generateACUSelected() {
    if (selected.size === 0) {
      toast.error('请先选择要生成 ACU 的草稿');
      return;
    }

    const confirmed = window.confirm(
      `确定要为选中 ${selected.size} 个草稿生成 ACU 吗？\n此操作将调用 DeepSeek API 进行文本分析，可能产生费用。`,
    );

    if (!confirmed) {
      return;
    }

    setTtsLoading(true);
    setCurrentOperation('acu');
    setTtsTotal(selected.size);
    setTtsDone(0);
    setLog('开始生成 ACU...');

    const ids = Array.from(selected);
    let fail = 0;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const generateOne = async (id: string) => {
        const item = items.find((x) => x.id === id);
        setTtsCurrent(`生成 ACU: ${item?.title || id}`);

        try {
          const response = await fetch('/api/admin/shadowing/acu/segment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              id,
              text: item?.text || '',
              lang: item?.lang || 'zh',
              provider: 'deepseek',
              model: 'deepseek-chat',
              concurrency: 8,
              retries: 2,
              genre: item?.genre || 'monologue',
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error('ACU 生成失败');
          }

          appendLog(
            `✅ ACU 生成成功 (${id}): ${item?.title || id} - ${result.sentenceCount} 句`,
          );
          return true;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('ACU 生成失败:', { id, message });
          appendLog(`ACU 生成失败 (${id}): ${message}`);
          fail++;
          return false;
        } finally {
          setTtsDone((v) => v + 1);
        }
      };

      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      console.log(`ACU生成并发控制: 总任务${ids.length}个, 批次大小${batchSize}, 并发数${concurrency}`);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(ids.length / batchSize);

        console.log(`处理批次 ${batchNum}/${totalBatches}: ${batch.length}个任务`);
        appendLog(`🔄 处理批次 ${batchNum}/${totalBatches} (${batch.length}个任务)`);

        const startTime = Date.now();
        const results = await Promise.all(batch.map((id) => generateOne(id)));
        const batchTime = Date.now() - startTime;

        console.log(`批次 ${batchNum} 完成，耗时: ${batchTime}ms`);
        appendLog(`✅ 批次 ${batchNum} 完成，耗时: ${batchTime}ms`);

        // 更新ACU性能统计
        setAcuPerformanceStats(prev => ({
          ...prev,
          totalAcuRequests: prev.totalAcuRequests + batch.length,
          actualConcurrency: batch.length,
          batchProcessingTime: batchTime,
          acuSuccessRate: results.filter(r => r).length / batch.length,
        }));

        fail += results.filter((ok) => !ok).length;

        if (throttle > 0 && i + batchSize < ids.length) {
          console.log(`批次间延迟: ${throttle}ms`);
          await wait(throttle);
        }
      }

      if (fail === 0) {
        toast.success(`ACU 生成完成：${ids.length}/${ids.length}`);
      } else if (fail < ids.length) {
        toast.success(`部分生成成功：${ids.length - fail}/${ids.length}`);
        toast.error(`有 ${fail} 个草稿生成失败，请查看日志`);
      } else {
        toast.error('ACU 生成失败，请检查日志');
      }

      setSelected(new Set());
      setQ((q) => q + ' ');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`ACU 生成失败：${message}`);
    } finally {
      setTtsCurrent('');
      setTtsLoading(false);
      setCurrentOperation('tts');
    }
  }

  async function publishSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setPublishing(true);
    setCurrentOperation('publish');
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;

    try {
      // 并发处理发布
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id, index) => {
          const it = items.find((x) => x.id === id);
          setTtsCurrent(it?.title || '');
          try {
            const startTime = Date.now();
            // 使用多域名轮换
            const apiUrl = `/api/admin/shadowing/drafts/${id}`;
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token;
            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ action: 'publish' }),
            });
            const responseTime = Date.now() - startTime;

            // 更新性能统计
            updatePerformanceStats(true, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: true };
          } catch (error) {
            console.error(`发布失败 ${id}:`, error);
            const responseTime = Date.now() - Date.now();

            // 更新性能统计
            updatePerformanceStats(false, responseTime);

            setTtsDone((v) => v + 1);
            return { id, success: false };
          }
        });

        const results = await Promise.all(promises);
        return results.filter((r) => !r.success).length;
      };

      // 分批处理
      const batchSize = Math.max(1, Math.min(concurrency, ids.length));
      console.log(`批量发布并发控制: 总任务${ids.length}个, 批次大小${batchSize}, 并发数${concurrency}`);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(ids.length / batchSize);

        console.log(`发布批次 ${batchNum}/${totalBatches}: ${batch.length}个任务`);
        appendLog(`🔄 发布批次 ${batchNum}/${totalBatches} (${batch.length}个任务)`);

        const startTime = Date.now();
        const batchFail = await processBatch(batch);
        const batchTime = Date.now() - startTime;

        console.log(`发布批次 ${batchNum} 完成，耗时: ${batchTime}ms`);
        appendLog(`✅ 发布批次 ${batchNum} 完成，耗时: ${batchTime}ms`);

        fail += batchFail;

        // 节流延迟
        if (throttle > 0 && i + batchSize < ids.length) {
          console.log(`批次间延迟: ${throttle}ms`);
          await new Promise<void>((resolve) => {
            (globalThis as any).setTimeout(() => {
              resolve();
            }, throttle);
          });
        }
      }

      toast.success(`批量发布完成：${ids.length - fail}/${ids.length}`);
      setSelected(new Set());
      // 刷新
      setQ((q) => q);
    } catch (e) {
      toast.error('批量发布失败，请重试');
    } finally {
      setTtsCurrent('');
      setPublishing(false);
    }
  }

  // 随机生成流程：使用备选音色进行批量TTS生成
  const startRandomGeneration = () => {
    if (candidateVoices.length === 0) {
      toast.error('请先设置备选音色');
      return;
    }
    if (selected.size === 0) {
      toast.error('请先选择要处理的草稿');
      return;
    }

    // 计算预估花费和参数
    const selectedDraftsArray = Array.from(selected);
    const actualDrafts = selectedDraftsArray
      .map((id) => items.find((item) => item.id === id))
      .filter(Boolean);

    // 为每个草稿随机分配音色
    const draftsWithVoices = actualDrafts
      .map((draft) => {
        if (!draft) return null;
        const textContent = draft.text || draft.title || '';
        const isDialogue = /^[A-Z]:/.test(textContent);

        return {
          ...draft,
          textContent,
          isDialogue,
        };
      })
      .filter(Boolean);

    // 计算总字符数
    const totalCharacters = draftsWithVoices.reduce((total, draft) => {
      return total + (draft?.textContent?.length || 0);
    }, 0);

    // 计算预估花费（Google TTS: $4/M字符）
    const estimatedCost = (totalCharacters / 1000000) * 4;
    const estimatedCostCNY = estimatedCost * 7.2;

    // 统计对话和独白数量
    const dialogueCount = draftsWithVoices.filter((d) => d?.isDialogue).length;
    const monologueCount = draftsWithVoices.filter((d) => !d?.isDialogue).length;

    // 显示确认对话框
    const confirmed = window.confirm(
      `🎲 随机生成参数确认：\n\n` +
      `• 选中草稿：${selectedDraftsArray.length} 个\n` +
      `  - 对话：${dialogueCount} 个 (A=男声, B=女声)\n` +
      `  - 独白：${monologueCount} 个 (随机音色)\n` +
      `• 备选音色：${candidateVoices.length} 个\n` +
      `• 总字符数：${totalCharacters.toLocaleString()} 字符\n` +
      `• 预估花费：$${estimatedCost.toFixed(4)} (约¥${estimatedCostCNY.toFixed(2)})\n` +
      `• 性能参数：并发${concurrency}，重试${MAX_TTS_RETRIES}次，延迟${throttle}ms\n\n` +
      `是否开始随机生成？`,
    );

    if (!confirmed) {
      return;
    }

    setShowCandidateSelector(false);
    setLog('开始随机生成流程...');

    // 开始批量TTS生成
    synthSelectedWithRandomVoices();
  };

  // 使用随机音色分配进行批量TTS生成
  const synthSelectedWithRandomVoices = async () => {
    if (selected.size === 0) return;

    const ids = Array.from(selected);
    setTtsLoading(true);
    setCurrentOperation('tts');
    setTtsTotal(ids.length);
    setTtsDone(0);
    let fail = 0;

    try {
      // 并发处理
      const processBatch = async (batchIds: string[]) => {
        const promises = batchIds.map(async (id, index) => {
          const it = items.find((x) => x.id === id);
          setTtsCurrent(it?.title || '');

          const startTime = Date.now();
          // 使用随机音色分配进行TTS生成，传递索引用于域名轮换
          const ok = await synthOneWithRandomVoices(id, index);
          const responseTime = Date.now() - startTime;

          // 更新性能统计
          updatePerformanceStats(ok, responseTime);

          setTtsDone((v) => v + 1);
          return { id, success: ok };
        });

        const results = await Promise.all(promises);
        return results.filter((r) => !r.success).length;
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
            await new Promise<void>((resolve) => {
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
      setQ((q) => q + ' '); // 添加空格确保值变化
    } catch (e) {
      toast.error('随机批量合成失败，请重试');
      setLog('随机批量合成失败，请重试');
    } finally {
      setTtsCurrent('');
      setTtsLoading(false);
    }
  };

  // 使用随机音色分配进行单个TTS生成
  const performSynthOneWithRandomVoices = async (
    id: string,
    taskIndex: number,
    attempt: number,
    totalAttempts: number,
  ) => {
    const it = items.find((x) => x.id === id);
    if (!it) {
      throw new Error('草稿不存在或已被删除');
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const detailUrl = `/api/admin/shadowing/drafts/${id}`;
    const detail = await fetch(detailUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!detail.ok) throw new Error(`获取草稿失败(${detail.status})`);
    const dj = await detail.json();
    const draft = dj.draft;

    // 检查是否为对话格式
    const isDialogue = isDialogueFormat(draft.text);

    // 根据对话格式分配音色（仅生成一次，失败重试时保持不变）
    const existingAssignment = voiceAssignmentsRef.current.get(id);
    let selectedVoice: string | null = null;
    let speakerVoices: Record<string, string> | null = null;
    let processedText = draft.text;

    if (isDialogue) {
      console.log('对话格式，使用多音色对话合成');
      if (existingAssignment && existingAssignment.type === 'dialogue') {
        speakerVoices = existingAssignment.mapping;
      } else {
        speakerVoices = getSpeakerVoices(draft.text, draft.notes?.roles);
        console.log('说话者音色分配:', speakerVoices);
        if (!speakerVoices) {
          throw new Error('无法分配说话者音色');
        }
        if (Object.values(speakerVoices).some((voice) => !voice)) {
          throw new Error('备选音色不足，无法为所有说话者分配音色');
        }
        voiceAssignmentsRef.current.set(id, { type: 'dialogue', mapping: speakerVoices });
      }

      // 分别合成每个说话者的音频
      const merged = await synthDialogueWithDifferentVoices(
        draft.text,
        speakerVoices,
        draft.lang,
        draft?.notes?.speakingRate || 1.0,
        draft?.notes?.pitch || 0,
        token || null,
      );

      if (merged && merged.audio_url) {
        const appliedMapping = merged.appliedSpeakerVoices || speakerVoices;

        // 保存合并后的音频地址
        const next = {
          ...draft,
          notes: {
            ...(draft.notes || {}),
            audio_url: merged.audio_url, // 合并后的整段音频
            sentence_timeline: merged.sentence_timeline || null,
            duration_ms: merged.duration_ms || null,
            is_dialogue: true,
            dialogue_count: Object.keys(appliedMapping).length,
            speakers: Object.keys(appliedMapping),
            tts_provider: 'Google',
            random_voice_assignment: appliedMapping,
          },
        };

        console.log('准备保存的音频URL:', merged.audio_url);
        console.log('准备保存的notes:', next.notes);

        const saveUrl = `/api/admin/shadowing/drafts/${draft.id}`;
        const save = await fetch(saveUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ notes: next.notes }),
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
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === draft.id ? { ...item, notes: { ...item.notes, audio_url: merged.audio_url } } : item,
          ),
        );

        // 触发页面刷新以显示新的音频
        setQ((q) => q + ' '); // 添加空格确保值变化
        if (attempt > 1) {
          appendLog(
            `第 ${taskIndex + 1} 个草稿在第 ${attempt}/${totalAttempts} 次尝试后成功：${draft.title || draft.id}`,
          );
        }
        voiceAssignmentsRef.current.delete(id);
        return true;
      } else {
        throw new Error('多音色对话合成失败');
      }
    } else {
      // 独白格式：随机选择一个音色（保持一致）
      if (existingAssignment && existingAssignment.type === 'monologue') {
        selectedVoice = existingAssignment.voice;
      } else {
        selectedVoice = getRandomVoice();
        if (!selectedVoice) {
          throw new Error('未找到可用音色');
        }
        voiceAssignmentsRef.current.set(id, { type: 'monologue', voice: selectedVoice });
      }
      processedText = draft.text;
      console.log('独白格式，使用随机音色:', selectedVoice);
    }

    // 非对话体：按句合成并生成时间轴，然后合并为整段
    console.log(`按句合成（含时间轴）: ${draft.title}`);
    if (!selectedVoice) {
      throw new Error('音色未设置，无法执行合成');
    }
    const r = await fetch('/api/admin/shadowing/synthesize-sentences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        text: processedText,
        lang: draft.lang,
        voice: selectedVoice,
        speakingRate: draft?.notes?.speakingRate || 1.0,
        pitch: draft?.notes?.pitch || 0,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || '按句合成失败');

    // 写入草稿 notes：整段音频 + 句级时间轴 + 时长
    const next = {
      ...draft,
      notes: {
        ...(draft.notes || {}),
        audio_url: j.audio_url,
        sentence_timeline: j.sentence_timeline || null,
        duration_ms: j.duration_ms || null,
        is_dialogue: false,
        tts_provider: 'google',
        random_voice_assignment: selectedVoice,
      },
    };
    const saveUrl = `/api/admin/shadowing/drafts/${id}`;
    const save = await fetch(saveUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ notes: next.notes }),
    });
    if (!save.ok) throw new Error(`保存音频地址失败(${save.status})`);

    // 更新本地状态（仅需音频地址立即可试听）
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, notes: { ...item.notes, audio_url: j.audio_url } } : item,
      ),
    );

    // 触发页面刷新以显示新的音频
    setQ((q) => q + ' '); // 添加空格确保值变化
    if (attempt > 1) {
      appendLog(
        `第 ${taskIndex + 1} 个草稿在第 ${attempt}/${totalAttempts} 次尝试后成功：${draft.title || draft.id}`,
      );
    }
    voiceAssignmentsRef.current.delete(id);
    return true;
  };

  const synthOneWithRandomVoices = async (id: string, taskIndex: number = 0) => {
    const maxAttempts = MAX_TTS_ATTEMPTS;
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const success = await performSynthOneWithRandomVoices(id, taskIndex, attempt, maxAttempts);
        if (success) {
          return true;
        }
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        console.error('随机TTS合成失败，准备重试', {
          draftId: id,
          attempt,
          maxAttempts,
          message,
        });
        appendLog(`第 ${taskIndex + 1} 个草稿第 ${attempt}/${maxAttempts} 次尝试失败：${message}`);

        // 检测音色相关错误，清除缓存以便重新分配音色
        const isVoiceError = message.includes('VOICE_UNAVAILABLE') ||
          message.includes('VOICE_NOT_SPECIFIED') ||
          message.includes('音色') ||
          message.includes('voice');

        if (isVoiceError) {
          console.log(`检测到音色错误，清除草稿 ${id} 的音色分配缓存，下次重试将重新分配音色`);
          appendLog(`⚠️ 音色不可用，将重新分配音色后重试`);
          voiceAssignmentsRef.current.delete(id);
        }

        if (attempt >= maxAttempts) {
          break;
        }
        const backoff = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        await wait(backoff);
      }
    }

    const finalMessage =
      lastError instanceof Error ? lastError.message : String(lastError || '未知错误');
    toast.error(`草稿 ${id} 在 ${maxAttempts} 次尝试后仍失败：${finalMessage}`);
    voiceAssignmentsRef.current.delete(id);
    return false;
  };

  // 获取说话者音色分配（基于角色性别）
  const getSpeakerVoices = (text: string, roles?: Record<string, any>) => {
    // 提取说话者（A/B/C...）
    const speakerPattern = /^[A-Z]:/gm;
    const matches = text.match(speakerPattern);
    if (!matches) return null;
    const speakers = Array.from(new Set(matches.map((m) => m.replace(':', ''))));

    const mapping: Record<string, string> = {};

    // 基于"备选音色"按性别分类
    const maleVoices = (candidateVoices || []).filter((v: any) => {
      const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
      return g === 'male' || g.includes('男');
    });
    const femaleVoices = (candidateVoices || []).filter((v: any) => {
      const g = (v.ssml_gender || v.ssmlGender || '').toLowerCase();
      return g === 'female' || g.includes('女');
    });

    const pickRandomName = (arr: any[]) => arr.length ? arr[Math.floor(Math.random() * arr.length)].name : '';

    // 根据角色的实际性别分配音色
    for (const speaker of speakers) {
      const roleInfo = roles?.[speaker];
      let gender: string | null = null;

      if (roleInfo && typeof roleInfo === 'object') {
        gender = roleInfo.gender; // 'male' or 'female'
      }

      if (gender === 'male' && maleVoices.length > 0) {
        mapping[speaker] = pickRandomName(maleVoices);
      } else if (gender === 'female' && femaleVoices.length > 0) {
        mapping[speaker] = pickRandomName(femaleVoices);
      } else if ((candidateVoices || []).length > 0) {
        // 没有性别信息或对应性别无音色时，随机选一个
        mapping[speaker] = pickRandomName(candidateVoices);
      } else {
        // 无备选则回退到旧策略
        if (gender === 'male') {
          mapping[speaker] = getRandomMaleVoice() || getRandomVoice() || '';
        } else if (gender === 'female') {
          mapping[speaker] = getRandomFemaleVoice() || getRandomVoice() || '';
        } else {
          mapping[speaker] = getRandomVoice() || '';
        }
      }
    }

    console.log('getSpeakerVoices - 最终音色分配(基于角色性别):', { roles, mapping });
    return mapping;
  };

  // 获取随机音色
  const getRandomVoice = () => {
    console.log('getRandomVoice - candidateVoices:', candidateVoices);
    if (candidateVoices.length === 0) {
      console.log('getRandomVoice - 没有备选音色，返回失败');
      return null;
    }

    // 优先选择完整名称的音色（包含语言代码的音色）
    const fullNameVoices = candidateVoices.filter(
      (voice) => voice.name.includes('-') && voice.name.split('-').length >= 3,
    );

    // 优先使用完整名称音色，如果没有则使用所有音色
    const voicesToChooseFrom = fullNameVoices.length > 0 ? fullNameVoices : candidateVoices;
    const randomIndex = Math.floor(Math.random() * voicesToChooseFrom.length);
    const selectedVoice = voicesToChooseFrom[randomIndex].name;

    console.log('getRandomVoice - 选择的音色:', selectedVoice);
    console.log(
      'getRandomVoice - 从',
      fullNameVoices.length > 0 ? '完整名称音色' : '所有音色',
      '中选择',
    );
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
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            audioUrls: audioUrls,
          }),
        });

        if (response.status === 429) {
          // 服务器繁忙，等待后重试
          const waitTime = Math.pow(2, retryCount) * 1000; // 指数退避
          console.log(`服务器繁忙，${waitTime}ms后重试...`);
          await new Promise<void>((resolve) => (globalThis as any).setTimeout(resolve, waitTime));
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
        await new Promise<void>((resolve) => (globalThis as any).setTimeout(resolve, waitTime));
      }
    }

    // 理论上不会到达这里，但为了类型安全
    return audioUrls[0];
  };

  // 多音色对话合成函数
  const synthDialogueWithDifferentVoices = async (
    text: string,
    speakerVoices: Record<string, string>,
    lang: string,
    speakingRate: number,
    pitch: number,
    token: string | null,
  ): Promise<{
    audio_url: string;
    sentence_timeline?: Array<{
      index: number;
      text: string;
      start: number;
      end: number;
      speaker?: string;
    }>;
    duration_ms?: number;
    appliedSpeakerVoices?: Record<string, string> | null;
  }> => {
    try {
      console.log('开始多音色对话合成:', {
        text: text.substring(0, 100) + '...',
        speakerVoices,
        lang,
      });

      // 解析对话文本，分离每个说话者的内容
      const lines = text.split('\n').filter((line) => line.trim());
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

      // 直接调用对话合成API（它现在会返回时间轴）
      console.log('调用对话合成API，返回整段音频与时间轴');

      const response = await fetch('/api/admin/shadowing/synthesize-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text: text,
          lang: lang,
          speakingRate: speakingRate,
          pitch: pitch,
          speakerVoices: speakerVoices,
        }),
      });

      if (!response.ok) {
        throw new Error(`对话合成失败: ${response.status}`);
      }

      const result = await response.json();
      console.log('对话合成完成:', result.audio_url);
      return {
        audio_url: result.audio_url,
        sentence_timeline: result.sentence_timeline || null,
        duration_ms: result.duration_ms || null,
        appliedSpeakerVoices: result.applied_speaker_voices || null,
      };
    } catch (error) {
      console.error('多音色对话合成失败:', error);
      throw error;
    }
  };

  // 获取随机男声音色
  const getRandomMaleVoice = () => {
    const maleVoices = candidateVoices.filter((voice) => {
      const gender = voice.ssml_gender || voice.ssmlGender || '';
      // 优先使用 ssml_gender 字段，这是更可靠的性别标识
      return gender.toLowerCase() === 'male' || gender.toLowerCase().includes('男');
    });

    if (maleVoices.length === 0) {
      console.error('getRandomMaleVoice - 没有找到男声音色');
      return null; // 严格模式：没有男声就返回失败
    }

    // 优先选择有完整名称的音色
    const validMaleVoices = maleVoices.filter((voice) => {
      // 优先选择有完整名称的音色
      return voice.name.includes('-') && voice.name.split('-').length >= 3;
    });

    // 如果没有有效的完整名称音色，则使用所有男声音色
    const voicesToChooseFrom = validMaleVoices.length > 0 ? validMaleVoices : maleVoices;

    if (voicesToChooseFrom.length === 0) {
      console.error('getRandomMaleVoice - 没有找到有效的男声音色');
      return null; // 严格模式：没有有效音色就返回失败
    }

    const randomIndex = Math.floor(Math.random() * voicesToChooseFrom.length);
    const selectedVoice = voicesToChooseFrom[randomIndex];

    if (!selectedVoice || !selectedVoice.name) {
      console.error('getRandomMaleVoice - 选择的音色无效:', selectedVoice);
      return null;
    }

    console.log(
      'getRandomMaleVoice - 选择的男声音色:',
      selectedVoice.name,
      'ssml_gender:',
      selectedVoice.ssml_gender,
    );
    return selectedVoice.name;
  };

  // 获取随机女声音色
  const getRandomFemaleVoice = () => {
    const femaleVoices = candidateVoices.filter((voice) => {
      const gender = voice.ssml_gender || voice.ssmlGender || '';
      // 优先使用 ssml_gender 字段，这是更可靠的性别标识
      return gender.toLowerCase() === 'female' || gender.toLowerCase().includes('女');
    });

    if (femaleVoices.length === 0) {
      console.error('getRandomFemaleVoice - 没有找到女声音色');
      return null; // 严格模式：没有女声就返回失败
    }

    // 优先选择有完整名称的音色
    const validFemaleVoices = femaleVoices.filter((voice) => {
      // 优先选择有完整名称的音色
      return voice.name.includes('-') && voice.name.split('-').length >= 3;
    });

    // 如果没有有效的完整名称音色，则使用所有女声音色
    const voicesToChooseFrom = validFemaleVoices.length > 0 ? validFemaleVoices : femaleVoices;

    if (voicesToChooseFrom.length === 0) {
      console.error('getRandomFemaleVoice - 没有找到有效的女声音色');
      return null; // 严格模式：没有有效音色就返回失败
    }

    const randomIndex = Math.floor(Math.random() * voicesToChooseFrom.length);
    const selectedVoice = voicesToChooseFrom[randomIndex];

    if (!selectedVoice || !selectedVoice.name) {
      console.error('getRandomFemaleVoice - 选择的音色无效:', selectedVoice);
      return null;
    }

    console.log(
      'getRandomFemaleVoice - 选择的女声音色:',
      selectedVoice.name,
      'ssml_gender:',
      selectedVoice.ssml_gender,
    );
    return selectedVoice.name;
  };

  // 开始批量翻译
  const startBatchTranslation = async () => {
    if (transRunning) return;

    // 检查是否有选中的项目
    if (selected.size === 0) {
      toast.error('请先选择要翻译的草稿');
      return;
    }

    // 检查是否选择了目标语言
    if (transTargetLanguages.length === 0) {
      toast.error('请先选择目标语言');
      return;
    }

    try {
      setTransRunning(true);
      setTransProgress({ done: 0, total: 0 });
      setTransLogs([]);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/shadowing/translate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
          targetLanguages: transTargetLanguages.length > 0 ? transTargetLanguages : undefined, // 传递目标语言
          selectedIds: Array.from(selected), // 传递选中的ID列表
          filters: {
            status: status === 'all' ? 'draft' : status,
            lang: lang === 'all' ? undefined : lang,
            level: level === 'all' ? undefined : level,
            genre: genre === 'all' ? undefined : genre,
            q: q.trim() || undefined,
          },
        }),
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
                setTransLogs((prev) => [...prev, data.message]);
              } else if (data.type === 'complete') {
                setTransProgress({ done: data.processed, total: data.total });
                setTransLogs((prev) => [...prev, data.message]);
                toast.success(`批量翻译完成: ${data.success_count}成功, ${data.failed_count}失败`);
                // 刷新列表
                setQ((q) => q + ' ');
              } else if (data.type === 'error') {
                setTransLogs((prev) => [...prev, data.message]);
                toast.error(data.message);
              }
            } catch (e) {
              console.error('解析SSE数据失败:', e);
            }
          }
        }
      }
    } catch (error: any) {
      setTransLogs((prev) => [...prev, `错误: ${error.message}`]);
      toast.error('批量翻译失败: ' + error.message);
    } finally {
      setTransRunning(false);
    }
  };

  // 停止批量翻译
  const stopBatchTranslation = () => {
    setTransRunning(false);
    setTransLogs((prev) => [...prev, '用户停止翻译']);
  };

  // 获取可用模型
  async function fetchAvailableModels() {
    try {
      setModelsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/shadowing/translate/models', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
    setPerformanceStats((prev) => {
      const newTotal = prev.totalRequests + 1;
      const newSuccessRate = (prev.successRate * prev.totalRequests + (success ? 1 : 0)) / newTotal;
      const newAvgResponseTime =
        (prev.avgResponseTime * prev.totalRequests + responseTime) / newTotal;

      // 计算推荐并发数
      let recommendedConcurrency = prev.recommendedConcurrency;
      if (newSuccessRate > 0.95 && newAvgResponseTime < 2000) {
        recommendedConcurrency = Math.min(100, prev.recommendedConcurrency + 5);
      } else if (newSuccessRate < 0.8 || newAvgResponseTime > 5000) {
        recommendedConcurrency = Math.max(6, prev.recommendedConcurrency - 3);
      }

      const newStats = {
        totalRequests: newTotal,
        successRate: newSuccessRate,
        avgResponseTime: newAvgResponseTime,
        currentLoad: Math.min(100, (concurrency / 100) * 100),
        recommendedConcurrency,
      };

      // 记录性能历史
      setPerformanceHistory((prev) => [
        ...prev.slice(-9), // 保留最近10条记录
        {
          timestamp: Date.now(),
          concurrency,
          successRate: newSuccessRate,
          avgResponseTime: newAvgResponseTime,
          totalRequests: newTotal,
        },
      ]);

      return newStats;
    });
  };

  // 智能推荐配置
  const getRecommendedConfig = () => {
    const { successRate, avgResponseTime, recommendedConcurrency } = performanceStats;

    if (successRate > 0.95 && avgResponseTime < 1500) {
      return {
        name: '高速模式',
        concurrency: Math.min(100, recommendedConcurrency + 10),
        retries: 2,
        throttle: 100,
        timeout: 90,
        description: '系统运行良好，可以提升性能',
      };
    } else if (successRate > 0.9 && avgResponseTime < 3000) {
      return {
        name: '平衡模式',
        concurrency: Math.min(50, recommendedConcurrency + 5),
        retries: 2,
        throttle: 200,
        timeout: 120,
        description: '当前配置较为合适',
      };
    } else {
      return {
        name: '保守模式',
        concurrency: Math.max(6, recommendedConcurrency - 3),
        retries: 3,
        throttle: 500,
        timeout: 180,
        description: '建议降低并发数以提高稳定性',
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
          <span>•</span>
          <button
            className="px-2 py-1 border rounded hover:bg-gray-50"
            onClick={async () => {
              try {
                // 1) 先 dry-run 预演
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                const token = session?.access_token;

                const res = await fetch('/api/admin/shadowing/cleanup-orphan-tts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ dryRun: true }),
                });
                const j = await res.json();
                if (!res.ok) throw new Error(j?.error || '清理失败');

                const dryMsg = `预演完成：引用${j.referencedCount} 个，扫描${j.scannedCount} 个，孤儿${j.orphanCount} 个。` +
                  (j.sampleOrphans?.length ? `\n示例：\n` + j.sampleOrphans.join('\n') : '');
                alert(dryMsg);

                if (!j.orphanCount || j.orphanCount === 0) {
                  return;
                }

                // 2) 二次确认是否删除
                const ok = window.confirm('是否删除上述孤儿文件？此操作不可撤销。');
                if (!ok) return;

                // 3) 可选输入最大删除数量
                const input = window.prompt('请输入最大删除数量（默认1000）：', '1000');
                let maxDelete = 1000;
                if (input && /^\d+$/.test(input)) {
                  maxDelete = Math.max(1, Math.min(100000, parseInt(input, 10)));
                }

                const delRes = await fetch('/api/admin/shadowing/cleanup-orphan-tts', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ dryRun: false, maxDelete }),
                });
                const dj = await delRes.json();
                if (!delRes.ok) throw new Error(dj?.error || '删除失败');
                alert(`清理完成：删除 ${dj.deletedCount} / 孤儿 ${dj.orphanCount}。`);
              } catch (e: any) {
                alert(`清理失败：${e.message}`);
              }
            }}
            title="清理未被引用的 tts 音频文件（默认仅预演）"
          >
            清理未引用音频
          </button>
        </div>
      </div>

      {/* 主题批量处理 */}
      <ThemeBatchProcessor />

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">搜索标题</label>
              <Input placeholder="搜索标题" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">语言</label>
              <Select
                value={lang}
                onValueChange={(value) => setLang(value as 'all' | 'en' | 'ja' | 'zh' | 'ko')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                  <SelectItem value="ko">한국어</SelectItem>
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
            {genre === 'dialogue' && (
              <div>
                <label className="text-sm font-medium">对话类型</label>
                <Select value={dialogueType} onValueChange={setDialogueType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIALOGUE_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">等级</label>
              <Select
                value={level}
                onValueChange={(value) => setLevel(value as 'all' | '1' | '2' | '3' | '4' | '5')}
              >
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
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as 'all' | 'draft' | 'approved')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="draft">草稿</SelectItem>
                  <SelectItem value="approved">已审核</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">音频状态</label>
              <Select
                value={audioStatus}
                onValueChange={(value) => setAudioStatus(value as 'all' | 'no_audio' | 'has_audio')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="no_audio">未生成音频</SelectItem>
                  <SelectItem value="has_audio">已生成音频</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">ACU状态</label>
              <Select
                value={acuStatus}
                onValueChange={(value) => setAcuStatus(value as 'all' | 'no_acu' | 'has_acu')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="no_acu">未生成ACU</SelectItem>
                  <SelectItem value="has_acu">已生成ACU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">音色状态</label>
              <Select
                value={voiceStatus}
                onValueChange={(value) => setVoiceStatus(value as 'all' | 'fallback_voice' | 'custom_voice')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="fallback_voice">⚠️ 回退音色(Standard)</SelectItem>
                  <SelectItem value="custom_voice">✅ 自定义音色</SelectItem>
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
          <div className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2">
            <strong>后端并发处理：</strong>
            使用后端批量API处理并发，避免浏览器连接限制。支持最多100个并发连接，更稳定可靠。
          </div>
        </CardHeader>
        <CardContent>
          {/* 实时性能监控 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">📊 实时性能监控</h3>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${performanceStats.currentLoad > 80 ? 'bg-red-500' : performanceStats.currentLoad > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                ></div>
                <span className="text-xs text-gray-600">
                  系统负载: {performanceStats.currentLoad.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">总请求数</div>
                <div className="font-medium">{performanceStats.totalRequests}</div>
              </div>
              <div>
                <div className="text-gray-600">成功率</div>
                <div className="font-medium text-green-600">
                  {(performanceStats.successRate * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-gray-600">平均响应时间</div>
                <div className="font-medium">{performanceStats.avgResponseTime.toFixed(0)}ms</div>
              </div>
              <div>
                <div className="text-gray-600">推荐并发数</div>
                <div className="font-medium text-blue-600">
                  {performanceStats.recommendedConcurrency}
                </div>
              </div>
            </div>

            {/* ACU生成专用监控 */}
            {acuPerformanceStats.totalAcuRequests > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-2">🎯 ACU生成监控</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">ACU请求数</div>
                    <div className="font-medium">{acuPerformanceStats.totalAcuRequests}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">实际并发数</div>
                    <div className="font-medium text-orange-600">
                      {acuPerformanceStats.actualConcurrency}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">批次耗时</div>
                    <div className="font-medium">
                      {acuPerformanceStats.batchProcessingTime}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">ACU成功率</div>
                    <div className="font-medium text-green-600">
                      {(acuPerformanceStats.acuSuccessRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">并发数 (1-100)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={concurrency}
                onChange={(e) => setConcurrency(Number(e.target.value) || 6)}
                className={
                  concurrency > performanceStats.recommendedConcurrency ? 'border-yellow-500' : ''
                }
              />
              <p className="text-xs text-gray-500">同时处理的任务数 (后端并发处理)</p>
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
                onChange={(e) => setRetries(Number(e.target.value) || 2)}
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
                onChange={(e) => setThrottle(Number(e.target.value) || 200)}
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
                onChange={(e) => setTimeout(Number(e.target.value) || 120)}
              />
              <p className="text-xs text-gray-500">单个TTS请求超时时间</p>
            </div>
            <div>
              <label className="text-sm font-medium">快速配置</label>
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcurrency(6);
                    setRetries(1);
                    setThrottle(500);
                    setTimeout(90);
                  }}
                >
                  保守模式
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcurrency(18);
                    setRetries(2);
                    setThrottle(200);
                    setTimeout(60);
                  }}
                >
                  平衡模式
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcurrency(30);
                    setRetries(3);
                    setThrottle(100);
                    setTimeout(45);
                  }}
                >
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
                建议配置: 并发{getRecommendedConfig().concurrency} | 重试
                {getRecommendedConfig().retries} | 延迟{getRecommendedConfig().throttle}ms | 超时
                {getRecommendedConfig().timeout}s
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
                  {showVoiceManager ? '隐藏' : '管理'}音色
                </Button>
                {selectedVoice && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedVoice(null)}>
                    清除选择
                  </Button>
                )}
              </div>
            </div>
            {selectedVoice && (
              <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                已选择: <strong>{selectedVoice.name}</strong> (
                {selectedVoice.provider === 'gemini' ? 'Gemini' : 'Google'})
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 批量翻译面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🌐 批量翻译</CardTitle>
          <CardDescription>
            为选中的草稿生成翻译，支持并发处理。请先选择要翻译的草稿。
          </CardDescription>
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
              <label className="text-sm font-medium">目标语言 *</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['en', 'ja', 'zh', 'ko'].map((lang) => (
                  <label key={lang} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transTargetLanguages.includes(lang)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setTransTargetLanguages([...transTargetLanguages, lang]);
                        } else {
                          setTransTargetLanguages(transTargetLanguages.filter(l => l !== lang));
                        }
                      }}
                      className="mr-1"
                    />
                    <span className={transTargetLanguages.includes(lang) ? 'font-medium text-blue-600' : ''}>
                      {lang === 'en' ? '英语' : lang === 'ja' ? '日语' : lang === 'zh' ? '中文' : '韩语'}
                    </span>
                  </label>
                ))}
              </div>
              {transTargetLanguages.length === 0 && (
                <p className="text-xs text-red-500 mt-1">请至少选择一个目标语言</p>
              )}
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
                    <SelectItem value="loading" disabled>
                      加载中...
                    </SelectItem>
                  ) : availableModels[transProvider] ? (
                    availableModels[transProvider].map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-models" disabled>
                      无可用模型
                    </SelectItem>
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
                onChange={(e) => setTransTemperature(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">并发数</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={transConcurrency}
                onChange={(e) => setTransConcurrency(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">重试次数</label>
              <Input
                type="number"
                min="0"
                max="5"
                value={transRetries}
                onChange={(e) => setTransRetries(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">节流延迟 (ms)</label>
              <Input
                type="number"
                min="0"
                max="2000"
                value={transThrottle}
                onChange={(e) => setTransThrottle(Number(e.target.value))}
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
              disabled={transRunning || selected.size === 0 || transTargetLanguages.length === 0}
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
            <div>
              进度：{transProgress.done}/{transProgress.total}
            </div>
          </div>

          {transLogs.length > 0 && (
            <div className="text-xs bg-gray-50 p-2 rounded h-24 overflow-auto whitespace-pre-wrap mt-2">
              {transLogs.map((log, i) => (
                <div key={`trans-log-${i}-${log.substring(0, 20)}`}>{log}</div>
              ))}
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
              <Checkbox checked={isAllSelected()} onCheckedChange={toggleSelectAll} />
              <label className="text-sm font-medium">全选</label>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const dialogueItems = items.filter((item) => isDialogueFormat(item.text || ''));
                  setSelected(new Set(dialogueItems.map((item) => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择对话格式
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const regularItems = items.filter((item) => !isDialogueFormat(item.text || ''));
                  setSelected(new Set(regularItems.map((item) => item.id)));
                }}
                disabled={ttsLoading || publishing}
              >
                选择独白格式
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <Button
              onClick={() => setShowCandidateSelector(true)}
              disabled={ttsLoading || publishing || selected.size === 0}
              className="bg-purple-600 hover:bg-purple-700"
            >
              🎲 随机生成
            </Button>
            <Button
              onClick={clearAudioSelected}
              disabled={ttsLoading || publishing || selected.size === 0}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              清除选中音频
            </Button>
            <Button
              onClick={generateACUSelected}
              disabled={ttsLoading || publishing || selected.size === 0}
              variant="outline"
              className="border-blue-300 text-blue-600 hover:bg-blue-50"
            >
              生成 ACU
            </Button>
            <Button
              onClick={publishSelected}
              disabled={publishing || selected.size === 0}
              variant="outline"
            >
              {publishing ? '发布中...' : '批量发布选中'}
            </Button>
            <Button
              onClick={revertSelected}
              disabled={publishing || selected.size === 0}
              variant="outline"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {publishing ? '撤回中...' : '批量撤回选中'}
            </Button>
            <Button onClick={deleteSelected} disabled={selected.size === 0} variant="destructive">
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
          language={lang === 'all' ? 'zh' : (lang as 'zh' | 'ja' | 'en' | 'ko')}
        />
      )}

      {/* 进度显示 */}
      {(ttsLoading || publishing) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {currentOperation === 'tts' && 'TTS 合成进度'}
                  {currentOperation === 'publish' && '批量发布进度'}
                  {currentOperation === 'revert' && '批量撤回进度'}
                  {currentOperation === 'delete' && '批量删除进度'}
                  {currentOperation === 'clear_audio' && '清除音频进度'}
                  {currentOperation === 'acu' && 'ACU 生成进度'}
                </span>
                <span>
                  {ttsDone}/{ttsTotal} ({Math.round((ttsDone / ttsTotal) * 100)}%)
                </span>
              </div>
              <Progress value={(ttsDone / ttsTotal) * 100} className="w-full" />
              {ttsCurrent && <div className="text-sm text-gray-600">当前处理: {ttsCurrent}</div>}
              <div className="text-xs text-gray-500">
                并发数: {concurrency} | 节流延迟: {throttle}ms | 超时: {timeout}s | 成功率:{' '}
                {(performanceStats.successRate * 100).toFixed(1)}% | 平均响应:{' '}
                {performanceStats.avgResponseTime.toFixed(0)}ms
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
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{log}</div>
          </CardContent>
        </Card>
      )}

      {/* 草稿列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">草稿列表</CardTitle>
              <CardDescription>
                共 {totalItems} 项草稿，第 {currentPage} / {totalPages} 页
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">每页显示:</label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value) => handlePageSizeChange(parseInt(value))}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* 专用按钮已移除；功能并入随机生成逻辑 */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无符合条件的草稿</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
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
                      <div className="text-sm text-gray-500 mt-1">
                        {it.lang} • 等级 {it.level} • {it.genre}
                        {it.genre === 'dialogue' && it.dialogue_type && DIALOGUE_TYPE_OPTIONS.find(d => d.value === it.dialogue_type)?.label && ` (${DIALOGUE_TYPE_OPTIONS.find(d => d.value === it.dialogue_type)?.label})`}
                        {it.notes?.audio_url && ' • 🎵'}
                        {it.notes?.acu_units && ' • 📊'}
                      </div>
                      {it.text && (
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto">
                          <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {formatDialogueText(it.text, it.genre)}
                          </div>
                        </div>
                      )}

                      {/* 显示翻译内容 */}
                      {it.translations && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-2">翻译内容:</div>
                          {it.translations.en && (
                            <div className="mb-2">
                              <div className="text-xs text-blue-600 font-medium mb-1">🇺🇸 英文:</div>
                              <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded border max-h-24 overflow-y-auto">
                                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                                  {formatDialogueText(it.translations.en, it.genre)}
                                </div>
                              </div>
                            </div>
                          )}
                          {it.translations.ja && (
                            <div className="mb-2">
                              <div className="text-xs text-red-600 font-medium mb-1">🇯🇵 日文:</div>
                              <div className="text-sm text-gray-700 bg-red-50 p-2 rounded border max-h-24 overflow-y-auto">
                                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                                  {formatDialogueText(it.translations.ja, it.genre)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* 显示音频播放器 */}
                      {it?.notes?.audio_url && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-2">🎵 音频播放:</div>
                          <div className="flex items-center gap-2">
                            <audio
                              controls
                              preload="metadata"
                              src={it.notes.audio_url}
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
                    {it.status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={() => {
                          if (confirm('确定要撤回此草稿吗？撤回后将从练习题库中移除。')) {
                            revertOne(it.id)
                              .then(() => {
                                toast.success('撤回成功');
                                window.location.reload();
                              })
                              .catch(() => {
                                toast.error('撤回失败');
                              });
                          }
                        }}
                      >
                        撤回发布
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页导航 */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>

                {/* 页码显示 */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                language={lang === 'all' ? 'zh' : lang}
                onCandidateVoicesSet={setCandidateVoices}
                showLanguageSelector={lang === 'all'}
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
