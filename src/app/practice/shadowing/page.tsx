'use client';
import React from 'react';
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
  const { language: currentLanguage } = useLanguage();
  const urlLang = searchParams?.get('lang') as 'ja' | 'en' | 'zh' | null;

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
