'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Save, CheckCircle, Play, Pause } from 'lucide-react';
import DesktopThreeColumnLayout from './DesktopThreeColumnLayout';
import RightPanelTabs from './RightPanelTabs';
import EnhancedAudioPlayer from './EnhancedAudioPlayer';
import { LANG_LABEL } from '@/types/lang';

interface DesktopLayoutProps {
  // 左侧面板相关
  leftPanelContent: React.ReactNode;
  
  // 当前选中的题目
  currentItem: {
    title?: string;
    lang?: 'en' | 'ja' | 'zh' | 'ko';
    level?: number;
    cefr?: string;
    tokens?: number;
    duration_ms?: number;
    audio_url?: string | null;
    isPracticed?: boolean;
  } | null;
  
  // 音频相关
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playAudio: () => void;
  
  // 保存相关
  saving: boolean;
  saveDraft: () => void;
  unifiedCompleteAndSave: () => void;
  
  // 步骤相关
  gatingActive: boolean;
  step: number;
  
  // 生词模式
  isVocabMode: boolean;
  setIsVocabMode: (mode: boolean) => void;
  
  // 原文展示内容
  textDisplayContent: React.ReactNode;
  
  // 右侧标签页内容
  translationContent: React.ReactNode;
  vocabularyContent: React.ReactNode;
  recordingContent: React.ReactNode;
  sentenceContent: React.ReactNode;
  
  // 翻译相关
  t: { shadowing?: Record<string, string> };
  currentSession: { created_at?: string } | null;
  highlightPlay: boolean;
}

export default function DesktopLayout({
  leftPanelContent,
  currentItem,
  isPlaying,
  setIsPlaying,
  playAudio,
  saving,
  saveDraft,
  unifiedCompleteAndSave,
  gatingActive,
  step,
  isVocabMode,
  setIsVocabMode,
  textDisplayContent,
  translationContent,
  vocabularyContent,
  recordingContent,
  sentenceContent,
  t,
  currentSession,
  highlightPlay,
}: DesktopLayoutProps) {
  
  // 渲染中间主内容面板
  const renderCenterPanel = () => {
    if (!currentItem) {
      return (
        <Card className="h-full flex items-center justify-center bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl">
          <div className="text-center p-8">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {t.shadowing?.select_question_to_start || '选择题目开始练习'}
            </h3>
            <p className="text-gray-600 leading-relaxed max-w-md">
              {t.shadowing?.select_from_left_vocabulary || '从左侧题库中选择一个题目'}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        {/* 题目信息卡片 */}
        <Card className="p-8 bg-gradient-to-br from-white to-blue-50/30 border-0 shadow-xl rounded-2xl">
          {/* 题目标题和信息 */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
                {currentItem.title}
              </h2>
              <div className="flex items-center gap-4 flex-wrap mb-4">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    currentItem.lang === 'en'
                      ? 'bg-blue-100 text-blue-700'
                    : currentItem.lang === 'ja'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {LANG_LABEL[currentItem.lang as keyof typeof LANG_LABEL]}
                </span>
                <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                  {t.shadowing?.level || '等级'} L{currentItem.level}
                </span>
                {currentItem.cefr && (
                  <span className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                    {currentItem.cefr}
                  </span>
                )}
                {currentItem.tokens && (
                  <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                    {currentItem.tokens} {t.shadowing?.words || '词'}
                  </span>
                )}
              </div>
              {currentItem.isPracticed && currentSession && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">已完成练习</span>
                  {currentSession?.created_at ? (
                    <span className="text-xs text-green-600">
                      ({new Date(currentSession.created_at).toLocaleString()})
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex gap-3 flex-wrap">
              {!(gatingActive && step === 5) && (
                <Button
                  onClick={playAudio}
                  variant="outline"
                  size="sm"
                  className={`h-11 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 rounded-xl shadow-sm hover:shadow-md transition-all ${
                    highlightPlay ? 'animate-pulse ring-2 ring-blue-400' : ''
                  }`}
                >
                  {isPlaying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                  {isPlaying ? '暂停' : '播放音频'}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={saveDraft}
                disabled={saving}
                className="h-11 bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200 text-yellow-700 hover:from-yellow-100 hover:to-amber-100 hover:border-yellow-300 rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <Save className="w-5 h-5 mr-2" />
                {saving ? '保存中...' : '保存草稿'}
              </Button>

              <Button
                size="sm"
                onClick={unifiedCompleteAndSave}
                disabled={saving}
                className="h-11 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-sm hover:shadow-md transition-all"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {saving ? '保存中...' : '完成并保存'}
              </Button>
            </div>
          </div>

          {/* 生词选择模式切换 */}
          {(!gatingActive || step === 3) && (
            <div className="mb-4">
              <Button
                variant={isVocabMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsVocabMode(!isVocabMode)}
              >
                {isVocabMode ? '退出选词模式' : '开启选词模式'}
              </Button>
            </div>
          )}

          {/* 原文展示区 */}
          {(!gatingActive || step >= 2) && (
            <div className="mb-4">
              {textDisplayContent}
            </div>
          )}

          {/* 音频播放器 - Sticky固定在卡片底部 */}
          {currentItem.audio_url && (!gatingActive || step !== 5) && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-blue-700">
                  {t.shadowing?.original_audio_text || '原文音频'}
                </span>
              </div>
              <EnhancedAudioPlayer
                audioUrl={currentItem.audio_url}
                duration_ms={currentItem.duration_ms}
                onPlayStateChange={(playing) => setIsPlaying(playing)}
              />
            </div>
          )}
        </Card>
      </div>
    );
  };

  // 渲染右侧辅助面板
  const renderRightPanel = () => {
    if (!currentItem) {
      return (
        <div className="h-full flex items-center justify-center p-8 text-center text-gray-500">
          <div>
            <p className="text-lg font-medium mb-2">选择题目</p>
            <p className="text-sm">选择题目后显示翻译、生词等辅助内容</p>
          </div>
        </div>
      );
    }

    return (
      <RightPanelTabs
        translationContent={translationContent}
        vocabularyContent={vocabularyContent}
        recordingContent={recordingContent}
        sentenceContent={sentenceContent}
        defaultTab="translation"
      />
    );
  };

  return (
    <DesktopThreeColumnLayout
      leftPanel={leftPanelContent}
      centerPanel={renderCenterPanel()}
      rightPanel={renderRightPanel()}
      leftPanelMinWidth={240}
      leftPanelMaxWidth={400}
      leftPanelDefaultWidth={288}
      rightPanelMinWidth={300}
      rightPanelMaxWidth={600}
      rightPanelDefaultWidth={400}
    />
  );
}

