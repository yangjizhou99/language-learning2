'use client';
import * as React from 'react';

// Simplified ThemeProvider: no dark/light logic, just render children
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
