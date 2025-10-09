'use client';
import React from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const ChineseShadowingPage = dynamic(
  () => import('@/components/shadowing/ChineseShadowingPage'),
  { ssr: false, loading: () => <div className="p-4 text-gray-500">Loading…</div> }
);

const JapaneseShadowingPage = dynamic(
  () => import('@/components/shadowing/JapaneseShadowingPage'),
  { ssr: false, loading: () => <div className="p-4 text-gray-500">Loading…</div> }
);

const EnglishShadowingPage = dynamic(
  () => import('@/components/shadowing/EnglishShadowingPage'),
  { ssr: false, loading: () => <div className="p-4 text-gray-500">Loading…</div> }
);

export default function ShadowingPage() {
  const searchParams = useSearchParams();
  const { language: currentLanguage } = useLanguage();
  const urlLang = searchParams?.get('lang') as 'ja' | 'en' | 'zh' | null;

  const lang = urlLang || currentLanguage;

  // Prefetch likely-used language component for smoother transition
  useEffect(() => {
    const target = lang;
    if (target === 'zh') {
      // Fire-and-forget
      import('@/components/shadowing/ChineseShadowingPage');
    } else if (target === 'ja') {
      import('@/components/shadowing/JapaneseShadowingPage');
    } else if (target === 'en') {
      import('@/components/shadowing/EnglishShadowingPage');
    }
  }, [lang]);

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
