"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Volume2, Play, Pause, CheckCircle } from "lucide-react";

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

interface VoiceSelectionPanelProps {
  language: string;
  onVoicesSelected: (voices: Voice[]) => void;
  maxSelections?: number;
}

export default function VoiceSelectionPanel({ 
  language, 
  onVoicesSelected, 
  maxSelections = 3 
}: VoiceSelectionPanelProps) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoices, setSelectedVoices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // 获取音色列表
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/shadowing/voices-db?lang=${language}`);
        const data = await response.json();
        
        if (data.success) {
          setVoices(data.voices || []);
        }
      } catch (error) {
        console.error('获取音色失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVoices();
  }, [language]);

  // 音色选择处理
  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoices(prev => {
      const newSelected = new Set(prev);
      
      if (newSelected.has(voiceId)) {
        newSelected.delete(voiceId);
      } else {
        if (newSelected.size >= maxSelections) {
          // 如果已达到最大选择数量，移除第一个选择的音色
          const firstSelected = newSelected.values().next().value;
          if (firstSelected) {
            newSelected.delete(firstSelected);
          }
        }
        newSelected.add(voiceId);
      }
      
      // 通知父组件选中的音色
      const selectedVoiceObjects = voices.filter(v => newSelected.has(v.id));
      onVoicesSelected(selectedVoiceObjects);
      
      return newSelected;
    });
  };

  // 音色试听
  const previewVoice = async (voiceName: string, languageCode: string) => {
    try {
      // 停止当前播放的音频
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      
      setPreviewingVoice(voiceName);
      
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            选择生成音色
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
          <Volume2 className="h-5 w-5" />
          选择生成音色
          <Badge variant="outline" className="ml-2">
            最多选择 {maxSelections} 个
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 已选择的音色 */}
          {selectedVoices.size > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                已选择音色 ({selectedVoices.size}/{maxSelections})
              </h4>
              <div className="flex flex-wrap gap-2">
                {voices
                  .filter(v => selectedVoices.has(v.id))
                  .map(voice => (
                    <Badge key={voice.id} variant="secondary" className="bg-blue-100 text-blue-800">
                      {voice.display_name || voice.name}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* 音色列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {voices.map((voice) => {
              const isSelected = selectedVoices.has(voice.id);
              const isPreviewing = previewingVoice === voice.name;
              
              return (
                <div
                  key={voice.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleVoiceSelect(voice.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        checked={isSelected}
                        onChange={() => handleVoiceSelect(voice.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm truncate">
                          {voice.display_name || voice.name}
                        </h4>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>{voice.language_code}</span>
                          <span>•</span>
                          <span>{voice.ssml_gender}</span>
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
                      </div>
                    </div>
                    
                    {isSelected && (
                      <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </div>
                  
                  {/* 使用场景 */}
                  {voice.useCase && (
                    <div className="mb-2">
                      <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        {voice.useCase}
                      </Badge>
                    </div>
                  )}
                  
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
          
          {voices.length === 0 && (
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
