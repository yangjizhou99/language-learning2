"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import Link from "next/link";

type Theme = {
  id: string;
  title_cn: string;
  title_en: string;
  description?: string;
  lang: "en" | "ja" | "zh";
  level: number;
  genre: string;
  register: string;
};

type Topic = {
  id: string;
  theme_id: string;
  title_cn: string;
  seed_en?: string;
  one_line_cn?: string;
  is_generated: boolean;
  ai_provider?: string;
  ai_model?: string;
  created_at: string;
};

export default function TopicManagement() {
  const params = useParams();
  const themeId = params.themeId as string;
  
  const [theme, setTheme] = useState<Theme | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // 生成参数
  const [count, setCount] = useState(5);
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.7);

  // 加载主题信息
  const loadTheme = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/admin/shadowing/themes?theme_id=${themeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error("获取主题信息失败");
      }

      const data = await res.json();
      setTheme(data.themes?.[0] || null);
    } catch (error) {
      console.error("加载主题失败:", error);
      toast.error("加载主题失败");
    }
  };

  // 加载题目列表
  const loadTopics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(`/api/admin/shadowing/themes/${themeId}/topics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error("获取题目列表失败");
      }

      const data = await res.json();
      setTopics(data.topics || []);
    } catch (error) {
      console.error("加载题目失败:", error);
      toast.error("加载题目失败");
    } finally {
      setLoading(false);
    }
  };

  // 生成题目
  const generateTopics = async () => {
    if (count < 1 || count > 20) {
      toast.error("题目数量必须在1-20之间");
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`/api/admin/shadowing/themes/${themeId}/topics/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          count,
          provider,
          model,
          temperature
        })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "生成题目失败");
      }

      const data = await res.json();
      toast.success(`成功生成 ${data.topics.length} 个题目`);
      loadTopics();
    } catch (error) {
      console.error("生成题目失败:", error);
      toast.error(error instanceof Error ? error.message : "生成题目失败");
    } finally {
      setGenerating(false);
    }
  };

  // 批量生成内容
  const generateContent = async () => {
    if (selected.size === 0) {
      toast.error("请先选择要生成内容的题目");
      return;
    }

    const selectedTopics = topics.filter(t => selected.has(t.id));
    const topicsText = selectedTopics.map(t => t.title_cn).join("\n");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("未登录或会话失效，请重新登录");
      }

      // 跳转到快速生成页面，并传递参数
      const params = new URLSearchParams({
        theme_id: themeId,
        topics: topicsText,
        lang: theme?.lang || "zh",
        level: theme?.level?.toString() || "1",
        genre: theme?.genre || "dialogue"
      });

      window.location.href = `/admin/shadowing/quick-gen?${params.toString()}`;
    } catch (error) {
      console.error("跳转失败:", error);
      toast.error("跳转失败");
    }
  };

  useEffect(() => {
    if (themeId) {
      loadTheme();
      loadTopics();
    }
  }, [themeId]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === topics.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(topics.map(t => t.id)));
    }
  };

  if (loading) {
    return <div className="text-center py-8">加载中...</div>;
  }

  if (!theme) {
    return <div className="text-center py-8 text-red-500">主题不存在</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{theme.title_cn}</h1>
          <p className="text-gray-600">{theme.title_en}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/shadowing/themes">返回主题列表</Link>
        </Button>
      </div>

      {/* 主题信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">主题信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{theme.lang}</Badge>
            <Badge variant="secondary">L{theme.level}</Badge>
            <Badge variant="outline">{theme.genre}</Badge>
            <Badge variant="outline">{theme.register}</Badge>
          </div>
          {theme.description && (
            <p className="text-gray-600">{theme.description}</p>
          )}
        </CardContent>
      </Card>

      {/* 生成题目 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">生成题目</CardTitle>
          <CardDescription>使用AI为主题生成具体的学习题目</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">题目数量</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">AI提供商</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">模型</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="模型名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium">温度</label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={generateTopics} 
                disabled={generating}
                className="w-full"
              >
                {generating ? "生成中..." : "生成题目"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 题目列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">题目列表</CardTitle>
          <CardDescription>共 {topics.length} 个题目</CardDescription>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无题目，请先生成题目</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selected.size === topics.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <label className="text-sm font-medium">全选</label>
                </div>
                <div className="text-sm text-gray-600">
                  已选择 {selected.size} 个题目
                </div>
                {selected.size > 0 && (
                  <Button onClick={generateContent} size="sm">
                    生成内容 ({selected.size}个题目)
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {topics.map((topic) => (
                  <div key={topic.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50">
                    <Checkbox
                      checked={selected.has(topic.id)}
                      onCheckedChange={() => toggleSelect(topic.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{topic.title_cn}</h3>
                        {topic.is_generated && (
                          <Badge variant="outline" className="text-blue-600">
                            AI生成
                          </Badge>
                        )}
                      </div>
                      {topic.seed_en && (
                        <p className="text-sm text-gray-600 mb-1">
                          关键词: {topic.seed_en}
                        </p>
                      )}
                      {topic.one_line_cn && (
                        <p className="text-sm text-gray-500 mb-2">
                          {topic.one_line_cn}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        创建时间: {new Date(topic.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
