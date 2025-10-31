/**
 * 简单直观的句子对比分析工具函数
 * 用于对比原文和转录文本，计算匹配度和评分
 */

export interface SentenceAnalysis {
  sentence: string;
  status: 'correct' | 'partial' | 'missing';
  issues: string[];
  score: number;
}

export interface SimpleAnalysisResult {
  sentenceAnalysis: SentenceAnalysis[];
  overallScore: number;
}

/**
 * 检查发音错误（仅用于英文）
 */
function checkPronunciationErrors(
  originalWords: string[],
  transcribedWords: string[],
  t?: { shadowing?: { pronounced_as?: string } },
): string[] {
  const errors: string[] = [];

  // 常见发音错误检查
  const commonErrors = [
    { original: 'today', error: 'tomorrow' },
    { original: 'tomorrow', error: 'today' },
    { original: 'no', error: 'now' },
    { original: 'now', error: 'no' },
    { original: 'it', error: 'is' },
    { original: 'is', error: 'it' },
  ];

  for (const error of commonErrors) {
    if (originalWords.includes(error.original) && transcribedWords.includes(error.error)) {
      const msg = (t?.shadowing?.pronounced_as || '"{original}" 说成了 "{error}"')
        .replace('{original}', error.original)
        .replace('{error}', error.error);
      errors.push(msg);
    }
  }

  return errors;
}

/**
 * 简单直观的句子对比分析
 * @param originalText 原文
 * @param transcribedText 转录文本
 * @param t 可选的翻译对象，用于错误消息国际化
 * @returns 分析结果，包含句子分析和整体评分
 */
export function performSimpleAnalysis(
  originalText: string,
  transcribedText: string,
  t?: { shadowing?: { issue_missing_chars?: string; issue_missing_words?: string; issue_most_missing?: string; pronounced_as?: string } },
): SimpleAnalysisResult {
  // 检查是否为中文
  const isChinese = /[\u4e00-\u9fff]/.test(originalText);

  let originalSentences: string[];
  let cleanTranscribed: string[];

  if (isChinese) {
    // 中文处理：按A:, B:分割对话
    originalSentences = originalText
      .split(/(?=[AB]:)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 清理转录文本（中文）
    cleanTranscribed = transcribedText
      .replace(/[。！？、，\s]+/g, '')
      .split('')
      .filter((c) => c.length > 0);
  } else {
    // 英文处理：按A:, B:分割
    originalSentences = originalText
      .split(/(?=[A-Z]:)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 清理转录文本（英文）
    cleanTranscribed = transcribedText
      .replace(/[.!?,\s]+/g, ' ')
      .split(' ')
      .map((w) => w.toLowerCase().trim())
      .filter((w) => w.length > 0);
  }

  const sentenceAnalysis: SentenceAnalysis[] = [];

  // 分析每个句子
  for (const sentence of originalSentences) {
    let cleanSentence: string[];

    if (isChinese) {
      // 中文处理：按字符分割，移除角色标识符
      cleanSentence = sentence
        .replace(/^[AB]:\s*/, '') // 移除角色标识符
        .replace(/[。！？、，\s]+/g, '')
        .split('')
        .filter((c) => c.length > 0);
    } else {
      // 英文处理：按单词分割
      cleanSentence = sentence
        .replace(/^[A-Z]:\s*/, '') // 移除角色标识符
        .replace(/[.!?,\s]+/g, ' ')
        .split(' ')
        .map((w) => w.toLowerCase().trim())
        .filter((w) => w.length > 0);
    }

    // 计算句子匹配度
    const matchedItems = cleanSentence.filter((item) => cleanTranscribed.includes(item));

    const matchRatio = cleanSentence.length > 0 ? matchedItems.length / cleanSentence.length : 0;

    let status: 'correct' | 'partial' | 'missing';
    const issues: string[] = [];

    if (matchRatio >= 0.9) {
      status = 'correct';
    } else if (matchRatio >= 0.5) {
      status = 'partial';
      // 找出遗漏的内容
      const missingItems = cleanSentence.filter((item) => !cleanTranscribed.includes(item));
      if (missingItems.length > 0) {
        if (isChinese) {
          issues.push(
            (t?.shadowing?.issue_missing_chars || '遗漏字符: {items}').replace(
              '{items}',
              missingItems.join(''),
            ),
          );
        } else {
          issues.push(
            (t?.shadowing?.issue_missing_words || '遗漏单词: {items}').replace(
              '{items}',
              missingItems.join(', '),
            ),
          );
        }
      }
    } else {
      status = 'missing';
      issues.push(t?.shadowing?.issue_most_missing || '大部分内容未说出');
    }

    // 检查发音错误（仅英文）
    if (!isChinese) {
      const pronunciationErrors = checkPronunciationErrors(cleanSentence, cleanTranscribed, t);
      if (pronunciationErrors.length > 0) {
        issues.push(...pronunciationErrors);
      }
    }

    sentenceAnalysis.push({
      sentence: sentence.replace(/^[AB]:\s*/, ''), // 移除角色标识符
      status,
      issues,
      score: Math.round(matchRatio * 100),
    });
  }

  const overallScore =
    sentenceAnalysis.length > 0
      ? Math.round(sentenceAnalysis.reduce((sum, s) => sum + s.score, 0) / sentenceAnalysis.length)
      : 0;

  return { sentenceAnalysis, overallScore };
}
