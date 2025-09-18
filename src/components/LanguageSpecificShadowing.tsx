import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChineseShadowingInterface from './ChineseShadowingInterface';
import JapaneseShadowingInterface from './JapaneseShadowingInterface';
import EnglishShadowingInterface from './EnglishShadowingInterface';

interface LanguageSpecificShadowingProps {
  children: React.ReactNode;
}

const LanguageSpecificShadowing: React.FC<LanguageSpecificShadowingProps> = ({ children }) => {
  const { language } = useLanguage();

  // 根据语言返回不同的界面组件
  switch (language) {
    case 'zh':
      return <ChineseShadowingInterface>{children}</ChineseShadowingInterface>;
    case 'ja':
      return <JapaneseShadowingInterface>{children}</JapaneseShadowingInterface>;
    case 'en':
      return <EnglishShadowingInterface>{children}</EnglishShadowingInterface>;
    default:
      return <ChineseShadowingInterface>{children}</ChineseShadowingInterface>;
  }
};

export default LanguageSpecificShadowing;
