'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  DollarSign,
  Users,
  Volume2,
  Calculator,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';

interface Voice {
  id: string;
  name: string;
  display_name?: string;
  language_code: string;
  ssml_gender: string;
  pricing: {
    pricePerMillionChars: number;
    examplePrice: string;
    examplePrice10k?: string;
  };
  provider?: string;
  useCase?: string;
}

interface Speaker {
  name: string;
  description: string;
  recommendedVoice: string;
  reason: string;
}

interface GenerationConfirmationProps {
  text: string;
  language: string;
  speakers: Speaker[];
  isDialogue: boolean;
  selectedVoices: Voice[];
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function GenerationConfirmation({
  text,
  language,
  speakers,
  isDialogue,
  selectedVoices,
  onConfirm,
  onCancel,
  loading = false,
}: GenerationConfirmationProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // 计算费用
  const calculateCost = () => {
    const textLength = text.length;
    const totalCost = selectedVoices.reduce((total, voice) => {
      const cost = (textLength / 1000000) * voice.pricing.pricePerMillionChars;
      return total + cost;
    }, 0);

    return {
      textLength,
      totalCost,
      costPerVoice: selectedVoices.map((voice) => ({
        voice: voice.display_name || voice.name,
        cost: (textLength / 1000000) * voice.pricing.pricePerMillionChars,
      })),
    };
  };

  const costInfo = calculateCost();

  // 音色试听
  const previewVoice = async (voiceName: string, languageCode: string) => {
    try {
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

  const stopPreview = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    setPreviewingVoice(null);
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          确认生成参数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 内容预览 */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            内容预览
          </h3>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">
              语言: {language === 'zh' ? '中文' : language === 'en' ? '英文' : '日文'} | 类型:{' '}
              {isDialogue ? '对话' : '独白'} | 字符数: {costInfo.textLength}
            </p>
            <div className="max-h-32 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap">{text}</p>
            </div>
          </div>
        </div>

        {/* 音色分配 */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            AI音色分析结果
          </h3>
          <div className="space-y-3">
            {speakers.map((speaker, index) => {
              const voice = selectedVoices.find((v) => v.name === speaker.recommendedVoice);
              const isPreviewing = previewingVoice === speaker.recommendedVoice;

              return (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{speaker.name}</Badge>
                        <span className="text-sm text-gray-600">
                          {voice?.display_name || speaker.recommendedVoice}
                        </span>
                        {voice?.provider && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              voice.provider === 'gemini'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {voice.provider === 'gemini' ? 'Gemini' : 'Google'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{speaker.description}</p>
                      <p className="text-xs text-blue-600">{speaker.reason}</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        if (isPreviewing) {
                          stopPreview();
                        } else {
                          previewVoice(speaker.recommendedVoice, language);
                        }
                      }}
                    >
                      {isPreviewing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 费用计算 */}
        <div>
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            费用预估
          </h3>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="space-y-2">
              {costInfo.costPerVoice.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>{item.voice}</span>
                  <span className="font-medium">${item.cost.toFixed(4)}</span>
                </div>
              ))}
              <hr className="my-2" />
              <div className="flex justify-between font-medium">
                <span>总计</span>
                <span className="text-lg">${costInfo.totalCost.toFixed(4)}</span>
              </div>
            </div>

            <Alert className="mt-3">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                费用基于文本长度和音色价格计算。实际费用可能因TTS服务商定价变化而有所不同。
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                生成中...
              </>
            ) : (
              <>
                <DollarSign className="h-4 w-4 mr-2" />
                确认生成 (${costInfo.totalCost.toFixed(4)})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
