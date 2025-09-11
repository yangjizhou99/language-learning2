"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import useMobileDetection from "@/hooks/useMobileDetection";

interface MobileContextType {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  forceMobileMode: boolean;
  setForceMobileMode: (force: boolean) => void;
  actualIsMobile: boolean;
}

const MobileContext = createContext<MobileContextType | undefined>(undefined);

export function MobileProvider({ children }: { children: React.ReactNode }) {
  const { isMobile, isTablet, isDesktop, screenWidth, screenHeight } = useMobileDetection();
  const [forceMobileMode, setForceMobileMode] = useState(false);
  
  const actualIsMobile = isMobile || forceMobileMode;

  // 将状态保存到localStorage，这样刷新页面后状态不会丢失
  useEffect(() => {
    const saved = localStorage.getItem('forceMobileMode');
    if (saved !== null) {
      setForceMobileMode(JSON.parse(saved));
    }
  }, []);

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
