'use client';

import React, { memo } from 'react';

interface OptionsGridProps {
  sentenceIndex: number;
  options: string[];
  selected: string[];
  animating: Record<string, boolean>;
  onSelect: (opt: string) => void;
}

const OptionButton = memo(({ 
  opt, 
  active, 
  animating, 
  onSelect 
}: { 
  opt: string; 
  active: boolean; 
  animating: boolean; 
  onSelect: () => void;
}) => {
  return (
    <button
      key={opt}
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`text-left px-2 py-1.5 rounded border transition-transform will-change-transform focus:outline-none focus:ring-1 focus:ring-primary/40 active:scale-[0.98] ${active ? 'border-primary bg-primary/10' : 'hover:bg-muted'} ${animating ? 'animate-opt-pop' : ''}`}
    >
      {opt}
    </button>
  );
});

OptionButton.displayName = 'OptionButton';

export const OptionsGrid = memo(({ sentenceIndex, options, selected, animating, onSelect }: OptionsGridProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        const akey = `${sentenceIndex}__${opt}`;
        return (
          <OptionButton
            key={opt}
            opt={opt}
            active={active}
            animating={animating[akey] || false}
            onSelect={() => onSelect(opt)}
          />
        );
      })}
    </div>
  );
});

OptionsGrid.displayName = 'OptionsGrid';

