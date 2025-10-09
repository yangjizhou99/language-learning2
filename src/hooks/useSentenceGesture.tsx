'use client';

import { useEffect, useRef, RefObject } from 'react';

interface UseSentenceGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onDoubleTap?: () => void;
  enabled?: boolean;
  threshold?: number;
}

/**
 * 句子卡片手势检测 Hook
 * 用于检测滑动和双击手势
 */
export function useSentenceGesture(
  elementRef: RefObject<HTMLElement>,
  options: UseSentenceGestureOptions = {}
) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onDoubleTap,
    enabled = true,
    threshold = 50,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // 检测双击
      const timeSinceLastTap = Date.now() - lastTapRef.current;
      if (timeSinceLastTap < 300 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        onDoubleTap?.();
        lastTapRef.current = 0;
        touchStartRef.current = null;
        return;
      }
      lastTapRef.current = Date.now();

      // 检测滑动（需要是快速滑动）
      if (deltaTime < 300 && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      }

      touchStartRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, onSwipeLeft, onSwipeRight, onDoubleTap]);
}

