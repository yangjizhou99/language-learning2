'use client';

import React, { useEffect, useState } from 'react';

interface ParticleEffectProps {
  type: 'success' | 'celebration' | 'warning';
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  emoji?: string;
}

export default function ParticleEffect({ type, onComplete }: ParticleEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // 生成粒子
    const particleCount = type === 'celebration' ? 20 : 10;
    const newParticles: Particle[] = [];

    const emojis = type === 'celebration' 
      ? ['✨', '🎉', '⭐', '💫', '🌟']
      : type === 'success'
      ? ['✓', '👍', '😊']
      : ['⚠️', '💪'];

    const colors = type === 'celebration'
      ? ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']
      : type === 'success'
      ? ['#10b981', '#34d399']
      : ['#f59e0b', '#fbbf24'];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: 50,
        y: 50,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4 - 2,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        emoji: type === 'celebration' ? emojis[Math.floor(Math.random() * emojis.length)] : undefined,
      });
    }

    setParticles(newParticles);

    // 动画完成后清理
    const timer = setTimeout(() => {
      onComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [type, onComplete]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animation: `particle-float 1.5s ease-out forwards`,
            animationDelay: `${Math.random() * 0.2}s`,
          }}
        >
          {particle.emoji ? (
            <span 
              className="text-2xl"
              style={{
                animation: 'particle-rotate 1.5s linear forwards',
              }}
            >
              {particle.emoji}
            </span>
          ) : (
            <div
              className="rounded-full"
              style={{
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                backgroundColor: particle.color,
              }}
            />
          )}
        </div>
      ))}

      <style jsx>{`
        @keyframes particle-float {
          0% {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(0);
          }
        }

        @keyframes particle-rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

