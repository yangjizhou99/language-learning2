/**
 * 优化的状态管理Hook
 * 提供防抖、记忆化和浅比较功能
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * 优化的状态Hook，支持浅比较和防抖更新
 */
export function useOptimizedState<T>(initialValue: T) {
  const [state, setState] = useState(initialValue);
  const prevStateRef = useRef<T>(initialValue);
  
  const setOptimizedState = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
      
      // 浅比较，避免不必要的更新
      if (JSON.stringify(prev) === JSON.stringify(next)) {
        return prev;
      }
      
      prevStateRef.current = next;
      return next;
    });
  }, []);

  return [state, setOptimizedState] as const;
}

/**
 * 防抖状态Hook
 */
export function useDebouncedState<T>(initialValue: T, delay: number = 300) {
  const [state, setState] = useState(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setDebouncedState = useCallback((newValue: T | ((prev: T) => T)) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState(prev => {
        const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
        return next;
      });
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setDebouncedState] as const;
}

/**
 * 记忆化状态Hook，基于依赖项自动更新
 */
export function useMemoizedState<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

/**
 * 持久化状态Hook，自动同步到localStorage
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
) {
  const defaultSerializer = {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  };

  const { serialize, deserialize } = serializer || defaultSerializer;

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setPersistedState = useCallback((newValue: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue;
      
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, serialize(next));
        }
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
      
      return next;
    });
  }, [key, serialize]);

  return [state, setPersistedState] as const;
}

/**
 * 批量状态更新Hook
 */
export function useBatchState<T extends Record<string, any>>(initialState: T) {
  const [state, setState] = useState(initialState);
  const batchRef = useRef<Partial<T>>({});
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchUpdate = useCallback((updates: Partial<T>, immediate = false) => {
    Object.assign(batchRef.current, updates);

    if (immediate) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setState(prev => ({ ...prev, ...batchRef.current }));
      batchRef.current = {};
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, ...batchRef.current }));
        batchRef.current = {};
      }, 16); // 一帧时间
    }
  }, []);

  const flushBatch = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState(prev => ({ ...prev, ...batchRef.current }));
    batchRef.current = {};
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchUpdate, flushBatch] as const;
}

/**
 * 异步状态Hook，用于处理异步操作
 */
export function useAsyncState<T>(
  initialValue: T,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const [state, setState] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      
      if (mountedRef.current) {
        setState(result);
        options.onSuccess?.(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        options.onError?.(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [options]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return [state, execute, loading, error] as const;
}

/**
 * 状态历史Hook，支持撤销/重做
 */
export function useHistoryState<T>(initialValue: T, maxHistory = 50) {
  const [state, setState] = useState(initialValue);
  const [history, setHistory] = useState<T[]>([initialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushState = useCallback((newValue: T) => {
    setState(newValue);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newValue);
      
      // 限制历史记录长度
      if (newHistory.length > maxHistory) {
        newHistory.shift();
        return newHistory;
      }
      
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, maxHistory - 1));
  }, [historyIndex, maxHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
    }
  }, [historyIndex, history]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    state,
    setState: pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    history,
    historyIndex
  };
}
