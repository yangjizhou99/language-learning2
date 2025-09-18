import { useState, useRef, useEffect } from 'react';

interface OptimizedAudioProps {
  src: string;
  className?: string;
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: string) => void;
}

/**
 * 优化的音频组件，支持 Supabase Storage 代理和缓存
 * 自动处理加载状态、错误回退和缓存优化
 */
export default function OptimizedAudio({
  src,
  className,
  controls = true,
  preload = 'metadata',
  onLoadStart,
  onLoadEnd,
  onError,
}: OptimizedAudioProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);

  // 如果是 Supabase Storage URL，使用代理路由
  const isSupabaseUrl = src.includes('.supabase.co/storage');
  const optimizedSrc = isSupabaseUrl
    ? `/api/storage-proxy?path=${encodeURIComponent(src.split('/storage/v1/object/public/')[1] || '')}&bucket=${src.split('/storage/v1/object/public/')[0].split('/').pop() || 'tts'}`
    : src;

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    onLoadEnd?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    const error = audio.error;
    let message = '音频加载失败';

    if (error) {
      switch (error.code) {
        case error.MEDIA_ERR_ABORTED:
          message = '音频加载被中断';
          break;
        case error.MEDIA_ERR_NETWORK:
          message = '网络错误，无法加载音频';
          break;
        case error.MEDIA_ERR_DECODE:
          message = '音频格式不支持';
          break;
        case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          message = '音频源不支持';
          break;
        default:
          message = `音频加载失败 (错误代码: ${error.code})`;
      }
    }

    setHasError(true);
    setErrorMessage(message);
    setIsLoading(false);
    onError?.(message);
  };

  // 重置错误状态当 src 改变时
  useEffect(() => {
    setHasError(false);
    setErrorMessage('');
  }, [src]);

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center p-4 border border-red-200 rounded bg-red-50 ${className}`}
      >
        <div className="text-center">
          <div className="text-red-600 text-sm mb-2">🔊 音频加载失败</div>
          <div className="text-red-500 text-xs">{errorMessage}</div>
          <button
            onClick={() => {
              setHasError(false);
              setErrorMessage('');
              audioRef.current?.load();
            }}
            className="mt-2 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
            <span className="text-sm">加载中...</span>
          </div>
        </div>
      )}
      <audio
        ref={audioRef}
        src={optimizedSrc}
        controls={controls}
        preload={preload}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onError={handleError}
        className={`w-full ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
      />
    </div>
  );
}
