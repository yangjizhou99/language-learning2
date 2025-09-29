"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

// 存储键（含旧版本迁移）
const LEGACY_CLOSE_KEY = 'pwa_add_prompt_closed_v1';
const SNOOZE_UNTIL_KEY = 'pwa_add_prompt_snooze_until_v1';
const CLOSE_COUNT_KEY = 'pwa_add_prompt_close_count_v1';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000; // 3天

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

function isInStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS
  const isIOSStandalone = (window.navigator as any).standalone === true;
  // Others
  const isDisplayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  return isIOSStandalone || isDisplayModeStandalone;
}

export default function AddToHomePrompt() {
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const deferredPromptRef = useRef<DeferredPromptEvent | null>(null);

  // 迁移旧的永久关闭为“休眠一段时间”
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(LEGACY_CLOSE_KEY) === '1') {
        const until = Date.now() + SNOOZE_MS;
        localStorage.setItem(SNOOZE_UNTIL_KEY, String(until));
        localStorage.removeItem(LEGACY_CLOSE_KEY);
      }
    } catch {}
  }, []);

  const isSnoozed = useMemo(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem(SNOOZE_UNTIL_KEY);
      const until = raw ? Number(raw) : 0;
      return Number.isFinite(until) && until > Date.now();
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSnoozed) return;
    if (isInStandalone()) return; // 已安装则不提示

    const ios = isIOS();
    setIsIos(ios);

    // 始终显示横幅（iOS 为指引，Android 在事件到达前禁用按钮）
    setVisible(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as DeferredPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, [isSnoozed]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    // 轻量注册 SW（若已注册，无副作用）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (!visible) return null;

  const onClose = () => {
    try {
      const until = Date.now() + SNOOZE_MS;
      localStorage.setItem(SNOOZE_UNTIL_KEY, String(until));
      const count = Number(localStorage.getItem(CLOSE_COUNT_KEY) || '0') + 1;
      localStorage.setItem(CLOSE_COUNT_KEY, String(count));
    } catch {}
    setVisible(false);
  };

  const onInstallClick = async () => {
    const evt = deferredPromptRef.current;
    if (!evt) return;
    try {
      await evt.prompt();
      await evt.userChoice;
    } finally {
      onClose();
      deferredPromptRef.current = null;
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl">
        <div className="relative rounded-none sm:rounded-xl border border-blue-200/70 bg-blue-50/80 dark:bg-blue-900/20 dark:border-blue-800/50 backdrop-blur p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-sm text-sm font-bold">A2HS</div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold text-blue-800 dark:text-blue-200 truncate">
                添加到主屏幕
              </div>
              <div className="text-xs sm:text-sm text-blue-700/90 dark:text-blue-300/90">
                {isIos ? '在 Safari 中点分享按钮，然后选择“添加到主屏幕”。' : '安装为应用，获得更快访问与沉浸体验。'}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 ml-2 flex items-center gap-2">
            {!isIos && (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={onInstallClick}
                disabled={!canInstall}
                title={canInstall ? '立即安装' : '等待浏览器准备安装'}
              >
                {canInstall ? '立即安装' : '稍后可安装'}
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="关闭">
              ✕
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


