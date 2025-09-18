"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { 
  Database, 
  Package, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock,
  Zap,
  FileAudio,
  Languages,
  BookOpen
} from "lucide-react";

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  url?: string;
}

interface PackingResult {
  type: string;
  success: boolean;
  itemsCount: number;
  filesCount: number;
  themesCount: number;
  subtopicsCount: number;
  publishedCount?: number;
  errors: string[];
  duration: number;
}

interface QuestionItem {
  id: string;
  title: string;
  lang: string;
  level: number;
  type: 'shadowing' | 'cloze' | 'alignment';
  status: string;
  created_at: string;
  text?: string;
  passage?: string;
  audio_url?: string;
  translations?: any;
  theme_id?: string;
  subtopic_id?: string;
  theme_title?: string;
  genre?: string;
  theme_genre?: string;
  subtopic_title?: string;
}

export default function SpecializedPackingPage() {
  // 数据库配置 - 从环境变量自动获取
  const [sourceConfig, setSourceConfig] = useState<DatabaseConfig>({
    host: "127.0.0.1",
    port: 54322,
    database: "postgres",
    username: "postgres",
    password: "postgres",
    ssl: false,
    url: ""
  });

  const [targetConfig, setTargetConfig] = useState<DatabaseConfig>({
    host: "db.yyfyieqfuwwyqrlewswu.supabase.co",
    port: 5432,
    database: "postgres",
    username: "postgres",
    password: "[yjzyjz925151560]",
    ssl: true,
    url: ""
  });

  const [supabaseConfig, setSupabaseConfig] = useState({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  });

  // 题目类型选择 - 只支持shadowing
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({
    'shadowing': true,
    'cloze': false,
    'alignment': false
  });

  // 筛选条件 - 默认只显示草稿
  const [filters, setFilters] = useState({
    lang: "all",
    level: "all",
    status: "draft", // 默认只显示草稿
    search: ""
  });

  // 题目列表
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // 打包结果
  const [packingResults, setPackingResults] = useState<PackingResult[]>([]);
  const [isPacking, setIsPacking] = useState(false);
  
  // 添加runId防抖，防止HMR导致的延迟日志
  const runIdRef = useRef(0);
  const [packingProgress, setPackingProgress] = useState({ 
    current: 0, 
    total: 0,
    currentStep: '',
    details: '',
    itemsProcessed: 0,
    itemsTotal: 0,
    filesProcessed: 0,
    filesTotal: 0,
    publishedCount: 0,
    publishTotal: 0
  });

  // 统计信息
  const stats = {
    total: items.length,
    selected: selected.size,
    byLang: {
      zh: items.filter(item => item.lang === 'zh').length,
      en: items.filter(item => item.lang === 'en').length,
      ja: items.filter(item => item.lang === 'ja').length
    },
    byLevel: {
      L1: items.filter(item => item.level === 1).length,
      L2: items.filter(item => item.level === 2).length,
      L3: items.filter(item => item.level === 3).length,
      L4: items.filter(item => item.level === 4).length,
      L5: items.filter(item => item.level === 5).length
    }
  };

  // 加载环境变量配置
  const loadEnvConfig = async () => {
    try {
      const response = await fetch('/api/admin/question-bank/env-config');
      const data = await response.json();
      
      if (data.success) {
        const config = data.config;
        setSourceConfig(prev => ({
          ...prev,
          url: config.localDbUrl
        }));
        setTargetConfig(prev => ({
          ...prev,
          url: config.prodDbUrl
        }));
        setSupabaseConfig({
          url: config.supabaseUrl,
          key: config.supabaseKey
        });
      } else {
        console.error('获取环境变量失败:', data.error);
        toast.error('获取环境变量失败: ' + data.error);
      }
    } catch (error) {
      console.error('获取环境变量失败:', error);
      toast.error('获取环境变量失败');
    }
  };

  // 加载题目数据 - 只加载shadowing草稿
  const loadItems = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const results = [];
      
      // 只加载shadowing草稿数据
      if (selectedTypes.shadowing) {
        const params = new URLSearchParams({
          status: 'draft', // 只获取草稿
          page: currentPage.toString(),
          pageSize: pageSize.toString()
        });
        
        if (filters.lang !== 'all') params.set('lang', filters.lang);
        if (filters.level !== 'all') params.set('level', filters.level);
        if (filters.search.trim()) params.set('q', filters.search.trim());

        const shadowingRes = await fetch(`/api/admin/shadowing/drafts?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (shadowingRes.ok) {
          const shadowingData = await shadowingRes.json();
          const shadowingItems = (shadowingData.items || []).map((item: any) => ({
            ...item,
            type: 'shadowing' as const,
            status: 'draft', // 确保状态为草稿
            theme_title: item.theme_title || '',
            theme_genre: item.theme_genre || '',
            subtopic_title: item.subtopic_title || ''
          }));
          results.push(...shadowingItems);
          
          // 设置分页信息
          setTotalItems(shadowingData.total || 0);
          setTotalPages(shadowingData.totalPages || 0);
        }
      }

      setItems(results);
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(item => item.id)));
    }
  };

  // 发布选中的草稿到本地数据库
  const publishSelectedDrafts = async (selectedItems: QuestionItem[], currentRunId?: number) => {
    let publishedCount = 0;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('未找到认证令牌');
      }
      
      // 并发发布草稿，但限制并发数量避免过载
      const batchSize = 5;
      for (let i = 0; i < selectedItems.length; i += batchSize) {
        const batch = selectedItems.slice(i, i + batchSize);
        
        const promises = batch.map(async (item) => {
          try {
            setPackingProgress(prev => ({ 
              ...prev, 
              currentStep: `发布草稿... (${publishedCount + 1}/${selectedItems.length})`,
              details: `正在发布: ${item.title}`
            }));
            
            const response = await fetch(`/api/admin/shadowing/drafts/${item.id}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ action: 'publish' })
            });
            
            if (response.ok) {
              publishedCount++;
              setPackingProgress(prev => ({ 
                ...prev, 
                publishedCount: publishedCount
              }));
              return { success: true, id: item.id };
            } else {
              const errorData = await response.json();
              console.error(`发布草稿失败 ${item.id}:`, errorData);
              return { success: false, id: item.id, error: errorData.error };
            }
          } catch (error) {
            console.error(`发布草稿异常 ${item.id}:`, error);
            return { success: false, id: item.id, error: error instanceof Error ? error.message : String(error) };
          }
        });
        
        await Promise.all(promises);
        
        // 添加小延迟避免过载
        if (i + batchSize < selectedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // 只有在当前runId有效时才输出成功日志
      if (currentRunId && currentRunId === runIdRef.current) {
        console.log(`成功发布 ${publishedCount}/${selectedItems.length} 个草稿`);
      } else if (currentRunId) {
        console.warn('发布完成但请求已过期，跳过日志输出', { currentRunId, currentRunIdRef: runIdRef.current });
      } else {
        console.log(`成功发布 ${publishedCount}/${selectedItems.length} 个草稿`);
      }
      
    } catch (error) {
      console.error('发布草稿失败:', error);
      throw error;
    }
    
    return publishedCount;
  };

  // 开始专项打包
  const startPacking = async () => {
    if (selected.size === 0) {
      toast.error('请先选择要打包的题目');
      return;
    }

    if (!sourceConfig.url || !targetConfig.url) {
      toast.error('环境变量中缺少数据库连接信息，请检查 LOCAL_DB_URL 和 PROD_DB_URL');
      return;
    }

    // 生成新的runId，防止HMR导致的延迟日志
    runIdRef.current += 1;
    const currentRunId = runIdRef.current;

    setIsPacking(true);
    setPackingResults([]);
    setPackingProgress({ 
      current: 0, 
      total: 0,
      currentStep: '准备中...',
      details: '正在初始化打包流程',
      itemsProcessed: 0,
      itemsTotal: 0,
      filesProcessed: 0,
      filesTotal: 0,
      publishedCount: 0,
      publishTotal: 0
    });

    let progressInterval: NodeJS.Timeout | undefined;
    
    try {
      const selectedItems = items.filter(item => selected.has(item.id));
      const typesToPack = Array.from(new Set(selectedItems.map(item => item.type)));

      setPackingProgress(prev => ({ 
        ...prev, 
        current: 1, 
        total: 5,
        currentStep: '连接数据库...',
        details: '正在建立数据库连接',
        itemsTotal: selectedItems.length,
        filesTotal: selectedItems.filter(item => item.audio_url).length
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      setPackingProgress(prev => ({ 
        ...prev, 
        current: 2,
        currentStep: '发送请求...',
        details: '正在向服务器发送打包请求'
      }));

      // 模拟进度更新
      progressInterval = setInterval(() => {
        setPackingProgress(prev => {
          if (prev.current === 2) {
            return {
              ...prev,
              currentStep: '处理数据...',
              details: '服务器正在处理您的数据，请稍候...'
            };
          }
          return prev;
        });
      }, 1000);

      const response = await fetch('/api/admin/question-bank/specialized-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sourceConfig: {
            url: sourceConfig.url || `postgresql://${sourceConfig.username}:${sourceConfig.password}@${sourceConfig.host}:${sourceConfig.port}/${sourceConfig.database}?sslmode=${sourceConfig.ssl ? 'require' : 'disable'}`
          },
          targetConfig: {
            url: targetConfig.url || `postgresql://${targetConfig.username}:${targetConfig.password}@${targetConfig.host}:${targetConfig.port}/${targetConfig.database}?sslmode=${targetConfig.ssl ? 'require' : 'disable'}`
          },
          supabaseConfig,
          questionTypes: typesToPack,
          filters: {
            lang: filters.lang === 'all' ? undefined : filters.lang,
            level: filters.level === 'all' ? undefined : parseInt(filters.level),
            status: filters.status === 'all' ? undefined : filters.status,
            selectedIds: Array.from(selected) // 传递选中的题目ID列表
          }
        })
      });

      setPackingProgress(prev => ({ 
        ...prev, 
        current: 3,
        currentStep: '处理响应...',
        details: '正在处理服务器响应'
      }));

      const data = await response.json();
      
      // 清除进度更新定时器
      clearInterval(progressInterval);

      if (response.ok) {
        setPackingResults(data.results);
        
        // 硬闸门：检查同步结果是否有错误
        const hasErrors = !data.success || 
                         (data.results && data.results.some((result: any) => !result.success)) || 
                         (data.errors && data.errors.length > 0) ||
                         (data.summary && data.summary.failedTypes > 0);
        
        console.log('同步结果检查:', {
          success: data.success,
          errors: data.errors?.length || 0,
          failedTypes: data.summary?.failedTypes || 0,
          hasErrors,
          currentRunId,
          runIdRef: runIdRef.current
        });
        
        if (hasErrors) {
          // 有错误，不发布到本地
          const errorDetails = data.errors ? data.errors.map((e: any) => `${e.type}: ${e.error}`).join('; ') : '未知错误';
          setPackingProgress(prev => ({ 
            ...prev, 
            current: 5,
            currentStep: '完成（有错误）',
            details: `同步过程中出现错误，未发布到本地数据库。错误: ${errorDetails}`,
            itemsProcessed: data.results?.reduce((sum: number, result: any) => sum + result.itemsCount, 0) || 0,
            filesProcessed: data.results?.reduce((sum: number, result: any) => sum + result.filesCount, 0) || 0
          }));
          toast.error(`同步过程中出现错误，未发布到本地数据库: ${errorDetails}`);
        } else {
          // 无错误，发布到本地数据库
          const selectedItems = items.filter(item => selected.has(item.id));
          if (selectedItems.length > 0) {
            // 再次检查runId，防止HMR导致的延迟执行
            if (currentRunId !== runIdRef.current) {
              console.warn('请求已过期，跳过发布', { currentRunId, currentRunIdRef: runIdRef.current });
              return;
            }
            
            setPackingProgress(prev => ({ 
              ...prev, 
              current: 4,
              currentStep: '发布草稿...',
              details: '草稿已同步到远程数据库，正在发布到本地数据库',
              publishTotal: selectedItems.length
            }));
            
            await publishSelectedDrafts(selectedItems, currentRunId);
          }
          
          setPackingProgress(prev => ({ 
            ...prev, 
            current: 5,
            currentStep: '完成',
            details: '打包和发布流程已完成',
            itemsProcessed: data.results?.reduce((sum: number, result: any) => sum + result.itemsCount, 0) || 0,
            filesProcessed: data.results?.reduce((sum: number, result: any) => sum + result.filesCount, 0) || 0
          }));
          toast.success(data.message);
        }
      } else {
        setPackingProgress(prev => ({ 
          ...prev, 
          current: 0,
          currentStep: '失败',
          details: data.error || '打包失败'
        }));
        toast.error(data.error || '打包失败');
      }
    } catch (error) {
      console.error('打包失败:', error);
      // 清除进度更新定时器
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      toast.error('打包失败，请检查网络连接');
    } finally {
      setIsPacking(false);
      // 延迟重置进度，让用户看到完成状态
      setTimeout(() => {
        setPackingProgress({ 
          current: 0, 
          total: 0,
          currentStep: '',
          details: '',
          itemsProcessed: 0,
          itemsTotal: 0,
          filesProcessed: 0,
          filesTotal: 0,
          publishedCount: 0,
          publishTotal: 0
        });
      }, 3000);
    }
  };

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

  // 页面加载时获取环境变量和数据
  useEffect(() => {
    loadEnvConfig();
    loadItems();
  }, [selectedTypes, filters, currentPage, pageSize]);

  // 当筛选条件改变时，重置选择
  useEffect(() => {
    setSelected(new Set());
  }, [filters]);

  // 当筛选条件改变时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Package className="w-6 h-6" />
          Shadowing草稿打包
        </h1>
        <p className="text-gray-600">
          专门用于打包Shadowing草稿题目，包含草稿数据、音频文件和翻译内容
        </p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-700">
            <strong>🔄 冲突处理：</strong>
            如果遇到相同ID的题目、主题或音频文件，系统会自动更新现有数据而不是重复创建。
            所有操作都在事务中执行，确保数据一致性。
          </div>
        </div>
      </div>

      {/* 数据库配置 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 源数据库配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              源数据库 (本地)
            </CardTitle>
            <CardDescription>从环境变量自动获取配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">主机地址:</span>
                <span className="ml-2 font-mono">{sourceConfig.host}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">端口:</span>
                <span className="ml-2 font-mono">{sourceConfig.port}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">数据库:</span>
                <span className="ml-2 font-mono">{sourceConfig.database}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">用户名:</span>
                <span className="ml-2 font-mono">{sourceConfig.username}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">SSL:</span>
                <span className="ml-2 font-mono">{sourceConfig.ssl ? '启用' : '禁用'}</span>
              </div>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-xs text-green-700">
                <strong>环境变量:</strong> LOCAL_DB_URL
              </div>
              <div className="text-xs text-green-600 font-mono mt-1 break-all">
                {sourceConfig.url || '未设置'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 目标数据库配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              目标数据库 (远程)
            </CardTitle>
            <CardDescription>从环境变量自动获取配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">主机地址:</span>
                <span className="ml-2 font-mono">{targetConfig.host}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">端口:</span>
                <span className="ml-2 font-mono">{targetConfig.port}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">数据库:</span>
                <span className="ml-2 font-mono">{targetConfig.database}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">用户名:</span>
                <span className="ml-2 font-mono">{targetConfig.username}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">SSL:</span>
                <span className="ml-2 font-mono">{targetConfig.ssl ? '启用' : '禁用'}</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-700">
                <strong>环境变量:</strong> PROD_DB_URL
              </div>
              <div className="text-xs text-blue-600 font-mono mt-1 break-all">
                {targetConfig.url || '未设置'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supabase配置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Supabase Storage
            </CardTitle>
            <CardDescription>从环境变量自动获取配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-gray-600">URL:</span>
                <span className="ml-2 font-mono text-xs break-all">{supabaseConfig.url || '未设置'}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">密钥:</span>
                <span className="ml-2 font-mono text-xs">
                  {supabaseConfig.key ? '已设置' : '未设置'}
                </span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-700">
                <strong>环境变量:</strong> NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
              </div>
              <div className="text-xs text-purple-600 mt-1">
                用于处理音频文件和翻译数据的存储
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 题目类型选择 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>题目类型</CardTitle>
          <CardDescription>专门用于打包Shadowing草稿题目</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start space-x-3 p-4 border rounded-lg bg-blue-50 border-blue-200">
            <Checkbox
              checked={true}
              disabled={true}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-blue-600" />
                <label className="font-medium text-blue-800">跟读练习草稿</label>
                <Badge variant="default" className="bg-blue-600">已选择</Badge>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                包含草稿数据、音频文件和翻译内容，专门用于打包未发布的草稿题目
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 筛选条件 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
          <CardDescription>筛选Shadowing草稿题目</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">搜索标题</label>
              <Input
                placeholder="搜索标题"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">语言</label>
              <Select value={filters.lang} onValueChange={(value) => setFilters(prev => ({ ...prev, lang: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部语言</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="ja">日文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">等级</label>
              <Select value={filters.level} onValueChange={(value) => setFilters(prev => ({ ...prev, level: value }))}>
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
            <div className="flex items-end">
              <Button onClick={loadItems} variant="outline" className="w-full" disabled={loading}>
                {loading ? '加载中...' : '刷新数据'}
              </Button>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-700">
              <strong>注意：</strong>只显示草稿状态的Shadowing题目，用于打包未发布的内容
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-sm">
                <span className="text-gray-600">草稿总数: </span>
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-600">已选择: </span>
                <span className="font-medium">{stats.selected}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">中文:</span>
                  <span className="font-medium">{stats.byLang.zh}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">英文:</span>
                  <span className="font-medium">{stats.byLang.en}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-600">日文:</span>
                  <span className="font-medium">{stats.byLang.ja}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">等级分布:</span>
                <span className="font-medium">L1:{stats.byLevel.L1} L2:{stats.byLevel.L2} L3:{stats.byLevel.L3} L4:{stats.byLevel.L4} L5:{stats.byLevel.L5}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selected.size === items.length && items.length > 0}
                onCheckedChange={toggleSelectAll}
                disabled={items.length === 0}
              />
              <label className="text-sm font-medium">全选</label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 题目列表 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shadowing草稿列表</CardTitle>
              <CardDescription>共 {totalItems} 个草稿题目，第 {currentPage} / {totalPages} 页</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">每页显示:</label>
                <Select value={pageSize.toString()} onValueChange={(value) => handlePageSizeChange(parseInt(value))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              没有找到符合条件的Shadowing草稿题目
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => {
                        const newSelected = new Set(selected);
                        if (newSelected.has(item.id)) {
                          newSelected.delete(item.id);
                        } else {
                          newSelected.add(item.id);
                        }
                        setSelected(newSelected);
                      }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{item.lang}</Badge>
                        <Badge variant="secondary">L{item.level}</Badge>
                        <Badge variant="outline">{item.genre || 'monologue'}</Badge>
                        <Badge variant="default" className="bg-blue-600">
                          跟读草稿
                        </Badge>
                        {item.audio_url && (
                          <Badge variant="default" className="bg-green-600">
                            已生成音频
                          </Badge>
                        )}
                      </div>
                      <div className="font-medium text-lg mb-2">{item.title}</div>
                      <div className="text-sm text-gray-500 mb-2">
                        创建时间: {new Date(item.created_at).toLocaleString()}
                      </div>
                      
                      {/* 显示主题和子主题信息 */}
                      {(item.theme_title || item.subtopic_title) && (
                        <div className="text-sm text-gray-600 mb-2">
                          {item.theme_title && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-gray-500">主题:</span>
                              <span className="font-medium">{item.theme_title}</span>
                              {item.theme_genre && (
                                <span className="text-gray-400">({item.theme_genre})</span>
                              )}
                            </span>
                          )}
                          {item.theme_title && item.subtopic_title && (
                            <span className="mx-2 text-gray-300">•</span>
                          )}
                          {item.subtopic_title && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-gray-500">子主题:</span>
                              <span className="font-medium">{item.subtopic_title}</span>
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* 显示文本内容 */}
                      {item.text && (
                        <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded border max-h-32 overflow-y-auto mb-3">
                          <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {item.text}
                          </div>
                        </div>
                      )}
                      
                      {/* 显示翻译内容 */}
                      {item.translations && (
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 mb-2">翻译内容:</div>
                          {item.translations.en && (
                            <div className="mb-2">
                              <div className="text-xs text-blue-600 font-medium mb-1">🇺🇸 英文:</div>
                              <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded border max-h-24 overflow-y-auto">
                                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                                  {item.translations.en}
                                </div>
                              </div>
                            </div>
                          )}
                          {item.translations.ja && (
                            <div className="mb-2">
                              <div className="text-xs text-red-600 font-medium mb-1">🇯🇵 日文:</div>
                              <div className="text-sm text-gray-700 bg-red-50 p-2 rounded border max-h-24 overflow-y-auto">
                                <div className="whitespace-pre-wrap text-xs leading-relaxed">
                                  {item.translations.ja}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 显示音频播放器 */}
                      {item.audio_url && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-2">🎵 音频播放:</div>
                          <div className="flex items-center gap-2">
                            <audio 
                              key={`${item.audio_url}-${Date.now()}`} 
                              controls 
                              src={`${item.audio_url}${item.audio_url.includes('?') ? '&' : '?'}t=${Date.now()}`} 
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分页导航 */}
      {totalPages > 1 && (
        <Card className="mb-6">
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
                        variant={currentPage === pageNum ? "default" : "outline"}
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

      {/* 打包操作 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">开始Shadowing草稿打包</h3>
              <p className="text-sm text-gray-600">
                将选中的Shadowing草稿题目同步到远程数据库（保持草稿状态），然后发布到本地数据库
              </p>
            </div>
            <Button 
              onClick={startPacking}
              disabled={isPacking || selected.size === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isPacking ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  打包中...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  开始打包
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 打包进度 */}
      {isPacking && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 animate-spin" />
              打包进度
            </CardTitle>
            <CardDescription>
              正在处理您的打包请求，请稍候...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* 总体进度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{packingProgress.currentStep}</span>
                  <span className="text-gray-600">
                    {packingProgress.current} / {packingProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: packingProgress.total > 0 
                        ? `${(packingProgress.current / packingProgress.total) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {packingProgress.details}
                </div>
              </div>

              {/* 详细统计 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {packingProgress.itemsProcessed}
                  </div>
                  <div className="text-xs text-gray-600">
                    已处理题目
                  </div>
                  <div className="text-xs text-gray-400">
                    / {packingProgress.itemsTotal}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {packingProgress.filesProcessed}
                  </div>
                  <div className="text-xs text-gray-600">
                    已处理文件
                  </div>
                  <div className="text-xs text-gray-400">
                    / {packingProgress.filesTotal}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {packingProgress.current}
                  </div>
                  <div className="text-xs text-gray-600">
                    当前步骤
                  </div>
                  <div className="text-xs text-gray-400">
                    / {packingProgress.total}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {packingProgress.total > 0 
                      ? Math.round((packingProgress.current / packingProgress.total) * 100)
                      : 0}%
                  </div>
                  <div className="text-xs text-gray-600">
                    完成进度
                  </div>
                  <div className="text-xs text-gray-400">
                    总体进度
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {packingProgress.publishedCount}
                  </div>
                  <div className="text-xs text-gray-600">
                    已发布草稿
                  </div>
                  <div className="text-xs text-gray-400">
                    / {packingProgress.publishTotal}
                  </div>
                </div>
              </div>

              {/* 进度步骤 */}
              <div className="pt-4 border-t">
                <div className="text-sm font-medium text-gray-700 mb-2">处理步骤：</div>
                <div className="space-y-1">
                  {[
                    { step: 1, name: '准备中...', status: packingProgress.current >= 1 ? 'completed' : packingProgress.current === 0 ? 'current' : 'pending' },
                    { step: 2, name: '连接数据库...', status: packingProgress.current >= 2 ? 'completed' : packingProgress.current === 1 ? 'current' : 'pending' },
                    { step: 3, name: '发送请求...', status: packingProgress.current >= 3 ? 'completed' : packingProgress.current === 2 ? 'current' : 'pending' },
                    { step: 4, name: '处理响应...', status: packingProgress.current >= 4 ? 'completed' : packingProgress.current === 3 ? 'current' : 'pending' },
                    { step: 5, name: '发布到本地...', status: packingProgress.current >= 5 ? 'completed' : packingProgress.current === 4 ? 'current' : 'pending' },
                    { step: 6, name: '完成', status: packingProgress.current >= 6 ? 'completed' : packingProgress.current === 5 ? 'current' : 'pending' }
                  ].map((step) => (
                    <div key={step.step} className="flex items-center gap-2 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        step.status === 'completed' 
                          ? 'bg-green-500 text-white' 
                          : step.status === 'current'
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-400'
                      }`}>
                        {step.status === 'completed' ? '✓' : step.step}
                      </div>
                      <span className={step.status === 'current' ? 'font-medium text-blue-600' : 'text-gray-600'}>
                        {step.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 打包结果 */}
      {packingResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              打包结果
            </CardTitle>
            <CardDescription>
              数据同步完成，系统已自动处理所有冲突情况
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {packingResults.map((result) => (
                <div key={result.type} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <h4 className="font-medium">
                        {result.type === 'shadowing' ? '跟读练习' :
                         result.type === 'cloze' ? '完形填空' : '对齐练习'}
                      </h4>
                      {result.errors.length > 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          {result.errors.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={result.success ? "default" : "destructive"}>
                      {result.success ? "成功" : "失败"}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      {result.itemsCount} 个题目
                    </span>
                    <span className="text-sm text-gray-600">
                      {result.filesCount} 个文件
                    </span>
                    <span className="text-sm text-gray-600">
                      {result.themesCount} 个主题
                    </span>
                    <span className="text-sm text-gray-600">
                      {result.subtopicsCount} 个子主题
                    </span>
                    <span className="text-sm text-gray-600">
                      {result.publishedCount || 0} 个已发布
                    </span>
                    <span className="text-sm text-gray-600">
                      {result.duration}ms
                    </span>
                    {result.errors.length > 0 && (
                      <span className="text-sm text-red-600">
                        {result.errors.length} 个错误
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 冲突处理说明 */}
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">🔄 冲突处理说明</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• <strong>相同题目ID：</strong>自动更新现有题目内容，保持ID不变</div>
                <div>• <strong>相同主题ID：</strong>更新主题信息，保持关联关系</div>
                <div>• <strong>相同音频文件：</strong>覆盖现有音频文件，更新URL</div>
                <div>• <strong>翻译数据：</strong>用新翻译覆盖旧翻译内容</div>
                <div>• <strong>草稿同步：</strong>草稿保持草稿状态同步到远程数据库</div>
                <div>• <strong>本地发布：</strong>将草稿移动到本地正式题目表，删除草稿记录</div>
                <div>• <strong>事务安全：</strong>所有操作在事务中执行，确保数据一致性</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
