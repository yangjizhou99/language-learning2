import React from 'react';

interface EnglishShadowingInterfaceProps {
  children?: React.ReactNode;
}

const EnglishShadowingInterface: React.FC<EnglishShadowingInterfaceProps> = ({ children }) => {
  return (
    <div className="english-shadowing-interface">
      {/* 英文界面特有的样式和布局 */}
      <style jsx>{`
        .english-shadowing-interface {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        
        .english-shadowing-interface .filter-section {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        }
        
        .english-shadowing-interface .filter-label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }
        
        .english-shadowing-interface .button-primary {
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
        
        .english-shadowing-interface .button-primary:hover {
          background: #2563eb;
        }
        
        .english-shadowing-interface .button-secondary {
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
        
        .english-shadowing-interface .button-secondary:hover {
          background: #e5e7eb;
        }
        
        .english-shadowing-interface .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .english-shadowing-interface .status-completed {
          background: #dcfce7;
          color: #166534;
        }
        
        .english-shadowing-interface .status-draft {
          background: #fef3c7;
          color: #92400e;
        }
        
        .english-shadowing-interface .status-not-started {
          background: #f3f4f6;
          color: #6b7280;
        }
      `}</style>
      {children}
    </div>
  );
};

export default EnglishShadowingInterface;





