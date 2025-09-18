// 简单直观的句子对比分析组件
export const SimpleAnalysisDisplay = ({
  originalText,
  transcribedText,
}: {
  originalText: string;
  transcribedText: string;
}) => {
  // 将原文按句子分割（以A:, B:为分界）
  const originalSentences = originalText
    .split(/(?=[A-Z]:)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 清理转录文本
  const cleanTranscribed = transcribedText
    .replace(/[.!?,\s]+/g, ' ')
    .split(' ')
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 0);

  console.log('原文句子:', originalSentences);
  console.log('转录单词:', cleanTranscribed);

  const sentenceAnalysis: Array<{
    sentence: string;
    status: 'correct' | 'partial' | 'missing';
    issues: string[];
    score: number;
  }> = [];

  // 分析每个句子
  for (const sentence of originalSentences) {
    const cleanSentence = sentence
      .replace(/^[A-Z]:\s*/, '') // 移除角色标识符
      .replace(/[.!?,\s]+/g, ' ')
      .split(' ')
      .map((w) => w.toLowerCase().trim())
      .filter((w) => w.length > 0);

    // 计算句子匹配度
    const matchedWords = cleanSentence.filter((word) => cleanTranscribed.includes(word));

    const matchRatio = cleanSentence.length > 0 ? matchedWords.length / cleanSentence.length : 0;

    let status: 'correct' | 'partial' | 'missing';
    let issues: string[] = [];

    if (matchRatio >= 0.9) {
      status = 'correct';
    } else if (matchRatio >= 0.5) {
      status = 'partial';
      // 找出遗漏的单词
      const missingWords = cleanSentence.filter((word) => !cleanTranscribed.includes(word));
      if (missingWords.length > 0) {
        issues.push(`遗漏单词: ${missingWords.join(', ')}`);
      }
    } else {
      status = 'missing';
      issues.push('大部分内容未说出');
    }

    // 检查发音错误
    const pronunciationErrors = checkPronunciationErrors(cleanSentence, cleanTranscribed);
    if (pronunciationErrors.length > 0) {
      issues.push(...pronunciationErrors);
    }

    sentenceAnalysis.push({
      sentence: sentence.replace(/^[A-Z]:\s*/, ''), // 显示时移除角色标识符
      status,
      issues,
      score: Math.round(matchRatio * 100),
    });
  }

  const overallScore =
    sentenceAnalysis.length > 0
      ? Math.round(sentenceAnalysis.reduce((sum, s) => sum + s.score, 0) / sentenceAnalysis.length)
      : 0;

  return (
    <div>
      {/* 整体评分 */}
      <div className="mb-4 p-3 bg-white rounded border">
        <div className="text-sm font-medium mb-2">整体评分：</div>
        <div className="text-2xl font-bold text-blue-600">{overallScore}%</div>
      </div>

      {/* 句子分析 */}
      <div className="space-y-3">
        {sentenceAnalysis.map((sentence, idx) => (
          <div
            key={idx}
            className={`p-3 rounded border ${
              sentence.status === 'correct'
                ? 'bg-green-50 border-green-200'
                : sentence.status === 'partial'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                {sentence.status === 'correct' && '✓ '}
                {sentence.status === 'partial' && '⚠ '}
                {sentence.status === 'missing' && '❌ '}
                句子 {idx + 1}
              </div>
              <div className="text-sm font-bold">{sentence.score}%</div>
            </div>

            <div className="text-sm mb-2">
              <span className="font-medium">原文：</span>
              <span className="text-gray-700">"{sentence.sentence}"</span>
            </div>

            {sentence.issues.length > 0 && (
              <div className="text-xs">
                <span className="font-medium text-red-600">问题：</span>
                <ul className="mt-1 space-y-1">
                  {sentence.issues.map((issue, issueIdx) => (
                    <li key={issueIdx} className="text-red-600">
                      • {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs text-gray-600">💡 分析基于句子级别，更直观地显示发音问题</div>
    </div>
  );
};

// 检查发音错误
const checkPronunciationErrors = (originalWords: string[], transcribedWords: string[]) => {
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
      errors.push(`"${error.original}" 说成了 "${error.error}"`);
    }
  }

  return errors;
};
