'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Languages, BookOpen, Mic, ListChecks } from 'lucide-react';

type TabType = 'translation' | 'vocabulary' | 'recording' | 'sentence';

interface RightPanelTabsProps {
  translationContent: React.ReactNode;
  vocabularyContent: React.ReactNode;
  recordingContent: React.ReactNode;
  sentenceContent: React.ReactNode;
  defaultTab?: TabType;
  className?: string;
}

export default function RightPanelTabs({
  translationContent,
  vocabularyContent,
  recordingContent,
  sentenceContent,
  defaultTab = 'translation',
  className = '',
}: RightPanelTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

  const tabs = [
    { 
      id: 'translation' as TabType, 
      label: '翻译', 
      icon: Languages,
      gradient: 'from-indigo-500 to-purple-600',
      bgGradient: 'from-indigo-50 to-purple-50',
    },
    { 
      id: 'vocabulary' as TabType, 
      label: '生词', 
      icon: BookOpen,
      gradient: 'from-amber-500 to-orange-600',
      bgGradient: 'from-amber-50 to-orange-50',
    },
    { 
      id: 'recording' as TabType, 
      label: '录音评分', 
      icon: Mic,
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-50',
    },
    { 
      id: 'sentence' as TabType, 
      label: '逐句练习', 
      icon: ListChecks,
      gradient: 'from-blue-500 to-cyan-600',
      bgGradient: 'from-blue-50 to-cyan-50',
    },
  ];

  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* 标签头部 */}
      <div className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-b border-gray-200 p-2">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md transform scale-105`
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 标签内容区域 */}
      <div className={`flex-1 overflow-y-auto bg-gradient-to-br ${activeTabData?.bgGradient || 'from-gray-50 to-gray-100'}`}>
        <div className="h-full">
          {activeTab === 'translation' && translationContent}
          {activeTab === 'vocabulary' && vocabularyContent}
          {activeTab === 'recording' && recordingContent}
          {activeTab === 'sentence' && sentenceContent}
        </div>
      </div>
    </div>
  );
}

