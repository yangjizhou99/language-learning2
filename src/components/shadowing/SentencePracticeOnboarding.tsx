'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, Mic, SkipForward, Check } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';

interface OnboardingStep {
  id: number;
  highlightSelector?: string;
  position: { x: string; y: string };
  animation: React.ReactNode;
}

interface SentencePracticeOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function SentencePracticeOnboarding({ onComplete, onSkip }: SentencePracticeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 延迟显示以确保DOM已渲染
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const steps: OnboardingStep[] = [
    {
      id: 0,
      position: { x: '50%', y: '30%' },
      animation: (
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl animate-bounce">👆</div>
          <div className="flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg animate-pulse">
            <div className="px-2 py-1 bg-gray-200 rounded text-sm font-bold">1</div>
            <div className="text-sm text-gray-700 line-clamp-1">Click sentence...</div>
            <div className="text-xl">👇</div>
          </div>
        </div>
      ),
    },
    {
      id: 1,
      position: { x: '30%', y: '50%' },
      animation: (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Button size="lg" className="pointer-events-none shadow-lg animate-pulse">
              <Volume2 className="w-6 h-6" />
            </Button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl animate-bounce">
              👆
            </div>
          </div>
          <WaveformAnimation isActive color="blue" size="lg" />
        </div>
      ),
    },
    {
      id: 2,
      position: { x: '50%', y: '50%' },
      animation: (
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Button size="lg" className="pointer-events-none bg-red-500 hover:bg-red-600 shadow-lg animate-pulse">
              <Mic className="w-6 h-6" />
            </Button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl animate-bounce">
              👆
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-500 animate-pulse" />
            <WaveformAnimation isActive color="red" size="lg" />
          </div>
        </div>
      ),
    },
    {
      id: 3,
      position: { x: '50%', y: '45%' },
      animation: (
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl">📊</div>
          <div className="w-64 space-y-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                style={{
                  animation: 'progressFill 2s ease-out forwards',
                  width: '0%',
                }}
              />
            </div>
            <div className="text-center text-3xl font-bold text-green-600 animate-pulse">
              85%
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      position: { x: '50%', y: '50%' },
      animation: (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">⚠️</span>
              <div className="text-4xl animate-bounce">👆</div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 bg-amber-100 border border-amber-300 rounded flex items-center gap-1 animate-pulse">
                <Volume2 className="w-4 h-4" />
                <span className="text-sm">word</span>
              </button>
            </div>
          </div>
          <WaveformAnimation isActive color="purple" size="md" />
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  const handleSkipNow = () => {
    setIsVisible(false);
    setTimeout(() => {
      onSkip();
    }, 300);
  };

  if (!isVisible) return null;

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleSkipNow}
      />

      {/* 动画内容 */}
      <div
        className="relative z-10 transition-all duration-500"
        style={{
          left: currentStepData.position.x,
          top: currentStepData.position.y,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {currentStepData.animation}
      </div>

      {/* 底部控制按钮 */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
        {/* 跳过按钮 */}
        <Button
          onClick={handleSkipNow}
          variant="outline"
          size="lg"
          className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg"
        >
          <SkipForward className="w-5 h-5" />
        </Button>

        {/* 进度指示器 */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`
                w-2 h-2 rounded-full transition-all duration-300
                ${index === currentStep ? 'bg-blue-500 w-6' : 'bg-gray-300'}
              `}
            />
          ))}
        </div>

        {/* 下一步/完成按钮 */}
        <Button
          onClick={handleNext}
          size="lg"
          className="bg-blue-500 hover:bg-blue-600 text-white shadow-lg"
        >
          {currentStep === steps.length - 1 ? (
            <Check className="w-5 h-5" />
          ) : (
            <span className="text-2xl">→</span>
          )}
        </Button>
      </div>

      <style jsx>{`
        @keyframes progressFill {
          from {
            width: 0%;
          }
          to {
            width: 85%;
          }
        }
      `}</style>
    </div>
  );
}

