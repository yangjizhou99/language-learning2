import { useEffect, useState } from 'react';

/**
 * 数字计数增长动画Hook
 * @param targetValue 目标数值
 * @param duration 动画持续时间（毫秒）
 * @param enabled 是否启用动画
 */
export function useCounterAnimation(
  targetValue: number,
  duration: number = 1500,
  enabled: boolean = true
): number {
  const [currentValue, setCurrentValue] = useState(enabled ? 0 : targetValue);

  useEffect(() => {
    if (!enabled) {
      setCurrentValue(targetValue);
      return;
    }

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用easeOutExpo缓动函数
      const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const value = Math.floor(startValue + (targetValue - startValue) * easeOutExpo);

      setCurrentValue(value);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCurrentValue(targetValue);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration, enabled]);

  return currentValue;
}

