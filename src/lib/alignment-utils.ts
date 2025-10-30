/**
 * Shadowing 评分对齐算法工具
 * 实现基于动态规划的 Levenshtein 对齐算法，支持 ACU 单元匹配
 */

export interface AcuUnit {
  span: string;
  start: number;
  end: number;
  sid: number;
}

export interface AlignmentOperation {
  type: '=' | 'I' | 'D' | 'S';  // 匹配、插入、删除、替换
  targetIdx?: number;
  saidIdx?: number;
  targetToken?: string;
  saidToken?: string;
}

export interface AlignmentError {
  type: 'extra' | 'missing' | 'substitution';
  position: number;
  expected?: string;      // 正确的内容
  actual: string;         // 用户读的内容
  acuUnit?: AcuUnit;      // 对应的ACU单元
  acuContext?: string;    // ACU单元的上下文
}

export interface AlignmentResult {
  distance: number;
  operations: AlignmentOperation[];
  extra: AlignmentError[];      // 多读
  missing: AlignmentError[];    // 少读
  substitution: AlignmentError[]; // 读错
}

/**
 * 智能连接 token：
 * - 若检测到包含英文字母的 token，则使用空格连接（英文保留单词空格）
 * - 否则使用无分隔连接（适用于中日等字符级 token）
 */
function joinTokensSmart(tokens: Array<string | undefined>): string {
  const safe = (tokens || []).filter((t): t is string => Boolean(t));
  const hasLatin = safe.some((t) => /[A-Za-z]/.test(t));
  return hasLatin ? safe.join(' ') : safe.join('');
}

/**
 * 计算编辑距离并返回操作路径
 */
export function levenshteinWithAlignment(target: string[], said: string[]): {
  distance: number;
  operations: AlignmentOperation[];
} {
  const m = target.length;
  const n = said.length;
  
  // 创建 DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  // 初始化边界
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 填充 DP 表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = target[i - 1] === said[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 删除
        dp[i][j - 1] + 1,      // 插入
        dp[i - 1][j - 1] + cost // 替换或匹配
      );
    }
  }
  
  // 回溯生成操作序列
  const operations: AlignmentOperation[] = [];
  let i = m, j = n;
  
  while (i > 0 || j > 0) {
    const current = dp[i][j];
    const cost = (i > 0 && j > 0) ? (target[i - 1] === said[j - 1] ? 0 : 1) : 1;
    
    if (i > 0 && j > 0 && dp[i - 1][j - 1] + cost === current) {
      // 匹配或替换
      operations.unshift({
        type: target[i - 1] === said[j - 1] ? '=' : 'S',
        targetIdx: i - 1,
        saidIdx: j - 1,
        targetToken: target[i - 1],
        saidToken: said[j - 1]
      });
      i--;
      j--;
    } else if (i > 0 && dp[i - 1][j] + 1 === current) {
      // 删除
      operations.unshift({
        type: 'D',
        targetIdx: i - 1,
        targetToken: target[i - 1]
      });
      i--;
    } else if (j > 0 && dp[i][j - 1] + 1 === current) {
      // 插入
      operations.unshift({
        type: 'I',
        saidIdx: j - 1,
        saidToken: said[j - 1]
      });
      j--;
    } else {
      // 回退到删除
      operations.unshift({
        type: 'D',
        targetIdx: i - 1,
        targetToken: target[i - 1]
      });
      i--;
    }
  }
  
  return {
    distance: dp[m][n],
    operations
  };
}

/**
 * 合并连续的操作片段
 */
function mergeConsecutiveOperations(operations: AlignmentOperation[]): AlignmentOperation[][] {
  if (operations.length === 0) return [];
  
  const groups: AlignmentOperation[][] = [];
  let currentGroup: AlignmentOperation[] = [operations[0]];
  
  for (let i = 1; i < operations.length; i++) {
    const current = operations[i];
    const previous = operations[i - 1];
    
    // 检查是否应该合并到当前组
    const shouldMerge = 
      current.type === previous.type && (
        current.type === 'I' || 
        current.type === 'D' || 
        current.type === 'S'
      );
    
    if (shouldMerge) {
      currentGroup.push(current);
    } else {
      groups.push(currentGroup);
      currentGroup = [current];
    }
  }
  
  groups.push(currentGroup);
  return groups;
}

/**
 * 根据 token 位置查找对应的 ACU 单元
 */
function findAcuUnit(
  tokenIndex: number,
  tokens: string[],
  acuUnits: AcuUnit[],
  currentSentence: string
): AcuUnit | undefined {
  if (!acuUnits || acuUnits.length === 0) return undefined;
  
  // 计算当前token在当前句子中的字符位置
  let charPosition = 0;
  for (let i = 0; i < tokenIndex && i < tokens.length; i++) {
    charPosition += tokens[i].length;
  }
  
  // 获取当前token
  const currentToken = tokens[tokenIndex];
  
  // 在当前句子中查找匹配的ACU单元
  // 找到包含当前token的ACU单元，优先选择更长的
  const matchingUnits = [];
  
  for (const unit of acuUnits) {
    // 检查ACU单元的文本是否在当前句子中
    if (currentSentence.includes(unit.span)) {
      // 检查ACU单元是否包含当前token
      if (unit.span.includes(currentToken)) {
        matchingUnits.push(unit);
      }
    }
  }
  
  // 如果有匹配的单元，选择最长的那个
  if (matchingUnits.length > 0) {
    const bestUnit = matchingUnits.reduce((longest, current) => 
      current.span.length > longest.span.length ? current : longest
    );
    return bestUnit;
  }
  
  return undefined;
}

/**
 * 分析对齐结果，生成三类错误
 */
export function analyzeAlignment(
  target: string[],
  said: string[],
  operations: AlignmentOperation[],
  acuUnits?: AcuUnit[],
  originalText?: string
): {
  extra: AlignmentError[];
  missing: AlignmentError[];
  substitution: AlignmentError[];
} {
  const extra: AlignmentError[] = [];
  const missing: AlignmentError[] = [];
  const substitution: AlignmentError[] = [];
  
  
  // 合并连续操作
  const operationGroups = mergeConsecutiveOperations(operations);
  
  for (const group of operationGroups) {
    if (group.length === 0) continue;
    
    const firstOp = group[0];
    const lastOp = group[group.length - 1];
    
    switch (firstOp.type) {
      case 'I': {
        // 插入操作 -> 多读
        const actualTokens = group.map(op => op.saidToken).filter(Boolean);
        const actualText = joinTokensSmart(actualTokens);
        
        extra.push({
          type: 'extra',
          position: firstOp.saidIdx || 0,
          actual: actualText
        });
        break;
      }
      
      case 'D': {
        // 删除操作 -> 少读
        const expectedTokens = group.map(op => op.targetToken).filter(Boolean);
        const expectedText = joinTokensSmart(expectedTokens);
        
        // 查找对应的 ACU 单元
        const acuUnit = findAcuUnit(
          firstOp.targetIdx || 0,
          target,
          acuUnits || [],
          originalText || ''
        );
        
        // 尝试找到用户实际读到的部分内容
        let actualText = '未读';
        if (acuUnit && acuUnit.span) {
          // 如果ACU单元存在，尝试找到用户实际读到的部分
          const acuSpan = acuUnit.span;
          const userSaidText = joinTokensSmart(said);
          
          // 检查用户是否读了ACU单元的部分内容
          for (let i = 0; i < acuSpan.length; i++) {
            const partialSpan = acuSpan.substring(0, i + 1);
            if (userSaidText.includes(partialSpan)) {
              actualText = partialSpan;
            }
          }
        }
        
        missing.push({
          type: 'missing',
          position: firstOp.targetIdx || 0,
          expected: acuUnit ? acuUnit.span : expectedText, // 优先使用完整的ACU单元内容
          actual: actualText,
          acuUnit,
          acuContext: acuUnit ? acuUnit.span : undefined
        });
        break;
      }
      
      case 'S': {
        // 替换操作 -> 读错
        const expectedTokens = group.map(op => op.targetToken).filter(Boolean);
        const actualTokens = group.map(op => op.saidToken).filter(Boolean);
        const expectedText = joinTokensSmart(expectedTokens);
        const actualText = joinTokensSmart(actualTokens);
        
        // 查找对应的 ACU 单元
        const acuUnit = findAcuUnit(
          firstOp.targetIdx || 0,
          target,
          acuUnits || [],
          originalText || ''
        );
        
        // 如果找到了ACU单元，需要找到用户读错的完整内容
        let fullActualText = actualText;
        if (acuUnit) {
          // 尝试找到用户读错的完整内容，匹配ACU单元的长度
          const acuLength = acuUnit.span.length;
          if (actualText.length < acuLength) {
            // 如果用户读的内容比ACU单元短，尝试从用户输入中找到更长的匹配
            const userInput = joinTokensSmart(said);
            const startPos = firstOp.saidIdx || 0;
            const endPos = Math.min(startPos + acuLength, said.length);
            fullActualText = joinTokensSmart(said.slice(startPos, endPos));
          }
        }
        
        substitution.push({
          type: 'substitution',
          position: firstOp.targetIdx || 0,
          expected: acuUnit ? acuUnit.span : expectedText, // 优先使用完整的ACU单元内容
          actual: fullActualText,
          acuUnit,
          acuContext: acuUnit ? acuUnit.span : undefined
        });
        break;
      }
    }
  }
  
  return { extra, missing, substitution };
}

/**
 * 主要的对齐分析函数
 */
export function performAlignment(
  target: string[],
  said: string[],
  acuUnits?: AcuUnit[],
  originalText?: string
): AlignmentResult {
  const { distance, operations } = levenshteinWithAlignment(target, said);
  const { extra, missing, substitution } = analyzeAlignment(
    target,
    said,
    operations,
    acuUnits,
    originalText
  );
  
  return {
    distance,
    operations,
    extra,
    missing,
    substitution
  };
}

/**
 * 计算综合相似度评分
 */
export function calculateSimilarityScore(
  target: string[],
  said: string[],
  alignmentResult: AlignmentResult
): number {
  const maxLen = Math.max(target.length, said.length, 1);
  const distance = alignmentResult.distance;
  const similarity = 1 - distance / maxLen;
  
  // 考虑覆盖度
  const coverage = target.length > 0 ? Math.min(1, said.length / target.length) : 0;
  
  // 合并相似度和覆盖度
  return (similarity + coverage) / 2;
}
