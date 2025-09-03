"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Lang } from "@/types/lang";

interface ClozeBlank {
  id: number;
  type: string;
  explanation: string;
}

interface ClozeItem {
  id: string;
  lang: string;
  level: number;
  topic: string;
  title: string;
  passage: string;
  blanks: ClozeBlank[];
}

interface ScoringResult {
  per_blank: Array<{
    id: number;
    score: number;
    reason: string;
    suggestion?: string;
  }>;
  overall: {
    score: number;
    feedback: string;
    strengths: string[];
    improvements: string[];
  };
}

export default function ClozePage() {
  const [lang, setLang] = useState<Lang>("ja");
  const [level, setLevel] = useState<number>(3);
  const [provider, setProvider] = useState<'deepseek'|'openrouter'|'openai'>("deepseek");
  const [model, setModel] = useState<string>('deepseek-chat');
  const [loading, setLoading] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [currentItem, setCurrentItem] = useState<ClozeItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string>("");


  const loadNextItem = async () => {
    setLoading(true);
    setError("");
    setScoringResult(null);
    setAnswers({});
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setLoading(false);
        return;
      }
      const response = await fetch(`/api/cloze/next?lang=${lang}&level=${level}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const result = await response.json();
      
      if (result.success) {
        setCurrentItem(result.item);
      } else {
        setError(result.error || '获取题目失败');
      }
    } catch (error) {
      setError('网络错误: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswers = async () => {
    if (!currentItem) return;
    
    setScoring(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('请先登录');
        setScoring(false);
        return;
      }
      const response = await fetch('/api/cloze/score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          itemId: currentItem.id,
          answers,
          provider,
          model
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setScoringResult(result.result);
      } else {
        setError(result.error || '评分失败');
      }
    } catch (error) {
      setError('评分失败: ' + error);
    } finally {
      setScoring(false);
    }
  };

  const renderCloze = () => {
    if (!currentItem) return null;
    
    // 将 passage 中的 {{1}}, {{2}} 等替换为输入框
    let passage = currentItem.passage;
    const blanks = currentItem.blanks.sort((a, b) => a.id - b.id);
    
    blanks.forEach((blank) => {
      const placeholder = `{{${blank.id}}}`;
      const inputId = `blank-${blank.id}`;
      const input = `<input id="${inputId}" class="border-b-2 border-blue-500 bg-yellow-50 px-2 py-1 mx-1 min-w-20" placeholder="填空" value="${answers[blank.id] || ''}" onchange="window.updateAnswer(${blank.id}, this.value)" />`;
      passage = passage.replace(placeholder, input);
    });
    
    return (
      <div 
        className="leading-8 text-lg"
        dangerouslySetInnerHTML={{ __html: passage }}
      />
    );
  };

  // 全局函数，用于更新答案
  useEffect(() => {
    (window as unknown as { updateAnswer: (blankId: number, value: string) => void }).updateAnswer = (blankId: number, value: string) => {
      setAnswers(prev => ({ ...prev, [blankId]: value }));
    };
    
    return () => {
      delete (window as unknown as { updateAnswer?: (blankId: number, value: string) => void }).updateAnswer;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Cloze 挖空练习</h1>
        <p className="text-gray-600">从题库中随机抽取题目，AI 智能评分</p>
      </div>

      {/* 设置区域 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex gap-4 items-center justify-center">
          <div>
            <label className="block text-sm font-medium mb-1">语言</label>
            <select 
              value={lang} 
              onChange={e => setLang(e.target.value as Lang)} 
              className="border rounded px-3 py-2"
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">难度等级</label>
            <select 
              value={level} 
              onChange={e => setLevel(parseInt(e.target.value))} 
              className="border rounded px-3 py-2"
            >
              <option value={1}>L1 - 初级</option>
              <option value={2}>L2 - 初中级</option>
              <option value={3}>L3 - 中级</option>
              <option value={4}>L4 - 中高级</option>
              <option value={5}>L5 - 高级</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">AI 提供商</label>
            <select
              value={provider}
              onChange={e => {
                const p = e.target.value as 'deepseek'|'openrouter'|'openai';
                setProvider(p);
                const defaults: Record<string,string> = {
                  deepseek: 'deepseek-chat',
                  openrouter: 'anthropic/claude-3.5-sonnet',
                  openai: 'gpt-4o'
                };
                setModel(defaults[p] || '');
              }}
              className="border rounded px-3 py-2"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">模型</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="border rounded px-3 py-2"
            >
              {provider === 'deepseek' && (
                <>
                  <option value="deepseek-chat">deepseek-chat</option>
                  <option value="deepseek-reasoner">deepseek-reasoner</option>
                </>
              )}
              {provider === 'openrouter' && (
                <>
                  <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet</option>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini</option>
                  <option value="meta-llama/Meta-Llama-3.1-70B-Instruct">meta-llama/Meta-Llama-3.1-70B-Instruct</option>
                </>
              )}
              {provider === 'openai' && (
                <>
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                </>
              )}
            </select>
          </div>
          <div className="pt-6">
            <button
              onClick={loadNextItem}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "加载中..." : "开始练习"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* 题目区域 */}
      {currentItem && (
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">{currentItem.title}</h2>
            <div className="text-sm text-gray-500">
              语言: {currentItem.lang.toUpperCase()} | 难度: L{currentItem.level} | 主题: {currentItem.topic}
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded">
            {renderCloze()}
          </div>

          <div className="flex gap-4 items-center">
            <button
              onClick={submitAnswers}
              disabled={scoring || Object.keys(answers).length === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {scoring ? "评分中..." : "提交答案"}
            </button>
            <button
              onClick={loadNextItem}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              下一题
            </button>
          </div>
        </div>
      )}

      {/* 评分结果 */}
      {scoringResult && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4">评分结果</h3>
          
          <div className="mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {Math.round(scoringResult.overall.score * 100)}%
              </div>
              <p className="text-gray-600">{scoringResult.overall.feedback}</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">优点</h4>
              <ul className="list-disc list-inside space-y-1">
                {scoringResult.overall.strengths.map((strength, index) => (
                  <li key={index} className="text-sm">{strength}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-orange-600 mb-2">改进建议</h4>
              <ul className="list-disc list-inside space-y-1">
                {scoringResult.overall.improvements.map((improvement, index) => (
                  <li key={index} className="text-sm">{improvement}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold mb-3">详细评分</h4>
            <div className="space-y-3">
              {scoringResult.per_blank.map((blank) => (
                <div key={blank.id} className="p-3 bg-gray-50 rounded">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">第 {blank.id} 空</span>
                    <span className={`px-2 py-1 rounded text-sm ${
                      blank.score === 1 ? 'bg-green-100 text-green-800' :
                      blank.score === 0.5 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {blank.score === 1 ? '完全正确' : blank.score === 0.5 ? '部分正确' : '需要改进'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{blank.reason}</p>
                  {blank.suggestion && (
                    <p className="text-sm text-blue-600">💡 {blank.suggestion}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
