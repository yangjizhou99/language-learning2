/**
 * 二次验证逻辑
 * 用于排除偶发错误，确认真正的薄弱项
 */

import type { Stat } from '@/types/pronunciation';
import { ci95 } from './stats';

/**
 * 判断是否需要二次验证
 * 
 * 触发条件（参考原文档第8章）:
 * - mean < 75 (低分)
 * - CI_width < 8 (数据已收敛)
 * 
 * @param stat 当前统计数据
 * @returns 是否需要验证
 */
export function needsSecondaryVerification(stat: Stat): boolean {
  if (stat.n < 3) {
    // 样本数太少，不需要验证
    return false;
  }

  const { mean } = stat;
  const ci = ci95(stat);

  if (!ci.width) {
    return false;
  }

  // 低分且数据收敛
  return mean < 75 && ci.width < 8;
}

/**
 * 判断验证结果是否需要替换原统计
 * 
 * 逻辑：
 * - 计算验证阶段的均值 μ'
 * - 与历史均值 μ 比较
 * - 若差异显著，用 μ' 替换
 * 
 * @param originalStat 原始统计
 * @param verificationMean 验证阶段的均值
 * @param verificationCount 验证样本数
 * @returns 是否需要替换
 */
export function shouldReplaceStats(
  originalStat: Stat,
  verificationMean: number,
  verificationCount: number
): boolean {
  if (verificationCount < 3) {
    // 验证样本太少，不替换
    return false;
  }

  const { mean } = originalStat;
  const ci = ci95(originalStat);
  const ciWidth = ci.width || 8;

  // 计算差异阈值
  const threshold = Math.max(8, 0.5 * ciWidth);

  // 判断差异是否显著
  const difference = Math.abs(verificationMean - mean);

  return difference > threshold;
}

/**
 * 生成验证建议
 * 
 * @param originalStat 原始统计
 * @param verificationMean 验证均值
 * @param replaced 是否已替换
 * @returns 建议文本
 */
export function generateVerificationAdvice(
  originalStat: Stat,
  verificationMean: number,
  replaced: boolean
): {
  conclusion: string;
  advice: string;
  severity: 'high' | 'medium' | 'low';
} {
  const diff = verificationMean - originalStat.mean;

  if (replaced) {
    if (diff > 0) {
      // 验证后分数更高（原评估过低）
      return {
        conclusion: '验证发现：原评估可能过于悲观',
        advice: '实际表现比之前更好，建议继续巩固练习',
        severity: 'medium',
      };
    } else {
      // 验证后分数更低（原评估过高）
      return {
        conclusion: '验证发现：之前可能偶然发挥较好',
        advice: '确认为薄弱项，强烈建议进行针对性训练',
        severity: 'high',
      };
    }
  } else {
    if (verificationMean < 75) {
      // 验证确认了薄弱项
      return {
        conclusion: '验证确认：此音节确实是薄弱项',
        advice: '建议进行针对性训练，掌握发音要领',
        severity: 'high',
      };
    } else if (verificationMean >= 75 && verificationMean < 85) {
      // 验证后还可以
      return {
        conclusion: '验证结果：基本掌握，仍有提升空间',
        advice: '可以进行适当练习，进一步提高准确度',
        severity: 'medium',
      };
    } else {
      // 验证后很好
      return {
        conclusion: '验证结果：表现优秀',
        advice: '已经掌握较好，可以继续保持',
        severity: 'low',
      };
    }
  }
}

/**
 * 为某个 Unit 选择验证句子
 * 
 * @param unitId 音节ID
 * @param lang 语言
 * @param count 需要的句子数量（默认5-7句）
 * @returns 句子ID列表
 */
export async function selectVerificationSentences(
  unitId: number,
  lang: string,
  count: number = 6
): Promise<number[]> {
  // 这个函数需要从数据库查询
  // 1. 优先选择包含该 unit 的句子
  // 2. 如果有最小对立词，优先选择对立词句子
  // 3. 难度适中（level 2-3）
  
  // 实际实现在 API 中进行
  return [];
}

/**
 * 计算验证阶段的统计数据
 * 
 * @param scores 验证阶段的分数数组
 * @returns 验证统计
 */
export function calculateVerificationStats(scores: number[]): {
  mean: number;
  count: number;
  min: number;
  max: number;
  stdDev: number;
} {
  if (scores.length === 0) {
    return { mean: 0, count: 0, min: 0, max: 0, stdDev: 0 };
  }

  const count = scores.length;
  const sum = scores.reduce((a, b) => a + b, 0);
  const mean = sum / count;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  // 计算标准差
  const variance = scores.reduce((acc, score) => {
    return acc + Math.pow(score - mean, 2);
  }, 0) / count;
  const stdDev = Math.sqrt(variance);

  return { mean, count, min, max, stdDev };
}

/**
 * 格式化验证报告
 * 
 * @param originalStat 原始统计
 * @param verificationStats 验证统计
 * @param replaced 是否替换
 * @returns 格式化的报告
 */
export function formatVerificationReport(
  originalStat: Stat,
  verificationStats: ReturnType<typeof calculateVerificationStats>,
  replaced: boolean
): {
  before: { mean: number; count: number };
  after: { mean: number; count: number };
  change: number;
  changePercent: number;
  replaced: boolean;
  advice: ReturnType<typeof generateVerificationAdvice>;
} {
  const change = verificationStats.mean - originalStat.mean;
  const changePercent = originalStat.mean > 0
    ? (change / originalStat.mean) * 100
    : 0;

  const advice = generateVerificationAdvice(
    originalStat,
    verificationStats.mean,
    replaced
  );

  return {
    before: {
      mean: Number(originalStat.mean.toFixed(1)),
      count: originalStat.n,
    },
    after: {
      mean: Number(verificationStats.mean.toFixed(1)),
      count: verificationStats.count,
    },
    change: Number(change.toFixed(1)),
    changePercent: Number(changePercent.toFixed(1)),
    replaced,
    advice,
  };
}

