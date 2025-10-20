/**
 * 缓存管理系统
 * 提供内存缓存和可选的Redis缓存支持
 */

interface CacheEntry<T> {
  value: T;
  expires: number;
  created: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxSize = 1000; // 最大缓存条目数
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds = 300): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expires: now + ttlSeconds * 1000,
      created: now,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  // 获取缓存统计信息
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expires) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.maxSize,
    };
  }
}

// 全局内存缓存实例
const memoryCache = new MemoryCache();

export class CacheManager {
  private static requestCache = new Map<string, Promise<unknown>>();

  /**
   * 获取缓存值
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      // 优先使用内存缓存
      const cached = memoryCache.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // 如果有Redis配置，可以在这里添加Redis缓存逻辑
      // const redisCached = await this.getFromRedis<T>(key);
      // if (redisCached !== null) {
      //   memoryCache.set(key, redisCached, 60); // 同步到内存缓存
      //   return redisCached;
      // }

      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 设置缓存值
   */
  static async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    try {
      // 设置内存缓存
      memoryCache.set(key, value, ttlSeconds);

      // 如果有Redis配置，可以在这里添加Redis缓存逻辑
      // await this.setToRedis(key, value, ttlSeconds);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  static async delete(key: string): Promise<void> {
    try {
      memoryCache.delete(key);
      // await this.deleteFromRedis(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * 批量删除缓存（支持通配符）
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      // 简单的通配符匹配
      const keys = Array.from(memoryCache['cache'].keys());
      const matchingKeys = keys.filter((key) => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(key);
        }
        return key.includes(pattern);
      });

      for (const key of matchingKeys) {
        memoryCache.delete(key);
      }

      console.log(`Invalidated ${matchingKeys.length} cache entries matching pattern: ${pattern}`);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * 请求去重 - 防止相同请求并发执行
   */
  static async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.requestCache.has(key)) {
      return this.requestCache.get(key)! as Promise<T>;
    }

    const promise = fetcher().finally(() => {
      this.requestCache.delete(key);
    });

    this.requestCache.set(key, promise);
    return promise;
  }

  /**
   * 生成缓存键
   */
  static generateKey(prefix: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * 获取缓存统计信息
   */
  static getStats() {
    return {
      memory: memoryCache.getStats(),
      pendingRequests: this.requestCache.size,
    };
  }

  /**
   * 清理所有缓存
   */
  static async clear(): Promise<void> {
    try {
      memoryCache.clear();
      this.requestCache.clear();
      console.log('All caches cleared');
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * 预热缓存
   */
  static async warmup<T>(key: string, fetcher: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fetcher();
    await this.set(key, result, ttlSeconds);
    return result;
  }
}

// 缓存装饰器
export function cached(ttlSeconds = 300, keyGenerator?: (...args: unknown[]) => string) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const key = keyGenerator
        ? keyGenerator(...args)
        : CacheManager.generateKey(`${(target as { constructor: { name: string } }).constructor.name}:${propertyName}`, {
            args: JSON.stringify(args),
          });

      return CacheManager.warmup(key, () => method.apply(this, args), ttlSeconds);
    };
  };
}

// 导出缓存实例用于直接操作
export { memoryCache };
