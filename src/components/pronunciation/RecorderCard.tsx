'use client';

// =====================================================
// 录音评测组件
// 读取句子并异步评测，显示结果
// =====================================================

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { supabase } from '@/lib/supabase';
import type { TokenResponse, AttemptResponse } from '@/types/pronunciation';

interface RecorderCardProps {
  sentence: {
    id: number;
    text: string;
  };
  lang?: 'zh-CN' | 'en-US' | 'ja-JP';
  onComplete?: (result: AttemptResponse) => void;
}

export default function RecorderCard({ sentence, lang = 'zh-CN', onComplete }: RecorderCardProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<AttemptResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

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
   * 创建语音识别器（使用麦克风录音然后上传到服务器处理）
   */
  const createRecognizer = async (
    token: string,
    region: string,
    language: string,
    referenceText: string
  ) => {
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    speechConfig.speechRecognitionLanguage = language;
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;
    speechConfig.requestWordLevelTimestamps();

    // 使用麦克风录音，然后上传到服务器处理
    const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 配置发音评测
    const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true // 启用误读检测
    );

    // 根据语言设置音素字母表（中文必须用 SAPI，日语用IPA）
    const alphabet = language.toLowerCase().startsWith('zh') ? 'SAPI' : 'IPA';
    (pronunciationConfig as any).phonemeAlphabet = alphabet;
    (pronunciationConfig as any)._phonemeAlphabet = alphabet;
    (pronunciationConfig as any).PhonemeAlphabet = alphabet;
    
    // 设置 NBestPhonemeCount
    (pronunciationConfig as any).nBestPhonemeCount = 5;
    (pronunciationConfig as any).NBestPhonemeCount = 5;
    (pronunciationConfig as any).privNBestPhonemeCount = 5;
    
    // 英语启用韵律评测
    if (language.toLowerCase().startsWith('en')) {
      try {
        if (typeof (pronunciationConfig as any).enableProsodyAssessment === 'function') {
          (pronunciationConfig as any).enableProsodyAssessment();
        }
      } catch {
        // 忽略错误
      }
    }

    pronunciationConfig.applyTo(recognizer);

    return recognizer;
  };

  /**
   * 上报评测结果
   */
  const submitAttempt = async (azureJson: any): Promise<AttemptResponse> => {
    // 获取 session token
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch('/api/pronunciation/attempts', {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify({
        sentence_id: sentence.id,
        lang,
        azure_json: azureJson,
      }),
    });

    if (!response.ok) {
      throw new Error('上报评测结果失败');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '上报评测结果失败');
    }

    return {
      attempt_id: data.attempt_id,
      valid: data.valid,
      updated_units: data.updated_units,
    };
  };

  /**
   * 执行录音评测（使用麦克风直接录音）
   */
  const handleRecord = async () => {
    setStatus('recording');
    setResult(null);
    setErrorMsg('');

    try {
      // 1. 获取 Token
      const { token, region } = await fetchToken();

      // 2. 创建识别器（使用麦克风输入）
      const recognizer = await createRecognizer(token, region, lang, sentence.text);

      // 3. 执行识别
      const azureJson = await new Promise<any>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            const json = JSON.parse(result.json);
            recognizer.close();
            resolve(json);
          },
          (err) => {
            recognizer.close();
            reject(new Error(err));
          }
        );
      });

      // 4. 上报结果
      setStatus('processing');
      const attemptResult = await submitAttempt(azureJson);

      setResult(attemptResult);
      setStatus('success');

      if (onComplete) {
        onComplete(attemptResult);
      }
    } catch (error) {
      console.error('录音评测失败:', error);
      setStatus('error');
      setErrorMsg(error instanceof Error ? error.message : '未知错误');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          发音评测
        </CardTitle>
        <CardDescription>
          朗读以下句子进行发音评测
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 句子显示 */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            请朗读：
          </div>
          <div className="text-3xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
            {sentence.text}
          </div>
        </div>

        {/* 录音按钮 */}
        <Button
          onClick={handleRecord}
          disabled={status === 'recording' || status === 'processing'}
          className="w-full"
          size="lg"
        >
          {status === 'recording' ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              录音中...
            </>
          ) : status === 'processing' ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-2" />
              开始录音
            </>
          )}
        </Button>

        {/* 成功结果 */}
        {status === 'success' && result && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-900 dark:text-green-100">
                评测完成
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">样本状态:</span>
                <span className={result.valid ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}>
                  {result.valid ? '有效' : '无效（需重试）'}
                </span>
              </div>
              
              {result.valid && result.updated_units.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">更新音节:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {result.updated_units.length} 个
                  </span>
                </div>
              )}
            </div>

            {result.valid && result.updated_units.length > 0 && (
              <div className="pt-2 border-t border-green-200 dark:border-green-800">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  已更新音节统计
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.updated_units.slice(0, 5).map((unit, idx) => (
                    <div
                      key={idx}
                      className="px-2 py-1 bg-white dark:bg-gray-800 rounded text-xs border border-gray-200 dark:border-gray-700"
                    >
                      {unit.n} 次样本
                    </div>
                  ))}
                  {result.updated_units.length > 5 && (
                    <div className="px-2 py-1 text-xs text-gray-500">
                      +{result.updated_units.length - 5} 个
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 错误提示 */}
        {status === 'error' && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-red-900 dark:text-red-100">
                评测失败
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">
                {errorMsg || '请检查麦克风权限和网络连接'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

