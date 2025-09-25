'use client';
import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useLanguage } from '@/contexts/LanguageContext';

const ChineseShadowingPage = dynamic(
  () => import('@/components/shadowing/ChineseShadowingPage'),
  { ssr: false }
);

const JapaneseShadowingPage = dynamic(
  () => import('@/components/shadowing/JapaneseShadowingPage'),
  { ssr: false }
);

const EnglishShadowingPage = dynamic(
  () => import('@/components/shadowing/EnglishShadowingPage'),
  { ssr: false }
);

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
