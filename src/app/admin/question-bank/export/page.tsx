"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Filter, 
  Download, 
  Upload, 
  Package, 
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

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
  theme_id?: string;
  subtopic_id?: string;
}

interface ExportPackage {
  id: string;
  name: string;
  description: string;
  items: QuestionItem[];
  created_at: string;
  status: 'draft' | 'ready' | 'exported';
}

export default function QuestionBankExportPage() {
  const router = useRouter();
  
  // 状态管理
  const [shadowingItems, setShadowingItems] = useState<QuestionItem[]>([]);
  const [clozeItems, setClozeItems] = useState<QuestionItem[]>([]);
  const [alignmentPacks, setAlignmentPacks] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLang, setSelectedLang] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectAll, setSelectAll] = useState(false);
  
  // 导出包管理
  const [exportPackages, setExportPackages] = useState<ExportPackage[]>([]);
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [packageName, setPackageName] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [remoteDbConfig, setRemoteDbConfig] = useState({
    url: "",
    key: "",
    name: "远程数据库"
  });

  // 获取认证头信息
  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 加载所有题库数据
  const loadAllData = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      // 并行加载所有类型的数据
      const [shadowingRes, clozeRes, alignmentRes] = await Promise.all([
        fetch('/api/admin/shadowing/items', { headers }),
        fetch('/api/admin/cloze/items', { headers }),
        fetch('/api/admin/alignment/packs', { headers })
      ]);

      const shadowingData = shadowingRes.ok ? await shadowingRes.json() : { items: [] };
      const clozeData = clozeRes.ok ? await clozeRes.json() : { items: [] };
      const alignmentData = alignmentRes.ok ? await alignmentRes.json() : { items: [] };

      // 转换数据格式
      const shadowing = (shadowingData.items || []).map((item: any) => ({
        ...item,
        type: 'shadowing' as const
      }));
      
      const cloze = (clozeData.items || []).map((item: any) => ({
        ...item,
        type: 'cloze' as const
      }));
      
      const alignment = (alignmentData.items || []).map((item: any) => ({
        ...item,
        type: 'alignment' as const
      }));

      setShadowingItems(shadowing);
      setClozeItems(cloze);
      setAlignmentPacks(alignment);
      
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有题目
  const getAllItems = (): QuestionItem[] => {
    return [...shadowingItems, ...clozeItems, ...alignmentPacks];
  };

  // 获取筛选后的题目
  const getFilteredItems = (): QuestionItem[] => {
    const allItems = getAllItems();
    return allItems.filter(item => {
      const matchesSearch = !searchQuery || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.text && item.text.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.passage && item.passage.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesLang = selectedLang === 'all' || item.lang === selectedLang;
      const matchesLevel = selectedLevel === 'all' || item.level === parseInt(selectedLevel);
      const matchesType = selectedType === 'all' || item.type === selectedType;
      
      return matchesSearch && matchesLang && matchesLevel && matchesType;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    const filteredItems = getFilteredItems();
    if (selectAll) {
      setSelected({});
      setSelectAll(false);
    } else {
      const newSelected: Record<string, boolean> = {};
      filteredItems.forEach(item => {
        newSelected[item.id] = true;
      });
      setSelected(newSelected);
      setSelectAll(true);
    }
  };

  // 创建导出包
  const createExportPackage = () => {
    const selectedItems = getAllItems().filter(item => selected[item.id]);
    if (selectedItems.length === 0) {
      toast.error('请先选择要导出的题目');
      return;
    }

    const newPackage: ExportPackage = {
      id: Date.now().toString(),
      name: packageName || `导出包_${new Date().toLocaleString()}`,
      description: packageDescription,
      items: selectedItems,
      created_at: new Date().toISOString(),
      status: 'draft'
    };

    setExportPackages(prev => [newPackage, ...prev]);
    setShowCreatePackage(false);
    setPackageName("");
    setPackageDescription("");
    setSelected({});
    setSelectAll(false);
    toast.success(`已创建导出包，包含 ${selectedItems.length} 个题目`);
  };

  // 预览导出包
  const previewPackage = (pkg: ExportPackage) => {
    const stats = {
      total: pkg.items.length,
      byType: pkg.items.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byLang: pkg.items.reduce((acc, item) => {
        acc[item.lang] = (acc[item.lang] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byLevel: pkg.items.reduce((acc, item) => {
        acc[`L${item.level}`] = (acc[`L${item.level}`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return stats;
  };

  // 导出为JSON
  const exportToJSON = (pkg: ExportPackage) => {
    const dataStr = JSON.stringify(pkg, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pkg.name}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('导出包已下载');
  };

  // 同步到远程数据库
  const syncToRemote = async (pkg: ExportPackage) => {
    if (!remoteDbConfig.url || !remoteDbConfig.key) {
      toast.error('请先配置远程数据库连接信息');
      return;
    }

    try {
      const response = await fetch('/api/admin/question-bank/sync-remote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...await getAuthHeaders()
        },
        body: JSON.stringify({
          package: pkg,
          remoteConfig: remoteDbConfig
        })
      });

      if (response.ok) {
        toast.success('同步到远程数据库成功');
        setExportPackages(prev => 
          prev.map(p => p.id === pkg.id ? { ...p, status: 'exported' } : p)
        );
      } else {
        const error = await response.json();
        toast.error(`同步失败: ${error.message}`);
      }
    } catch (error) {
      console.error('同步失败:', error);
      toast.error('同步失败，请检查网络连接');
    }
  };

  // 页面加载时获取数据
  useEffect(() => {
    loadAllData();
  }, []);

  // 更新全选状态
  useEffect(() => {
    const filteredItems = getFilteredItems();
    const selectedCount = filteredItems.filter(item => selected[item.id]).length;
    setSelectAll(selectedCount === filteredItems.length && filteredItems.length > 0);
  }, [selected, searchQuery, selectedLang, selectedLevel, selectedType]);

  const filteredItems = getFilteredItems();
  const selectedCount = filteredItems.filter(item => selected[item.id]).length;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">题库筛选与导出</h1>
        <p className="text-gray-600">筛选本地题库内容，创建导出包并同步到远程数据库</p>
      </div>

      {/* 远程数据库配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            远程数据库配置
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="remote-url">数据库URL</Label>
              <Input
                id="remote-url"
                placeholder="https://your-project.supabase.co"
                value={remoteDbConfig.url}
                onChange={(e) => setRemoteDbConfig(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="remote-key">服务密钥</Label>
              <Input
                id="remote-key"
                type="password"
                placeholder="your-service-role-key"
                value={remoteDbConfig.key}
                onChange={(e) => setRemoteDbConfig(prev => ({ ...prev, key: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="remote-name">数据库名称</Label>
              <Input
                id="remote-name"
                placeholder="远程数据库"
                value={remoteDbConfig.name}
                onChange={(e) => setRemoteDbConfig(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 搜索与筛选区域 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            搜索与筛选
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">搜索关键词</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="搜索标题或内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>语言</Label>
              <Select value={selectedLang} onValueChange={setSelectedLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有语言</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">英文</SelectItem>
                  <SelectItem value="ja">日文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>等级</Label>
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有等级</SelectItem>
                  <SelectItem value="1">L1</SelectItem>
                  <SelectItem value="2">L2</SelectItem>
                  <SelectItem value="3">L3</SelectItem>
                  <SelectItem value="4">L4</SelectItem>
                  <SelectItem value="5">L5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>类型</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有类型</SelectItem>
                  <SelectItem value="shadowing">跟读练习</SelectItem>
                  <SelectItem value="cloze">完形填空</SelectItem>
                  <SelectItem value="alignment">对齐练习</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={loadAllData} 
                variant="outline" 
                className="w-full"
                disabled={loading}
              >
                {loading ? '加载中...' : '刷新数据'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 批量操作区域 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Checkbox
                checked={selectAll}
                onCheckedChange={toggleSelectAll}
                disabled={filteredItems.length === 0}
              />
              <span className="text-sm text-gray-600">
                已选择 {selectedCount} 项 / 共 {filteredItems.length} 项
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelected({});
                  setSelectAll(false);
                }}
                disabled={selectedCount === 0}
              >
                清空选择
              </Button>
              
              <Dialog open={showCreatePackage} onOpenChange={setShowCreatePackage}>
                <DialogTrigger asChild>
                  <Button 
                    disabled={selectedCount === 0}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Package className="w-4 h-4 mr-2" />
                    创建导出包
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>创建导出包</DialogTitle>
                    <DialogDescription>
                      将选中的 {selectedCount} 个题目打包导出
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="package-name">包名称</Label>
                      <Input
                        id="package-name"
                        placeholder="导出包名称"
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="package-desc">描述</Label>
                      <Textarea
                        id="package-desc"
                        placeholder="导出包描述（可选）"
                        value={packageDescription}
                        onChange={(e) => setPackageDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-6">
                    <DialogClose asChild>
                      <Button variant="ghost">取消</Button>
                    </DialogClose>
                    <Button onClick={createExportPackage}>
                      创建导出包
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 题目列表 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>题目列表</CardTitle>
          <CardDescription>
            共 {filteredItems.length} 个题目
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">加载中...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              没有找到符合条件的内容
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selected[item.id] || false}
                      onCheckedChange={(checked) => {
                        setSelected(prev => ({
                          ...prev,
                          [item.id]: checked as boolean
                        }));
                      }}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{item.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{item.lang}</Badge>
                        <Badge variant="outline">L{item.level}</Badge>
                        <Badge variant={
                          item.type === 'shadowing' ? 'default' :
                          item.type === 'cloze' ? 'secondary' : 'destructive'
                        }>
                          {item.type === 'shadowing' ? '跟读' :
                           item.type === 'cloze' ? '完形' : '对齐'}
                        </Badge>
                        <Badge variant={item.status === 'approved' ? 'default' : 'outline'}>
                          {item.status === 'approved' ? '已审核' : '草稿'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 导出包列表 */}
      {exportPackages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>导出包列表</CardTitle>
            <CardDescription>
              已创建的导出包，可以下载或同步到远程数据库
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exportPackages.map((pkg) => {
                const stats = previewPackage(pkg);
                return (
                  <div key={pkg.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-sm text-gray-500">
                          共 {stats.total} 个题目
                        </span>
                        <div className="flex gap-2">
                          {Object.entries(stats.byType).map(([type, count]) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type === 'shadowing' ? '跟读' :
                               type === 'cloze' ? '完形' : '对齐'}: {count}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          {Object.entries(stats.byLang).map(([lang, count]) => (
                            <Badge key={lang} variant="secondary" className="text-xs">
                              {lang}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        pkg.status === 'exported' ? 'default' :
                        pkg.status === 'ready' ? 'secondary' : 'outline'
                      }>
                        {pkg.status === 'exported' ? '已同步' :
                         pkg.status === 'ready' ? '就绪' : '草稿'}
                      </Badge>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => exportToJSON(pkg)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        下载JSON
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncToRemote(pkg)}
                        disabled={pkg.status === 'exported'}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        同步远程
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
