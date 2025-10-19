'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Loader2 } from 'lucide-react';

interface TrainingContentProps {
  content: {
    articulation_points: string;
    common_errors: string;
    tips: string;
    ipa_symbol?: string;
    practice_words: string[];
    practice_phrases: string[];
  };
  unitSymbol: string;
}

export default function TrainingContent({ content, unitSymbol }: TrainingContentProps) {
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  async function playTTS(text: string) {
    try {
      setPlayingWord(text);

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
        // 解码 base64 并播放
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
          setPlayingWord(null);
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setPlayingWord(null);
          alert('播放失败');
        };

        await audio.play();
      } else {
        throw new Error('生成失败');
      }
    } catch (err) {
      console.error('TTS 播放失败:', err);
      alert('播放失败，请重试');
      setPlayingWord(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* 区块1: 发音要领 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          📍 发音要领
        </h2>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {content.articulation_points}
          </p>
        </div>
      </div>

      {/* 区块2: 常见错误 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          ⚠️ 常见错误
        </h2>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {content.common_errors}
          </p>
        </div>
      </div>

      {/* 区块3: 发音技巧 */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          💡 发音技巧
        </h2>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {content.tips}
          </p>
        </div>
      </div>

      {/* 区块4: 练习词汇 */}
      {content.practice_words.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📝 练习词汇
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {content.practice_words.map((word, idx) => (
              <button
                key={idx}
                onClick={() => playTTS(word)}
                disabled={playingWord !== null}
                className="p-3 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors text-left flex items-center justify-between group disabled:opacity-50"
              >
                <span className="text-gray-900 font-medium">{word}</span>
                {playingWord === word ? (
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                ) : (
                  <Volume2 className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
                )}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            💡 点击词汇可以听标准读音
          </p>
        </div>
      )}

      {/* 区块5: 练习短语 */}
      {content.practice_phrases.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            📖 练习短语
          </h2>
          <div className="space-y-3">
            {content.practice_phrases.map((phrase, idx) => (
              <button
                key={idx}
                onClick={() => playTTS(phrase)}
                disabled={playingWord !== null}
                className="w-full p-4 rounded-lg border border-gray-200 hover:border-green-500 hover:bg-green-50 transition-colors text-left flex items-center justify-between group disabled:opacity-50"
              >
                <span className="text-gray-900">{phrase}</span>
                {playingWord === phrase ? (
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
                ) : (
                  <Volume2 className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors flex-shrink-0 ml-3" />
                )}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            💡 点击短语可以听标准读音，建议跟读练习
          </p>
        </div>
      )}
    </div>
  );
}

