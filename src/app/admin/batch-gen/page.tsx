'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Lang = 'en' | 'ja' | 'zh';
type Kind = 'alignment' | 'cloze' | 'shadowing';

type EventMsg = { type: string; [k: string]: any };

export default function BatchGenPage() {
  const [kind, setKind] = useState<Kind>('cloze');
  const [lang, setLang] = useState<Lang>('ja');
  const [levels, setLevels] = useState<number[]>([3]);
  const [topicsText, setTopicsText] = useState('Daily life\nCampus');
  const [perCombo, setPerCombo] = useState(2);
  const [provider, setProvider] = useState<'openrouter' | 'deepseek'>('deepseek');
  const [model, setModel] = useState('');
  const [orModels, setOrModels] = useState<
    Array<{ id: string; name: string; context_length?: number; pricing?: any }>
  >([]);
  const [orLoading, setOrLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.5);
  const [dsModels, setDsModels] = useState<string[] | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [register, setRegister] = useState<'casual' | 'neutral' | 'formal'>('neutral');
  const [genre, setGenre] = useState('monologue');
  const [sentRange, setSentRange] = useState<[number, number]>([6, 10]);
  const [style, setStyle] = useState<any>({
    formality: 'neutral',
    tone: 'friendly',
    length: 'medium',
  });
  const [blanksRange, setBlanksRange] = useState<[number, number]>([6, 10]);
  const [autoBlanks, setAutoBlanks] = useState<boolean>(true);
  const [weights, setWeights] = useState({ connector: 0.4, collocation: 0.3, grammar: 0.3 });

  // 性能参数
  const [concurrency, setConcurrency] = useState(4);
  const [batchSize, setBatchSize] = useState(1);
  const [retries, setRetries] = useState(2);
  const [throttle, setThrottle] = useState(0);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, saved: 0, total_target: 0 });
  const [logs, setLogs] = useState<string[]>([]);
  const [aggUsage, setAggUsage] = useState<{
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 计算总目标数量
  const totalTarget = useMemo(() => {
    const topics = topicsText.split('\n').filter((t) => t.trim()).length || 1;
    return topics * levels.length * perCombo * batchSize;
  }, [topicsText, levels, perCombo, batchSize]);

  const totalCombos = useMemo(() => {
    const topics = topicsText.split('\n').filter((t) => t.trim()).length || 1;
    return topics * levels.length * perCombo;
  }, [topicsText, levels, perCombo]);

  // 页面加载时自动获取最新模型列表
  useEffect(() => {
    if (provider === 'openrouter' && !orModels) {
      refreshOpenRouter();
    }
  }, [provider]);

  const params = useMemo(
    () => ({
      kind,
      params: {
        lang,
        levels,
        topicsText,
        perCombo,
        provider,
        model: model || (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'deepseek-chat'),
        temperature,
        style,
        blanksRange,
        autoBlanks,
        weights,
        genre,
        register,
        sentRange,
        concurrency,
        batchSize,
        retries,
        throttle_ms: throttle,
      },
    }),
    [
      kind,
      lang,
      levels,
      topicsText,
      perCombo,
      provider,
      model,
      temperature,
      style,
      blanksRange,
      autoBlanks,
      weights,
      genre,
      register,
      sentRange,
      concurrency,
      batchSize,
      retries,
      throttle,
    ],
  );

  // 显示确认对话框
  function showStartConfirm() {
    if (running) return;
    setShowConfirmDialog(true);
  }

  // 确认后开始生成
  async function start() {
    if (running) return;
    setShowConfirmDialog(false);
    setRunning(true);
    setLogs([]);
    setAggUsage(null);
    setProgress({ done: 0, total: 0, saved: 0, total_target: totalTarget });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('未登录或会话失效');
      const r = await fetch('/api/admin/batch/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
        signal: ac.signal,
      });
      if (!r.ok || !r.body) throw new Error(`请求失败: ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          try {
            const msg: EventMsg = JSON.parse(json);
            if (msg.type === 'start') {
              setProgress((p) => ({ ...p, total: msg.total || 0, total_target: totalTarget }));
              setLogs((L) => [...L, `开始，任务数 ${msg.total}，目标生成 ${totalTarget} 条`]);
            } else if (msg.type === 'progress') {
              setLogs((L) => [...L, `生成中 #${(msg.idx ?? 0) + 1} [L${msg.level}] ${msg.topic}`]);
            } else if (msg.type === 'saved') {
              setProgress((p) => ({
                ...p,
                done: msg.done || p.done,
                total: msg.total || p.total,
                saved: p.saved + (msg.saved?.count || 1),
              }));
              if (msg.usage) setAggUsage(msg.usage);
              setLogs((L) => [
                ...L,
                `已保存 #${(msg.idx ?? 0) + 1} → ${msg.saved?.table} (${msg.saved?.count || 1}条)`,
              ]);
            } else if (msg.type === 'error') {
              setProgress((p) => ({ ...p, done: p.done + 1 }));
              setLogs((L) => [...L, `错误 #${(msg.idx ?? 0) + 1}: ${msg.message}`]);
            } else if (msg.type === 'done') {
              setLogs((L) => [...L, `完成，总数 ${msg.total}`]);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setLogs((L) => [...L, `中断/失败：${e?.message || String(e)}`]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function stop() {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }

  const toggleLevel = (n: number) =>
    setLevels((arr) =>
      arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n].sort((a, b) => a - b),
    );

  // 模型分类和搜索功能
  const getModelCategory = (modelId: string) => {
    if (modelId.startsWith('openai/')) return 'OpenAI';
    if (modelId.startsWith('anthropic/')) return 'Anthropic';
    if (modelId.startsWith('google/')) return 'Google';
    if (modelId.startsWith('meta/')) return 'Meta';
    if (modelId.startsWith('mistral/')) return 'Mistral';
    if (modelId.startsWith('qwen/')) return 'Qwen';
    if (modelId.startsWith('cohere/')) return 'Cohere';
    if (modelId.startsWith('perplexity/')) return 'Perplexity';
    if (modelId.startsWith('deepseek/')) return 'DeepSeek';
    if (modelId.startsWith('microsoft/')) return 'Microsoft';
    if (modelId.startsWith('01-ai/')) return '01-ai';
    if (modelId.startsWith('nousresearch/')) return 'Nous Research';
    if (modelId.startsWith('intel/')) return 'Intel';
    if (modelId.startsWith('stabilityai/')) return 'Stability AI';
    if (modelId.startsWith('technologyinnovationinstitute/')) return 'TII';
    if (modelId.startsWith('allenai/')) return 'Allen Institute';
    if (modelId.startsWith('teknium/')) return 'Teknium';
    return '其他';
  };

  const filteredModels = useMemo(() => {
    const models =
      orModels.length > 0 ? orModels : openrouterModels.map((id) => ({ id, name: id }));
    if (!modelSearch) return models;
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        getModelCategory(m.id).toLowerCase().includes(modelSearch.toLowerCase()),
    );
  }, [orModels, modelSearch]);

  const groupedModels = useMemo(() => {
    const groups: {
      [key: string]: Array<{ id: string; name: string; context_length?: number; pricing?: any }>;
    } = {};
    filteredModels.forEach((model) => {
      const category = getModelCategory(model.id);
      if (!groups[category]) groups[category] = [];
      groups[category].push(model);
    });
    return groups;
  }, [filteredModels]);

  async function refreshOpenRouter() {
    try {
      setOrLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 直接从OpenRouter API获取最新模型列表
      const referer = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const r = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': referer,
          'X-Title': 'Lang Trainer Admin',
        },
      });

      if (!r.ok) {
        const text = await r.text();
        throw new Error(`OpenRouter API error: ${text}`);
      }

      const j = await r.json();
      const models = Array.isArray(j?.data)
        ? j.data.map((m: any) => ({
            id: m.id || m.name,
            name: m.name || m.id,
            context_length: m.context_length,
            pricing: m.pricing,
          }))
        : [];

      if (models.length) {
        setOrModels(models);
        // 自动选择第一个模型
        if (!model) setModel(models[0]?.id || '');
      }
    } catch (e) {
      console.error('Failed to fetch OpenRouter models:', e);
      // 如果API失败，使用静态列表作为备选
      setOrModels(openrouterModels.map((id) => ({ id, name: id })));
    } finally {
      setOrLoading(false);
    }
  }

  async function refreshDeepSeek() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const r = await fetch('/api/admin/models/deepseek', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || r.statusText);
      const list: string[] = Array.isArray(j.models) ? j.models.map((m: any) => m.id || m) : [];
      if (list.length) setDsModels(list);
    } catch (e) {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">批量生成中心（对齐 / Cloze / Shadowing）</h1>

      <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">类型</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            <option value="alignment">alignment</option>
            <option value="cloze">cloze</option>
            <option value="shadowing">shadowing</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">语言</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">简体中文</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">等级（多选 1-6/5）</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleLevel(n)}
                className={`px-2 py-1 rounded border ${levels.includes(n) ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">主题（每行一个）</label>
            <textarea
              className="w-full border rounded px-2 py-1 h-28"
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                className="px-2 py-1 rounded border"
                onClick={() => setTopicsText(defaultTopics.join('\n'))}
              >
                填充默认主题
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border"
                onClick={() => setTopicsText(defaultExamTopics.join('\n'))}
              >
                考试/学术主题
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded border"
                onClick={() => setTopicsText(defaultBusinessTopics.join('\n'))}
              >
                商务主题
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">每组合数量</label>
            <input
              className="w-full border rounded px-2 py-1"
              type="number"
              min={1}
              max={50}
              value={perCombo}
              onChange={(e) => setPerCombo(Number(e.target.value) || 1)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Provider / Model / 温度</label>
            <div className="flex gap-2">
              <select
                className="border rounded px-2 py-1"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as any);
                  setModel('');
                }}
              >
                <option value="openrouter">openrouter</option>
                <option value="deepseek">deepseek</option>
              </select>
              {provider === 'openrouter' ? (
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1"
                      placeholder="搜索模型..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                    />
                    <button
                      type="button"
                      className="px-2 py-1 rounded border"
                      onClick={refreshOpenRouter}
                      disabled={orLoading}
                    >
                      {orLoading ? '刷新中' : '刷新模型'}
                    </button>
                  </div>
                  {orModels.length > 0 && (
                    <div className="text-xs text-gray-500">
                      已加载 {orModels.length} 个模型 | 搜索到 {filteredModels.length} 个结果
                    </div>
                  )}
                  <select
                    className="w-full border rounded px-2 py-1"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="">选择模型...</option>
                    {Object.entries(groupedModels).map(([category, models]) => (
                      <optgroup key={category} label={category}>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}{' '}
                            {m.context_length ? `(${Math.round(m.context_length / 1000)}k)` : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex-1 flex gap-2">
                  <select
                    className="flex-1 border rounded px-2 py-1"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {(dsModels || deepseekModels).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="px-2 py-1 rounded border"
                    onClick={refreshDeepSeek}
                  >
                    刷新模型
                  </button>
                </div>
              )}
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 类型特定参数 */}
      {kind === 'alignment' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Formality</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={style.formality || 'neutral'}
              onChange={(e) => setStyle((s: any) => ({ ...s, formality: e.target.value }))}
            >
              <option value="casual">casual</option>
              <option value="neutral">neutral</option>
              <option value="formal">formal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tone</label>
            <input
              className="w-full border rounded px-2 py-1"
              value={style.tone || 'friendly'}
              onChange={(e) => setStyle((s: any) => ({ ...s, tone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Length</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={style.length || 'medium'}
              onChange={(e) => setStyle((s: any) => ({ ...s, length: e.target.value }))}
            >
              <option value="short">short</option>
              <option value="medium">medium</option>
              <option value="long">long</option>
            </select>
          </div>
        </section>
      )}

      {kind === 'cloze' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">空格范围</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoBlanks}
                  onChange={(e) => setAutoBlanks(e.target.checked)}
                />{' '}
                自动
              </label>
              {!autoBlanks && (
                <>
                  <input
                    className="w-24 border rounded px-2 py-1"
                    type="number"
                    min={1}
                    max={30}
                    value={blanksRange[0]}
                    onChange={(e) => setBlanksRange([Number(e.target.value) || 1, blanksRange[1]])}
                  />
                  <input
                    className="w-24 border rounded px-2 py-1"
                    type="number"
                    min={1}
                    max={30}
                    value={blanksRange[1]}
                    onChange={(e) => setBlanksRange([blanksRange[0], Number(e.target.value) || 1])}
                  />
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">自动：按等级与目标长度估算空格数</div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">权重（连接词/搭配/语法）</label>
            <div className="flex gap-2">
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                step={0.1}
                value={weights.connector}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, connector: Number(e.target.value) || 0 }))
                }
              />
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                step={0.1}
                value={weights.collocation}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, collocation: Number(e.target.value) || 0 }))
                }
              />
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                step={0.1}
                value={weights.grammar}
                onChange={(e) =>
                  setWeights((w) => ({ ...w, grammar: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </div>
        </section>
      )}

      {kind === 'shadowing' && (
        <section className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">体裁</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="monologue">monologue</option>
              <option value="dialogue">dialogue</option>
              <option value="news">news</option>
              <option value="lecture">lecture</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">语域</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={register}
              onChange={(e) => setRegister(e.target.value as any)}
            >
              <option value="casual">casual</option>
              <option value="neutral">neutral</option>
              <option value="formal">formal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">句子范围</label>
            <div className="flex gap-2">
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                min={1}
                max={30}
                value={sentRange[0]}
                onChange={(e) => setSentRange([Number(e.target.value) || 1, sentRange[1]])}
              />
              <input
                className="w-24 border rounded px-2 py-1"
                type="number"
                min={1}
                max={30}
                value={sentRange[1]}
                onChange={(e) => setSentRange([sentRange[0], Number(e.target.value) || 1])}
              />
            </div>
          </div>
        </section>
      )}

      {/* 参数说明和教程 */}
      <section className="bg-blue-50 rounded-lg shadow p-4 space-y-3">
        <h3 className="text-lg font-medium text-blue-800">📚 参数说明和教程</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">🚀 并发数 (1-8)</h4>
            <p className="text-gray-600">同时处理的任务数量。越高速度越快，但容易触发API限制。</p>
            <div className="bg-white p-2 rounded text-xs">
              <strong>建议：</strong>
              <br />
              • 小批量(20条内): 2-3
              <br />
              • 中批量(20-100条): 4-6
              <br />• 大批量(100条+): 6-8
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">📦 批量条数 (1-10)</h4>
            <p className="text-gray-600">每次API调用生成的内容条数。减少API调用次数，提升效率。</p>
            <div className="bg-white p-2 rounded text-xs">
              <strong>建议：</strong>
              <br />
              • 质量优先: 1-2条
              <br />
              • 平衡模式: 3-5条
              <br />• 速度优先: 5-8条
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">🔄 重试次数 (0-5)</h4>
            <p className="text-gray-600">API调用失败时的自动重试次数。处理网络问题和临时错误。</p>
            <div className="bg-white p-2 rounded text-xs">
              <strong>建议：</strong>
              <br />
              • 稳定网络: 1-2次
              <br />
              • 一般网络: 2-3次
              <br />• 不稳定网络: 3-5次
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-blue-700">⏱️ 节流延迟 (0-2000ms)</h4>
            <p className="text-gray-600">任务间的等待时间。防止触发API频率限制。</p>
            <div className="bg-white p-2 rounded text-xs">
              <strong>建议：</strong>
              <br />
              • 无限制: 0ms
              <br />
              • 保守: 100-200ms
              <br />
              • 安全: 300-500ms
              <br />• 极保守: 500-1000ms
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
          <h4 className="font-medium text-yellow-800 mb-2">⚠️ 常见问题解决</h4>
          <ul className="space-y-1 text-yellow-700">
            <li>
              • <strong>429错误多</strong> → 降低并发数，增加节流延迟
            </li>
            <li>
              • <strong>生成质量下降</strong> → 降低批量条数
            </li>
            <li>
              • <strong>内存不足</strong> → 减少并发数
            </li>
            <li>
              • <strong>速度太慢</strong> → 增加并发数和批量条数
            </li>
          </ul>
        </div>
      </section>

      {/* 性能参数 */}
      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <h3 className="text-lg font-medium text-gray-800">性能优化参数</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">并发数（1-8）</label>
            <input
              type="number"
              min={1}
              max={8}
              className="w-full border rounded px-2 py-1"
              value={concurrency}
              onChange={(e) => setConcurrency(Number(e.target.value) || 4)}
            />
            <div className="text-xs text-gray-500 mt-1">同时处理的任务数，建议4-6</div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">批量条数（1-10）</label>
            <input
              type="number"
              min={1}
              max={10}
              className="w-full border rounded px-2 py-1"
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value) || 1)}
            />
            <div className="text-xs text-gray-500 mt-1">每次生成的内容条数</div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">重试次数（0-5）</label>
            <input
              type="number"
              min={0}
              max={5}
              className="w-full border rounded px-2 py-1"
              value={retries}
              onChange={(e) => setRetries(Number(e.target.value) || 2)}
            />
            <div className="text-xs text-gray-500 mt-1">429/503错误重试次数</div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">节流延迟（ms）</label>
            <input
              type="number"
              min={0}
              max={2000}
              className="w-full border rounded px-2 py-1"
              value={throttle}
              onChange={(e) => setThrottle(Number(e.target.value) || 0)}
            />
            <div className="text-xs text-gray-500 mt-1">每任务间延迟，防429</div>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
          <strong>预计生成：</strong>
          {totalTarget} 条内容（{totalCombos} 个组合 × {batchSize} 批量条数）
        </div>

        {/* 快速配置预设 */}
        <div className="border-t pt-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">⚡ 快速配置预设</h4>
          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
              onClick={() => {
                setConcurrency(2);
                setBatchSize(1);
                setRetries(2);
                setThrottle(100);
              }}
            >
              保守模式 (2并发, 1批量)
            </button>
            <button
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              onClick={() => {
                setConcurrency(4);
                setBatchSize(3);
                setRetries(2);
                setThrottle(100);
              }}
            >
              平衡模式 (4并发, 3批量)
            </button>
            <button
              className="px-3 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
              onClick={() => {
                setConcurrency(6);
                setBatchSize(5);
                setRetries(3);
                setThrottle(200);
              }}
            >
              高速模式 (6并发, 5批量)
            </button>
            <button
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
              onClick={() => {
                setConcurrency(8);
                setBatchSize(8);
                setRetries(3);
                setThrottle(300);
              }}
            >
              极速模式 (8并发, 8批量)
            </button>
          </div>
        </div>
      </section>

      {/* 运行控制 */}
      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center gap-3">
          <button
            className={`px-4 py-2 rounded ${running ? 'bg-gray-300' : 'bg-blue-600 text-white'}`}
            onClick={showStartConfirm}
            disabled={running}
          >
            开始批量生成
          </button>
          <button className="px-4 py-2 rounded border" onClick={stop} disabled={!running}>
            停止
          </button>
          <div className="text-sm text-gray-600">
            进度：{progress.saved}/{progress.total_target}
          </div>
          {aggUsage && (
            <div className="text-sm text-gray-600">
              Tokens: {aggUsage.total_tokens} （P:{aggUsage.prompt_tokens} C:
              {aggUsage.completion_tokens}）
            </div>
          )}
        </div>
        <div className="h-2 bg-gray-100 rounded overflow-hidden">
          <div
            className="h-full bg-blue-500"
            style={{
              width:
                progress.total_target > 0
                  ? `${Math.round((progress.saved / progress.total_target) * 100)}%`
                  : '0%',
            }}
          />
        </div>
        <div className="max-h-64 overflow-auto text-sm font-mono bg-gray-50 p-2 rounded border">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>

        {/* 性能提示 */}
        {running && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <h4 className="font-medium text-blue-800 mb-2">💡 性能提示</h4>
            <div className="text-blue-700 space-y-1">
              <div>
                • 当前配置：{concurrency}并发 × {batchSize}批量 = 理论{concurrency * batchSize}
                倍速度
              </div>
              <div>
                • 预计完成时间：
                {totalTarget > 0 ? Math.ceil(totalTarget / (concurrency * batchSize * 2)) : 0}分钟
              </div>
              <div>• 如遇429错误，建议降低并发数或增加节流延迟</div>
            </div>
          </div>
        )}
      </section>

      {/* 确认对话框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">确认批量生成任务</h2>

              {/* 任务概览 */}
              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">📋 任务概览</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">类型：</span>
                      <span className="font-medium">{kind}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">语言：</span>
                      <span className="font-medium">
                        {lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">等级：</span>
                      <span className="font-medium">{levels.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">主题数量：</span>
                      <span className="font-medium">
                        {topicsText.split('\n').filter((t) => t.trim()).length || 1}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">每组合数量：</span>
                      <span className="font-medium">{perCombo}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">总目标数量：</span>
                      <span className="font-medium text-blue-600">{totalTarget} 条</span>
                    </div>
                  </div>
                </div>

                {/* 模型配置 */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-medium text-green-800 mb-2">🤖 模型配置</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">提供商：</span>
                      <span className="font-medium">{provider}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">模型：</span>
                      <span className="font-medium">
                        {model ||
                          (provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'deepseek-chat')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">温度：</span>
                      <span className="font-medium">{temperature}</span>
                    </div>
                  </div>
                </div>

                {/* 性能配置 */}
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h3 className="font-medium text-orange-800 mb-2">⚡ 性能配置</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">并发数：</span>
                      <span className="font-medium">{concurrency}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">批量条数：</span>
                      <span className="font-medium">{batchSize}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">重试次数：</span>
                      <span className="font-medium">{retries}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">节流延迟：</span>
                      <span className="font-medium">{throttle}ms</span>
                    </div>
                  </div>
                </div>

                {/* 类型特定参数 */}
                {kind === 'alignment' && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-800 mb-2">🎯 Alignment 参数</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">正式程度：</span>
                        <span className="font-medium">{style.formality || 'neutral'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">语调：</span>
                        <span className="font-medium">{style.tone || 'friendly'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">长度：</span>
                        <span className="font-medium">{style.length || 'medium'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {kind === 'cloze' && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-800 mb-2">🕳️ Cloze 参数</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">空格范围：</span>
                        <span className="font-medium">
                          {autoBlanks ? '自动' : `${blanksRange[0]}-${blanksRange[1]}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">权重配置：</span>
                        <span className="font-medium">
                          连接词:{weights.connector} 搭配:{weights.collocation} 语法:
                          {weights.grammar}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {kind === 'shadowing' && (
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-800 mb-2">🎤 Shadowing 参数</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">体裁：</span>
                        <span className="font-medium">{genre}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">语域：</span>
                        <span className="font-medium">{register}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">句子范围：</span>
                        <span className="font-medium">
                          {sentRange[0]}-{sentRange[1]} 句
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 主题列表 */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-800 mb-2">📝 主题列表</h3>
                  <div className="text-sm">
                    {topicsText
                      .split('\n')
                      .filter((t) => t.trim())
                      .map((topic, index) => (
                        <div
                          key={index}
                          className="inline-block bg-white px-2 py-1 rounded border mr-2 mb-2"
                        >
                          {topic.trim()}
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* 预计时间和成本 */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-yellow-800 mb-2">⏱️ 预计信息</h3>
                <div className="text-sm text-yellow-700 space-y-1">
                  <div>
                    • 预计完成时间：
                    {totalTarget > 0 ? Math.ceil(totalTarget / (concurrency * batchSize * 2)) : 0}{' '}
                    分钟
                  </div>
                  <div>
                    • 理论处理速度：{concurrency * batchSize} 倍（{concurrency}并发 × {batchSize}
                    批量）
                  </div>
                  <div>• 总组合数：{totalCombos} 个（主题 × 等级 × 每组合数量）</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={start}
                >
                  确认开始生成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 默认主题集合
const defaultTopics = [
  'Daily life',
  'Campus life',
  'Travel',
  'Food & Cooking',
  'Health & Fitness',
  'Technology & Gadgets',
  'Environment & Sustainability',
  'Culture & Festivals',
  'Hobbies & Sports',
  'Work & Career',
];

const defaultExamTopics = [
  'Academic writing',
  'Presentation skills',
  'Research & Methodology',
  'Critical thinking',
  'Reading comprehension',
  'Listening strategies',
  'Note-taking',
  'Debate & Argumentation',
  'Summarization',
  'Paraphrasing',
];

const defaultBusinessTopics = [
  'Meetings & Negotiation',
  'Email etiquette',
  'Project management',
  'Marketing & Branding',
  'Customer support',
  'Finance & Budgeting',
  'Hiring & Onboarding',
  'Remote collaboration',
  'Product roadmap',
  'Performance review',
];

// 模型列表示例（可根据需要扩展/维护）
const openrouterModels = [
  // OpenAI 系列
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4-turbo',
  'openai/gpt-4',
  'openai/gpt-3.5-turbo',

  // Anthropic Claude 系列
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-haiku',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-2.1',
  'anthropic/claude-2.0',
  'anthropic/claude-instant-1.2',

  // Google Gemini 系列
  'google/gemini-1.5-pro',
  'google/gemini-1.5-flash',
  'google/gemini-pro',
  'google/gemini-pro-vision',

  // Meta Llama 系列
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'meta/llama-3-8b-instruct',
  'meta/llama-3-70b-instruct',
  'meta/llama-2-7b-chat',
  'meta/llama-2-13b-chat',
  'meta/llama-2-70b-chat',

  // Mistral 系列
  'mistral/mistral-large-2407',
  'mistral/mixtral-8x7b-instruct',
  'mistral/mixtral-8x22b-instruct',
  'mistral/mistral-7b-instruct',
  'mistral/mistral-nemo-12b-2409',

  // Qwen 系列
  'qwen/qwen2.5-7b-instruct',
  'qwen/qwen2.5-14b-instruct',
  'qwen/qwen2.5-32b-instruct',
  'qwen/qwen2.5-72b-instruct',
  'qwen/qwen-1.5-7b-chat',
  'qwen/qwen-1.5-14b-chat',
  'qwen/qwen-1.5-32b-chat',
  'qwen/qwen-1.5-72b-chat',

  // Cohere 系列
  'cohere/command-r',
  'cohere/command-r-plus',
  'cohere/command-light',
  'cohere/command',

  // Perplexity 系列（在线检索型）
  'perplexity/llama-3-sonar-small-32k-online',
  'perplexity/llama-3-sonar-large-32k-online',
  'perplexity/llama-3.1-sonar-small-128k-online',
  'perplexity/llama-3.1-sonar-large-128k-online',

  // DeepSeek 系列
  'deepseek/deepseek-chat',
  'deepseek/deepseek-coder',
  'deepseek/deepseek-reasoner',

  // Microsoft 系列
  'microsoft/phi-3-medium-128k-instruct',
  'microsoft/phi-3-mini-128k-instruct',
  'microsoft/phi-3-small-8k-instruct',

  // 01-ai 系列
  '01-ai/yi-1.5-9b-chat',
  '01-ai/yi-1.5-34b-chat',
  '01-ai/yi-1.5-70b-chat',

  // Nous Research 系列
  'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
  'nousresearch/nous-hermes-2-vision',

  // Intel 系列
  'intel/neural-chat-7b-v3-3',
  'intel/neural-chat-7b-v3-1',

  // Stability AI 系列
  'stabilityai/stablelm-2-zephyr-1.6b',
  'stabilityai/stablelm-2-zephyr-12b',

  // Technology Innovation Institute 系列
  'technologyinnovationinstitute/aya-23-8b-instruct',
  'technologyinnovationinstitute/aya-23-35b-instruct',

  // Allen Institute 系列
  'allenai/olmo-7b-instruct',
  'allenai/olmo-7b',

  // 其他优秀模型
  'teknium/openhermes-2.5-mistral-7b',
  'teknium/openhermes-2-mistral-7b',
  'teknium/phi-3-mini-128k-instruct',
  'teknium/phi-3-medium-128k-instruct',

  // 多模态模型
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'google/gemini-1.5-pro',
  'google/gemini-1.5-flash',

  // 代码专用模型
  'deepseek/deepseek-coder',
  'microsoft/phi-3-mini-128k-instruct',
  'microsoft/phi-3-medium-128k-instruct',

  // 数学推理模型
  'deepseek/deepseek-reasoner',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-405b-instruct',

  // 长文本模型
  'anthropic/claude-3.5-sonnet',
  'google/gemini-1.5-pro',
  'meta/llama-3.1-405b-instruct',
  'qwen/qwen2.5-72b-instruct',
];

const deepseekModels = ['deepseek-chat', 'deepseek-reasoner'];
