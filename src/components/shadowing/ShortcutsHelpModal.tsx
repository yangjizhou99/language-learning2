'use client';

import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { formatShortcut, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

export default function ShortcutsHelpModal({ isOpen, onClose, shortcuts }: ShortcutsHelpModalProps) {
  if (!isOpen) return null;

  // 按类别分组快捷键
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || '其他';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部 */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Keyboard className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">键盘快捷键</h2>
                  <p className="text-sm text-blue-100 mt-1">快速掌握高效操作</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 快捷键列表 */}
          <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="mb-6 last:mb-0">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={`${category}-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <span className="text-sm text-gray-700">{shortcut.description}</span>
                      <kbd className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-mono font-semibold text-gray-900 shadow-sm min-w-[60px] text-center">
                        {formatShortcut(shortcut)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              按 <kbd className="px-2 py-0.5 bg-white border border-gray-300 rounded text-xs font-mono">?</kbd> 随时打开此帮助
            </p>
          </div>
        </div>
      </div>
    </>
  );
}




