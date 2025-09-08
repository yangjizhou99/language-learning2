/**
 * 优化的Cloze渲染组件
 * 使用React.memo和useMemo进行性能优化
 */

import React, { memo, useMemo, useCallback } from 'react';

interface ClozeBlank {
  id: number;
  type: string;
  answer: string;
  explanation: string;
}

interface ClozeItem {
  id: string;
  lang: string;
  level: number;
  topic: string;
  title: string;
  passage: string;
  blanks: ClozeBlank[];
}

interface ClozeRendererProps {
  item: ClozeItem;
  answers: Record<string, string>;
  showAnswers?: boolean;
  onAnswerChange: (id: string, value: string) => void;
  onSubmit?: () => void;
}

const ClozeRenderer = memo<ClozeRendererProps>(({ 
  item, 
  answers, 
  showAnswers = false, 
  onAnswerChange, 
  onSubmit 
}) => {
  // 记忆化正则表达式
  const blankRegex = useMemo(() => /(\{\{(\d+)\}\})/g, []);

  // 记忆化输入框组件
  const InputField = useMemo(() => {
    return memo<{ id: number; value: string; placeholder: string }>(({ id, value, placeholder }) => (
      <input
        className="mx-1 min-w-20 px-2 py-1 bg-background border-0 border-b-2 border-input focus:outline-none focus:ring-2 focus:ring-ring rounded-none"
        placeholder={placeholder}
        value={value}
        onChange={e => onAnswerChange(String(id), e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit?.();
          }
        }}
        autoComplete="off"
      />
    ));
  }, [onAnswerChange, onSubmit]);

  // 记忆化用户答案显示组件
  const UserAnswerDisplay = useMemo(() => {
    return memo<{ id: number; value: string }>(({ id, value }) => (
      <span
        className="mx-1 px-2 py-1 bg-blue-100 text-blue-800 border border-blue-300 rounded"
      >
        {value || '(未填写)'}
      </span>
    ));
  }, []);

  // 记忆化正确答案显示组件
  const CorrectAnswerDisplay = useMemo(() => {
    return memo<{ id: number; answer: string }>(({ id, answer }) => (
      <span
        className="mx-1 px-2 py-1 bg-green-100 text-green-800 border border-green-300 rounded"
      >
        {answer}
      </span>
    ));
  }, []);

  // 记忆化渲染逻辑
  const renderCloze = useMemo(() => {
    if (!item) return null;

    const parts: React.ReactNode[] = [];
    const text = item.passage;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // 重置正则表达式
    blankRegex.lastIndex = 0;

    while ((match = blankRegex.exec(text)) !== null) {
      const full = match[1];
      const idNum = Number(match[2]);
      const start = match.index;

      // 添加文本部分
      if (start > lastIndex) {
        parts.push(
          <span key={`t-${lastIndex}`}>
            {text.slice(lastIndex, start)}
          </span>
        );
      }

      // 根据显示模式添加不同的组件
      if (showAnswers) {
        // 显示答案模式
        const userAnswer = answers[String(idNum)] || '';
        const correctAnswer = item.blanks.find(b => b.id === idNum)?.answer || '';

        parts.push(
          <React.Fragment key={`answers-${idNum}-${start}`}>
            <UserAnswerDisplay id={idNum} value={userAnswer} />
            <span className="mx-1 text-gray-400">→</span>
            <CorrectAnswerDisplay id={idNum} answer={correctAnswer} />
          </React.Fragment>
        );
      } else {
        // 输入模式
        parts.push(
          <InputField
            key={`i-${idNum}-${start}`}
            id={idNum}
            value={answers[String(idNum)] || ''}
            placeholder="填空"
          />
        );
      }

      lastIndex = start + full.length;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push(
        <span key="t-tail">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  }, [item, answers, showAnswers, blankRegex, InputField, UserAnswerDisplay, CorrectAnswerDisplay]);

  return (
    <div className="leading-8 text-lg">
      {renderCloze}
    </div>
  );
});

ClozeRenderer.displayName = 'ClozeRenderer';

export default ClozeRenderer;
