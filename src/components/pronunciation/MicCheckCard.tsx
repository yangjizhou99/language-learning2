'use client';

// =====================================================
// 麦克风自检组件
// Azure SDK 直接录音评测 → 显示分数 → 手动下一步
// =====================================================

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, CheckCircle2, XCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { supabase } from '@/lib/supabase';
import type { TokenResponse } from '@/types/pronunciation';

interface MicCheckCardProps {
  lang?: 'zh-CN' | 'en-US' | 'ja-JP';
  onSuccess?: () => void;
}

type CheckStatus = 'idle' | 'recording' | 'evaluated';

export default function MicCheckCard({ lang = 'zh-CN', onSuccess }: MicCheckCardProps) {
  const [status, setStatus] = useState<CheckStatus>('idle');
  const [score, setScore] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 测试句子
  const testSentences = {
    'zh-CN': '你好世界',
    'en-US': 'Hello world',
    'ja-JP': 'こんにちは',
  };

  const testSentence = testSentences[lang];

  /**
   * 获取 Token
   */
  const fetchToken = async (): Promise<TokenResponse> => {
    // 获取 session token
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch('/api/speech/token', {
      headers,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error('获取 Token 失败');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '获取 Token 失败');
    }

    return {
      token: data.token,
      region: data.region,
      expiresAt: data.expiresAt,
    };
  };

  /**
   * 创建语音识别器
   */
  const createRecognizer = (
    token: string,
    region: string,
    language: string,
    referenceText: string
  ) => {
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = language;

    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 配置发音评测
    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true // 启用误读检测
    );

    pronunciationConfig.applyTo(recognizer);

    return recognizer;
  };

  /**
   * 执行录音评测
   */
  const handleCheck = async () => {
    setStatus('recording');
    setScore(null);
    setErrorMsg('');

    try {
      // 1. 获取 Token
      const { token, region } = await fetchToken();

      // 2. 创建识别器
      const recognizer = createRecognizer(token, region, lang, testSentence);

      // 3. 执行识别并评分
      const pronScore = await new Promise<number>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            try {
              const pa = sdk.PronunciationAssessmentResult.fromResult(result);
              recognizer.close();
              resolve(pa.pronunciationScore);
            } catch (err) {
              recognizer.close();
              reject(err);
            }
          },
          (err) => {
            recognizer.close();
            reject(new Error(err));
          }
        );
      });

      setScore(pronScore);
      setStatus('evaluated');
    } catch (error) {
      console.error('录音评测失败:', error);
      setStatus('idle');
      setErrorMsg(error instanceof Error ? error.message : '未知错误');
    }
  };

  /**
   * 重新测试
   */
  const handleReset = () => {
    setScore(null);
    setErrorMsg('');
    setStatus('idle');
  };

  /**
   * 进入下一步
   */
  const handleNext = () => {
    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          麦克风自检
        </CardTitle>
        <CardDescription>
          点击按钮，朗读句子，立即查看评分
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 测试句子 */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            请朗读：
          </div>
          <div className="text-2xl font-medium text-gray-900 dark:text-gray-100">
            {testSentence}
          </div>
        </div>

        {/* 操作按钮 */}
        {status === 'idle' && (
          <Button onClick={handleCheck} className="w-full" size="lg">
            <Mic className="w-5 h-5 mr-2" />
            开始录音评测
          </Button>
        )}

        {status === 'recording' && (
          <div className="flex flex-col items-center justify-center p-6 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <div className="text-center">
              <div className="font-medium text-gray-900 dark:text-gray-100">
                正在录音和评测...
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                请开始朗读，读完自动停止
              </div>
            </div>
          </div>
        )}

        {/* 评测结果 */}
        {status === 'evaluated' && score !== null && (
          <>
            <div className={`flex items-center gap-3 p-4 rounded-lg border ${
              score >= 60 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}>
              {score >= 60 ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className={`font-medium ${
                  score >= 60 
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-orange-900 dark:text-orange-100'
                }`}>
                  {score >= 60 ? '麦克风工作正常' : '建议重新测试'}
                </div>
                <div className={`text-sm ${
                  score >= 60 
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-orange-700 dark:text-orange-300'
                }`}>
                  发音分数: {score.toFixed(1)} / 100
                  {score < 60 && ' (建议 ≥ 60)'}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button onClick={handleReset} variant="outline" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                重新测试
              </Button>
              <Button onClick={handleNext} className="flex-1" size="lg">
                <ArrowRight className="w-5 h-5 mr-2" />
                进入练习
              </Button>
            </div>
          </>
        )}

        {/* 错误提示 */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-red-900 dark:text-red-100">
                出错了
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {errorMsg}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

