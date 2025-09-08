"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang } from '@/types/lang';
import { translations, Translations } from '@/lib/i18n';

interface LanguageContextType {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>('zh');

  // 初始化语言设置
  useEffect(() => {
    // 从本地存储或浏览器语言检测默认语言
    const savedLanguage = localStorage.getItem('preferred-language') as Lang;
    if (savedLanguage && ['zh', 'en', 'ja'].includes(savedLanguage)) {
      setLanguageState(savedLanguage);
    } else {
      // 根据浏览器语言自动选择
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('zh')) {
        setLanguageState('zh');
      } else if (browserLang.startsWith('ja')) {
        setLanguageState('ja');
      } else {
        setLanguageState('en');
      }
    }
  }, []);

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang);
    localStorage.setItem('preferred-language', lang);
    
    // 更新HTML lang属性
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';
    }
  };

  const value = {
    language,
    setLanguage,
    t: translations[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// 便捷的翻译Hook
export function useTranslation() {
  const { t } = useLanguage();
  return t;
}
