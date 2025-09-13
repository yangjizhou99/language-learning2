"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: { email: string };
};

export default function ThemeManagement() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<"all" | "en" | "ja" | "zh">("all");
  const [level, setLevel] = useState<"all" | "1" | "2" | "3" | "4" | "5" | "6">("all");
  const [genre, setGenre] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // 创建主题表单
  const [formData, setFormData] = useState({
    title_cn: "",
    title_en: "",
    description: "",
    lang: "zh" as "en" | "ja" | "zh",
    level: 1,
    genre: "dialogue",
    register: "neutral"
  });

  // 加载主题列表
  const loadThemes = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const params = new URLSearchParams();
      if (lang !== 'all') params.set('lang', lang);
      if (level !== 'all') params.set('level', level);
      if (genre !== 'all') params.set('genre', genre);
      params.set('active', 'true');

      const res = await fetch(`/api/admin/shadowing/themes?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!res.ok) {
        throw new Error("获取主题列表失败");
      }

      const data = await res.json();
      setThemes(data.themes || []);
    } catch (error) {
      console.error("加载主题失败:", error);
      toast.error("加载主题失败");
    } finally {
      setLoading(false);
    }
  };

  // 创建主题
  const createTheme = async () => {
    if (!formData.title_cn || !formData.title_en) {
      toast.error("请填写主题名称");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/admin/shadowing/themes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "创建主题失败");
      }

      toast.success("主题创建成功");
      setShowCreateDialog(false);
      setFormData({
        title_cn: "",
        title_en: "",
        description: "",
        lang: "zh",
        level: 1,
        genre: "dialogue",
        register: "neutral"
      });
      loadThemes();
    } catch (error) {
      console.error("创建主题失败:", error);
      toast.error(error instanceof Error ? error.message : "创建主题失败");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, [lang, level, genre]);

  const langMap = { en: "English", ja: "日本語", zh: "简体中文" };
  const genreMap = { dialogue: "对话", monologue: "独白", news: "新闻", lecture: "讲座" };
  const registerMap = { casual: "非正式", neutral: "中性", formal: "正式" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">主题管理</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>创建新主题</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>创建新主题</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title_cn">中文标题 *</Label>
                  <Input
                    id="title_cn"
                    value={formData.title_cn}
                    onChange={(e) => setFormData({ ...formData, title_cn: e.target.value })}
                    placeholder="例如：校园生活"
                  />
                </div>
                <div>
                  <Label htmlFor="title_en">英文标题 *</Label>
                  <Input
                    id="title_en"
                    value={formData.title_en}
                    onChange={(e) => setFormData({ ...formData, title_en: e.target.value })}
                    placeholder="例如：Campus Life"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="description">主题描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="描述这个主题的内容和特点"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lang">目标语言</Label>
                  <Select value={formData.lang} onValueChange={(value: "en" | "ja" | "zh") => setFormData({ ...formData, lang: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">简体中文</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="level">难度等级</Label>
                  <Select value={formData.level.toString()} onValueChange={(value) => setFormData({ ...formData, level: Number(value) })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">L1 - 初级</SelectItem>
                      <SelectItem value="2">L2 - 初中级</SelectItem>
                      <SelectItem value="3">L3 - 中级</SelectItem>
                      <SelectItem value="4">L4 - 中高级</SelectItem>
                      <SelectItem value="5">L5 - 高级</SelectItem>
                      <SelectItem value="6">L6 - 专家级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">体裁</Label>
                  <Select value={formData.genre} onValueChange={(value) => setFormData({ ...formData, genre: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dialogue">对话</SelectItem>
                      <SelectItem value="monologue">独白</SelectItem>
                      <SelectItem value="news">新闻</SelectItem>
                      <SelectItem value="lecture">讲座</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="register">语域</Label>
                  <Select value={formData.register} onValueChange={(value) => setFormData({ ...formData, register: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="casual">非正式</SelectItem>
                      <SelectItem value="neutral">中性</SelectItem>
                      <SelectItem value="formal">正式</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  取消
                </Button>
                <Button onClick={createTheme} disabled={creating}>
                  {creating ? "创建中..." : "创建主题"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>语言</Label>
              <Select value={lang} onValueChange={(value: "all" | "en" | "ja" | "zh") => setLang(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="zh">简体中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>等级</Label>
              <Select value={level} onValueChange={(value: "all" | "1" | "2" | "3" | "4" | "5" | "6") => setLevel(value)}>
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
                  <SelectItem value="6">L6</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>体裁</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部体裁</SelectItem>
                  <SelectItem value="dialogue">对话</SelectItem>
                  <SelectItem value="monologue">独白</SelectItem>
                  <SelectItem value="news">新闻</SelectItem>
                  <SelectItem value="lecture">讲座</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主题列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">主题列表</CardTitle>
          <CardDescription>共 {themes.length} 个主题</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : themes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无符合条件的主题</p>
            </div>
          ) : (
            <div className="space-y-4">
              {themes.map((theme) => (
                <div key={theme.id} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{langMap[theme.lang]}</Badge>
                        <Badge variant="secondary">L{theme.level}</Badge>
                        <Badge variant="outline">{genreMap[theme.genre as keyof typeof genreMap]}</Badge>
                        <Badge variant="outline">{registerMap[theme.register as keyof typeof registerMap]}</Badge>
                      </div>
                      <h3 className="text-lg font-medium mb-1">{theme.title_cn}</h3>
                      <p className="text-sm text-gray-600 mb-2">{theme.title_en}</p>
                      {theme.description && (
                        <p className="text-sm text-gray-500 mb-2">{theme.description}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        创建时间: {new Date(theme.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/shadowing/themes/${theme.id}/topics`}>
                          管理题目
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
