'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Volume2, Play, Pause, CheckCircle, Settings } from 'lucide-react';

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
  provider?: string;
  useCase?: string;
}

interface CandidateVoiceSelectorProps {
  language: string;
  onCandidateVoicesSet: (voices: Voice[]) => void;
  maxCandidates?: number;
  showLanguageSelector?: boolean; // 新增：是否显示语言选择器
}

export default function CandidateVoiceSelector({
  language,
  onCandidateVoicesSet,
  maxCandidates = 999, // 默认不限制数量
  showLanguageSelector = false, // 默认不显示语言选择器
}: CandidateVoiceSelectorProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [candidateVoices, setCandidateVoices] = useState<Set<string>>(new Set());
  const [selectedLanguage, setSelectedLanguage] = useState<string>(language);
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');

  // 使用 ref 存储回调以避免无限循环
  const onCandidateVoicesSetRef = useRef(onCandidateVoicesSet);
  onCandidateVoicesSetRef.current = onCandidateVoicesSet;

  // 标记是否已初始化
  const initializedRef = useRef(false);

  // 从本地存储加载备选音色（只在组件挂载时执行一次）
  useEffect(() => {
    if (initializedRef.current) return;
    const savedCandidates = localStorage.getItem(`candidateVoices_${language}`);
    if (savedCandidates) {
      try {
        const candidateNames = JSON.parse(savedCandidates);
        setCandidateVoices(new Set(candidateNames));
      } catch (error) {
        console.error('加载备选音色失败:', error);
      }
    }
    initializedRef.current = true;
  }, [language]);

  // 保存备选音色到本地存储
  useEffect(() => {
    if (candidateVoices.size > 0) {
      localStorage.setItem(
        `candidateVoices_${language}`,
        JSON.stringify(Array.from(candidateVoices)),
      );
    } else {
      localStorage.removeItem(`candidateVoices_${language}`);
    }
  }, [candidateVoices, language]);
  const [loading, setLoading] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // 获取音色列表
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setLoading(true);
        const currentLang = showLanguageSelector ? selectedLanguage : language;

        let allVoices: Voice[] = [];

        if (currentLang === 'all') {
          // 获取所有语言的音色（包含韩语）
          const languages = ['zh', 'ja', 'en', 'ko'];
          const promises = languages.map(async (lang) => {
            const response = await fetch(`/api/admin/shadowing/voices-db?lang=${lang}`);
            const data = await response.json();
            return data.success ? data.voices || [] : [];
          });

          const results = await Promise.all(promises);
          allVoices = results.flat();
        } else {
          // 获取特定语言的音色
          const response = await fetch(`/api/admin/shadowing/voices-db?lang=${currentLang}`);
          const data = await response.json();

          if (data.success) {
            allVoices = data.voices || [];
          }
        }

        // 优先显示完整名称的音色，按名称排序
        const sortedVoices = allVoices.sort((a, b) => {
          const aIsFullName = a.name.includes('-') && a.name.split('-').length >= 3;
          const bIsFullName = b.name.includes('-') && b.name.split('-').length >= 3;

          if (aIsFullName && !bIsFullName) return -1;
          if (!aIsFullName && bIsFullName) return 1;
          return a.name.localeCompare(b.name);
        });

        setVoices(sortedVoices);
      } catch (error) {
        console.error('获取音色失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, [language, selectedLanguage, showLanguageSelector]);

  // 备选音色选择处理
  const handleCandidateSelect = (voiceName: string) => {
    setCandidateVoices((prev) => {
      const newCandidates = new Set(prev);

      if (newCandidates.has(voiceName)) {
        newCandidates.delete(voiceName);
      } else {
        // 如果设置了最大数量限制且已达到限制，则不允许继续添加
        if (maxCandidates < 999 && newCandidates.size >= maxCandidates) {
          return prev; // 不添加新音色
        }
        newCandidates.add(voiceName);
      }

      return newCandidates;
    });
  };

  // 使用useEffect来通知父组件，避免在渲染过程中调用
  useEffect(() => {
    if (voices.length === 0) return; // 等待音色加载完成
    const candidateVoiceObjects = voices.filter((v) => candidateVoices.has(v.name));
    onCandidateVoicesSetRef.current(candidateVoiceObjects);
  }, [candidateVoices, voices]);

  // 音色试听
  const previewVoice = async (voiceName: string, languageCode: string) => {
    try {
      // 停止当前播放的音频
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      setPreviewingVoice(voiceName);

      console.log('试听音色:', { voiceName, languageCode });

      const response = await fetch('/api/admin/shadowing/preview-voice-cached', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voiceName,
          languageCode,
        }),
      });

      if (!response.ok) {
        throw new Error('试听失败');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const newAudioElement = new Audio(audioUrl);
      newAudioElement.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };
      newAudioElement.onerror = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };

      setAudioElement(newAudioElement);
      await newAudioElement.play();
    } catch (error) {
      console.error('试听失败:', error);
      setPreviewingVoice(null);
    }
  };

  // 停止试听
  const stopPreview = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setPreviewingVoice(null);
  };

  // 清除所有备选音色
  const clearAllCandidates = () => {
    setCandidateVoices(new Set());
    onCandidateVoicesSet([]);
  };

  // 将简化音色名称映射为完整名称（与preview-voice-cached API保持一致）
  const mapToFullVoiceName = (voiceName: string): string => {
    // 如果已经是完整名称，直接返回
    if (voiceName.includes('-') && voiceName.split('-').length >= 3) {
      return voiceName;
    }

    // 简化名称映射到完整的Google Cloud TTS音色名称
    const simplifiedToFull: Record<string, string> = {
      // Chirp3-HD 音色
      Achernar: 'en-US-Chirp3-HD-Achernar',
      Achird: 'en-US-Chirp3-HD-Achird',
      Algenib: 'en-US-Chirp3-HD-Algenib',
      Algieba: 'en-US-Chirp3-HD-Algieba',
      Alnilam: 'en-US-Chirp3-HD-Alnilam',
      Aoede: 'en-US-Chirp3-HD-Aoede',
      Autonoe: 'en-US-Chirp3-HD-Autonoe',
      Callirrhoe: 'en-US-Chirp3-HD-Callirrhoe',
      Charon: 'en-US-Chirp3-HD-Charon',
      Despina: 'en-US-Chirp3-HD-Despina',
      Enceladus: 'en-US-Chirp3-HD-Enceladus',
      Erinome: 'en-US-Chirp3-HD-Erinome',
      Fenrir: 'en-US-Chirp3-HD-Fenrir',
      Gacrux: 'en-US-Chirp3-HD-Gacrux',
      Iapetus: 'en-US-Chirp3-HD-Iapetus',
      Laomedeia: 'en-US-Chirp3-HD-Laomedeia',
      Leda: 'en-US-Chirp3-HD-Leda',
      Pulcherrima: 'en-US-Chirp3-HD-Pulcherrima',
      Rasalgethi: 'en-US-Chirp3-HD-Rasalgethi',
      Sadachbia: 'en-US-Chirp3-HD-Sadachbia',
      Sadaltager: 'en-US-Chirp3-HD-Sadaltager',
      Schedar: 'en-US-Chirp3-HD-Schedar',
      Sulafat: 'en-US-Chirp3-HD-Sulafat',
      Umbriel: 'en-US-Chirp3-HD-Umbriel',
      Vindemiatrix: 'en-US-Chirp3-HD-Vindemiatrix',
      Zephyr: 'en-US-Chirp3-HD-Zephyr',
      Zubenelgenubi: 'en-US-Chirp3-HD-Zubenelgenubi',

      // 其他音色
      Orus: 'en-US-Chirp3-HD-Orus',
      Puck: 'en-US-Chirp3-HD-Puck',
      Kore: 'en-US-Chirp3-HD-Kore',
    };

    return simplifiedToFull[voiceName] || voiceName;
  };

  // 根据价格范围筛选音色，并统一显示完整名称
  const filteredVoices = voices
    .filter((voice) => {
      if (selectedPriceRange !== 'all') {
        const price = voice.pricing?.pricePerMillionChars || 0;
        switch (selectedPriceRange) {
          case 'free':
            return price === 0;
          case 'low':
            return price > 0 && price <= 5;
          case 'medium':
            return price > 5 && price <= 10;
          case 'high':
            return price > 10 && price <= 20;
          case 'premium':
            return price > 20;
          default:
            return true;
        }
      }
      return true;
    })
    .map((voice) => ({
      ...voice,
      display_name: mapToFullVoiceName(voice.name), // 统一使用完整名称作为显示名称
      name: mapToFullVoiceName(voice.name), // 同时更新实际名称
    }));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            设置备选音色
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">加载音色列表中...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          设置备选音色
          {maxCandidates < 999 && (
            <Badge variant="outline" className="ml-2">
              最多选择 {maxCandidates} 个
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">从备选音色中随机选择，A=男声，B=女声，C+=随机</p>
          <div className="flex items-center gap-2">
            <Badge variant="outline">总音色: {voices.length}</Badge>
            {selectedPriceRange !== 'all' && (
              <Badge variant="secondary">筛选后: {filteredVoices.length}</Badge>
            )}
            <Badge variant="default">已选择: {candidateVoices.size}</Badge>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          {showLanguageSelector && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">选择语言音色</label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文音色</SelectItem>
                  <SelectItem value="ja">日语音色</SelectItem>
                  <SelectItem value="en">英语音色</SelectItem>
                  <SelectItem value="ko">韩语音色</SelectItem>
                  <SelectItem value="all">全部音色</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 价格筛选 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">价格范围筛选</label>
            <Select value={selectedPriceRange} onValueChange={setSelectedPriceRange}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有价格</SelectItem>
                <SelectItem value="free">免费 (0)</SelectItem>
                <SelectItem value="low">经济型 (1-5$/M字符)</SelectItem>
                <SelectItem value="medium">标准型 (6-10$/M字符)</SelectItem>
                <SelectItem value="high">高质量 (11-20$/M字符)</SelectItem>
                <SelectItem value="premium">专业级 (20+$/M字符)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 批量选择按钮 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">批量选择</label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const allVoiceNames = filteredVoices.map((v) => v.name);
                  setCandidateVoices(new Set(allVoiceNames));
                }}
                className="text-xs"
              >
                全选当前筛选
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const maleVoices = filteredVoices
                    .filter((v) => v.ssml_gender === 'MALE')
                    .map((v) => v.name);
                  setCandidateVoices(new Set(maleVoices));
                }}
                className="text-xs"
              >
                全选男声
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const femaleVoices = filteredVoices
                    .filter((v) => v.ssml_gender === 'FEMALE')
                    .map((v) => v.name);
                  setCandidateVoices(new Set(femaleVoices));
                }}
                className="text-xs"
              >
                全选女声
              </Button>
              <Button size="sm" variant="outline" onClick={clearAllCandidates} className="text-xs">
                清除全部
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 已选择的备选音色 */}
          {candidateVoices.size > 0 && (
            <div className="p-3 bg-green-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-green-800">
                  备选音色 ({candidateVoices.size}
                  {maxCandidates < 999 ? `/${maxCandidates}` : ''})
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearAllCandidates}
                  className="text-xs h-6 px-2"
                >
                  清除备选
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {voices
                  .filter((v) => candidateVoices.has(v.name))
                  .map((voice, index) => (
                    <Badge
                      key={voice.id ?? `${voice.name}-${index}`}
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      {mapToFullVoiceName(voice.name)}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* 音色列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredVoices.map((voice, index) => {
              const isCandidate = candidateVoices.has(voice.name);
              const isPreviewing = previewingVoice === voice.name;

              return (
                <div
                  key={voice.id ?? `${voice.name}-${index}`}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${isCandidate ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  onClick={() => handleCandidateSelect(voice.name)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={isCandidate}
                        onChange={() => handleCandidateSelect(voice.name)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm truncate">{voice.display_name}</h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>{voice.language_code}</span>
                          <span>•</span>
                          <span>{voice.ssml_gender}</span>
                          {voice.provider && (
                            <>
                              <span>•</span>
                              <span
                                className={`px-1 py-0.5 rounded text-xs ${voice.provider === 'gemini'
                                    ? 'bg-purple-100 text-purple-700'
                                    : voice.provider === 'xunfei'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                              >
                                {voice.provider === 'gemini'
                                  ? 'Gemini'
                                  : voice.provider === 'xunfei'
                                    ? '科大讯飞'
                                    : 'Google'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isCandidate && (
                      <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                  </div>

                  {/* 使用场景标签 */}
                  <div className="mb-2 flex flex-wrap gap-1">
                    {/* 新闻播报标签 */}
                    {(voice.name.includes('profnews') ||
                      voice.name.includes('xiaoguo') ||
                      voice.name.includes('pengfei') ||
                      voice.display_name?.includes('新闻播报')) && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-red-100 text-red-700 border-red-200"
                        >
                          📰 新闻播报
                        </Badge>
                      )}

                    {/* 对话标签 */}
                    {(voice.name.includes('talk') || voice.display_name?.includes('对话')) && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-purple-100 text-purple-700 border-purple-200"
                      >
                        💬 对话
                      </Badge>
                    )}

                    {/* 情感标签 */}
                    {(voice.name.includes('em') ||
                      voice.name.includes('emo') ||
                      voice.display_name?.includes('情感')) && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-pink-100 text-pink-700 border-pink-200"
                        >
                          😊 情感
                        </Badge>
                      )}

                    {/* 闲聊标签 */}
                    {(voice.name.includes('chat') || voice.display_name?.includes('闲聊')) && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700 border-green-200"
                      >
                        💭 闲聊
                      </Badge>
                    )}

                    {/* 角色标签 */}
                    {(voice.name.includes('boy') ||
                      voice.display_name?.includes('小男孩') ||
                      voice.display_name?.includes('老人')) && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200"
                        >
                          🎭 角色
                        </Badge>
                      )}

                    {/* 高质量标签 */}
                    {(voice.name.includes('Chirp3-HD') ||
                      voice.display_name?.includes('Chirp3-HD')) && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-blue-100 text-blue-700 border-blue-200"
                        >
                          ⭐ 高质量
                        </Badge>
                      )}

                    {/* 基础标签 */}
                    {(voice.name.includes('Standard') ||
                      voice.display_name?.includes('Standard')) && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-gray-100 text-gray-700 border-gray-200"
                        >
                          💰 经济型
                        </Badge>
                      )}

                    {/* 通用useCase标签 */}
                    {voice.useCase &&
                      !voice.name.includes('profnews') &&
                      !voice.name.includes('xiaoguo') &&
                      !voice.name.includes('pengfei') &&
                      !voice.name.includes('talk') &&
                      !voice.name.includes('em') &&
                      !voice.name.includes('chat') &&
                      !voice.name.includes('boy') &&
                      !voice.name.includes('Chirp3-HD') &&
                      !voice.name.includes('Standard') && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {voice.useCase}
                        </Badge>
                      )}
                  </div>

                  {/* 价格信息 */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>${voice.pricing.pricePerMillionChars}/M 字符</span>
                    <span>示例: ${voice.pricing.examplePrice}/1K字符</span>
                  </div>

                  {/* 试听按钮 */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPreviewing) {
                        stopPreview();
                      } else {
                        previewVoice(voice.name, voice.language_code);
                      }
                    }}
                  >
                    {isPreviewing ? (
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
              );
            })}
          </div>

          {filteredVoices.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Volume2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>没有找到可用的音色</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
