'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type SentenceSegment = {
  index: number;
  text: string;
  start: number; // seconds
  end: number;   // seconds
  speaker?: string;
};

export interface UseSegmentAudioOptions {
  onSegmentPlayStart?: (index: number) => void;
}

export function useSegmentAudio(
  audioUrl: string | null | undefined,
  sentenceTimeline: SentenceSegment[] | null | undefined,
  options: UseSegmentAudioOptions = {},
) {
  const { onSegmentPlayStart } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const iosUnlockedRef = useRef(false);

  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const isIOS = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = (navigator as any).platform || '';
    const iOSUA = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = /Mac/.test(platform) && 'ontouchend' in (window as any);
    return iOSUA || iPadOS13Plus;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioUrl || !sentenceTimeline || sentenceTimeline.length === 0) return;

    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current.src = '';
    }

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';

    const handlePause = () => {
      setIsPlaying(false);
    };
    const handlePlay = () => setIsPlaying(true);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('ended', handleEnded);
    audioRef.current = audio;

    return () => {
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('ended', handleEnded);
      try { audio.pause(); } catch {}
      audio.src = '';
    };
  }, [audioUrl, sentenceTimeline]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopAtRef.current = null;
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
    }
    setCurrentIndex(null);
  }, []);

  const speak = useCallback(async (index: number) => {
    if (!(audioUrl && sentenceTimeline && sentenceTimeline.length > 0)) {
      return;
    }

    const seg = sentenceTimeline.find((s) => s.index === index) || sentenceTimeline[index];
    const a = audioRef.current;
    if (!seg || !a) return;

    // 通知外部：将开始播放某句（用于暂停主播放器）
    try { onSegmentPlayStart?.(index); } catch {}

    // 停掉之前的状态
    try { a.pause(); } catch {}
    stopAtRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // iOS 自动播放策略解锁
    if (isIOS && !iosUnlockedRef.current) {
      try {
        a.muted = true;
        a.playbackRate = playbackRate;
        const p = a.play();
        if (p && typeof (p as any).then === 'function') {
          (p as Promise<void>).then(() => { try { a.pause(); } catch {}; a.muted = false; }).catch(() => { a.muted = false; });
        } else {
          try { a.pause(); } catch {}
          a.muted = false;
        }
      } catch { a.muted = false; }
      iosUnlockedRef.current = true;
    }

    try {
      // 等待元数据
      await new Promise<void>((resolve) => {
        if (a.readyState >= 1) return resolve();
        const onLoaded = () => {
          a.removeEventListener('loadedmetadata', onLoaded);
          a.removeEventListener('canplay', onLoaded);
          resolve();
        };
        a.addEventListener('loadedmetadata', onLoaded, { once: true });
        a.addEventListener('canplay', onLoaded, { once: true });
      });

      const START_EPS = 0.005;
      const STOP_EPS = 0.08;
      const targetStart = Math.max(0, seg.start + START_EPS);
      const targetStop = Math.max(seg.start, seg.end - STOP_EPS);

      const anyAudio = a as any;
      try {
        if (typeof anyAudio.fastSeek === 'function') {
          anyAudio.fastSeek(targetStart);
        } else {
          a.currentTime = targetStart;
        }
      } catch { a.currentTime = targetStart; }

      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; cleanup(); resolve(); } };
        const onSeeked = () => finish();
        const onCanPlay = () => finish();
        const cleanup = () => {
          a.removeEventListener('seeked', onSeeked);
          a.removeEventListener('canplay', onCanPlay);
        };
        a.addEventListener('seeked', onSeeked, { once: true });
        a.addEventListener('canplay', onCanPlay, { once: true });
        setTimeout(finish, 1200);
      });

      stopAtRef.current = targetStop;
      a.playbackRate = playbackRate;
      setCurrentIndex(index);

      if (!isIOS) {
        try {
          if ('speechSynthesis' in window) {
            setTimeout(() => { try { window.speechSynthesis.cancel(); } catch {} }, 0);
          }
        } catch {}
      }

      await new Promise<void>((resolve, reject) => {
        let finished = false;
        let safetyId: ReturnType<typeof setTimeout> | null = null;

        function clearRaf() {
          if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }
        }
        function cleanup() {
          clearRaf();
          if (safetyId !== null) {
            clearTimeout(safetyId);
            safetyId = null;
          }
          stopAtRef.current = null;
          if (a) {
            a.removeEventListener('ended', onEnded);
            a.removeEventListener('pause', onPause);
          }
        }
        function finish() {
          if (finished) return;
          finished = true;
          cleanup();
          resolve();
        }
        function fail(err?: unknown) {
          if (finished) return;
          finished = true;
          cleanup();
          reject(err ?? new Error('Audio playback failed'));
        }
        function onEnded() { finish(); }
        function onPause() {
          // 若是到达 stopAt 或手动暂停，视为结束
          finish();
        }
        function watch() {
          if (!a) return;
          const stopAt = stopAtRef.current;
          if (typeof stopAt === 'number' && a.currentTime >= stopAt) {
            try { a.pause(); } catch {}
            finish();
            return;
          }
          rafRef.current = requestAnimationFrame(watch);
        }

        a.addEventListener('ended', onEnded, { once: true });
        a.addEventListener('pause', onPause);
        clearRaf();
        rafRef.current = requestAnimationFrame(watch);

        const estimated = Math.max((targetStop - targetStart) * 1000, 300);
        safetyId = setTimeout(() => finish(), estimated + 2000);

        (async () => {
          try {
            await a.play();
          } catch (err) {
            fail(err);
          }
        })();
      });
    } finally {
      // 播放完成时复位当前索引
      setCurrentIndex(null);
    }
  }, [audioUrl, sentenceTimeline, isIOS, playbackRate, onSegmentPlayStart]);

  return {
    speak,
    stop,
    isPlaying,
    currentIndex,
    playbackRate,
    setPlaybackRate,
  };
}


