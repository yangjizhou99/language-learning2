import React from 'react';

interface ChineseShadowingInterfaceProps {
  // 这里可以定义需要传递给中文界面的props
  children?: React.ReactNode;
}

const ChineseShadowingInterface: React.FC<ChineseShadowingInterfaceProps> = ({ children }) => {
  return (
    <div className="chinese-shadowing-interface">
      {/* 中文界面特有的样式和布局 */}
      <style jsx>{`
        .chinese-shadowing-interface {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }
        
        .chinese-shadowing-interface .filter-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .chinese-shadowing-interface .filter-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }
        
        .chinese-shadowing-interface .button-primary {
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
        
        .chinese-shadowing-interface .button-primary:hover {
          background: #2563eb;
        }
        
        .chinese-shadowing-interface .button-secondary {
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
        
        .chinese-shadowing-interface .button-secondary:hover {
          background: #e5e7eb;
        }
        
        .chinese-shadowing-interface .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .chinese-shadowing-interface .status-completed {
          background: #dcfce7;
          color: #166534;
        }
        
        .chinese-shadowing-interface .status-draft {
          background: #fef3c7;
          color: #92400e;
        }
        
        .chinese-shadowing-interface .status-not-started {
          background: #f3f4f6;
          color: #6b7280;
        }
      `}</style>
      {children}
    </div>
  );
};

export default ChineseShadowingInterface;





