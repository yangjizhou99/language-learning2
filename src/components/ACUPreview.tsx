'use client';

import React from 'react';

interface ACUPreviewProps {
  text: string;
  acuMarked: string;
  units: Array<{ span: string; start: number; end: number; sid: number }>;
}

export default function ACUPreview({ text, acuMarked, units }: ACUPreviewProps) {
  // 将 ACU 标记的文本按星号分割并渲染
  const renderACUPreview = () => {
    if (!acuMarked) return <span className="text-gray-500">暂无 ACU 数据</span>;

    const parts = acuMarked.split('*');
    return parts.map((part, index) => {
      if (part.length === 0) return null;
      
      // 为每个块分配不同的颜色
      const colors = [
        'bg-blue-100 text-blue-800 border-blue-200',
        'bg-green-100 text-green-800 border-green-200',
        'bg-yellow-100 text-yellow-800 border-yellow-200',
        'bg-purple-100 text-purple-800 border-purple-200',
        'bg-pink-100 text-pink-800 border-pink-200',
        'bg-indigo-100 text-indigo-800 border-indigo-200',
        'bg-orange-100 text-orange-800 border-orange-200',
        'bg-teal-100 text-teal-800 border-teal-200',
      ];
      
      const colorClass = colors[index % colors.length];
      
      return (
        <span
          key={index}
          className={`inline-block px-2 py-1 mx-1 mb-1 rounded border text-sm ${colorClass}`}
          title={`块 ${index + 1}`}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700">ACU 标记预览:</div>
      <div className="p-3 bg-gray-50 rounded border min-h-[60px]">
        {renderACUPreview()}
      </div>
      <div className="text-xs text-gray-500">
        共 {units.length} 个 ACU 块，覆盖 {text.length} 个字符
      </div>
    </div>
  );
}
