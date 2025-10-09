'use client';

import React, { useEffect, useState } from 'react';

interface ScoreAnimationProps {
  score: number;
  label: string;
  className?: string;
}

export function AnimatedScore({ score, label, className = '' }: ScoreAnimationProps) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // 数字滚动动画
    const duration = 800;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, current + increment);
      setDisplayScore(Math.round(current));

      if (step >= steps || current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const isExcellent = score >= 80;
  const isMedium = score >= 60 && score < 80;

  return (
    <div className={`relative ${className}`}>
      <div className="text-lg font-semibold">
        <span className={`
          ${isExcellent ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-red-600'}
          transition-colors duration-300
        `}>
          {displayScore}%
        </span>
      </div>
      <div className="text-xs text-gray-500">{label}</div>
      
      {/* 优秀时的粒子效果 */}
      {isExcellent && displayScore === score && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                left: '50%',
                top: '50%',
                width: '4px',
                height: '4px',
                background: 'linear-gradient(45deg, #10B981, #34D399)',
                borderRadius: '50%',
                animation: `particle-${i} 0.6s ease-out forwards`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Toast 通知组件
interface ToastProps {
  message: string;
  type: 'success' | 'info' | 'celebration';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'from-green-500 to-emerald-600',
    info: 'from-blue-500 to-indigo-600',
    celebration: 'from-yellow-500 to-orange-500',
  };

  const icons = {
    success: '✓',
    info: 'ℹ',
    celebration: '🎉',
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`
        px-6 py-3 rounded-lg shadow-lg text-white
        bg-gradient-to-r ${colors[type]}
        flex items-center gap-3
        transform transition-all duration-300
      `}>
        <span className="text-xl">{icons[type]}</span>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}

// 徽章升级动画
interface BadgeUpgradeProps {
  badge: {
    emoji: string;
    label: string;
  };
  onClose: () => void;
}

export function BadgeUpgrade({ badge, onClose }: BadgeUpgradeProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl animate-scale-in max-w-sm mx-4">
        <div className="text-center space-y-4">
          {/* 徽章图标 */}
          <div className="text-6xl animate-bounce">
            {badge.emoji}
          </div>
          
          {/* 标题 */}
          <h3 className="text-2xl font-bold text-gray-900">
            恭喜升级！
          </h3>
          
          {/* 徽章名称 */}
          <p className="text-lg text-gray-700">
            获得 <span className="font-bold text-yellow-600">{badge.label}</span> 称号
          </p>
          
          {/* 粒子效果 */}
          <div className="relative h-20">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                style={{
                  left: '50%',
                  top: '50%',
                  animation: `confetti-${i % 4} 1s ease-out forwards`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            太棒了！
          </button>
        </div>
      </div>
    </div>
  );
}

// 添加动画CSS到全局样式
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes particle-0 { to { transform: translate(20px, -20px); opacity: 0; } }
    @keyframes particle-1 { to { transform: translate(-20px, -20px); opacity: 0; } }
    @keyframes particle-2 { to { transform: translate(20px, 20px); opacity: 0; } }
    @keyframes particle-3 { to { transform: translate(-20px, 20px); opacity: 0; } }
    @keyframes particle-4 { to { transform: translate(30px, 0); opacity: 0; } }
    @keyframes particle-5 { to { transform: translate(-30px, 0); opacity: 0; } }
    
    @keyframes confetti-0 { to { transform: translate(40px, 60px) rotate(180deg); opacity: 0; } }
    @keyframes confetti-1 { to { transform: translate(-40px, 60px) rotate(-180deg); opacity: 0; } }
    @keyframes confetti-2 { to { transform: translate(30px, 80px) rotate(360deg); opacity: 0; } }
    @keyframes confetti-3 { to { transform: translate(-30px, 80px) rotate(-360deg); opacity: 0; } }
    
    @keyframes slide-in-right {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scale-in {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }
    .animate-fade-in { animation: fade-in 0.3s ease-out; }
    .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
  `;
  document.head.appendChild(style);
}

