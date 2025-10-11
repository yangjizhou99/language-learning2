'use client';

import React from 'react';

interface WaveformAnimationProps {
  isActive?: boolean;
  color?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function WaveformAnimation({ 
  isActive = true, 
  color = 'green',
  size = 'md',
  className = '' 
}: WaveformAnimationProps) {
  const colorClasses = {
    green: 'bg-green-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4',
    lg: 'h-6',
  };

  const bars = [
    { delay: '0s', duration: '0.6s', height: '40%' },
    { delay: '0.1s', duration: '0.8s', height: '80%' },
    { delay: '0.2s', duration: '0.7s', height: '60%' },
    { delay: '0.15s', duration: '0.9s', height: '100%' },
    { delay: '0.25s', duration: '0.75s', height: '50%' },
  ];

  return (
    <div className={`flex items-center justify-center gap-0.5 ${sizeClasses[size]} ${className}`}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className={`
            w-1 rounded-full transition-all
            ${colorClasses[color]}
            ${isActive ? '' : 'opacity-30'}
          `}
          style={{
            height: isActive ? bar.height : '20%',
            animation: isActive ? `waveform ${bar.duration} ease-in-out ${bar.delay} infinite` : 'none',
          }}
        />
      ))}
      
      <style jsx>{`
        @keyframes waveform {
          0%, 100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(0.3);
          }
        }
      `}</style>
    </div>
  );
}

