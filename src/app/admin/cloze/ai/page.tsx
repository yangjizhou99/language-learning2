'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ClozeBlank {
  id: number;
  answer: string;
  acceptable: string[];
  distractors: string[];
  explanation: string;
  type: string;
}

interface ClozeItem {
  id?: string;
  lang: string;
  level: number;
  topic: string;
  title: string;
  passage: string;
  blanks: ClozeBlank[];
  status?: string;
  ai_provider?: string;
  ai_model?: string;
  ai_usage?: any;
}

export default function ClozeAIPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [formData, setFormData] = useState({
    lang: 'en',
    level: 3,
    count: 3,
    topic: '',
    provider: 'deepseek',
    model: 'deepseek-chat',
  });
  const [customModel, setCustomModel] = useState('');
  const [dynamicModels, setDynamicModels] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setDynamicModels([]);
          return;
        }
        const provider = formData.provider;
        const res = await fetch(`/api/admin/providers/models?provider=${provider}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.models)) {
          const models = [...data.models].sort((a: any, b: any) =>
            String(a.name || a.id).localeCompare(String(b.name || b.id)),
          );
          setDynamicModels(models);
        } else {
          setDynamicModels([]);
        }
      } catch {
        setDynamicModels([]);
      }
    };
    load();
  }, [formData.provider]);

  const [currentItem, setCurrentItem] = useState<ClozeItem | null>(null);
  const [generatedItems, setGeneratedItems] = useState<ClozeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const generateItems = async () => {
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('请先登录');
        setGenerating(false);
        return;
      }

      const response = await fetch('/api/admin/cloze/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...formData,
          model:
            formData.provider === 'openrouter' && formData.model === 'custom'
              ? customModel || ''
              : formData.model,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setGeneratedItems(result.items);
        setCurrentItem(result.items[0]);
        setCurrentIndex(0);
        toast.success('题目已生成');
      } else {
        toast.error('生成失败: ' + result.error);
      }
    } catch (error) {
      toast.error('生成失败: ' + error);
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!currentItem) return;
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('请先登录');
        setSaving(false);
        return;
      }

      const response = await fetch('/api/admin/cloze/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: currentItem.id,
          lang: currentItem.lang || formData.lang,
          level: currentItem.level || formData.level,
          topic: currentItem.topic ?? formData.topic ?? '',
          title: currentItem.title,
          passage: currentItem.passage,
          blanks: currentItem.blanks,
          status: 'draft',
          ai_provider: currentItem.ai_provider,
          ai_model: currentItem.ai_model,
          ai_usage: currentItem.ai_usage,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setCurrentItem({ ...currentItem, id: result.data.id, status: 'draft' });
        toast.success('草稿已保存');
      } else {
        toast.error('保存失败: ' + result.error);
      }
    } catch (error) {
      toast.error('保存失败: ' + error);
    } finally {
      setSaving(false);
    }
  };

  const publishItem = async () => {
    if (!currentItem?.id) return;
    setPublishing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error('请先登录');
        setPublishing(false);
        return;
      }

      const response = await fetch('/api/admin/cloze/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ draftId: currentItem.id }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('题目已发布到题库');
        setCurrentItem({ ...currentItem, status: 'approved' });
      } else {
        toast.error('发布失败: ' + result.error);
      }
    } catch (error) {
      toast.error('发布失败: ' + error);
    } finally {
      setPublishing(false);
    }
  };

  const updateBlank = (blankIndex: number, field: keyof ClozeBlank, value: any) => {
    if (!currentItem) return;
    const newBlanks = [...currentItem.blanks];
    newBlanks[blankIndex] = { ...newBlanks[blankIndex], [field]: value };
    setCurrentItem({ ...currentItem, blanks: newBlanks });
  };

  const addAcceptable = (blankIndex: number) => {
    if (!currentItem) return;
    const newBlanks = [...currentItem.blanks];
    newBlanks[blankIndex].acceptable.push('');
    setCurrentItem({ ...currentItem, blanks: newBlanks });
  };

  const removeAcceptable = (blankIndex: number, acceptableIndex: number) => {
    if (!currentItem) return;
    const newBlanks = [...currentItem.blanks];
    newBlanks[blankIndex].acceptable.splice(acceptableIndex, 1);
    setCurrentItem({ ...currentItem, blanks: newBlanks });
  };

  const updateAcceptable = (blankIndex: number, acceptableIndex: number, value: string) => {
    if (!currentItem) return;
    const newBlanks = [...currentItem.blanks];
    newBlanks[blankIndex].acceptable[acceptableIndex] = value;
    setCurrentItem({ ...currentItem, blanks: newBlanks });
  };

  if (loading) {
    return <div className="p-8">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 管理员导航栏 */}
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              Lang Trainer
            </Link>
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="text-gray-700 hover:text-gray-900">
                控制台
              </Link>
              <Link href="/admin/cloze/ai" className="text-blue-600 font-medium">
                Cloze 管理
              </Link>
              <Link href="/admin/setup" className="text-gray-700 hover:text-gray-900">
                权限设置
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回控制台
            </Link>
            <Link href="/" className="px-3 py-1 text-sm border rounded hover:bg-gray-50">
              返回首页
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-8 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Cloze 题目 AI 生成与审核</h1>

          {/* 生成表单 */}
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-semibold mb-4">生成新题目</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">语言</label>
                <select
                  value={formData.lang}
                  onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="zh">简体中文</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">难度等级</label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded"
                >
                  <option value={1}>L1 - 初级</option>
                  <option value={2}>L2 - 初中级</option>
                  <option value={3}>L3 - 中级</option>
                  <option value={4}>L4 - 中高级</option>
                  <option value={5}>L5 - 高级</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">题目数量</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.count}
                  onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">主题 (可选)</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  placeholder="例如: 商务、旅游、科技"
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI 提供商</label>
                <select
                  value={formData.provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    // 根据提供商设置默认模型
                    const defaults: Record<string, string> = {
                      deepseek: 'deepseek-chat',
                      openrouter: 'anthropic/claude-3.5-sonnet',
                      openai: 'gpt-4o',
                    };
                    setFormData({ ...formData, provider, model: defaults[provider] || '' });
                    if (provider !== 'openrouter') setCustomModel('');
                  }}
                  className="w-full p-2 border rounded"
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">模型</label>
                <select
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full p-2 border rounded min-w-[360px] md:min-w-[480px]"
                >
                  {formData.provider === 'deepseek' && (
                    <>
                      <option value="deepseek-chat">deepseek-chat</option>
                      <option value="deepseek-reasoner">deepseek-reasoner</option>
                    </>
                  )}
                  {formData.provider === 'openrouter' && (
                    <>
                      {dynamicModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                      <option value="custom">自定义...</option>
                    </>
                  )}
                  {formData.provider === 'openai' && (
                    <>
                      {dynamicModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {formData.provider === 'openrouter' && formData.model === 'custom' && (
                  <input
                    type="text"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                    placeholder="输入 OpenRouter 模型标识，如 provider/model-name"
                    className="mt-2 w-full p-2 border rounded min-w-[360px] md:min-w-[480px]"
                  />
                )}
              </div>
            </div>
            <Button onClick={generateItems} disabled={generating}>
              {generating ? '生成中...' : '生成题目'}
            </Button>
            {formData.provider === 'openrouter' && (
              <Button
                className="ml-3"
                variant="secondary"
                onClick={async () => {
                  try {
                    const {
                      data: { session },
                    } = await supabase.auth.getSession();
                    if (!session) {
                      toast.error('请先登录');
                      return;
                    }
                    const res = await fetch(`/api/admin/providers/models?provider=openrouter`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    const data = await res.json();
                    if (res.ok && Array.isArray(data.models)) {
                      const models = [...data.models].sort((a: any, b: any) =>
                        String(a.name || a.id).localeCompare(String(b.name || b.id)),
                      );
                      setDynamicModels(models);
                      toast.success('模型列表已刷新，共 ' + models.length + ' 个');
                    } else {
                      toast.error('刷新失败: ' + (data?.error || 'unknown'));
                    }
                  } catch (e: any) {
                    toast.error('刷新失败: ' + (e?.message || String(e)));
                  }
                }}
              >
                刷新模型列表
              </Button>
            )}
          </div>

          {/* 题目导航 */}
          {generatedItems.length > 0 && (
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    题目 {currentIndex + 1} / {generatedItems.length}
                  </span>
                  <div className="flex space-x-2">
                    {generatedItems.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentIndex(index);
                          setCurrentItem(generatedItems[index]);
                        }}
                        className={`px-3 py-1 rounded text-sm ${
                          index === currentIndex
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={saveDraft} disabled={saving}>
                    {saving ? '保存中...' : '保存草稿'}
                  </Button>
                  <Button onClick={publishItem} disabled={publishing || !currentItem?.id}>
                    {publishing ? '发布中...' : '发布题目'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 当前题目编辑 */}
        {currentItem && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">标题</label>
              <input
                type="text"
                value={currentItem.title}
                onChange={(e) => setCurrentItem({ ...currentItem, title: e.target.value })}
                className="w-full p-3 border rounded"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">文章内容</label>
              <textarea
                value={currentItem.passage}
                onChange={(e) => setCurrentItem({ ...currentItem, passage: e.target.value })}
                rows={6}
                className="w-full p-3 border rounded"
                placeholder="使用 {{1}}, {{2}}, {{3}} 等标记空白位置"
              />
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-semibold">空白设置</h3>
              {currentItem.blanks.map((blank, blankIndex) => (
                <div key={blank.id} className="border p-4 rounded">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">正确答案</label>
                      <input
                        type="text"
                        value={blank.answer}
                        onChange={(e) => updateBlank(blankIndex, 'answer', e.target.value)}
                        className="w-full p-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">类型</label>
                      <select
                        value={blank.type}
                        onChange={(e) => updateBlank(blankIndex, 'type', e.target.value)}
                        className="w-full p-2 border rounded"
                      >
                        <option value="grammar">语法</option>
                        <option value="vocabulary">词汇</option>
                        <option value="connector">连接词</option>
                        <option value="particle">助词</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">可接受答案</label>
                    <div className="space-y-2">
                      {blank.acceptable.map((acceptable, acceptableIndex) => (
                        <div key={acceptableIndex} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={acceptable}
                            onChange={(e) =>
                              updateAcceptable(blankIndex, acceptableIndex, e.target.value)
                            }
                            className="flex-1 p-2 border rounded"
                            placeholder="同义词或可接受的答案"
                          />
                          <button
                            onClick={() => removeAcceptable(blankIndex, acceptableIndex)}
                            className="text-red-600 hover:text-red-800"
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addAcceptable(blankIndex)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        + 添加可接受答案
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">解释</label>
                    <textarea
                      value={blank.explanation}
                      onChange={(e) => updateBlank(blankIndex, 'explanation', e.target.value)}
                      rows={2}
                      className="w-full p-2 border rounded"
                      placeholder="为什么这个答案是正确的"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
