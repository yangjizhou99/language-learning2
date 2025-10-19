'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2, ChevronRight } from 'lucide-react';

interface MinimalPair {
  word_1: string;
  word_2: string;
  pinyin_1: string;
  pinyin_2: string;
}

interface MinimalPairPracticeProps {
  pairs: MinimalPair[];
  unitSymbol: string;
}

export default function MinimalPairPractice({ pairs, unitSymbol }: MinimalPairPracticeProps) {
  const [playingText, setPlayingText] = useState<string | null>(null);

  async function playTTS(text: string) {
    try {
      setPlayingText(text);

      const response = await fetch('/api/pronunciation/generate-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          lang: 'zh-CN',
        }),
      });

      if (!response.ok) {
        throw new Error('生成 TTS 失败');
      }

      const result = await response.json();

      if (result.success && result.audio) {
        const audioData = atob(result.audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }

        const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setPlayingText(null);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setPlayingText(null);
          alert('播放失败');
        };

        await audio.play();
      } else {
        throw new Error('生成失败');
      }
    } catch (err) {
      console.error('TTS 播放失败:', err);
      alert('播放失败，请重试');
      setPlayingText(null);
    }
  }

  if (pairs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        🎯 最小对立词练习
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        对比练习，注意区分发音差异
      </p>

      <div className="space-y-4">
        {pairs.map((pair, idx) => (
          <div
            key={idx}
            className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg"
          >
            {/* 词1 */}
            <button
              onClick={() => playTTS(pair.word_1)}
              disabled={playingText !== null}
              className="p-4 bg-white rounded-lg border-2 border-blue-200 hover:border-blue-500 hover:shadow-md transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-semibold text-gray-900">
                  {pair.word_1}
                </span>
                {playingText === pair.word_1 ? (
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                ) : (
                  <Volume2 className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
                )}
              </div>
              <p className="text-sm text-gray-500 font-mono">{pair.pinyin_1}</p>
            </button>

            {/* VS 分隔符 */}
            <div className="hidden md:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 pointer-events-none">
              <div className="px-3 py-1 bg-gray-200 rounded-full text-xs font-semibold text-gray-600">
                VS
              </div>
            </div>

            {/* 词2 */}
            <button
              onClick={() => playTTS(pair.word_2)}
              disabled={playingText !== null}
              className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-500 hover:shadow-md transition-all text-left group disabled:opacity-50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-semibold text-gray-900">
                  {pair.word_2}
                </span>
                {playingText === pair.word_2 ? (
                  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                ) : (
                  <Volume2 className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" />
                )}
              </div>
              <p className="text-sm text-gray-500 font-mono">{pair.pinyin_2}</p>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>练习建议：</strong>先听左边的词，再听右边的词，反复对比差异。
          可以尝试跟读，但此处不进行评分，专注于理解发音差异即可。
        </p>
      </div>
    </div>
  );
}

