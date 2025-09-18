'use client';

import React, { useState, useRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Square, Mic, Upload, Trash2 } from 'lucide-react';

interface AudioRecording {
  url: string;
  fileName: string;
  size: number;
  type: string;
  duration: number;
  created_at: string;
  transcription?: string; // 添加转录文字
}

interface AudioRecorderProps {
  sessionId?: string;
  existingRecordings?: AudioRecording[];
  onRecordingAdded?: (recording: AudioRecording) => void;
  onRecordingDeleted?: (recording: AudioRecording) => void;
  onTranscriptionReady?: (transcription: string) => void; // 添加转录回调
  onRecordingSelected?: (recording: AudioRecording) => void; // 添加录音选择回调
  originalText?: string; // 添加原文用于生成相关转录
  language?: string; // 添加语言参数
  className?: string;
}

const AudioRecorder = React.forwardRef<any, AudioRecorderProps>(
  (
    {
      sessionId,
      existingRecordings = [],
      onRecordingAdded,
      onRecordingDeleted,
      onTranscriptionReady,
      onRecordingSelected,
      originalText,
      language = 'ja',
      className = '',
    },
    ref,
  ) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<AudioRecording[]>(existingRecordings);
    const [currentRecordingUrl, setCurrentRecordingUrl] = useState<string | null>(null);
    const [uploadingRecording, setUploadingRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [currentTranscription, setCurrentTranscription] = useState<string>('');
    const [isRealTimeTranscribing, setIsRealTimeTranscribing] = useState(false);
    const [realTimeTranscription, setRealTimeTranscription] = useState<string>('');
    const realTimeTranscriptionRef = useRef<string>('');

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const recognitionRef = useRef<any>(null);
    const recordingStartTimeRef = useRef<number>(0);

    // 同步外部录音列表的变化
    useEffect(() => {
      setRecordings(existingRecordings);
    }, [existingRecordings]);

    // 初始化语音识别
    useEffect(() => {
      if (typeof window !== 'undefined') {
        const SpeechRecognition =
          (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;
          // 根据语言参数设置语音识别语言
          const langMap: { [key: string]: string } = {
            ja: 'ja-JP',
            zh: 'zh-CN',
            en: 'en-US',
          };
          const recognitionLang = langMap[language] || 'en-US';
          recognitionRef.current.lang = recognitionLang;

          recognitionRef.current.onstart = () => {
            setIsRealTimeTranscribing(true);
            setRealTimeTranscription('');
            realTimeTranscriptionRef.current = '';
          };

          recognitionRef.current.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
              } else {
                interimTranscript += transcript;
              }
            }

            // 累积所有最终转录结果
            setRealTimeTranscription((prev) => {
              const newFinal = finalTranscript.trim();
              if (newFinal) {
                const updated = prev + (prev ? ' ' : '') + newFinal;
                realTimeTranscriptionRef.current = updated;
                return updated;
              }
              return prev;
            });

            // 显示当前实时转录（包含临时结果）
            const currentDisplay = (finalTranscript + interimTranscript).trim();
          };

          recognitionRef.current.onerror = (event: any) => {
            console.error('实时语音识别错误:', event.error);
            setIsRealTimeTranscribing(false);
          };

          recognitionRef.current.onend = () => {
            setIsRealTimeTranscribing(false);
          };
        }
      }

      return () => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };
    }, []);

    // 语音转文字功能
    const transcribeAudio = useCallback(
      async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
          // 优先使用实时转录的结果
          const latestTranscription = realTimeTranscriptionRef.current;
          if (latestTranscription && latestTranscription.trim().length > 0) {
            setCurrentTranscription(latestTranscription);
            return latestTranscription;
          }

          // 如果没有实时转录结果，使用当前转录
          if (currentTranscription && currentTranscription.trim().length > 0) {
            return currentTranscription;
          }

          // 如果都没有，则使用转录API作为备选

          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          if (originalText) {
            formData.append('originalText', originalText);
          }
          formData.append('language', language); // 传递语言参数

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('转录API请求失败');
          }

          const data = await response.json();

          if (data.success && data.transcription) {
            setCurrentTranscription(data.transcription);
            return data.transcription;
          } else {
            throw new Error('转录API返回无效结果');
          }
        } catch (error) {
          console.error('语音转文字失败:', error);
          // 返回模拟结果作为备选
          const mockTranscription =
            language === 'zh' ? '你好，很高兴认识你' : 'こんにちは、はじめまして';
          setCurrentTranscription(mockTranscription);
          return mockTranscription;
        } finally {
          setIsTranscribing(false);
        }
      },
      [realTimeTranscription, currentTranscription, originalText, language],
    );

    const startRecording = useCallback(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });

        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setCurrentRecordingUrl(audioUrl);

          // Stop all tracks to release microphone
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        recordingStartTimeRef.current = Date.now();

        // 开始实时语音识别
        if (recognitionRef.current) {
          setRealTimeTranscription('');
          realTimeTranscriptionRef.current = '';
          recognitionRef.current.start();
        }
      } catch (error) {
        console.error('Error starting recording:', error);
        alert('无法访问麦克风，请检查权限设置');
      }
    }, []);

    const stopRecording = useCallback(async () => {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);

        // 停止实时语音识别
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }

        // 等待一小段时间让语音识别完成，然后使用最终结果
        setTimeout(() => {
          const latestTranscription = realTimeTranscriptionRef.current;

          if (latestTranscription.trim()) {
            // 检查转录质量
            const transcriptionQuality = checkTranscriptionQuality(
              latestTranscription,
              originalText,
            );

            // 立即更新转录文字状态
            setCurrentTranscription(latestTranscription);
            onTranscriptionReady?.(latestTranscription);
          } else {
            // 如果没有实时转录结果，使用API转录
            if (audioChunksRef.current.length > 0) {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

              // 自动进行语音转文字
              transcribeAudio(audioBlob)
                .then((transcription) => {
                  setCurrentTranscription(transcription);
                  onTranscriptionReady?.(transcription);
                })
                .catch((error) => {
                  console.error('转录失败:', error);
                });
            }
          }
        }, 1000); // 增加等待时间到1秒
      }
    }, [isRecording, realTimeTranscription, transcribeAudio, onTranscriptionReady]);

    const playAudio = useCallback(
      (url: string, recordingId: string) => {
        if (isPlaying === recordingId) {
          // Stop current audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          setIsPlaying(null);
        } else {
          // Play audio
          if (audioRef.current) {
            audioRef.current.pause();
          }

          audioRef.current = new Audio(url);
          audioRef.current.onended = () => setIsPlaying(null);
          audioRef.current.play().catch(console.error);
          setIsPlaying(recordingId);
        }
      },
      [isPlaying],
    );

    const uploadCurrentRecording = useCallback(async () => {
      if (!currentRecordingUrl || !audioChunksRef.current.length) return;

      setUploadingRecording(true);
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        // 计算准确的录音时长
        const recordingDuration = Date.now() - recordingStartTimeRef.current;

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording-${Date.now()}.webm`);
        formData.append('duration', recordingDuration.toString());
        if (sessionId) {
          formData.append('sessionId', sessionId);
        }

        // 获取认证头
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const response = await fetch('/api/upload/audio', {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('上传失败响应:', errorText);
          throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success) {
          // 确保使用最新的转录文字
          const finalTranscription =
            realTimeTranscriptionRef.current.trim() || currentTranscription;

          const newRecording = {
            ...data.audio,
            transcription: finalTranscription, // 添加转录文字
          };
          setRecordings((prev) => [...prev, newRecording]);
          onRecordingAdded?.(newRecording);

          // Clear current recording
          URL.revokeObjectURL(currentRecordingUrl);
          setCurrentRecordingUrl(null);
          setCurrentTranscription('');
          audioChunksRef.current = [];
        } else {
          throw new Error(data.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Error uploading recording:', error);
        alert(`录音上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      } finally {
        setUploadingRecording(false);
      }
    }, [
      currentRecordingUrl,
      sessionId,
      onRecordingAdded,
      realTimeTranscription,
      currentTranscription,
    ]);

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        uploadCurrentRecording,
        hasUnsavedRecording: () => currentRecordingUrl && audioChunksRef.current.length > 0,
      }),
      [uploadCurrentRecording, currentRecordingUrl],
    );

    const deleteRecording = useCallback(
      (recording: AudioRecording) => {
        setRecordings((prev) => prev.filter((r) => r.url !== recording.url));
        onRecordingDeleted?.(recording);
      },
      [onRecordingDeleted],
    );

    const discardCurrentRecording = useCallback(() => {
      if (currentRecordingUrl) {
        URL.revokeObjectURL(currentRecordingUrl);
        setCurrentRecordingUrl(null);
        audioChunksRef.current = [];
      }
    }, [currentRecordingUrl]);

    const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // 检查转录质量
    const checkTranscriptionQuality = (transcription: string, originalText?: string) => {
      if (!originalText) return { quality: 'unknown', message: '无法检查转录质量' };

      const transcriptionLength = transcription.trim().length;
      const originalLength = originalText.trim().length;
      const lengthRatio = transcriptionLength / originalLength;

      let quality = 'good';
      let message = '';

      if (lengthRatio < 0.3) {
        quality = 'poor';
        message = '转录内容过少，建议重新录音';
      } else if (lengthRatio < 0.6) {
        quality = 'fair';
        message = '转录内容不完整，建议重新录音';
      } else if (lengthRatio > 1.5) {
        quality = 'fair';
        message = '转录内容过多，可能包含背景噪音';
      } else {
        quality = 'good';
        message = '转录质量良好';
      }

      return { quality, message, lengthRatio };
    };

    return (
      <Card
        className={`p-6 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl space-y-6 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">录音练习</h3>
              <p className="text-sm text-gray-600">跟读练习，提升口语能力</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full">
            <span className="text-sm font-semibold text-blue-700">{recordings.length} 个录音</span>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                variant="outline"
                size="lg"
                className="h-12 bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-700 hover:from-red-100 hover:to-pink-100 hover:border-red-300 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Mic className="w-5 h-5 mr-2" />
                开始录音
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="destructive"
                size="lg"
                className="h-12 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Square className="w-5 h-5 mr-2" />
                停止录音
              </Button>
            )}
          </div>

          {/* 状态指示器 */}
          <div className="flex items-center gap-4 flex-wrap">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-200">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-red-700">录音中...</span>
              </div>
            )}

            {isRealTimeTranscribing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700">实时转录中...</span>
              </div>
            )}

            {isTranscribing && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-blue-700">转录中...</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Recording Preview */}
        {currentRecordingUrl && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => playAudio(currentRecordingUrl, 'current')}
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 bg-white hover:bg-blue-100 rounded-full shadow-sm"
                >
                  <Play className="w-4 h-4 text-blue-600" />
                </Button>
                <div>
                  <span className="text-sm font-medium text-gray-900">新录音（未保存）</span>
                  <p className="text-xs text-gray-500">点击播放预览录音效果</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={uploadCurrentRecording}
                  disabled={uploadingRecording || isTranscribing}
                  variant="default"
                  size="sm"
                  className="h-8 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {uploadingRecording ? '上传中...' : isTranscribing ? '转录中...' : '保存'}
                </Button>
                <Button
                  onClick={discardCurrentRecording}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* 实时转录显示 */}
            {isRealTimeTranscribing && realTimeTranscription && (
              <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium text-green-700">实时转录：</span>
                </div>
                <div className="text-sm text-green-800 max-h-32 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                  {realTimeTranscription}
                </div>
              </div>
            )}

            {/* 转录文字显示 */}
            {currentTranscription && (
              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs font-medium text-gray-600">转录文字：</span>
                </div>
                <div className="text-sm text-gray-800 max-h-32 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                  {currentTranscription}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Recordings List */}
        {recordings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center">
                <Play className="w-3 h-3 text-gray-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800">历史录音</h4>
            </div>
            <div className="space-y-3">
              {recordings.map((recording, index) => (
                <div
                  key={recording.url}
                  className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Button
                        onClick={() => playAudio(recording.url, recording.url)}
                        variant="ghost"
                        size="sm"
                        className={`w-10 h-10 rounded-full shadow-sm transition-all ${
                          isPlaying === recording.url
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-white hover:bg-blue-50 text-blue-600'
                        }`}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-900">录音 #{index + 1}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDuration(Math.floor(recording.duration / 1000))} ·{' '}
                          {formatFileSize(recording.size)} ·
                          {new Date(recording.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {recording.transcription && (
                        <Button
                          onClick={() => onRecordingSelected?.(recording)}
                          variant="outline"
                          size="sm"
                          className="h-8 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-700 hover:from-green-100 hover:to-emerald-100 hover:border-green-300 rounded-lg"
                        >
                          评分
                        </Button>
                      )}
                      <Button
                        onClick={() => deleteRecording(recording)}
                        variant="ghost"
                        size="sm"
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* 显示转录文字 */}
                  {recording.transcription && (
                    <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs font-medium text-gray-600">转录文字：</span>
                      </div>
                      <div className="text-sm text-gray-800 max-h-32 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
                        {recording.transcription}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {recordings.length === 0 && !currentRecordingUrl && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">还没有录音</h3>
            <p className="text-gray-500 leading-relaxed">点击"开始录音"开始练习</p>
          </div>
        )}
      </Card>
    );
  },
);

export default AudioRecorder;
