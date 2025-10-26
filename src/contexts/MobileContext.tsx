'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import useMobileDetection from '@/hooks/useMobileDetection';

interface MobileContextType {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  userAgent: string;
  forceMobileMode: boolean;
  setForceMobileMode: (force: boolean) => void;
  actualIsMobile: boolean;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

export function MobileProvider({ children }: { children: React.ReactNode }) {
  const { isMobile, isTablet, isDesktop, screenWidth, screenHeight, userAgent } =
    useMobileDetection();
  const [forceMobileMode, setForceMobileMode] = useState(() => {
    try {
      if (typeof window === 'undefined') return false;
      const saved = localStorage.getItem('forceMobileMode');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const actualIsMobile = isMobile || forceMobileMode;

  useEffect(() => {
    localStorage.setItem('forceMobileMode', JSON.stringify(forceMobileMode));
  }, [forceMobileMode]);

  return (
    <MobileContext.Provider
      value={{
        isMobile,
        isTablet,
        isDesktop,
        screenWidth,
        screenHeight,
        userAgent,
        forceMobileMode,
        setForceMobileMode,
        actualIsMobile,
      }}
    >
      {children}
    </MobileContext.Provider>
  );
}

export function useMobile() {
  const context = useContext(MobileContext);
  if (context === undefined) {
    throw new Error('useMobile must be used within a MobileProvider');
  }
  return context;
}
