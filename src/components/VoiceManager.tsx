"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, DollarSign, Star, Volume2, Users, Play, Pause } from "lucide-react";

interface Voice {
  name: string;
  displayName?: string;
  languageCode: string;
  ssmlGender: string;
  naturalSampleRateHertz: number;
  supportedEngines: string[];
  supportedModels: string[];
  pricing: {
    pricePerMillionChars: number;
    quality: string;
    description: string;
  };
  examplePrice: string;
  characteristics?: {
    voiceType: string;
    tone: string;
    accent: string;
    speed: string;
    pitch: string;
    emotion: string;
    useCase: string;
    ageRange: string;
    personality: string;
  };
  browserVoice?: SpeechSynthesisVoice; // 保存原始浏览器音色信息
}

interface VoiceRecommendation {
  speaker: string;
  voiceName: string;
  reason: string;
  confidence: number;
}

interface VoiceManagerProps {
  onVoiceSelect: (voice: Voice) => void;
  selectedVoice?: Voice;
  language?: string;
}

export default function VoiceManager({ onVoiceSelect, selectedVoice, language = "zh" }: VoiceManagerProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [groupedVoices, setGroupedVoices] = useState<Record<string, Voice[]>>({});
  const [categorizedVoices, setCategorizedVoices] = useState<Record<string, Voice[]>>({});
  const [loading, setLoading] = useState(true);
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
      
      // 根据音色类型选择不同的处理方式
      const isFreeVoice = voiceName.includes('pyttsx3');
      
      if (isFreeVoice) {
        // pyttsx3音色
        await previewWithPyttsx3(voiceName, languageCode);
      } else {
        // 付费音色使用服务器 TTS
        await previewWithServerTTS(voiceName, languageCode);
      }
      
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

  // 使用pyttsx3 TTS 试听
  const previewWithPyttsx3 = async (voiceName: string, languageCode: string) => {
    try {
      console.log('Starting pyttsx3 TTS preview for:', voiceName, languageCode);
      
      // 获取预览文本
      const previewTexts = {
        'cmn-CN': '你好，这是一个免费的中文语音合成测试。',
        'zh-CN': '你好，这是一个免费的中文语音合成测试。',
        'en-US': 'Hello, this is a free English text-to-speech test.',
        'ja-JP': 'こんにちは、これは無料の日本語音声合成テストです。',
        'multi': 'Hello, this is a multilingual text-to-speech test.'
      };
      
      const text = previewTexts[languageCode as keyof typeof previewTexts] || previewTexts['multi'];
      
      // 调用pyttsx3 API生成音频
      const response = await fetch('/api/admin/shadowing/pyttsx3-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voiceId: voiceName,
          languageCode: languageCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 获取音频数据
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 创建音频元素并播放
      const audio = new Audio(audioUrl);
      setAudioElement(audio);
      
      audio.onloadeddata = () => {
        console.log('pyttsx3 audio loaded, starting playback');
        audio.play().catch(err => {
          console.error('pyttsx3 audio play failed:', err);
          setPlaybackError(`播放失败: ${err.message}`);
        });
      };
      
      audio.onended = () => {
        console.log('pyttsx3 audio playback ended');
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (event) => {
        console.error('pyttsx3 audio error:', event);
        setPlaybackError('pyttsx3音频播放失败');
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };
      
    } catch (error) {
      console.error('pyttsx3 preview error:', error);
      setPlaybackError(`pyttsx3试听失败: ${error instanceof Error ? error.message : String(error)}`);
      setPreviewingVoice(null);
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
    } catch (playError) {
      console.error('Audio play failed:', playError);
      // 如果是自动播放被阻止，提示用户点击播放
      if (playError.name === 'NotAllowedError') {
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
  const fetchVoices = async (lang: string = selectedLanguage, category: string = selectedCategory) => {
    try {
      setLoading(true);
      setError(null);
      
      let allVoices: Voice[] = [];
      
      // 如果是免费音色分类，使用pyttsx3音色
      if (category === "Free" || category === "all") {
        try {
          console.log("获取pyttsx3免费音色...");
          const response = await fetch('/api/admin/shadowing/pyttsx3-voices');
          const data = await response.json();
          
          if (data.success && data.voices) {
            // 转换pyttsx3音色格式为Voice格式
            const pyttsx3Voices: Voice[] = data.voices.map((voice: any, index: number) => {
              const languageCode = voice.languages[0] || 'en-US';
              const isChinese = languageCode.includes('zh') || languageCode.includes('CN');
              
              return {
                name: voice.id,
                displayName: voice.name,
                languageCode: languageCode,
                ssmlGender: voice.gender || 'FEMALE',
                naturalSampleRateHertz: 22050,
                supportedEngines: ['pyttsx3'],
                supportedModels: ['pyttsx3-tts'],
                pricing: {
                  pricePerMillionChars: 0.00,
                  quality: '免费质量',
                  description: '完全免费，使用pyttsx3开源TTS'
                },
                examplePrice: '完全免费',
                characteristics: {
                  voiceType: 'pyttsx3 TTS',
                  tone: voice.gender === 'FEMALE' ? '中高音' : '中低音',
                  accent: isChinese ? '标准普通话' : '标准英语',
                  speed: '中等',
                  pitch: '自然',
                  emotion: '中性',
                  useCase: '通用',
                  ageRange: '通用',
                  personality: '自然',
                  description: `pyttsx3开源音色 - ${voice.name}`
                },
                source: 'pyttsx3',
                model: 'pyttsx3-tts'
              };
            });
            
            // 根据语言过滤
            const filteredVoices = pyttsx3Voices.filter(voice => {
              if (lang !== "all") {
                if (lang === "cmn-CN" && voice.languageCode.includes('zh')) return true;
                if (lang === voice.languageCode) return true;
                return false;
              }
              return true;
            });
            
            allVoices = filteredVoices;
            console.log("使用pyttsx3音色:", filteredVoices.length, "个");
            console.log("pyttsx3音色列表:", filteredVoices.map(v => `${v.displayName} (${v.languageCode})`));
          } else {
            console.log("未获取到pyttsx3音色，显示空列表");
            allVoices = [];
          }
        } catch (error) {
          console.warn("获取pyttsx3音色失败:", error);
          allVoices = [];
        }
      } else {
        // 其他分类从服务器API获取
        const params = new URLSearchParams();
        if (lang !== "all") params.append("lang", lang);
        if (category !== "all") params.append("category", category);
        
        const response = await fetch(`/api/admin/shadowing/voices?${params}`);
        const data = await response.json();
        
        if (data.success) {
          allVoices = data.voices;
        }
      }
      
      console.log("音色数据加载成功:", allVoices.length, "个音色");
      setVoices(allVoices);
      
      // 重新分组
      const grouped = allVoices.reduce((acc: Record<string, Voice[]>, voice) => {
        const langCode = voice.languageCode;
        if (!acc[langCode]) acc[langCode] = [];
        acc[langCode].push(voice);
        return acc;
      }, {});
      setGroupedVoices(grouped);
      
      // 重新分类
      const categorized = allVoices.reduce((acc: Record<string, Voice[]>, voice) => {
        const name = voice.name;
        let category = 'Other';
        if (name.includes('pyttsx3') || name.includes('Free') || name.includes('free')) {
          category = 'Free';
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
      
    } catch (err) {
      console.error("音色数据加载失败:", err);
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
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
    } catch (err) {
      setError("AI 推荐失败，请重试");
    } finally {
      setRecommending(false);
    }
  };

  useEffect(() => {
    fetchVoices(selectedLanguage, selectedCategory);
  }, [selectedLanguage, selectedCategory]);

  // 过滤音色
  const filteredVoices = voices.filter(voice => 
    voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    voice.languageCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 获取当前显示的音色列表
  const displayVoices = selectedCategory === "all" ? filteredVoices : 
    voices.filter(voice => 
      voice.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voice.languageCode.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // 调试信息
  console.log("VoiceManager 状态:", {
    voices: voices.length,
    selectedCategory,
    selectedLanguage,
    categorizedVoices: Object.keys(categorizedVoices),
    displayVoices: displayVoices.length,
    loading,
    error
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
                  <SelectItem value="Free">🆓 免费音色 (完全免费)</SelectItem>
                  <SelectItem value="Chirp3-HD">Chirp3-HD (最高质量)</SelectItem>
                  <SelectItem value="Neural2">Neural2 (高质量)</SelectItem>
                  <SelectItem value="Wavenet">Wavenet (标准质量)</SelectItem>
                  <SelectItem value="Standard">Standard (基础质量)</SelectItem>
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
                <div key={index} className="p-3 border rounded-lg bg-muted/50">
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
                        <h4 className="font-medium text-sm">{voice.displayName || voice.name}</h4>
                        <div className="flex items-center gap-1">
                          {voice.pricing.pricePerMillionChars === 0 && (
                            <Badge variant="default" className="bg-green-600 text-white">
                              🆓 免费
                            </Badge>
                          )}
                          <Badge variant={voice.pricing.quality === '最高质量' ? 'default' : voice.pricing.quality === '免费质量' ? 'secondary' : 'secondary'}>
                            {voice.pricing.quality}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{voice.languageCode}</span>
                        <span>•</span>
                        <span>{voice.ssmlGender}</span>
                        <span>•</span>
                        <span>{voice.naturalSampleRateHertz}Hz</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {voice.pricing.pricePerMillionChars === 0 ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <span className="text-lg">🆓</span>
                              <span className="text-xs font-medium">完全免费</span>
                            </div>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3" />
                              <span className="text-xs">
                                ${voice.pricing.pricePerMillionChars}/M 字符
                              </span>
                              <span className="text-xs text-muted-foreground">
                                (示例: ${voice.examplePrice}/1K字符)
                              </span>
                            </>
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
                              previewVoice(voice.name, voice.languageCode);
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
                      
                      <p className="text-xs text-muted-foreground">
                        {voice.pricing.description}
                      </p>
                      
                      {/* 音色特征信息 */}
                      {voice.characteristics && (
                        <div className="mt-2 space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <Badge key="voiceType" variant="outline" className="text-xs">
                              {voice.characteristics.voiceType}
                            </Badge>
                            <Badge key="tone" variant="outline" className="text-xs">
                              {voice.characteristics.tone}
                            </Badge>
                            <Badge key="accent" variant="outline" className="text-xs">
                              {voice.characteristics.accent}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">音调:</span> {voice.characteristics.pitch} | 
                            <span className="font-medium"> 语速:</span> {voice.characteristics.speed} | 
                            <span className="font-medium"> 情感:</span> {voice.characteristics.emotion}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">适用场景:</span> {voice.characteristics.useCase}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">年龄范围:</span> {voice.characteristics.ageRange} | 
                            <span className="font-medium"> 性格:</span> {voice.characteristics.personality}
                          </div>
                        </div>
                      )}
                      
                      {voice.supportedModels && voice.supportedModels.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {voice.supportedModels.slice(0, 2).map((model, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
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
