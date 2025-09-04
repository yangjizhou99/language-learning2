"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
// import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface AlignmentPack {
  id: string;
  lang: "en" | "ja" | "zh";
  topic: string;
  tags: string[];
  preferred_style: any;
  steps: any;
  status: string;
  created_at: string;
}

interface Step {
  type: string;
  title: string;
  prompt: string;
  exemplar: string;
  key_phrases?: string[];
  patterns?: string[];
  hints?: string[];
  checklist?: string[];
  templates?: string[];
  outline?: string[];
  rubric: any;
}

interface Scores {
  fluency: number;
  relevance: number;
  style: number;
  length: number;
  overall: number;
}

interface Feedback {
  highlights: string[];
  issues: string[];
  replace_suggestions: Array<{
    from: string;
    to: string;
    why: string;
  }>;
  extra_phrases: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function AlignmentPracticePage() {
  const params = useParams();
  const packId = params.id as string;
  
  const [pack, setPack] = useState<AlignmentPack | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("D1");
  const [submission, setSubmission] = useState("");
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Scores | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [usage, setUsage] = useState<any>(null);
  const [provider, setProvider] = useState<"openrouter" | "deepseek" | "openai">("openrouter");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<{id: string; name: string}[]>([]);
  const [temperature, setTemperature] = useState(0.2);
  const [error, setError] = useState("");
  
  // 角色扮演对话相关状态
  const [userRole, setUserRole] = useState<"A" | "B" | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isDialogueStep, setIsDialogueStep] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // 获取训练包详情
  useEffect(() => {
    if (!packId) return;
    
    fetch(`/api/alignment/packs/${packId}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setPack(data.pack);
        } else {
          setError(data.error);
        }
      })
      .catch(err => setError(err.message));
  }, [packId]);

  // 检测当前步骤是否为对话步骤
  useEffect(() => {
    if (pack) {
      const step = pack.steps[currentStep];
      const isDialogue = step?.type?.startsWith("dialogue") || currentStep.startsWith("D");
      setIsDialogueStep(isDialogue);
      
      // 如果是对话步骤，重置对话状态
      if (isDialogue) {
        setMessages([]);
        setUserRole(null);
      }
    }
  }, [currentStep, pack]);

  // 获取 AI 模型列表
  useEffect(() => {
    if (provider === "openrouter") {
      fetch(`/api/ai/models?provider=${provider}`)
        .then(r => r.json())
        .then(data => {
          setModels(data || []);
          setModel(data?.[0]?.id || "");
        });
    } else if (provider === "deepseek") {
      const j = [{id: "deepseek-chat", name: "deepseek-chat"}, {id: "deepseek-reasoner", name: "deepseek-reasoner"}];
      setModels(j);
      setModel(j[0].id);
    } else {
      const j = [{id: "gpt-4o-mini", name: "gpt-4o-mini"}];
      setModels(j);
      setModel(j[0].id);
    }
  }, [provider]);

  // 提交评分
  const submitForScoring = async () => {
    if (!pack) return;
    
    // 对话步骤需要消息记录，非对话步骤需要提交内容
    if (isDialogueStep && (!userRole || messages.length === 0)) {
      setError("请先选择角色并开始对话");
      return;
    }
    if (!isDialogueStep && !submission.trim()) {
      setError("请先输入练习内容");
      return;
    }
    
    setLoading(true);
    setScores(null);
    setFeedback(null);
    setUsage(null);

    try {
      let body: any = {
        pack_id: pack.id,
        step_key: currentStep,
        provider,
        model,
        temperature
      };

      if (isDialogueStep) {
        // 对话步骤：生成转录并评分
        const transcript = messages.map(msg => 
          `${msg.role === "user" ? userRole : (userRole === "A" ? "B" : "A")}: ${msg.content}`
        ).join("\n");
        
        body.userRole = userRole;
        body.transcript = transcript;
        body.submission = ""; // 对话步骤不需要 submission
      } else {
        // 非对话步骤：使用提交内容
        body.submission = submission.trim();
      }

      // 评分接口已下线：直接在前端给出占位反馈，避免 404
      const r = await Promise.resolve({ ok: true, json: async () => ({ ok: true, result: { scores: { fluency: 0, relevance: 0, style: 0, length: 0, overall: 0 }, feedback: { highlights: [], issues: [], replace_suggestions: [], extra_phrases: [] } }, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }) });
      // const r = await fetch("/api/alignment/score", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(body)
      // });

      const data: any = await r.json();
      if (data?.ok) {
        setScores(data.result.scores);
        setFeedback(data.result.feedback);
        setUsage(data.usage);
      } else {
        setError(data?.error || "评分接口已停用");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // 应用替换建议
  const applySuggestion = (from: string, to: string) => {
    setSubmission(prev => prev.replace(new RegExp(from, 'g'), to));
  };

  // 发送对话消息
  const sendMessage = async () => {
    if (!inputMessage.trim() || !userRole || !pack) return;
    
    const userMessage: Message = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setChatLoading(true);
    
    try {
      const r = await fetch("/api/alignment/roleplay/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: pack.id,
          step_key: currentStep,
          role: userRole,
          messages: [...messages, userMessage],
          provider,
          model,
          temperature
        })
      });
      
      const data = await r.json();
      if (data.ok) {
        const aiMessage: Message = {
          role: "assistant",
          content: data.reply,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatLoading(false);
    }
  };

  // 当用户选择 B 且对话尚未开始时，由 AI 先开场
  const kickoffAi = async (role: "A" | "B") => {
    if (!pack || !isDialogueStep) return;
    if (role !== "B") return;
    if (messages.length > 0) return;

    setChatLoading(true);
    try {
      const r = await fetch("/api/alignment/roleplay/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack_id: pack.id,
          step_key: currentStep,
          role: role, // 用户扮演B，则AI扮演A并先说
          messages: [],
          provider,
          model,
          temperature
        })
      });
      const data = await r.json();
      if (data.ok) {
        const aiMessage: Message = {
          role: "assistant",
          content: data.reply,
          timestamp: Date.now()
        };
        setMessages([aiMessage]);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChatLoading(false);
    }
  };

  // 处理回车键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!chatLoading) sendMessage();
    }
  };

  function DialoguePanel() {
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-medium mb-3">角色扮演对话</h3>
        {!userRole && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">选择你要扮演的角色：</p>
            <div className="flex gap-3">
              <Button onClick={() => setUserRole("A")} variant="outline">扮演角色 A</Button>
              <Button onClick={() => { setUserRole("B"); kickoffAi("B"); }} variant="secondary">扮演角色 B（由 A 先开场）</Button>
            </div>
          </div>
        )}

        {userRole && (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
              <span className="font-medium">你正在扮演：角色 {userRole}</span>
              {chatLoading && <span className="ml-3 text-xs text-gray-500">AI 正在回复…</span>}
              <button
                onClick={() => { setUserRole(null); setMessages([]); setInputMessage(""); }}
                className="ml-3 text-blue-600 hover:underline text-xs"
              >
                重新选择
              </button>
            </div>

            <div className="h-64 overflow-y-auto border rounded p-3 mb-4 bg-gray-50">
              {messages.length === 0 ? (
                <div className="text-gray-500 text-center py-8">
                  {userRole === "B" ? "正在等待 A 开场…" : "开始对话吧！输入你的第一句话"}
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                    <div className={`inline-block max-w-xs p-2 rounded ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-white text-gray-800 border"}`}>
                      <div className="text-xs opacity-75 mb-1">
                        {msg.role === "user" ? `角色 ${userRole}` : `角色 ${userRole === "A" ? "B" : "A"}`}
                      </div>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="输入你的对话内容..."
                className="flex-1 px-3 py-2 border rounded bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                disabled={chatLoading}
              />
              <Button onClick={sendMessage} disabled={!inputMessage.trim() || chatLoading}>发送</Button>
            </div>

            <Button onClick={submitForScoring} disabled={loading || messages.length === 0} className="mt-4 w-full">
              {loading ? "评分中..." : "提交对话评分"}
            </Button>
          </>
        )}
      </div>
    );
  }

  function EditorPanel() {
    return (
      <div className="rounded-2xl border bg-card text-card-foreground p-6">
        <h3 className="font-medium mb-3">你的练习</h3>
        <textarea
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          placeholder="在这里输入你的练习内容..."
          className="w-full h-48 p-3 border rounded-lg bg-background resize-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        <Button onClick={submitForScoring} disabled={loading || !submission.trim()} className="mt-4 w-full">
          {loading ? "评分中..." : "提交评分"}
        </Button>
      </div>
    );
  }

  function ResultsPanel() {
    if (!scores) return null;
    return (
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="font-medium mb-4">AI 评分结果</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{scores.overall}</div>
            <div className="text-sm text-gray-600">总分</div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-sm">流畅性</span><span className="font-medium">{scores.fluency}</span></div>
            <div className="flex justify-between"><span className="text-sm">相关性</span><span className="font-medium">{scores.relevance}</span></div>
            <div className="flex justify-between"><span className="text-sm">风格</span><span className="font-medium">{scores.style}</span></div>
            <div className="flex justify-between"><span className="text-sm">长度</span><span className="font-medium">{scores.length}</span></div>
          </div>
        </div>

        {feedback && (
          <div className="space-y-4">
            {feedback.highlights.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-600 mb-2">亮点</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {feedback.highlights.map((highlight, i) => (<li key={i}>{highlight}</li>))}
                </ul>
              </div>
            )}
            {feedback.issues.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-600 mb-2">需要改进</h4>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {feedback.issues.map((issue, i) => (<li key={i}>{issue}</li>))}
                </ul>
              </div>
            )}
            {feedback.replace_suggestions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-blue-600 mb-2">替换建议</h4>
                <div className="space-y-2">
                  {feedback.replace_suggestions.map((suggestion, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-red-600">{suggestion.from}</span>
                      <span>→</span>
                      <span className="text-green-600">{suggestion.to}</span>
                      <button onClick={() => applySuggestion(suggestion.from, suggestion.to)} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">应用</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {feedback.extra_phrases.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-purple-600 mb-2">补充短语</h4>
                <div className="flex flex-wrap gap-2">
                  {feedback.extra_phrases.map((phrase, i) => (<span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm">{phrase}</span>))}
                </div>
              </div>
            )}
          </div>
        )}

        {usage && (
          <div className="mt-4 pt-4 border-t text-xs text-gray-500">
            Token 用量：PT={usage.prompt_tokens} · CT={usage.completion_tokens} · TT={usage.total_tokens}
          </div>
        )}
      </div>
    );
  }

  if (!pack) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        {error ? (
          <div className="text-red-600">错误：{error}</div>
        ) : (
          <div className="text-gray-600">加载中...</div>
        )}
      </main>
    );
  }

  const step = pack.steps[currentStep] as Step;
  const stepOrder: string[] = (pack.steps.order as string[]) || ["D1", "D2", "T3", "W4", "T5", "W6"];

  return (
    <main className="p-6">
      <div className="mx-auto px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1200 }}>
      <Breadcrumbs segments={[{ href: "/", label: "首页" }, { href: "/practice/alignment", label: "对齐练习" }, { href: `/practice/alignment/${packId}`, label: pack.topic }]} />
      <div className="max-w-6xl mx-auto space-y-6">
      {/* 头部信息 */}
      <div className="rounded-2xl border bg-card text-card-foreground p-6">
        <h1 className="text-2xl font-semibold mb-2">
          {pack.topic} - 对齐练习
        </h1>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>语言：{pack.lang === "en" ? "英语" : pack.lang === "ja" ? "日语" : "中文"}</span>
          <span>标签：{pack.tags.join(", ")}</span>
          <span>状态：{pack.status}</span>
        </div>
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="text-red-800 text-sm">
            <strong>错误：</strong> {error}
            <button
              onClick={() => setError("")}
              className="ml-2 text-red-600 hover:text-red-800 underline"
            >
              清除
            </button>
          </div>
        </div>
      )}

      {/* 步骤导航 */}
      <div className="rounded-2xl border bg-card text-card-foreground p-4">
        <h3 className="font-medium mb-3">练习步骤</h3>
        <div className="flex gap-2 flex-wrap">
          {stepOrder.map((stepKey) => (
            <Button
              key={stepKey}
              onClick={() => setCurrentStep(stepKey)}
              variant={currentStep === stepKey ? "default" : "outline"}
            >
              {stepKey}
            </Button>
          ))}
        </div>
      </div>

      {/* 当前步骤内容 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 左侧：任务说明和范例 */}
        <div className="space-y-6">
          {/* 任务说明 */}
          <div className="rounded-2xl border bg-card text-card-foreground p-6">
            <h3 className="font-medium mb-3">{step.title}</h3>
            <p className="text-gray-700 mb-4">{step.prompt}</p>
            
            {/* 支持材料 */}
            {step.key_phrases && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">关键短语</h4>
                <div className="flex flex-wrap gap-2">
                  {step.key_phrases.map((phrase, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                      {phrase}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {step.patterns && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">句型模式</h4>
                <div className="flex flex-wrap gap-2">
                  {step.patterns.map((pattern, i) => (
                    <span key={i} className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm">
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {step.hints && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-600 mb-2">提示</h4>
                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                  {step.hints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 范例 */}
          <div className="rounded-2xl border bg-card text-card-foreground p-6">
            <h3 className="font-medium mb-3">范例</h3>
            <div className="bg-muted p-4 rounded">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono">
                {step.exemplar}
              </pre>
            </div>
          </div>
        </div>

        {/* 右侧：练习区域 */}
        <div className="space-y-6">
          {/* AI 模型选择 */}
          <div className="rounded-2xl border bg-card text-card-foreground p-4">
            <h3 className="font-medium mb-3">AI 模型设置</h3>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as any)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
              </select>
              
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value) || 0.2)}
                className="border rounded px-2 py-1 text-sm"
                placeholder="温度"
              />
            </div>
          </div>

          {/* 对话/编辑/结果分块 */}
          {isDialogueStep && <DialoguePanel />}
          {!isDialogueStep && <EditorPanel />}
          <ResultsPanel />
        </div>
      </div>
      </div>
    </main>
  );
}
