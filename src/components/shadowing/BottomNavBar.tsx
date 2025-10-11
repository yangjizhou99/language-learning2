'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Mic, CheckCircle } from 'lucide-react';

interface BottomNavBarProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onRecord?: () => void;
  onComplete?: () => void;
  isRecording?: boolean;
  showPrevious?: boolean;
  showNext?: boolean;
  showRecord?: boolean;
  showComplete?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function BottomNavBar({
  onPrevious,
  onNext,
  onRecord,
  onComplete,
  isRecording = false,
  showPrevious = true,
  showNext = true,
  showRecord = true,
  showComplete = false,
  disabled = false,
  className = '',
}: BottomNavBarProps) {
  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-30 ${className}`}
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)',
      }}
    >
      <div className="mx-auto max-w-[680px] px-4">
        <div className="bg-white/95 backdrop-blur-lg border border-gray-200 shadow-2xl rounded-2xl p-3">
          <div className="flex items-center justify-between gap-3">
            {/* 上一题按钮 */}
            {showPrevious && (
              <Button
                variant="outline"
                size="lg"
                onClick={onPrevious}
                disabled={disabled}
                className="flex-shrink-0 h-12 px-4 rounded-xl"
              >
                <ArrowLeft className="w-5 h-5 mr-1" />
                <span className="text-sm">上一题</span>
              </Button>
            )}

            {/* 录音/完成按钮（居中，较大） */}
            {showRecord && (
              <Button
                size="lg"
                onClick={onRecord}
                disabled={disabled}
                className={`flex-1 h-14 rounded-xl text-base font-semibold ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                }`}
              >
                <Mic className="w-6 h-6 mr-2" />
                {isRecording ? '停止录音' : '开始录音'}
              </Button>
            )}

            {showComplete && (
              <Button
                size="lg"
                onClick={onComplete}
                disabled={disabled}
                className="flex-1 h-14 rounded-xl text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                <CheckCircle className="w-6 h-6 mr-2" />
                完成练习
              </Button>
            )}

            {/* 下一题按钮 */}
            {showNext && (
              <Button
                variant="outline"
                size="lg"
                onClick={onNext}
                disabled={disabled}
                className="flex-shrink-0 h-12 px-4 rounded-xl"
              >
                <span className="text-sm">下一题</span>
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




