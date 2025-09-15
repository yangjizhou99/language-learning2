"use client";
import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import ChineseShadowingPage from './ChineseShadowingPage';
import JapaneseShadowingPage from './JapaneseShadowingPage';
import EnglishShadowingPage from './EnglishShadowingPage';

const LanguageSpecificShadowingPage: React.FC = () => {
  const { language } = useLanguage();

  switch (language) {
    case 'zh':
      return <ChineseShadowingPage />;
    case 'ja':
      return <JapaneseShadowingPage />;
    case 'en':
      return <EnglishShadowingPage />;
    default:
      return <ChineseShadowingPage />;
  }
};

export default LanguageSpecificShadowingPage;





