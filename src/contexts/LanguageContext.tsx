"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang } from '@/types/lang';
import { translations, Translations } from '@/lib/i18n';
import ClientOnly from '@/components/ClientOnly';

interface LanguageContextType {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  setLanguageFromUserProfile: (nativeLang: string) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Lang>('zh');
  const [mounted, setMounted] = useState(false);
  const [hasSetFromProfile, setHasSetFromProfile] = useState(false);

  // 确保组件已挂载
  useEffect(() => {
    setMounted(true);
  }, []);

  // 初始化语言设置
  useEffect(() => {
    if (!mounted) return;
    
    // 检查是否已经根据用户资料设置过语言
    const profileLanguageSet = localStorage.getItem('profile-language-set');
    if (profileLanguageSet === 'true') {
      // 如果已经根据用户资料设置过，使用保存的语言
      const savedLanguage = localStorage.getItem('preferred-language') as Lang;
      if (savedLanguage && ['zh', 'en', 'ja'].includes(savedLanguage)) {
        setLanguageState(savedLanguage);
        setHasSetFromProfile(true);
        return;
      }
    }
    
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
  }, [mounted]);

  const setLanguage = (lang: Lang) => {
    setLanguageState(lang);
    
    // 只在客户端更新localStorage和HTML属性
    if (mounted) {
      localStorage.setItem('preferred-language', lang);
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';
    }
  };

  // 根据用户母语设置界面语言
  const setLanguageFromUserProfile = (nativeLang: string) => {
    if (!mounted || hasSetFromProfile) return;
    
    // 将用户母语映射到界面语言
    let interfaceLang: Lang;
    switch (nativeLang) {
      case 'zh':
        interfaceLang = 'zh';
        break;
      case 'ja':
        interfaceLang = 'ja';
        break;
      case 'en':
        interfaceLang = 'en';
        break;
      default:
        // 如果母语不在支持范围内，不改变当前语言
        return;
    }
    
    // 设置界面语言
    setLanguageState(interfaceLang);
    setHasSetFromProfile(true);
    
    // 保存到localStorage
    localStorage.setItem('preferred-language', interfaceLang);
    localStorage.setItem('profile-language-set', 'true');
    document.documentElement.lang = interfaceLang === 'zh' ? 'zh-CN' : interfaceLang === 'ja' ? 'ja-JP' : 'en-US';
  };

  const value = {
    language,
    setLanguage,
    setLanguageFromUserProfile,
    t: translations[language],
  };

  return (
    <ClientOnly>
      <LanguageContext.Provider value={value}>
        {children}
      </LanguageContext.Provider>
    </ClientOnly>
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
