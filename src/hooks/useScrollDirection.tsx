'use client';

import { useEffect, useState, useRef } from 'react';

export type ScrollDirection = 'up' | 'down' | null;

interface UseScrollDirectionOptions {
  threshold?: number;
  enabled?: boolean;
}

/**
 * 检测滚动方向的 Hook
 * @param options - 配置选项
 * @param options.threshold - 触发检测的最小滚动距离（像素）
 * @param options.enabled - 是否启用滚动检测
 * @returns 滚动方向和当前滚动位置
 */
export function useScrollDirection(options: UseScrollDirectionOptions = {}) {
  const { threshold = 10, enabled = true } = options;
  
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>(null);
  const [scrollY, setScrollY] = useState(0);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // 更新滚动位置
          setScrollY(currentScrollY);
          
          // 计算滚动差值
          const diff = currentScrollY - lastScrollY.current;
          
          // 只有当滚动超过阈值时才更新方向
          if (Math.abs(diff) > threshold) {
            if (diff > 0) {
              setScrollDirection('down');
            } else {
              setScrollDirection('up');
            }
            lastScrollY.current = currentScrollY;
          }
          
          ticking.current = false;
        });
        
        ticking.current = true;
      }
    };

    // 初始化滚动位置
    lastScrollY.current = window.scrollY;
    setScrollY(window.scrollY);

    // 添加滚动监听器，使用 passive 优化性能
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, enabled]);

  return { scrollDirection, scrollY };
}

