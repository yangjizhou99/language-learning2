'use client';
import React from 'react';

export type StepIndex = 1 | 2 | 3 | 4;

export interface PracticeStepperProps {
  currentStep: StepIndex;
  onStepChange: (next: StepIndex) => void;
  maxStepAllowed?: StepIndex; // gating: 禁止点击超过此步
  size?: 'sm' | 'md';
  className?: string;
  labels?: string[]; // 可选：自定义可访问名称
}

const steps: StepIndex[] = [1, 2, 3, 4];

export default function PracticeStepper({
  currentStep,
  onStepChange,
  maxStepAllowed,
  size = 'md',
  className = '',
  labels,
}: PracticeStepperProps) {
  const canClick = (s: StepIndex) => {
    if (!maxStepAllowed) return true;
    return s <= maxStepAllowed;
  };

  const basePad = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const fontSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`flex items-center gap-2 ${fontSize} ${className}`}
      role="tablist"
      aria-label="Shadowing 步骤导航"
    >
      {steps.map((s) => {
        const active = s === currentStep;
        const disabled = !canClick(s);
        const ariaLabel = labels?.[s - 1] || `步骤 ${s}`;
        return (
          <button
            key={s}
            role="tab"
            aria-selected={active}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onStepChange(s)}
            className={[
              'rounded',
              basePad,
              'transition-colors',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
            ].join(' ')}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}


