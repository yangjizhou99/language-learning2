"use client";
import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import ChineseShadowingPage from '@/components/shadowing/ChineseShadowingPage';
import JapaneseShadowingPage from '@/components/shadowing/JapaneseShadowingPage';
import EnglishShadowingPage from '@/components/shadowing/EnglishShadowingPage';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ShadowingPage() {
  const searchParams = useSearchParams();
  const { language: currentLanguage, setLanguage } = useLanguage();
  const urlLang = searchParams?.get('lang') as 'ja' | 'en' | 'zh' | null;
  
  // 同步URL参数到界面语言
  useEffect(() => {
    if (urlLang && ['ja', 'en', 'zh'].includes(urlLang) && urlLang !== currentLanguage) {
      setLanguage(urlLang);
    }
  }, [urlLang, currentLanguage, setLanguage]);

  const lang = urlLang || currentLanguage;

  switch (lang) {
    case 'ja':
      return <JapaneseShadowingPage />;
    case 'en':
      return <EnglishShadowingPage />;
    case 'zh':
    default:
      return <ChineseShadowingPage />;
  }
}