"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, DollarSign, Volume2, Users, Play, Pause } from "lucide-react";

/**
 * 音色接口定义
 * 包含音色的所有属性和元数据
 */
interface Voice {
  id: string;
  name: string;
  display_name?: string;
  language_code: string;
  ssml_gender: string;
  natural_sample_rate_hertz: number;
  pricing: {
    pricePerMillionChars: number;
    examplePrice: string;
    examplePrice10k?: string;
  };
  characteristics?: {
    voiceType: string;
    tone: string;
    pitch: string;
  };
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  provider?: string;
  useCase?: string; // 使用场景描述，由API动态生成
  // 兼容旧字段
  languageCode?: string;
  supportedModels?: string[];
  ssmlGender?: string;
  naturalSampleRateHertz?: number;
  displayName?: string;
  examplePrice?: string;
  examplePrice10k?: string;
  browserVoice?: SpeechSynthesisVoice;
}

interface VoiceRecommendation {
  speaker: string;
  voiceName: string;
  reason: string;
  confidence: number;
  languageCode?: string;
}

interface VoiceManagerProps {
  onVoiceSelect: (voice: Voice) => void;
  selectedVoice?: Voice;
  language?: string;
}

/**
 * 音色管理器组件
 * 功能：
 * 1. 显示和管理所有可用音色
 * 2. 支持语言和分类筛选
 * 3. 提供音色试听功能
 * 4. 显示音色使用场景和特征
 * 5. 支持AI推荐音色
 */
export default function VoiceManager({ onVoiceSelect, selectedVoice, language = "zh" }: VoiceManagerProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [categorizedVoices, setCategorizedVoices] = useState<Record<string, Voice[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLanguage, setSelectedLanguage] = useState(
    language === "zh" ? "cmn-CN" : 
    language === "ja" ? "ja-JP" : 
    language === "en" ? "en-US" : 
    "all"
  );
  const [searchTerm, setSearchTerm] = useState("");
  
  // AI 推荐相关状态
  const [recommendationText, setRecommendationText] = useState("");
  const [recommendations, setRecommendations] = useState<VoiceRecommendation[]>([]);
  const [recommending, setRecommending] = useState(false);
  
  // 试听功能状态
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  


  // 试听音色
  const previewVoice = async (voiceName: string, languageCode: string) => {
    try {
      // 停止当前播放的音频
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      
      setPreviewingVoice(voiceName);
      setPlaybackError(null);
      
      console.log('Starting preview for:', voiceName, languageCode);
      
      // 使用服务器 TTS 试听
      await previewWithServerTTS(voiceName, languageCode);
      
    } catch (error) {
      console.error('Preview error:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setPreviewingVoice(null);
      setPlaybackError(`试听失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };


  // 使用服务器 TTS 试听
  const previewWithServerTTS = async (voiceName: string, languageCode: string) => {
    const response = await fetch('/api/admin/shadowing/preview-voice-cached', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voiceName,
        languageCode
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, response.statusText, errorText);
      throw new Error(`Failed to generate preview: ${response.status} ${response.statusText}`);
    }
    
    const audioBlob = await response.blob();
    console.log('Audio blob size:', audioBlob.size);
    const audioUrl = URL.createObjectURL(audioBlob);
    console.log('Audio URL created:', audioUrl);
    
    const newAudioElement = new Audio(audioUrl);
    newAudioElement.onended = () => {
      console.log('Audio playback ended');
      setPreviewingVoice(null);
      URL.revokeObjectURL(audioUrl);
    };
    newAudioElement.onerror = (error) => {
      console.error('Audio playback error:', error);
      setPreviewingVoice(null);
      URL.revokeObjectURL(audioUrl);
    };
    newAudioElement.onloadstart = () => {
      console.log('Audio loading started');
    };
    newAudioElement.oncanplay = () => {
      console.log('Audio can play');
    };
    
    setAudioElement(newAudioElement);
    console.log('Starting audio playback...');
    
    try {
      await newAudioElement.play();
      console.log('Audio playback started successfully');
    } catch (playError: unknown) {
      console.error('Audio play failed:', playError);
      // 如果是自动播放被阻止，提示用户点击播放
      if (playError && typeof playError === 'object' && 'name' in playError && playError.name === 'NotAllowedError') {
        console.log('Autoplay blocked, user interaction required');
        setPlaybackError('浏览器阻止了自动播放，请点击播放按钮');
      }
      throw playError;
    }
  };
  
  // 停止试听
  const stopPreview = () => {
    // 停止服务器 TTS
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    
    // 停止浏览器 TTS
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
    
    setPreviewingVoice(null);
  };

  // 获取音色列表
  const fetchVoices = useCallback(async (lang: string = selectedLanguage, category: string = selectedCategory) => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用数据库API获取音色
      const params = new URLSearchParams();
      params.append("lang", lang);
      if (category !== "all") params.append("category", category);
      
      console.log("fetchVoices调用参数:", { lang, category, selectedLanguage, selectedCategory });
      
      const response = await fetch(`/api/admin/shadowing/voices-db?${params}`);
      const data = await response.json();
      
      if (data.success) {
        const allVoices = data.voices || [];
        console.log("从数据库获取音色成功:", allVoices.length, "个音色");
        console.log("音色数据示例:", allVoices.slice(0, 3));
        console.log("语言分布:", data.groupedByLanguage);
        console.log("分类分布:", Object.keys(data.categorizedVoices || {}).reduce((acc: Record<string, number>, key: string) => {
          acc[key] = data.categorizedVoices[key].length;
          return acc;
        }, {}));
        setVoices(allVoices);
        
        // 重新分类
        const categorized = allVoices.reduce((acc: Record<string, Voice[]>, voice: Voice) => {
          const name = voice.name;
          const provider = voice.provider || '';
          let category = 'Other';
          
          if (provider === 'xunfei') {
            // 科大讯飞音色按性别分类
            const gender = voice.ssml_gender || '';
            if (gender.toLowerCase().includes('female') || gender.toLowerCase().includes('女')) {
              category = 'Xunfei-Female';
            } else if (gender.toLowerCase().includes('male') || gender.toLowerCase().includes('男')) {
              category = 'Xunfei-Male';
            } else {
              category = 'Xunfei-Female'; // 默认女声
            }
          } else if (name.includes('Chirp3-HD')) {
            category = 'Chirp3-HD';
          } else if (name.includes('Neural2')) {
            category = 'Neural2';
          } else if (name.includes('Wavenet')) {
            category = 'Wavenet';
          } else if (name.includes('Standard')) {
            category = 'Standard';
          }
          
          if (!acc[category]) acc[category] = [];
          acc[category].push(voice);
          return acc;
        }, {});
        setCategorizedVoices(categorized);
      }
      
    } catch (err) {
      console.error("音色数据加载失败:", err);
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, selectedCategory]);

  // 设置数据库
  const setupDatabase = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      console.log("开始设置数据库...");
      const response = await fetch("/api/admin/setup-database-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("数据库设置成功:", data.message);
        console.log("添加的Gemini音色:", data.geminiVoicesAdded);
        console.log("提供商分布:", data.providerCounts);
        
        // 设置成功后重新获取音色列表
        await fetchVoices(selectedLanguage, selectedCategory);
        
        // 显示成功消息
        setError(null);
      } else {
        console.error("数据库设置失败:", data.error);
        setError(`设置失败: ${data.error}`);
      }
    } catch (err) {
      console.error("数据库设置失败:", err);
      setError("设置失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  // 恢复所有音色
  const restoreAllVoices = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      console.log("开始恢复所有音色...");
      const response = await fetch("/api/admin/restore-all-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("音色恢复成功:", data.message);
        console.log("Google音色:", data.googleVoices);
        console.log("Gemini音色:", data.geminiVoices);
        console.log("语言分布:", data.stats);
        console.log("提供商分布:", data.providerStats);
        
        // 恢复成功后重新获取音色列表
        await fetchVoices(selectedLanguage, selectedCategory);
        
        // 显示成功消息
        setError(null);
      } else {
        console.error("音色恢复失败:", data.error);
        setError(`恢复失败: ${data.error}`);
      }
    } catch (err) {
      console.error("音色恢复失败:", err);
      setError("恢复失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  // 同步音色数据
  const syncVoices = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      console.log("开始同步音色数据...");
      const response = await fetch("/api/admin/shadowing/sync-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("音色同步成功:", data.message);
        console.log("同步统计:", data.stats);
        
        // 同步成功后重新获取音色列表
        await fetchVoices(selectedLanguage, selectedCategory);
        
        // 显示成功消息
        setError(null);
      } else {
        console.error("音色同步失败:", data.error);
        setError(`同步失败: ${data.error}`);
      }
    } catch (err) {
      console.error("音色同步失败:", err);
      setError("同步失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  // 同步科大讯飞音色到数据库
  const syncXunfeiVoices = async () => {
    try {
      setSyncing(true);
      setError(null);
      
      console.log("开始同步科大讯飞音色...");
      const response = await fetch("/api/admin/shadowing/sync-xunfei-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("科大讯飞音色同步成功:", data.message);
        console.log("同步数量:", data.count);
        
        // 同步成功后重新获取音色列表
        await fetchVoices(selectedLanguage, selectedCategory);
        
        // 显示成功消息
        setError(null);
      } else {
        console.error("科大讯飞音色同步失败:", data.error);
        setError(`科大讯飞音色同步失败: ${data.error}`);
      }
    } catch (err) {
      console.error("科大讯飞音色同步失败:", err);
      setError("科大讯飞音色同步失败，请重试");
    } finally {
      setSyncing(false);
    }
  };

  // AI 推荐音色
  const recommendVoices = async () => {
    if (!recommendationText.trim()) return;
    
    try {
      setRecommending(true);
      const response = await fetch("/api/admin/shadowing/recommend-voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: recommendationText,
          language: selectedLanguage,
          context: "语音合成"
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
      } else {
        setError(data.error || "AI 推荐失败");
      }
    } catch {
      setError("AI 推荐失败，请重试");
    } finally {
      setRecommending(false);
    }
  };

  useEffect(() => {
    fetchVoices(selectedLanguage, selectedCategory);
  }, [fetchVoices, selectedLanguage, selectedCategory]);

  // 过滤音色
  const filteredVoices = voices.filter(voice => 
    voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (voice.language_code || voice.languageCode || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 获取当前显示的音色列表
  const displayVoices = selectedCategory === "all" ? filteredVoices : 
    filteredVoices.filter(voice => {
      // 使用数据库的category字段进行筛选
      return voice.category === selectedCategory;
    });

  // 调试信息
  console.log("VoiceManager 状态:", {
    voices: voices.length,
    selectedCategory,
    selectedLanguage,
    categorizedVoices: Object.keys(categorizedVoices),
    displayVoices: displayVoices.length,
    filteredVoices: filteredVoices.length,
    searchTerm,
    loading,
    error
  });
  
  // 详细分类信息 - 按价格和性别分类
  console.log("分类详情:", {
    'Xunfei-Female': voices.filter(v => v.category === 'Xunfei-Female').length,
    'Xunfei-Male': voices.filter(v => v.category === 'Xunfei-Male').length,
    'Chirp3HD-Female': voices.filter(v => v.category === 'Chirp3HD-Female').length,
    'Chirp3HD-Male': voices.filter(v => v.category === 'Chirp3HD-Male').length,
    'Neural2-Female': voices.filter(v => v.category === 'Neural2-Female').length,
    'Neural2-Male': voices.filter(v => v.category === 'Neural2-Male').length,
    'Wavenet-Female': voices.filter(v => v.category === 'Wavenet-Female').length,
    'Wavenet-Male': voices.filter(v => v.category === 'Wavenet-Male').length,
    'Standard-Female': voices.filter(v => v.category === 'Standard-Female').length,
    'Standard-Male': voices.filter(v => v.category === 'Standard-Male').length,
    'Other-Female': voices.filter(v => v.category === 'Other-Female').length,
    'Other-Male': voices.filter(v => v.category === 'Other-Male').length
  });

  return (
    <div className="space-y-6">
      {/* 控制面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            音色管理器
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="language">语言</Label>
              <Select value={selectedLanguage} onValueChange={(value) => {
                setSelectedLanguage(value);
                fetchVoices(value, selectedCategory);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有语言</SelectItem>
                  <SelectItem value="cmn-CN">中文</SelectItem>
                  <SelectItem value="en-US">英语</SelectItem>
                  <SelectItem value="ja-JP">日语</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category">质量分类</Label>
              <Select value={selectedCategory} onValueChange={(value) => {
                setSelectedCategory(value);
                fetchVoices(selectedLanguage, value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分类</SelectItem>
                  
                  {/* Gemini TTS 系列 - AI增强 */}
                  <SelectItem value="Gemini-Female">Gemini 女声 (AI增强)</SelectItem>
                  <SelectItem value="Gemini-Male">Gemini 男声 (AI增强)</SelectItem>
                  
                  {/* 科大讯飞系列 - 中文专业 */}
                  <SelectItem value="Xunfei-Female">科大讯飞 女声 (中文专业)</SelectItem>
                  <SelectItem value="Xunfei-Male">科大讯飞 男声 (中文专业)</SelectItem>
                  
                  {/* Chirp3-HD 系列 - 最高质量 */}
                  <SelectItem value="Chirp3HD-Female">Chirp3-HD 女声 (最高质量)</SelectItem>
                  <SelectItem value="Chirp3HD-Male">Chirp3-HD 男声 (最高质量)</SelectItem>
                  
                  {/* Neural2 系列 - 高质量 */}
                  <SelectItem value="Neural2-Female">Neural2 女声 (高质量)</SelectItem>
                  <SelectItem value="Neural2-Male">Neural2 男声 (高质量)</SelectItem>
                  
                  {/* Wavenet 系列 - 中高质量 */}
                  <SelectItem value="Wavenet-Female">Wavenet 女声 (中高质量)</SelectItem>
                  <SelectItem value="Wavenet-Male">Wavenet 男声 (中高质量)</SelectItem>
                  
                  {/* Standard 系列 - 基础质量 */}
                  <SelectItem value="Standard-Female">Standard 女声 (基础质量)</SelectItem>
                  <SelectItem value="Standard-Male">Standard 男声 (基础质量)</SelectItem>
                  
                  {/* 其他 */}
                  <SelectItem value="Other-Female">其他 女声</SelectItem>
                  <SelectItem value="Other-Male">其他 男声</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="search">搜索音色</Label>
              <Input
                id="search"
                placeholder="搜索音色名称..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => fetchVoices()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新列表
            </Button>
            <Button onClick={restoreAllVoices} disabled={syncing || loading} variant="outline" className="bg-green-100 hover:bg-green-200">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              恢复所有音色
            </Button>
            <Button onClick={setupDatabase} disabled={syncing || loading} variant="outline" className="bg-purple-100 hover:bg-purple-200">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              设置数据库
            </Button>
            <Button onClick={syncVoices} disabled={syncing || loading} variant="outline">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              同步音色
            </Button>
            <Button onClick={syncXunfeiVoices} disabled={syncing || loading} variant="outline" className="bg-blue-100 hover:bg-blue-200">
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              同步科大讯飞
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI 推荐面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            AI 音色推荐
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recommendation-text">输入对话内容</Label>
            <Textarea
              id="recommendation-text"
              placeholder="输入对话内容，AI 将为你推荐最合适的音色..."
              value={recommendationText}
              onChange={(e) => setRecommendationText(e.target.value)}
              rows={3}
            />
          </div>
          
          <Button 
            onClick={recommendVoices} 
            disabled={recommending || !recommendationText.trim()}
            className="w-full"
          >
            {recommending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            AI 推荐音色
          </Button>
          
          {recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">推荐结果：</h4>
              {recommendations.map((rec, index) => (
                <div key={`recommendation-${rec.speaker}-${rec.voiceName}-${index}`} className="p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rec.speaker}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{rec.voiceName}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          if (previewingVoice === rec.voiceName) {
                            stopPreview();
                          } else {
                            previewVoice(rec.voiceName, rec.languageCode || 'en-US');
                          }
                        }}
                        disabled={loading}
                      >
                        {previewingVoice === rec.voiceName ? (
                          <>
                            <Pause className="h-3 w-3 mr-1" />
                            停止
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            试听
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 音色列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>可用音色 ({displayVoices.length})</span>
            {selectedCategory !== "all" && (
              <Badge variant="outline">{selectedCategory}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">加载音色列表...</span>
            </div>
          ) : error ? (
            <Alert>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : playbackError ? (
            <Alert>
              <AlertDescription>{playbackError}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayVoices.map((voice) => (
                <Card 
                  key={voice.name} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedVoice?.name === voice.name ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onVoiceSelect(voice)}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm truncate flex-1 mr-2">{voice.display_name || voice.displayName || voice.name}</h4>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {voice.category}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{voice.language_code || voice.languageCode}</span>
                        <span>•</span>
                        <span>{voice.ssml_gender || voice.ssmlGender}</span>
                        <span>•</span>
                        <span>{voice.natural_sample_rate_hertz || voice.naturalSampleRateHertz}Hz</span>
                        {voice.provider && (
                          <>
                            <span>•</span>
                            <span className={`px-1 py-0.5 rounded text-xs ${
                              voice.provider === 'gemini' 
                                ? 'bg-purple-100 text-purple-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {voice.provider === 'gemini' ? 'Gemini' : 'Google'}
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-xs">
                            ${voice.pricing.pricePerMillionChars}/M 字符
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (示例: ${voice.examplePrice}/1K字符)
                          </span>
                          {voice.examplePrice10k && (
                            <span className="text-xs text-muted-foreground">
                              (${voice.examplePrice10k}/10K字符)
                            </span>
                          )}
                        </div>
                        
                        {/* 试听按钮 */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation(); // 阻止卡片点击事件
                            if (previewingVoice === voice.name) {
                              stopPreview();
                            } else {
                              previewVoice(voice.name, voice.language_code || voice.languageCode || 'zh-CN');
                            }
                          }}
                          disabled={loading}
                        >
                          {previewingVoice === voice.name ? (
                            <>
                              <Pause className="h-3 w-3 mr-1" />
                              停止
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1" />
                              试听
                            </>
                          )}
                        </Button>
                      </div>
                      
                      {/* 使用场景 */}
                      {voice.useCase && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-blue-600">使用场景:</span>
                            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {voice.useCase}
                            </Badge>
                          </div>
                        </div>
                      )}
                      
                      {/* 只显示基础特征，去掉自定义描述 */}
                      {voice.characteristics && (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <Badge key="voiceType" variant="outline" className="text-xs">
                              {voice.characteristics.voiceType}
                            </Badge>
                            <Badge key="tone" variant="outline" className="text-xs">
                              {voice.characteristics.tone}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">音调:</span> {voice.characteristics.pitch}
                          </div>
                        </div>
                      )}
                      
                      {voice.supportedModels && voice.supportedModels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {voice.supportedModels.slice(0, 2).map((model: string, index: number) => (
                            <Badge key={`model-${voice.name}-${model}-${index}`} variant="outline" className="text-xs">
                              {model}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
