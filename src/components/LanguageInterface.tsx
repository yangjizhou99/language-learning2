import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface LanguageInterfaceProps {
  children: React.ReactNode;
}

// 中文界面组件
const ChineseInterface: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="chinese-interface">{children}</div>;
};

// 日文界面组件
const JapaneseInterface: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="japanese-interface">{children}</div>;
};

// 英文界面组件
const EnglishInterface: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="english-interface">{children}</div>;
};

// 语言界面切换器
const LanguageInterface: React.FC<LanguageInterfaceProps> = ({ children }) => {
  const { language } = useLanguage();

  switch (language) {
    case 'zh':
      return <ChineseInterface>{children}</ChineseInterface>;
    case 'ja':
      return <JapaneseInterface>{children}</JapaneseInterface>;
    case 'en':
      return <EnglishInterface>{children}</EnglishInterface>;
    default:
      return <ChineseInterface>{children}</ChineseInterface>;
  }
};

export default LanguageInterface;
