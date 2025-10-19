'use client';

// =====================================================
// 批量录音评测组件
// 先录音保存 → 批量提交评分
// =====================================================

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, CheckCircle2, AlertCircle, Trash2, Send, Play, RefreshCw } from 'lucide-react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { supabase } from '@/lib/supabase';
import type { TokenResponse, AttemptResponse } from '@/types/pronunciation';

interface Recording {
  sentenceId: number;
  sentenceText: string;
  audioBlob: Blob;
  audioUrl: string;
  status: 'pending' | 'submitting' | 'success' | 'error';
  result?: AttemptResponse;
  error?: string;
}

interface BatchRecorderCardProps {
  sentences: Array<{ id: number; text: string }>;
  lang?: 'zh-CN' | 'en-US' | 'ja-JP';
  onBatchComplete?: (results: AttemptResponse[]) => void;
  onNextBatch?: () => void;
}

export default function BatchRecorderCard({ 
  sentences, 
  lang = 'zh-CN', 
  onBatchComplete,
  onNextBatch 
}: BatchRecorderCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentRecognizer, setCurrentRecognizer] = useState<any>(null);

  const currentSentence = sentences[currentIndex];
  const hasRecordings = recordings.length > 0;
  const allRecorded = recordings.length === sentences.length;
  const allEvaluated = recordings.length > 0 && recordings.every(r => r.status !== 'pending' && r.status !== 'submitting');

  /**
   * 获取 Token
   */
  const fetchToken = async (): Promise<TokenResponse> => {
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
   * 开始录音当前句子
   */
  const handleStartRecord = async () => {
    if (!currentSentence) return;

    setIsRecording(true);

    try {
      // 1. 获取 Token
      const { token, region } = await fetchToken();

      // 2. 创建识别器
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = lang;

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      // 配置发音评测
      const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
        currentSentence.text,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      
      // 根据语言设置音素字母表（中文必须用 SAPI，日语用IPA）
      const alphabet = lang.toLowerCase().startsWith('zh') ? 'SAPI' : 'IPA';
      (pronunciationConfig as any).phonemeAlphabet = alphabet;
      (pronunciationConfig as any)._phonemeAlphabet = alphabet;
      (pronunciationConfig as any).PhonemeAlphabet = alphabet;
      
      // 设置 NBestPhonemeCount
      (pronunciationConfig as any).nBestPhonemeCount = 5;
      (pronunciationConfig as any).NBestPhonemeCount = 5;
      (pronunciationConfig as any).privNBestPhonemeCount = 5;
      
      // 英语启用韵律评测
      if (lang.toLowerCase().startsWith('en')) {
        try {
          if (typeof (pronunciationConfig as any).enableProsodyAssessment === 'function') {
            (pronunciationConfig as any).enableProsodyAssessment();
          }
        } catch {
          // 忽略错误
        }
      }
      
      pronunciationConfig.applyTo(recognizer);

      setCurrentRecognizer(recognizer);

      // 3. 执行识别（仅保存原始结果，不立即评分）
      const azureJson = await new Promise<any>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            const json = JSON.parse(result.json);
            recognizer.close();
            setCurrentRecognizer(null);
            resolve(json);
          },
          (err) => {
            recognizer.close();
            setCurrentRecognizer(null);
            reject(new Error(err));
          }
        );
      });

      // 4. 将录音数据保存（先不提交评分）
      // 注意：这里我们只保存 Azure 返回的 JSON，实际音频在 Azure 那边
      const recording: Recording = {
        sentenceId: currentSentence.id,
        sentenceText: currentSentence.text,
        audioBlob: new Blob([JSON.stringify(azureJson)], { type: 'application/json' }),
        audioUrl: '',
        status: 'pending',
      };

      // 临时存储 azureJson 到 recording 对象
      (recording as any).azureJson = azureJson;

      setRecordings((prev) => [...prev, recording]);

      // 5. 自动进入下一句
      if (currentIndex < sentences.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }

      setIsRecording(false);
    } catch (error) {
      console.error('录音失败:', error);
      setIsRecording(false);
      alert(error instanceof Error ? error.message : '录音失败');
    }
  };

  /**
   * 删除某个录音
   */
  const handleDeleteRecording = (index: number) => {
    setRecordings((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * 上报单个评测结果
   */
  const submitAttempt = async (sentenceId: number, azureJson: any): Promise<AttemptResponse> => {
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
        sentence_id: sentenceId,
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
   * 批量提交所有录音进行评分
   */
  const handleBatchSubmit = async () => {
    setIsSubmitting(true);

    const updatedRecordings = [...recordings];

    for (let i = 0; i < updatedRecordings.length; i++) {
      const recording = updatedRecordings[i];
      
      if (recording.status !== 'pending') continue;

      // 更新状态为提交中
      recording.status = 'submitting';
      setRecordings([...updatedRecordings]);

      try {
        const azureJson = (recording as any).azureJson;
        const result = await submitAttempt(recording.sentenceId, azureJson);
        
        recording.status = 'success';
        recording.result = result;
      } catch (error) {
        recording.status = 'error';
        recording.error = error instanceof Error ? error.message : '提交失败';
      }

      setRecordings([...updatedRecordings]);
    }

    setIsSubmitting(false);

    // 通知父组件
    const successResults = updatedRecordings
      .filter(r => r.status === 'success' && r.result)
      .map(r => r.result!);

    if (onBatchComplete && successResults.length > 0) {
      onBatchComplete(successResults);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          批量发音评测
        </CardTitle>
        <CardDescription>
          连续录音多句，最后批量提交评分
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 当前句子 */}
        {!allRecorded && currentSentence && (
          <>
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  句子 {currentIndex + 1} / {sentences.length}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  已录 {recordings.length} 句
                </div>
              </div>
              <div className="text-3xl font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                {currentSentence.text}
              </div>
            </div>

            {/* 录音按钮 */}
            <Button
              onClick={handleStartRecord}
              disabled={isRecording || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isRecording ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  录音中...（请朗读）
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  录制这一句
                </>
              )}
            </Button>
          </>
        )}

        {/* 已录制列表 */}
        {hasRecordings && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                已录制句子 ({recordings.length})
              </div>
              {!isSubmitting && recordings.some(r => r.status === 'pending') && (
                <Button
                  onClick={handleBatchSubmit}
                  disabled={isSubmitting}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  批量提交评分
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recordings.map((recording, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border bg-white dark:bg-gray-900/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {index + 1}. {recording.sentenceText}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {recording.status === 'pending' && '✓ 已录制，等待提交'}
                        {recording.status === 'submitting' && '⏳ 评测中...'}
                        {recording.status === 'success' && (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {recording.result?.valid ? '有效样本' : '无效样本（需重录）'}
                            {recording.result?.updated_units && recording.result.updated_units.length > 0 && 
                              ` · 更新了 ${recording.result.updated_units.length} 个音节`
                            }
                          </span>
                        )}
                        {recording.status === 'error' && (
                          <span className="text-red-600 dark:text-red-400">
                            ✗ {recording.error}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 状态图标 */}
                    <div className="flex-shrink-0">
                      {recording.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRecording(index)}
                          disabled={isSubmitting}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </Button>
                      )}
                      {recording.status === 'submitting' && (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      )}
                      {recording.status === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {recording.status === 'error' && (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完成提示和详细结果 */}
        {allEvaluated && (
          <div className="space-y-4">
            {/* 统计摘要 */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="font-medium text-green-900 dark:text-green-100">
                  本批评测完成！
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {recordings.filter(r => r.status === 'success').length}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">成功</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {recordings.filter(r => r.result?.valid).length}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">有效样本</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {recordings.reduce((sum, r) => sum + (r.result?.updated_units.length || 0), 0)}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400">更新音节</div>
                </div>
              </div>
            </div>

            {/* 下一批按钮 */}
            {onNextBatch && (
              <Button onClick={onNextBatch} className="w-full" size="lg">
                <RefreshCw className="w-5 h-5 mr-2" />
                开始下一批（5句）
              </Button>
            )}
          </div>
        )}

        {/* 提示信息 */}
        {!allRecorded && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-900 dark:text-blue-100">
              💡 点击"录制这一句"开始朗读，读完自动进入下一句。录完所有句子后，点击"批量提交评分"。
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
