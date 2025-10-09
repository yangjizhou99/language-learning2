'use client';

import { useEffect, useRef, RefObject } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeGestureCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: (x: number, y: number) => void;
  onSwipeMove?: (deltaX: number, deltaY: number) => void;
  onSwipeEnd?: () => void;
}

interface UseSwipeGestureOptions extends SwipeGestureCallbacks {
  threshold?: number;
  enabled?: boolean;
  preventScroll?: boolean;
}

/**
 * 滑动手势检测 Hook
 * @param elementRef - 要监听手势的元素引用
 * @param options - 配置选项和回调函数
 * @returns void
 */
export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  options: UseSwipeGestureOptions = {}
) {
  const {
    threshold = 50,
    enabled = true,
    preventScroll = false,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
  } = options;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
      
      if (onSwipeStart) {
        onSwipeStart(touch.clientX, touch.clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      const currentX = touch.clientX;
      const currentY = touch.clientY;
      
      touchMoveRef.current = { x: currentX, y: currentY };
      
      if (onSwipeMove) {
        const deltaX = currentX - touchStartRef.current.x;
        const deltaY = currentY - touchStartRef.current.y;
        onSwipeMove(deltaX, deltaY);
      }

      if (preventScroll) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current || !touchMoveRef.current) return;

      const deltaX = touchMoveRef.current.x - touchStartRef.current.x;
      const deltaY = touchMoveRef.current.y - touchStartRef.current.y;

      // 判断是横向还是纵向滑动
      const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

      if (isHorizontal) {
        // 横向滑动
        if (Math.abs(deltaX) > threshold) {
          if (deltaX > 0) {
            onSwipeRight?.();
          } else {
            onSwipeLeft?.();
          }
        }
      } else {
        // 纵向滑动
        if (Math.abs(deltaY) > threshold) {
          if (deltaY > 0) {
            onSwipeDown?.();
          } else {
            onSwipeUp?.();
          }
        }
      }

      if (onSwipeEnd) {
        onSwipeEnd();
      }

      touchStartRef.current = null;
      touchMoveRef.current = null;
    };

    // 添加事件监听器
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventScroll });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventScroll });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [
    enabled,
    threshold,
    preventScroll,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeMove,
    onSwipeEnd,
  ]);
}

