'use client';

import { useRef, useCallback, useState } from 'react';

interface UseAudioThrottleOptions {
    throttleMs?: number;
    onPlay?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
}

interface AudioPlayOptions {
    url: string;
    startTime?: number;
    endTime?: number;
}

/**
 * 音频播放节流Hook
 * 防止快速连续点击导致音频重叠
 */
export function useAudioThrottle(options: UseAudioThrottleOptions = {}) {
    const { throttleMs = 300, onPlay, onEnd, onError } = options;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const lastPlayTimeRef = useRef<number>(0);
    const endTimeRef = useRef<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 停止当前播放
    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        endTimeRef.current = null;
        setIsPlaying(false);
        setIsLoading(false);
    }, []);

    // 播放音频（可指定开始和结束时间）
    const play = useCallback(async ({ url, startTime = 0, endTime }: AudioPlayOptions) => {
        const now = Date.now();

        // 节流检查
        if (now - lastPlayTimeRef.current < throttleMs) {
            return;
        }
        lastPlayTimeRef.current = now;

        // 停止之前的音频
        stop();

        // 停止其他可能的音频（如TTS）
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        setIsLoading(true);

        try {
            const audio = new Audio(url);
            audioRef.current = audio;
            endTimeRef.current = endTime ?? null;

            // 设置开始时间
            audio.currentTime = startTime;

            // 监听时间更新，检查是否到达结束时间
            const handleTimeUpdate = () => {
                if (endTimeRef.current !== null && audio.currentTime >= endTimeRef.current) {
                    stop();
                    onEnd?.();
                }
            };

            audio.addEventListener('timeupdate', handleTimeUpdate);

            audio.addEventListener('canplaythrough', () => {
                setIsLoading(false);
            }, { once: true });

            audio.addEventListener('playing', () => {
                setIsPlaying(true);
                setIsLoading(false);
                onPlay?.();
            }, { once: true });

            audio.addEventListener('ended', () => {
                setIsPlaying(false);
                audioRef.current = null;
                endTimeRef.current = null;
                onEnd?.();
            }, { once: true });

            audio.addEventListener('error', (e) => {
                setIsPlaying(false);
                setIsLoading(false);
                audioRef.current = null;
                endTimeRef.current = null;
                const error = new Error(`Audio playback failed: ${audio.error?.message || 'Unknown error'}`);
                onError?.(error);
            }, { once: true });

            await audio.play();
        } catch (error) {
            setIsPlaying(false);
            setIsLoading(false);
            audioRef.current = null;
            endTimeRef.current = null;
            onError?.(error instanceof Error ? error : new Error('Failed to play audio'));
        }
    }, [throttleMs, stop, onPlay, onEnd, onError]);

    return {
        play,
        stop,
        isPlaying,
        isLoading,
    };
}
