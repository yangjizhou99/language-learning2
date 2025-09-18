import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

// 中文界面内容
const ChineseContent: React.FC = () => {
  return (
    <div className="chinese-content">
      <h1 className="text-2xl font-bold mb-4">Shadowing 跟读练习</h1>

      {/* 筛选区域 */}
      <div className="filter-section mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="filter-label">语言</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="zh">中文（普通话）</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          <div>
            <label className="filter-label">等级</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">全部等级</option>
              <option value="1">L1 - 初级</option>
              <option value="2">L2 - 初中级</option>
              <option value="3">L3 - 中级</option>
            </select>
          </div>

          <div>
            <label className="filter-label">练习状态</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">全部状态</option>
              <option value="completed">已完成</option>
              <option value="draft">草稿中</option>
              <option value="not-started">未开始</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="stats-section mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>共 50 题</span>
          <div className="flex items-center gap-4">
            <span className="status-badge status-completed">已完成 10</span>
            <span className="status-badge status-draft">草稿中 5</span>
            <span className="status-badge status-not-started">未开始 35</span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="action-buttons mb-6">
        <button className="button-primary mr-2">播放音频</button>
        <button className="button-secondary mr-2">保存草稿</button>
        <button className="button-primary mr-2">完成并保存</button>
        <button className="button-secondary">调试单词本</button>
      </div>
    </div>
  );
};

// 日文界面内容
const JapaneseContent: React.FC = () => {
  return (
    <div className="japanese-content">
      <h1 className="text-2xl font-bold mb-4">シャドーイング練習</h1>

      {/* 筛选区域 */}
      <div className="filter-section mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="filter-label">言語</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="zh">中国語（普通話）</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>

          <div>
            <label className="filter-label">レベル</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">すべてのレベル</option>
              <option value="1">L1 - 初級</option>
              <option value="2">L2 - 初中級</option>
              <option value="3">L3 - 中級</option>
            </select>
          </div>

          <div>
            <label className="filter-label">練習状態</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">すべての状態</option>
              <option value="completed">完了</option>
              <option value="draft">下書き中</option>
              <option value="not-started">未開始</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="stats-section mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>合計 50 問</span>
          <div className="flex items-center gap-4">
            <span className="status-badge status-completed">完了 10</span>
            <span className="status-badge status-draft">下書き中 5</span>
            <span className="status-badge status-not-started">未開始 35</span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="action-buttons mb-6">
        <button className="button-primary mr-2">音声再生</button>
        <button className="button-secondary mr-2">下書き保存</button>
        <button className="button-primary mr-2">完了して保存</button>
        <button className="button-secondary">単語デバッグ</button>
      </div>
    </div>
  );
};

// 英文界面内容
const EnglishContent: React.FC = () => {
  return (
    <div className="english-content">
      <h1 className="text-2xl font-bold mb-4">Shadowing Practice</h1>

      {/* 筛选区域 */}
      <div className="filter-section mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="filter-label">Language</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="zh">Chinese (Mandarin)</option>
              <option value="en">English</option>
              <option value="ja">Japanese</option>
            </select>
          </div>

          <div>
            <label className="filter-label">Level</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">All Levels</option>
              <option value="1">L1 - Beginner</option>
              <option value="2">L2 - Elementary</option>
              <option value="3">L3 - Intermediate</option>
            </select>
          </div>

          <div>
            <label className="filter-label">Practice Status</label>
            <select className="w-full p-2 border border-gray-300 rounded">
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="not-started">Not Started</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="stats-section mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total 50 Questions</span>
          <div className="flex items-center gap-4">
            <span className="status-badge status-completed">Completed 10</span>
            <span className="status-badge status-draft">Draft 5</span>
            <span className="status-badge status-not-started">Not Started 35</span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="action-buttons mb-6">
        <button className="button-primary mr-2">Play Audio</button>
        <button className="button-secondary mr-2">Save Draft</button>
        <button className="button-primary mr-2">Complete & Save</button>
        <button className="button-secondary">Debug Vocabulary</button>
      </div>
    </div>
  );
};

// 主组件
const LanguageSpecificContent: React.FC = () => {
  const { language } = useLanguage();

  switch (language) {
    case 'zh':
      return <ChineseContent />;
    case 'ja':
      return <JapaneseContent />;
    case 'en':
      return <EnglishContent />;
    default:
      return <ChineseContent />;
  }
};

export default LanguageSpecificContent;
