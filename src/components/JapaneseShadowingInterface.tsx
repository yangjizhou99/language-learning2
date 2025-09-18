import React from 'react';

interface JapaneseShadowingInterfaceProps {
  children?: React.ReactNode;
}

const JapaneseShadowingInterface: React.FC<JapaneseShadowingInterfaceProps> = ({ children }) => {
  return (
    <div className="japanese-shadowing-interface">
      {/* 日文界面特有的样式和布局 */}
      <style jsx>{`
        .japanese-shadowing-interface {
          font-family:
            'Hiragino Sans', 'Yu Gothic', 'Meiryo', 'MS PGothic', 'Takao', 'IPAexGothic',
            'IPAPGothic', 'VL PGothic', 'Noto Sans CJK JP', 'Hiragino Kaku Gothic ProN',
            'Hiragino Kaku Gothic Pro', 'Yu Gothic Medium', 'Yu Gothic', 'Meiryo', sans-serif;
          font-weight: 400;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: 'palt' 1;
          text-rendering: optimizeLegibility;
        }

        .japanese-shadowing-interface * {
          font-family: inherit !important;
        }

        .japanese-shadowing-interface .filter-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .japanese-shadowing-interface .filter-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }

        .japanese-shadowing-interface .button-primary {
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .japanese-shadowing-interface .button-primary:hover {
          background: #2563eb;
        }

        .japanese-shadowing-interface .button-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .japanese-shadowing-interface .button-secondary:hover {
          background: #e5e7eb;
        }

        .japanese-shadowing-interface .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .japanese-shadowing-interface .status-completed {
          background: #dcfce7;
          color: #166534;
        }

        .japanese-shadowing-interface .status-draft {
          background: #fef3c7;
          color: #92400e;
        }

        .japanese-shadowing-interface .status-not-started {
          background: #f3f4f6;
          color: #6b7280;
        }

        /* 确保日文界面下所有文本使用一致的字体粗细 */
        .japanese-shadowing-interface .text-sm {
          font-size: 0.875rem;
          line-height: 1.25rem;
          font-weight: inherit;
        }

        .japanese-shadowing-interface .text-sm.font-medium {
          font-size: 0.875rem;
          line-height: 1.25rem;
          font-weight: 500 !important;
        }

        .japanese-shadowing-interface .text-xs {
          font-size: 0.75rem;
          line-height: 1rem;
          font-weight: inherit;
        }
      `}</style>
      {children}
    </div>
  );
};

export default JapaneseShadowingInterface;
