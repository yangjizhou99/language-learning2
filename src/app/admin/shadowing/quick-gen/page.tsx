"use client";
import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { supabase } from "@/lib/supabase";

type Stage = "theme" | "pick" | "review" | "gen";
type Lang = "en" | "ja" | "zh";
type Provider = "openrouter" | "deepseek" | "openai";

type Theme = {
  title_cn: string;
  title_en: string;
  rationale: string;
};

type Topic = {
  title_cn: string;
  seed_en: string;
  one_line_cn: string;
  use?: boolean; // 用户是否勾选
};

type Progress = {
  saved: number;
  total_target: number;
};

export default function ShadowingQuickGenPage() {
  // 基础参数
  const [level, setLevel] = useState(3);
  const [genre, setGenre] = useState("dialogue");
  const [count, setCount] = useState(5);
  
  // 主题选择相关
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  
  // 主题管理相关
  const [showCreateTheme, setShowCreateTheme] = useState(false);
  const [creatingTheme, setCreatingTheme] = useState(false);
  const [themeForm, setThemeForm] = useState({
    title_cn: "",
    level: 1
  });
  const [batchThemes, setBatchThemes] = useState("");
  const [showBatchCreate, setShowBatchCreate] = useState(false);
  const [deletingTheme, setDeletingTheme] = useState<string | null>(null);
  const [showDraftManager, setShowDraftManager] = useState(false);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [deletingDrafts, setDeletingDrafts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [existingTopics, setExistingTopics] = useState<any[]>([]);
  const [loadingExistingTopics, setLoadingExistingTopics] = useState(false);
  const [selectedExistingTopics, setSelectedExistingTopics] = useState<Set<string>>(new Set());
  const [deletingTopics, setDeletingTopics] = useState(false);

  // 等级与体裁的联动配置
  const levelGenreMap: Record<number, { value: string; label: string; description: string }[]> = {
    1: [
      { value: "dialogue", label: "对话", description: "日常对话，如问路、点餐、打招呼" },
      { value: "monologue", label: "独白", description: "简单的自我介绍、日常描述" }
    ],
    2: [
      { value: "dialogue", label: "对话", description: "购物、预约、校园办事等对话" },
      { value: "monologue", label: "独白", description: "日常任务描述、个人经历分享" }
    ],
    3: [
      { value: "dialogue", label: "对话", description: "校园生活、社交话题讨论" },
      { value: "monologue", label: "独白", description: "个人观点表达、经历分享" },
      { value: "news", label: "新闻", description: "校园新闻、轻量社会话题" }
    ],
    4: [
      { value: "dialogue", label: "对话", description: "专业话题讨论、深度交流" },
      { value: "monologue", label: "独白", description: "专题介绍、分析说明" },
      { value: "news", label: "新闻", description: "科技、教育、健康等专题新闻" },
      { value: "lecture", label: "讲座", description: "知识讲解、概念介绍" }
    ],
    5: [
      { value: "dialogue", label: "对话", description: "复杂话题辩论、专业讨论" },
      { value: "monologue", label: "独白", description: "深度分析、专业观点阐述" },
      { value: "news", label: "新闻", description: "国际新闻、政策解读" },
      { value: "lecture", label: "讲座", description: "专业讲座、学术讲解" }
    ],
    6: [
      { value: "dialogue", label: "对话", description: "高难度专业讨论、学术辩论" },
      { value: "monologue", label: "独白", description: "复杂分析、深度思考表达" },
      { value: "news", label: "新闻", description: "深度报道、专业分析" },
      { value: "lecture", label: "讲座", description: "高级讲座、学术报告" }
    ]
  };

  // 获取当前等级可选的体裁
  const availableGenres = levelGenreMap[level] || levelGenreMap[3];
  
  // 当等级改变时，检查当前体裁是否还可用
  const handleLevelChange = (newLevel: number) => {
    setLevel(newLevel);
    const newAvailableGenres = levelGenreMap[newLevel] || levelGenreMap[3];
    const currentGenreStillAvailable = newAvailableGenres.some(g => g.value === genre);
    
    if (!currentGenreStillAvailable) {
      // 如果当前体裁不可用，自动选择第一个可用的体裁
      setGenre(newAvailableGenres[0].value);
    }
  };
  
  // 高级参数（折叠）
  const [lang, setLang] = useState<Lang>("ja");
  const [provider, setProvider] = useState<Provider>("deepseek");
  const [model, setModel] = useState("deepseek-chat");
  const [temperature, setTemperature] = useState(0.4);
  const [concurrency, setConcurrency] = useState(4);
  const [advOpen, setAdvOpen] = useState(false);

  // 模型列表状态
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string, description?: string}>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // 加载主题列表
  const loadThemes = async () => {
    setLoadingThemes(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      console.log("开始加载主题，token:", token ? "存在" : "不存在");

      // 按难度等级筛选主题
      const params = new URLSearchParams({
        level: level.toString(),
        active: 'true'
      });

      const res = await fetch(`/api/admin/shadowing/themes?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      console.log("主题API状态:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API错误响应:", errorText);
        throw new Error(`获取主题列表失败: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log("主题API响应:", data);
      setThemes(data.themes || []);
    } catch (error) {
      console.error("加载主题失败:", error);
    } finally {
      setLoadingThemes(false);
    }
  };

  // 创建主题
  const createTheme = async () => {
    if (!themeForm.title_cn) {
      alert("请填写主题名称");
      return;
    }

    setCreatingTheme(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 主题只关联难度等级，暂时使用默认值（待数据库迁移完成后改为null）
      const themeData = {
        ...themeForm,
        title_en: themeForm.title_cn, // 英文标题使用中文标题
        description: "", // 空描述
        lang: "zh", // 暂时使用默认值，迁移后改为null
        genre: "dialogue", // 暂时使用默认值，迁移后改为null
        register: "neutral" // 暂时使用默认值，迁移后改为null
      };

      const res = await fetch("/api/admin/shadowing/themes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(themeData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "创建主题失败");
      }

      alert("主题创建成功");
      setShowCreateTheme(false);
      setThemeForm({
        title_cn: "",
        level: 1
      });
      loadThemes();
    } catch (error) {
      console.error("创建主题失败:", error);
      alert(error instanceof Error ? error.message : "创建主题失败");
    } finally {
      setCreatingTheme(false);
    }
  };

  // 删除选中的题目
  const deleteSelectedTopics = async () => {
    if (selectedExistingTopics.size === 0) {
      alert("请先选择要删除的题目");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedExistingTopics.size} 个题目吗？此操作不可撤销。`)) {
      return;
    }

    setDeletingTopics(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      // 批量删除选中的题目
      const deletePromises = Array.from(selectedExistingTopics).map(topicId =>
        fetch(`/api/admin/shadowing/topics/${topicId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(res => !res.ok);

      if (failed.length > 0) {
        throw new Error(`删除失败：${failed.length} 个题目删除失败`);
      }

      // 重新加载题目列表
      await loadExistingTopics();
      setSelectedExistingTopics(new Set());
      alert(`成功删除 ${selectedExistingTopics.size} 个题目`);
    } catch (error) {
      console.error("删除题目失败:", error);
      alert(error instanceof Error ? error.message : "删除题目失败");
    } finally {
      setDeletingTopics(false);
    }
  };

  // 加载已存在的题目
  const loadExistingTopics = async () => {
    if (!selectedTheme) return;
    
    setLoadingExistingTopics(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      const res = await fetch(`/api/admin/shadowing/themes/${selectedTheme.id}/topics`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("获取已存在题目失败");
      }

      const data = await res.json();
      console.log("已存在的题目:", data.topics?.length || 0, "个");
      setExistingTopics(data.topics || []);
    } catch (error) {
      console.error("加载已存在题目失败:", error);
      setExistingTopics([]);
    } finally {
      setLoadingExistingTopics(false);
    }
  };

  // 加载草稿列表
  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      const res = await fetch(`/api/admin/shadowing/drafts?status=draft`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("获取草稿列表失败");
      }

      const data = await res.json();
      console.log("加载的草稿数据:", data.items?.length || 0, "个草稿");
      setDrafts(data.items || []);
    } catch (error) {
      console.error("加载草稿失败:", error);
      alert(error instanceof Error ? error.message : "加载草稿失败");
    } finally {
      setLoadingDrafts(false);
    }
  };

  // 删除选中的草稿
  const deleteSelectedDrafts = async () => {
    if (selectedDrafts.size === 0) {
      alert("请选择要删除的草稿");
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedDrafts.size} 个草稿吗？删除后无法恢复。`)) {
      return;
    }

    setDeletingDrafts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      const deletePromises = Array.from(selectedDrafts).map(draftId => 
        fetch(`/api/admin/shadowing/drafts/${draftId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      const results = await Promise.allSettled(deletePromises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      if (successCount > 0) {
        alert(`删除完成！成功删除 ${successCount} 个草稿${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
        setSelectedDrafts(new Set());
        loadDrafts();
      } else {
        alert("所有草稿删除失败，请检查网络连接或重试");
      }
    } catch (error) {
      console.error("删除草稿失败:", error);
      alert(error instanceof Error ? error.message : "删除草稿失败");
    } finally {
      setDeletingDrafts(false);
    }
  };

  // 删除主题
  const deleteTheme = async (themeId: string) => {
    if (!confirm("确定要删除这个主题吗？删除后无法恢复。")) {
      return;
    }

    setDeletingTheme(themeId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      const res = await fetch(`/api/admin/shadowing/themes/${themeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "删除主题失败");
      }

      alert("主题删除成功");
      loadThemes();
    } catch (error) {
      console.error("删除主题失败:", error);
      alert(error instanceof Error ? error.message : "删除主题失败");
    } finally {
      setDeletingTheme(null);
    }
  };

  // 批量创建主题
  const createBatchThemes = async () => {
    if (!batchThemes.trim()) {
      alert("请填写主题名称");
      return;
    }

    const themeNames = batchThemes
      .split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (themeNames.length === 0) {
      alert("请填写有效的主题名称");
      return;
    }

    setCreatingTheme(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("用户未登录");
      }

      // 批量创建主题
      const promises = themeNames.map(themeName => {
        const themeData = {
          title_cn: themeName,
          title_en: themeName, // 英文标题使用中文标题
          description: "", // 空描述
          lang: "zh", // 暂时使用默认值，迁移后改为null
          genre: "dialogue", // 暂时使用默认值，迁移后改为null
          register: "neutral", // 暂时使用默认值，迁移后改为null
          level: themeForm.level
        };

        return fetch("/api/admin/shadowing/themes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(themeData)
        });
      });

      const results = await Promise.allSettled(promises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successCount++;
        } else {
          errorCount++;
          console.error(`主题 "${themeNames[index]}" 创建失败:`, result);
        }
      });

      if (successCount > 0) {
        alert(`批量创建完成！成功创建 ${successCount} 个主题${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`);
        setShowBatchCreate(false);
        setBatchThemes("");
        loadThemes();
      } else {
        alert("所有主题创建失败，请检查网络连接或重试");
      }
    } catch (error) {
      console.error("批量创建主题失败:", error);
      alert(error instanceof Error ? error.message : "批量创建主题失败");
    } finally {
      setCreatingTheme(false);
    }
  };

  // 获取模型列表
  const fetchModels = async (provider: Provider) => {
    setLoadingModels(true);
    setModelError(null);
    try {
      console.log(`正在获取 ${provider} 的模型列表...`);
      
      if (provider === 'deepseek') {
        // DeepSeek 使用静态模型列表
        const models = [
          { id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'DeepSeek 对话模型' },
          { id: 'deepseek-coder', name: 'DeepSeek Coder', description: 'DeepSeek 代码模型' },
          { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: 'DeepSeek 推理模型' }
        ];
        setAvailableModels(models);
        
        // 如果当前模型不在新列表中，自动选择第一个
        const currentModelExists = models.some((m) => m.id === model);
        if (!currentModelExists) {
          setModel(models[0].id);
        }
      } else if (provider === 'openrouter') {
        // OpenRouter 直接调用API
        const referer = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': referer,
            'X-Title': 'Lang Trainer Admin'
          }
        });
        
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`OpenRouter API error: ${text}`);
        }
        
        const data = await res.json();
        const models = Array.isArray(data?.data) ? data.data.map((m: any) => ({
          id: m.id || m.name,
          name: m.name || m.id,
          description: m.description || ''
        })).filter((m: any) => m.id).sort((a, b) => a.name.localeCompare(b.name)) : [];
        
        setAvailableModels(models);
        
        // 如果当前模型不在新列表中，自动选择第一个
        if (models.length > 0) {
          const currentModelExists = models.some((m: any) => m.id === model);
          if (!currentModelExists) {
            setModel(models[0].id);
          }
        }
      }
    } catch (error) {
      console.error('获取模型列表失败:', error);
      setModelError(`网络错误: ${error instanceof Error ? error.message : '未知错误'}`);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  // 处理提供者变更
  const handleProviderChange = (newProvider: Provider) => {
    setProvider(newProvider);
    fetchModels(newProvider);
  };

  // 初始化时获取模型列表和主题列表
  useEffect(() => {
    fetchModels(provider);
    loadThemes();
  }, []);

  // 当难度等级改变时重新加载主题
  useEffect(() => {
    loadThemes();
  }, [level]);

  // 状态管理
  const [stage, setStage] = useState<Stage>("theme");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  // 主题数据
  const [theme, setTheme] = useState<Theme | null>(null);
  const [chosen, setChosen] = useState<Topic[]>([]);

  // 生成进度
  const [progress, setProgress] = useState<Progress>({ saved: 0, total_target: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  // 第一阶段：生成主题候选
  const suggest = async () => {
    if (!selectedTheme) {
      alert("请先选择一个主题");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("未登录或会话失效，请重新登录");
      }

      // 调试：检查用户权限
      console.log('用户会话:', session.user?.email);
      console.log('访问令牌存在:', !!session.access_token);
      console.log('选中主题:', selectedTheme);

      const res = await fetch(`/api/admin/shadowing/themes/${selectedTheme.id}/topics/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ count, provider, model, temperature })
      });
      
      if (!res.ok) {
        const error = await res.json();
        console.error('主题生成API错误:', error);
        throw new Error(error.message || error.error || `请求失败 (${res.status})`);
      }
      
      const data = await res.json();
      // 使用选中的主题信息
      setTheme({
        title_cn: selectedTheme.title_cn,
        title_en: selectedTheme.title_en,
        rationale: selectedTheme.description || "基于选中的主题生成"
      });
      setChosen(data.topics.map((t: any) => ({ 
        title_cn: t.title_cn,
        seed_en: t.seed_en || "",
        one_line_cn: t.one_line_cn || "",
        use: true 
      })));
      setStage("review");
    } catch (err: any) {
      alert("生成主题失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 第二阶段：开始生成
  const startGen = async () => {
    const selected = chosen.filter(t => t.use);
    if (selected.length === 0) {
      alert("请至少选择一个题目");
      return;
    }

    setStage("gen");
    setRunning(true);
    setProgress({ saved: 0, total_target: selected.length });
    setLogs([]);

    try {
      // 获取认证token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("未登录或会话失效，请重新登录");
      }

      // 构建生成参数，复用现有的批量生成API
      const topicsText = selected.map(t => t.title_cn).join("\n");
      
      const res = await fetch("/api/admin/batch/stream", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          kind: "shadowing",
          params: {
            lang,
            level,
            genre,
            topicsText,
            provider,
            model,
            temperature,
            concurrency,
            perCombo: 1,
            register: level <= 2 ? "casual" : level >= 5 ? "formal" : "neutral",
            sentRange: level <= 2 ? [4, 6] : level <= 4 ? [6, 8] : [8, 10],
            batch_size: 1,
            theme_id: selectedTheme?.id,
            topic_ids: selected.map(t => t.id).filter(Boolean)
          }
        })
      });

      if (!res.ok) throw new Error("生成请求失败");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(value);
        const lines = text.split("\n").filter(l => l.startsWith("data: "));
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            handleStreamEvent(data);
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, `错误: ${err.message}`]);
    } finally {
      setRunning(false);
    }
  };

  const handleStreamEvent = (data: any) => {
    switch (data.type) {
      case "start":
        setLogs(prev => [...prev, `开始生成 ${data.total} 个任务...`]);
        break;
      case "progress":
        setLogs(prev => [...prev, `正在生成: ${data.topic} (等级${data.level})`]);
        break;
      case "saved":
        setProgress(prev => ({ ...prev, saved: data.done }));
        setLogs(prev => [...prev, `✓ 已保存到 ${data.saved.table}: ${data.saved.count} 项`]);
        break;
      case "error":
        setLogs(prev => [...prev, `✗ 失败: ${data.message}`]);
        break;
      case "done":
        setLogs(prev => [...prev, "生成完成！请到草稿箱审核。"]);
        break;
    }
  };

  const toggle = (idx: number) => {
    setChosen(prev => prev.map((t, i) => i === idx ? { ...t, use: !t.use } : t));
  };

  const edit = (idx: number, newTitle: string) => {
    setChosen(prev => prev.map((t, i) => i === idx ? { ...t, title_cn: newTitle } : t));
  };

  const stop = () => {
    setRunning(false);
    setLogs(prev => [...prev, "用户手动停止"]);
  };

  return (
    <main className="space-y-6">
      <Breadcrumbs 
        items={[
          { href: "/admin", label: "控制台" },
          { href: "/admin/shadowing", label: "Shadowing" },
          { label: "快速生成" }
        ]} 
      />
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shadowing 快速生成</h1>
        <div className="text-sm text-gray-500">
          {stage === "theme" && "第一步：选择主题"}
          {stage === "pick" && "第二步：选择参数"}
          {stage === "review" && "第三步：审核题目"}
          {stage === "gen" && "第四步：生成内容"}
        </div>
      </div>

      {/* 0) 主题选择 */}
      {stage === "theme" && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-4">
          <h2 className="font-medium">选择主题</h2>
          <p className="text-sm text-gray-600">请先选择一个主题，然后系统会为该主题生成具体的学习题目</p>
          
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="text-sm font-medium">目标语言</label>
              <select 
                className="border rounded px-2 py-1 mt-1" 
                value={lang} 
                onChange={e => setLang(e.target.value as Lang)}
              >
                <option value="zh">简体中文</option>
                <option value="en">English</option>
                <option value="ja">日本語</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">难度等级</label>
              <select 
                className="border rounded px-2 py-1 mt-1" 
                value={level} 
                onChange={e => handleLevelChange(Number(e.target.value))}
              >
                <option value={1}>L1 - 初级</option>
                <option value={2}>L2 - 入门</option>
                <option value={3}>L3 - 中级</option>
                <option value={4}>L4 - 中高级</option>
                <option value={5}>L5 - 高级</option>
                <option value={6}>L6 - 专家级</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">体裁</label>
              <select 
                className="border rounded px-2 py-1 mt-1" 
                value={genre} 
                onChange={e => setGenre(e.target.value)}
              >
                {availableGenres.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <button 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={loadThemes}
              disabled={loadingThemes}
            >
              {loadingThemes ? "加载中..." : "加载主题"}
            </button>
          </div>

          {themes.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-medium">可用主题：</h3>
              <div className="grid gap-3">
                {themes.map((theme) => (
                  <div 
                    key={theme.id} 
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                      selectedTheme?.id === theme.id ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedTheme(theme)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{theme.title_cn}</h4>
                        {theme.title_en && theme.title_en !== theme.title_cn && (
                          <p className="text-sm text-gray-600">{theme.title_en}</p>
                        )}
                        {theme.description && (
                          <p className="text-xs text-gray-500 mt-1">{theme.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">L{theme.level}</span>
                          {theme.genre && (
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">{theme.genre}</span>
                          )}
                          {theme.register && (
                            <span className="text-xs bg-gray-200 px-2 py-1 rounded">{theme.register}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTheme(theme.id);
                          }}
                          disabled={deletingTheme === theme.id}
                          className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                          title="删除主题"
                        >
                          {deletingTheme === theme.id ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={async () => {
                    await loadExistingTopics();
                    setStage("pick");
                  }}
                  disabled={!selectedTheme}
                >
                  选择此主题
                </button>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => setShowCreateTheme(true)}
                >
                  创建新主题
                </button>
                <button 
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={() => setShowBatchCreate(true)}
                >
                  批量创建主题
                </button>
                <button 
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => {
                    setShowDraftManager(true);
                    loadDrafts();
                  }}
                >
                  管理草稿
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>暂无符合条件的主题</p>
              <div className="flex gap-3 justify-center mt-2">
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => setShowCreateTheme(true)}
                >
                  创建新主题
                </button>
                <button 
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={() => setShowBatchCreate(true)}
                >
                  批量创建主题
                </button>
                <button 
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => {
                    setShowDraftManager(true);
                    loadDrafts();
                  }}
                >
                  管理草稿
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 1) 参数选择 */}
      {stage === "pick" && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-3">
        <h2 className="font-medium">基础参数</h2>
        
        {/* 等级说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-blue-800 mb-2">当前等级说明：</div>
          <div className="text-blue-700">
            {level === 1 && "L1 初级：超短句·高频词；口语化；避免复杂从句"}
            {level === 2 && "L2 入门：短句；基础连接词；简单从句"}
            {level === 3 && "L3 中级：中等篇幅；常见并列/从句"}
            {level === 4 && "L4 中高级：较长；抽象词；结构更复杂"}
            {level === 5 && "L5 高级：较长；信息密度高；专业/抽象词汇"}
            {level === 6 && "L6 专家级：复杂分析；高难度专业内容"}
          </div>
          <div className="text-blue-600 mt-1">
            支持 {availableGenres.length} 种体裁：{availableGenres.map(g => g.label).join("、")}
          </div>
        </div>

        {/* 第一步选择结果展示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-blue-800 mb-2">第一步选择结果</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-700">主题：</span>
              <span className="text-blue-600">{selectedTheme?.title_cn}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">目标语言：</span>
              <span className="text-blue-600">
                {lang === 'en' ? '英语' : lang === 'ja' ? '日语' : '中文'}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-700">难度等级：</span>
              <span className="text-blue-600">L{level} - {level === 1 ? '初级' : level === 2 ? '入门' : level === 3 ? '中级' : level === 4 ? '中高级' : level === 5 ? '高级' : '专家级'}</span>
            </div>
            <div>
              <span className="font-medium text-blue-700">体裁：</span>
              <span className="text-blue-600">
                {genre === 'dialogue' ? '对话' : genre === 'monologue' ? '独白' : genre === 'news' ? '新闻' : '讲座'}
              </span>
            </div>
          </div>
        </div>

        {/* 已存在的题目显示 */}
        {existingTopics.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-yellow-800">
                已存在的题目 ({existingTopics.length} 个) - 新生成的题目将避免与这些重复
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedExistingTopics.size === existingTopics.length) {
                      setSelectedExistingTopics(new Set());
                    } else {
                      setSelectedExistingTopics(new Set(existingTopics.map(t => t.id)));
                    }
                  }}
                  className="px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300"
                >
                  {selectedExistingTopics.size === existingTopics.length ? "取消全选" : "全选"}
                </button>
                <button
                  onClick={deleteSelectedTopics}
                  disabled={selectedExistingTopics.size === 0 || deletingTopics}
                  className="px-2 py-1 text-xs bg-red-200 text-red-800 rounded hover:bg-red-300 disabled:bg-gray-200 disabled:text-gray-400"
                >
                  {deletingTopics ? "删除中..." : `删除选中 (${selectedExistingTopics.size})`}
                </button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto">
              <div className="space-y-1">
                {existingTopics.map((topic, index) => (
                  <div key={topic.id || index} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedExistingTopics.has(topic.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedExistingTopics);
                        if (e.target.checked) {
                          newSelected.add(topic.id);
                        } else {
                          newSelected.delete(topic.id);
                        }
                        setSelectedExistingTopics(newSelected);
                      }}
                      className="mt-0.5"
                    />
                    <div className="text-yellow-700 flex-1">
                      <div className="font-medium">{topic.title_cn}</div>
                      {topic.one_line_cn && (
                        <div className="text-yellow-600 text-xs mt-1">{topic.one_line_cn}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* 生成参数 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium text-gray-800 mb-3">生成参数</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">
              生成数量
              <input 
                type="number" 
                min={1} 
                max={30} 
                className="border rounded px-2 py-1 w-full mt-1" 
                value={count} 
                onChange={e => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} 
              />
            </label>
            <div className="text-sm text-gray-600 flex items-center">
              <span className="font-medium">当前设置：</span>
              <span className="ml-2">基于 "{selectedTheme?.title_cn}" 主题，生成 {count} 个 {genre === 'dialogue' ? '对话' : genre === 'monologue' ? '独白' : genre === 'news' ? '新闻' : '讲座'} 题目</span>
            </div>
          </div>
        </div>
        
        <button 
          className={`px-4 py-2 rounded font-medium ${
            loading ? "bg-gray-300 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"
          }`} 
          onClick={suggest} 
          disabled={loading}
        >
          {loading ? "生成中..." : "生成主题候选"}
        </button>

        <details className="mt-4">
          <summary 
            className="cursor-pointer select-none text-sm text-gray-600 hover:text-gray-800" 
            onClick={() => setAdvOpen(!advOpen)}
          >
            高级设置（可选）
            {advOpen && (
              <span className="ml-2 text-xs text-blue-600">
                {provider} / {model}
              </span>
            )}
          </summary>
          {advOpen && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 p-3 bg-gray-50 rounded">
              <label className="text-xs">
                Provider
                <select 
                  className="border rounded px-2 py-1 w-full text-sm" 
                  value={provider} 
                  onChange={e => handleProviderChange(e.target.value as Provider)}
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </label>
              <label className="text-xs">
                Model
                <div className="flex items-center gap-1 mt-1">
                  <select 
                    className="border rounded px-2 py-1 flex-1 text-sm min-w-0" 
                    value={model} 
                    onChange={e => setModel(e.target.value)}
                    disabled={loadingModels}
                    style={{ maxWidth: '200px' }}
                  >
                    {loadingModels ? (
                      <option>加载中...</option>
                    ) : availableModels.length > 0 ? (
                      availableModels.map((m) => (
                        <option key={m.id} value={m.id} title={m.name}>
                          {m.name.length > 25 ? `${m.name.substring(0, 25)}...` : m.name}
                        </option>
                      ))
                    ) : (
                      <option>{modelError ? '加载失败' : '无可用模型'}</option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => fetchModels(provider)}
                    disabled={loadingModels}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
                    title="刷新模型列表"
                  >
                    🔄
                  </button>
                </div>
                {modelError ? (
                  <div className="text-xs text-red-500 mt-1 break-words">
                    {modelError}
                  </div>
                ) : availableModels.length > 0 ? (
                  <div className="text-xs text-gray-500 mt-1 break-words max-w-full">
                    {availableModels.find(m => m.id === model)?.description || ''}
                  </div>
                ) : null}
              </label>
              <label className="text-xs">
                Temperature
                <input 
                  type="number" 
                  min={0} 
                  max={1} 
                  step={0.1} 
                  className="border rounded px-2 py-1 w-full text-sm" 
                  value={temperature} 
                  onChange={e => setTemperature(Number(e.target.value) || 0.4)} 
                />
              </label>
              <label className="text-xs">
                并发数
                <input 
                  type="number" 
                  min={1} 
                  max={8} 
                  className="border rounded px-2 py-1 w-full text-sm" 
                  value={concurrency} 
                  onChange={e => setConcurrency(Number(e.target.value) || 4)} 
                />
              </label>
            </div>
          )}
        </details>
      </section>
      )}

      {/* 2) 审核主题候选 */}
      {stage !== "pick" && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-lg">大主题：{theme?.title_cn || "—"}</h3>
              <p className="text-sm text-gray-600 mt-1">{theme?.rationale}</p>
            </div>
            <div className="text-xs text-gray-500">
              已选择 {chosen.filter(t => t.use).length} / {chosen.length} 个题目
            </div>
          </div>
          
          <div className="space-y-2">
            {chosen.map((topic, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50">
                <input 
                  type="checkbox" 
                  checked={!!topic.use} 
                  onChange={() => toggle(i)} 
                  className="mt-1"
                />
                <div className="flex-1 space-y-1">
                  <input 
                    className="w-full font-medium border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none bg-transparent" 
                    value={topic.title_cn} 
                    onChange={e => edit(i, e.target.value)} 
                  />
                  <div className="text-xs text-gray-500">关键词: {topic.seed_en}</div>
                  {topic.one_line_cn && (
                    <div className="text-xs text-gray-600">{topic.one_line_cn}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              className="px-3 py-2 rounded border hover:bg-gray-50" 
              onClick={suggest} 
              disabled={loading}
            >
              重新生成主题
            </button>
            <button 
              className="px-3 py-2 rounded border hover:bg-gray-50" 
              onClick={loadExistingTopics} 
              disabled={loadingExistingTopics}
            >
              {loadingExistingTopics ? "加载中..." : "刷新已存在题目"}
            </button>
            <button 
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-medium" 
              onClick={startGen}
              disabled={chosen.filter(t => t.use).length === 0}
            >
              开始生成内容
            </button>
          </div>
        </section>
      )}

      {/* 3) 生成进度 */}
      {stage === "gen" && (
        <section className="p-4 bg-white rounded-2xl shadow space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">生成进度</h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {progress.saved}/{progress.total_target}
              </span>
              <button 
                className="px-3 py-1 text-sm rounded border hover:bg-gray-50" 
                onClick={stop} 
                disabled={!running}
              >
                停止
              </button>
            </div>
          </div>
          
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-3 bg-green-500 transition-all duration-300 ease-out" 
              style={{ 
                width: `${progress.total_target ? (progress.saved / progress.total_target * 100) : 0}%` 
              }} 
            />
          </div>
          
          <div className="bg-gray-50 rounded p-3 h-48 overflow-auto font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className="py-1">{log}</div>
            ))}
          </div>
          
          {!running && progress.saved > 0 && (
            <div className="text-center">
              <a 
                href="/admin/shadowing/review" 
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                前往草稿箱审核
              </a>
            </div>
          )}
        </section>
      )}

      {/* 创建主题模态框 */}
      {showCreateTheme && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">创建新主题</h2>
                <button
                  onClick={() => setShowCreateTheme(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">主题名称 *</label>
                  <input
                    className="border rounded px-2 py-1 w-full mt-1"
                    value={themeForm.title_cn}
                    onChange={(e) => setThemeForm({ ...themeForm, title_cn: e.target.value })}
                    placeholder="例如：校园生活"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">难度等级 *</label>
                  <select 
                    className="border rounded px-2 py-1 w-full mt-1" 
                    value={themeForm.level} 
                    onChange={(e) => setThemeForm({ ...themeForm, level: Number(e.target.value) })}
                  >
                    <option value={1}>L1 - 初级</option>
                    <option value={2}>L2 - 入门</option>
                    <option value={3}>L3 - 中级</option>
                    <option value={4}>L4 - 中高级</option>
                    <option value={5}>L5 - 高级</option>
                    <option value={6}>L6 - 专家级</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-800 mb-2">主题说明：</div>
                  <div className="text-blue-700">
                    <div>• 主题主要关联难度等级</div>
                    <div>• 主题可以在不同语言、体裁、语域下重复使用</div>
                    <div>• 生成内容时会根据当前页面设置自动匹配</div>
                    <div className="text-orange-600 mt-2">注：当前使用默认值，数据库迁移后将完全解耦</div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowCreateTheme(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={createTheme}
                    disabled={creatingTheme}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creatingTheme ? "创建中..." : "创建主题"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 批量创建主题模态框 */}
      {showBatchCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">批量创建主题</h2>
                <button
                  onClick={() => setShowBatchCreate(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">主题名称列表 *</label>
                  <textarea
                    className="border rounded px-2 py-1 w-full mt-1"
                    rows={8}
                    value={batchThemes}
                    onChange={(e) => setBatchThemes(e.target.value)}
                    placeholder="每行一个主题名称，例如：&#10;校园生活&#10;购物体验&#10;旅游攻略&#10;职场沟通&#10;健康养生"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    每行输入一个主题名称，系统会自动过滤空行
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">难度等级 *</label>
                  <select 
                    className="border rounded px-2 py-1 w-full mt-1" 
                    value={themeForm.level} 
                    onChange={(e) => setThemeForm({ ...themeForm, level: Number(e.target.value) })}
                  >
                    <option value={1}>L1 - 初级</option>
                    <option value={2}>L2 - 入门</option>
                    <option value={3}>L3 - 中级</option>
                    <option value={4}>L4 - 中高级</option>
                    <option value={5}>L5 - 高级</option>
                    <option value={6}>L6 - 专家级</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <div className="font-medium text-blue-800 mb-2">批量创建说明：</div>
                  <div className="text-blue-700">
                    <div>• 所有主题主要关联难度等级</div>
                    <div>• 主题可以在不同语言、体裁、语域下重复使用</div>
                    <div>• 生成内容时会根据当前页面设置自动匹配</div>
                    <div className="text-orange-600 mt-2">注：当前使用默认值，数据库迁移后将完全解耦</div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowBatchCreate(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                    disabled={creatingTheme}
                  >
                    取消
                  </button>
                  <button
                    onClick={createBatchThemes}
                    disabled={creatingTheme || !batchThemes.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {creatingTheme ? "创建中..." : "批量创建"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 草稿管理模态框 */}
      {showDraftManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">草稿管理</h2>
                <button
                  onClick={() => setShowDraftManager(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={loadDrafts}
                    disabled={loadingDrafts}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loadingDrafts ? "加载中..." : "刷新草稿"}
                  </button>
                  <button
                    onClick={() => setSelectedDrafts(new Set(drafts.map(d => d.id)))}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => setSelectedDrafts(new Set())}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    取消全选
                  </button>
                  <button
                    onClick={deleteSelectedDrafts}
                    disabled={selectedDrafts.size === 0 || deletingDrafts}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
                  >
                    {deletingDrafts ? "删除中..." : `删除选中 (${selectedDrafts.size})`}
                  </button>
                </div>

                <div className="text-sm text-gray-600">
                  共 {drafts.length} 个草稿，已选择 {selectedDrafts.size} 个
                  {drafts.length > itemsPerPage && (
                    <span className="ml-2">
                      (第 {currentPage} 页，共 {Math.ceil(drafts.length / itemsPerPage)} 页)
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto border rounded">
                  {drafts.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {loadingDrafts ? "加载中..." : "暂无草稿"}
                    </div>
                  ) : (
                    <div className="space-y-2 p-2">
                      {drafts
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((draft) => (
                        <div
                          key={draft.id}
                          className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                            selectedDrafts.has(draft.id) ? 'border-blue-500 bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            const newSelected = new Set(selectedDrafts);
                            if (newSelected.has(draft.id)) {
                              newSelected.delete(draft.id);
                            } else {
                              newSelected.add(draft.id);
                            }
                            setSelectedDrafts(newSelected);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <input
                                  type="checkbox"
                                  checked={selectedDrafts.has(draft.id)}
                                  onChange={() => {}}
                                  className="mr-2"
                                />
                                <h4 className="font-medium">{draft.title}</h4>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">L{draft.level}</span>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">{draft.genre}</span>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {draft.text?.substring(0, 100)}...
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                创建时间: {new Date(draft.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 分页控件 */}
                {drafts.length > itemsPerPage && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      首页
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      上一页
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {currentPage} / {Math.ceil(drafts.length / itemsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(drafts.length / itemsPerPage), prev + 1))}
                      disabled={currentPage >= Math.ceil(drafts.length / itemsPerPage)}
                      className="px-3 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      下一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.ceil(drafts.length / itemsPerPage))}
                      disabled={currentPage >= Math.ceil(drafts.length / itemsPerPage)}
                      className="px-3 py-1 text-sm border rounded disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      末页
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
