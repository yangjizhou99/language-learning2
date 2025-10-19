'use client';

// =====================================================
// 句子列表组件 - 分页展示所有句子
// 每句显示状态，可单独录制，保存音频和评测结果
// =====================================================

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Loader2, CheckCircle2, AlertCircle, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { supabase } from '@/lib/supabase';

interface Sentence {
  id: number;
  text: string;
  level: number;
}

interface AttemptRecord {
  sentence_id: number;
  pron_score: number;
  valid_flag: boolean;
  audio_path?: string;
  created_at: string;
  attempt_count?: number; // 该句子的评测次数
}

interface SentenceListCardProps {
  sentences: Sentence[];
  attempts: Map<number, AttemptRecord>; // sentence_id -> attempt
  lang?: 'zh-CN' | 'en-US' | 'ja-JP';
  onRecordingComplete?: (sentenceId: number) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

type RecordingState = {
  sentenceId: number;
  status: 'recording' | 'uploading' | 'submitting';
};

export default function SentenceListCard({
  sentences,
  attempts,
  lang = 'zh-CN',
  onRecordingComplete,
  currentPage,
  totalPages,
  onPageChange,
}: SentenceListCardProps) {
  const [recordingState, setRecordingState] = useState<RecordingState | null>(null);
  const [error, setError] = useState<string>('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentSentenceRef = useRef<Sentence | null>(null);

  /**
   * 获取 Azure Token
   */
  const fetchToken = async () => {
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

    return { token: data.token, region: data.region };
  };

  /**
   * 上传音频文件
   */
  const uploadAudio = async (audioBlob: Blob): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('ext', 'webm');

    const response = await fetch('/api/pronunciation/upload', {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error('上传音频失败');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '上传音频失败');
    }

    return data.path;
  };

  /**
   * 提交评测结果
   */
  const submitAttempt = async (sentenceId: number, azureJson: any, audioPath: string) => {
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
        audio_path: audioPath,
      }),
    });

    if (!response.ok) {
      throw new Error('提交评测失败');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '提交评测失败');
    }

    return data;
  };

  /**
   * 开始录制某个句子
   */
  const handleRecord = async (sentence: Sentence) => {
    currentSentenceRef.current = sentence;
    setRecordingState({ sentenceId: sentence.id, status: 'recording' });
    setError('');

    try {
      // 1. 获取 Azure Token
      const { token, region } = await fetchToken();

      // 2. 启动 MediaRecorder（用于保存音频）
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const MR = (window as any).MediaRecorder;
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const chosenMime = mimeCandidates.find(m => MR.isTypeSupported?.(m)) || 'audio/webm';
      const recorder = new MR(stream, { mimeType: chosenMime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.start(250);

      // 3. 创建 Azure 识别器（同时进行评测）
      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = lang;

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      const pronunciationConfig = new sdk.PronunciationAssessmentConfig(
        sentence.text,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      pronunciationConfig.applyTo(recognizer);

      // 4. 执行识别（Azure 评测）
      const azureJson = await new Promise<any>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            const json = JSON.parse(result.json);
            recognizer.close();
            
            // 停止 MediaRecorder
            if (recorder.state === 'recording') {
              recorder.stop();
            }
            
            resolve(json);
          },
          (err) => {
            recognizer.close();
            if (recorder.state === 'recording') {
              recorder.stop();
            }
            reject(new Error(err));
          }
        );
      });

      // 5. 等待录音完成
      const audioBlob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          stream.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
          resolve(blob);
        };
      });

      // 6. 上传音频
      setRecordingState({ sentenceId: sentence.id, status: 'uploading' });
      const audioPath = await uploadAudio(audioBlob);

      // 7. 提交评测结果
      setRecordingState({ sentenceId: sentence.id, status: 'submitting' });
      await submitAttempt(sentence.id, azureJson, audioPath);

      // 8. 完成
      setRecordingState(null);
      if (onRecordingComplete) {
        onRecordingComplete(sentence.id);
      }
    } catch (error) {
      console.error('录制失败:', error);
      setError(error instanceof Error ? error.message : '录制失败');
      setRecordingState(null);

      // 清理资源
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  /**
   * 播放已保存的音频
   */
  const handlePlayAudio = async (audioPath: string) => {
    try {
      // 通过代理获取音频
      const url = `/api/storage-proxy?path=${encodeURIComponent(audioPath)}&bucket=pronunciation-audio`;
      const audio = new Audio(url);
      await audio.play();
    } catch (error) {
      console.error('播放失败:', error);
      alert('音频播放失败');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              发音评测句子列表
            </CardTitle>
            <CardDescription>
              点击"录制"按钮进行发音评测（每句只需录一次）
            </CardDescription>
          </div>
          
          {/* 分页控制 */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* 句子列表 */}
        <div className="space-y-2">
          {sentences.map((sentence) => {
            const attempt = attempts.get(sentence.id);
            const isRecording = recordingState?.sentenceId === sentence.id;
            const recordingStatus = isRecording ? recordingState.status : null;

            return (
              <div
                key={sentence.id}
                className="p-4 rounded-lg border bg-white dark:bg-gray-900/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 句子内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {sentence.text}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        L{sentence.level}
                      </Badge>
                    </div>

                    {/* 状态显示 */}
                    {attempt ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className={attempt.valid_flag ? 'text-green-600' : 'text-orange-600'}>
                          {attempt.valid_flag ? '✓ 有效样本' : '⚠ 无效样本'}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          分数: {attempt.pron_score?.toFixed(1) || '—'}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500 dark:text-gray-500">
                          已录 {attempt.attempt_count || 1}/3 次
                        </span>
                        {attempt.audio_path && (
                          <>
                            <span className="text-gray-400">·</span>
                            <button
                              onClick={() => handlePlayAudio(attempt.audio_path!)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              播放录音
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        未录制（最多可录3次）
                      </div>
                    )}

                    {/* 录制状态提示 */}
                    {isRecording && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {recordingStatus === 'recording' && '🎤 录音中...'}
                        {recordingStatus === 'uploading' && '📤 上传中...'}
                        {recordingStatus === 'submitting' && '⏳ 评测中...'}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex-shrink-0">
                    {attempt ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRecord(sentence)}
                        disabled={!!recordingState}
                      >
                        重录
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleRecord(sentence)}
                        disabled={!!recordingState}
                      >
                        {isRecording ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Mic className="w-4 h-4 mr-1" />
                            录制
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 统计信息 */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              本页进度：
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {sentences.filter(s => attempts.has(s.id)).length} / {sentences.length} 句已录制
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

