// =====================================================
// AI发音纠正系统 - 统计工具函数
// =====================================================

import type { Stat, ConfidenceInterval, Grade } from '@/types/pronunciation';

/**
 * Welford 增量更新算法
 * 用于在线计算均值和方差，数值稳定
 * @param cur 当前统计数据
 * @param x 新样本值
 * @returns 更新后的统计数据
 */
export function welfordUpdate(cur: Stat, x: number): Stat {
  const n = cur.n + 1;
  const delta = x - cur.mean;
  const mean = cur.mean + delta / n;
  const delta2 = x - mean;
  const m2 = cur.m2 + delta * delta2;

  return { n, mean, m2 };
}

/**
 * Welford 逆向更新算法（移除样本）
 * 用于从统计中移除一个旧样本
 * @param cur 当前统计数据
 * @param x 要移除的样本值
 * @returns 更新后的统计数据
 */
export function welfordRemove(cur: Stat, x: number): Stat {
  if (cur.n <= 1) {
    // 移除最后一个样本，返回空统计
    return { n: 0, mean: 0, m2: 0 };
  }

  const n = cur.n - 1;
  const delta = x - cur.mean;
  const mean = (cur.mean * cur.n - x) / n;
  const delta2 = x - mean;
  const m2 = cur.m2 - delta * delta2;

  return { n, mean, m2: Math.max(0, m2) }; // 确保 m2 不为负（数值误差）
}

/**
 * 计算 95% 置信区间
 * @param stat 统计数据
 * @returns 置信区间（low, high, width）
 */
export function ci95(stat: Stat): ConfidenceInterval {
  if (stat.n < 2) {
    return { low: undefined, high: undefined, width: undefined };
  }

  // 样本方差
  const variance = stat.m2 / (stat.n - 1);
  // 标准误
  const standardError = Math.sqrt(variance / stat.n);
  // 95% 置信区间 (z = 1.96)
  const margin = 1.96 * standardError;

  return {
    low: stat.mean - margin,
    high: stat.mean + margin,
    width: 2 * margin,
  };
}

/**
 * 根据均值和置信区间下限映射等级
 * A: mean ≥ 85 且 ci_low ≥ 80
 * B: 75 ≤ mean < 85 或 CI 穿越 80
 * C: mean < 75
 * @param mean 均值
 * @param ciLow 置信区间下限（可选）
 * @returns 等级 A/B/C
 */
export function gradeFromMeanCI(mean: number, ciLow?: number): Grade {
  // 如果没有置信区间（样本数 < 2），仅根据均值判断
  if (ciLow === undefined) {
    if (mean >= 85) return 'A';
    if (mean >= 75) return 'B';
    return 'C';
  }

  // 有置信区间时，考虑置信区间下限
  if (mean >= 85 && ciLow >= 80) {
    return 'A';
  }

  if (mean >= 75) {
    return 'B';
  }

  return 'C';
}

/**
 * 批量更新多个样本（用于批量计算）
 * @param cur 当前统计数据
 * @param samples 样本数组
 * @returns 更新后的统计数据
 */
export function welfordBatchUpdate(cur: Stat, samples: number[]): Stat {
  let result = { ...cur };
  for (const sample of samples) {
    result = welfordUpdate(result, sample);
  }
  return result;
}

/**
 * 计算标准差
 * @param stat 统计数据
 * @returns 标准差
 */
export function standardDeviation(stat: Stat): number {
  if (stat.n < 2) return 0;
  const variance = stat.m2 / (stat.n - 1);
  return Math.sqrt(variance);
}

/**
 * 判断样本是否有效（根据 completeness 阈值）
 * @param completeness 完整度分数
 * @param threshold 阈值（默认 0.6）
 * @returns 是否有效
 */
export function isValidSample(completeness: number, threshold: number = 0.6): boolean {
  return completeness >= threshold;
}

/**
 * 计算两个统计数据的差异（用于二次验证）
 * @param stat1 统计数据1
 * @param stat2 统计数据2
 * @returns 均值差异的绝对值
 */
export function meanDifference(stat1: Stat, stat2: Stat): number {
  return Math.abs(stat1.mean - stat2.mean);
}

/**
 * 判断是否需要二次验证
 * @param mean 均值
 * @param ciWidth 置信区间宽度
 * @param meanThreshold 均值阈值（默认 75）
 * @param ciWidthThreshold CI宽度阈值（默认 8）
 * @returns 是否需要二次验证
 */
export function needsSecondaryVerification(
  mean: number,
  ciWidth?: number,
  meanThreshold: number = 75,
  ciWidthThreshold: number = 8
): boolean {
  if (ciWidth === undefined) return false;
  return mean < meanThreshold && ciWidth < ciWidthThreshold;
}

