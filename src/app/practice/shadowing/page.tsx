'use client';
import React from 'react';
import dynamic from 'next/dynamic';

// Use the ChineseShadowingPage as the unified implementation for all languages.
// It already supports reading `lang` from URL params and persisted filters.
const UnifiedShadowingPage = dynamic(
  () => import('@/components/shadowing/ChineseShadowingPage'),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-gray-500 text-sm">加载中...</div>
      </div>
    )
  }
);

export default function ShadowingPage() {
  return <UnifiedShadowingPage />;
}
