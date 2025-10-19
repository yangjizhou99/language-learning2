'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Mic, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

interface VerificationSentence {
  sentence_id: number;
  text: string;
  level: number;
}

interface VerificationFlowProps {
  sentences: VerificationSentence[];
  onComplete: (scores: Array<{ sentence_id: number; score: number; valid: boolean }>) => void;
}

interface SentenceResult {
  sentence_id: number;
  score: number;
  valid: boolean;
  completed: boolean;
}

export default function VerificationFlow({ sentences, onComplete }: VerificationFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Map<number, SentenceResult>>(new Map());
  const [recording, setRecording] = useState(false);

  const currentSentence = sentences[currentIndex];
  const progress = ((currentIndex + 1) / sentences.length) * 100;

  async function fetchToken() {
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/speech/token', {
      headers: session ? {
        'Authorization': `Bearer ${session.access_token}`,
      } : {},
    });

    if (!response.ok) {
      throw new Error('获取 Token 失败');
    }

    return response.json() as Promise<{ token: string; region: string }>;
  }

  async function handleRecord() {
    if (!currentSentence) return;

    setRecording(true);

    try {
      const { token, region } = await fetchToken();

      const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = 'zh-CN';

      const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      const paConfig = new sdk.PronunciationAssessmentConfig(
        currentSentence.text,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      paConfig.applyTo(recognizer);

      await new Promise<void>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            try {
              const azureResult = JSON.parse(result.json);
              const pa = sdk.PronunciationAssessmentResult.fromResult(result);

              const score = pa.pronunciationScore || 0;
              const completeness = pa.completenessScore || 0;
              const valid = completeness >= 0.6;

              // 保存结果
              const newResults = new Map(results);
              newResults.set(currentSentence.sentence_id, {
                sentence_id: currentSentence.sentence_id,
                score,
                valid,
                completed: true,
              });
              setResults(newResults);

              recognizer.close();
              resolve();
            } catch (err) {
              recognizer.close();
              reject(err);
            }
          },
          (err) => {
            recognizer.close();
            reject(err);
          }
        );
      });

      // 自动进入下一句
      if (currentIndex < sentences.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      console.error('录音失败:', err);
      alert('录音失败，请重试');
    } finally {
      setRecording(false);
    }
  }

  function handleSubmit() {
    const scoresArray = Array.from(results.values());
    onComplete(scoresArray);
  }

  const allCompleted = sentences.every(s => 
    results.has(s.sentence_id) && results.get(s.sentence_id)?.completed
  );

  return (
    <div className="space-y-6">
      {/* 进度条 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">验证进度</h2>
          <span className="text-sm text-gray-600">
            {currentIndex + 1} / {sentences.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 句子列表（侧边显示状态） */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">验证句子</h3>
        <div className="space-y-2">
          {sentences.map((sentence, idx) => {
            const result = results.get(sentence.sentence_id);
            const isCompleted = result?.completed;
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={sentence.sentence_id}
                className={`p-3 rounded-lg border-2 transition-colors ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50'
                    : isCompleted
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-shrink-0">
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : isCurrent ? (
                        <Circle className="w-5 h-5 text-blue-600 fill-blue-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <p className={`text-sm ${isCurrent ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                      {sentence.text}
                    </p>
                  </div>
                  {isCompleted && result && (
                    <span className={`text-sm font-semibold ${
                      result.valid ? 'text-green-700' : 'text-orange-700'
                    }`}>
                      {result.score.toFixed(1)}
                      {!result.valid && ' (无效)'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 当前句子录音区 */}
      {!allCompleted && currentSentence && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">请朗读以下句子</p>
            <p className="text-2xl font-semibold text-gray-900 mb-6">
              {currentSentence.text}
            </p>

            <Button
              onClick={handleRecord}
              disabled={recording}
              size="lg"
              className="w-full max-w-xs"
            >
              {recording ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  录音中...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  开始录音
                </>
              )}
            </Button>

            {results.has(currentSentence.sentence_id) && (
              <p className="mt-4 text-sm text-green-600">
                ✓ 已录制，可以重录或继续下一句
              </p>
            )}
          </div>
        </div>
      )}

      {/* 提交按钮 */}
      {allCompleted && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              验证完成！
            </h3>
            <p className="text-gray-600 mb-6">
              已完成全部 {sentences.length} 句验证，点击提交查看结果
            </p>
            <Button
              onClick={handleSubmit}
              size="lg"
              className="w-full max-w-xs"
            >
              提交验证结果
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

