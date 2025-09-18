'use client';
import { useEffect } from 'react';

export default function HydrationFix() {
  useEffect(() => {
    // 修复浏览器扩展导致的水合不匹配问题
    const fixHydrationMismatch = () => {
      const body = document.body;
      if (body) {
        // 移除可能由浏览器扩展添加的属性
        const attrs = Array.from(body.attributes);
        attrs.forEach((attr) => {
          if (
            attr.name.startsWith('inmaintabuse') ||
            (attr.name.startsWith('data-') && attr.name.includes('extension'))
          ) {
            body.removeAttribute(attr.name);
          }
        });
      }
    };

    // 立即执行一次
    fixHydrationMismatch();

    // 监听 DOM 变化，防止扩展再次添加属性
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target === document.body) {
          fixHydrationMismatch();
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['inmaintabuse', 'data-extension'],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
