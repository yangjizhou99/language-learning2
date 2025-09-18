'use client';
import { useEffect, useState } from 'react';

interface MobileDetectionResult {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
}

export default function useMobileDetection(): MobileDetectionResult {
  const [detection, setDetection] = useState<MobileDetectionResult>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 0,
    screenHeight: 0,
    userAgent: '',
  });

  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();

      // 多种检测方法
      const isMobileWidth = width < 768;
      const isTabletWidth = width >= 768 && width < 1024;

      // User Agent 检测
      const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent,
      );
      const isTabletUA = /ipad|android(?!.*mobile)/i.test(userAgent);

      // 触摸设备检测
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      // 综合判断
      const isMobile = isMobileWidth || (isMobileUA && !isTabletUA);
      const isTablet = isTabletWidth || (isTabletUA && !isMobile);
      const isDesktop = !isMobile && !isTablet;

      setDetection({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        screenHeight: height,
        userAgent,
      });
    };

    // 初始检测
    detectDevice();

    // 监听窗口大小变化
    const handleResize = () => {
      detectDevice();
    };

    // 监听方向变化
    const handleOrientationChange = () => {
      // 延迟检测，等待方向变化完成
      setTimeout(detectDevice, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // 监听媒体查询变化
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      detectDevice();
    };

    mediaQuery.addEventListener('change', handleMediaChange);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      mediaQuery.removeEventListener('change', handleMediaChange);
    };
  }, []);

  return detection;
}
