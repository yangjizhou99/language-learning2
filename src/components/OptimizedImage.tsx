import Image from 'next/image';
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  fallback?: string;
}

/**
 * 优化的图片组件，支持 Supabase Storage 和本地图片
 * 自动处理缓存、格式优化和错误回退
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 70,
  sizes,
  fallback = '/placeholder-image.png',
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  // 如果是 Supabase Storage URL，使用代理路由
  const isSupabaseUrl = src.includes('.supabase.co/storage');
  const optimizedSrc = isSupabaseUrl
    ? `/api/storage-proxy?path=${encodeURIComponent(src.split('/storage/v1/object/public/')[1] || '')}&bucket=${src.split('/storage/v1/object/public/')[0].split('/').pop() || 'tts'}`
    : src;

  const handleError = () => {
    if (imgSrc !== fallback) {
      setImgSrc(fallback);
    }
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded"
          style={{ width, height }}
        />
      )}
      <Image
        src={imgSrc}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        quality={quality}
        sizes={sizes || `(max-width: 768px) 100vw, ${width}px`}
        onError={handleError}
        onLoad={handleLoad}
        className={`transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}
