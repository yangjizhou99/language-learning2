/**
 * 优化的数据库查询工具
 * 提供查询优化、批量操作和连接池管理
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CacheManager } from '@/lib/cache';

export interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  batchSize?: number;
  timeout?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface FilterOptions {
  [key: string]: any;
}

/**
 * 优化的查询构建器
 */
export class OptimizedQueryBuilder {
  private supabase: SupabaseClient;
  private cacheEnabled: boolean;
  private cacheTTL: number;

  constructor(supabase: SupabaseClient, options: QueryOptions = {}) {
    this.supabase = supabase;
    this.cacheEnabled = options.cache ?? true;
    this.cacheTTL = options.cacheTTL ?? 300;
  }

  /**
   * 执行带缓存的查询
   */
  async query<T>(
    table: string,
    select: string = '*',
    filters: FilterOptions = {},
    options: QueryOptions = {}
  ): Promise<T[]> {
    const cacheKey = this.generateCacheKey(table, select, filters);
    
    // 尝试从缓存获取
    if (this.cacheEnabled && options.cache !== false) {
      const cached = await CacheManager.get<T[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // 构建查询
    let query = this.supabase.from(table).select(select);

    // 应用过滤器
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value.operator) {
          // 支持操作符查询 { operator: 'gte', value: 10 }
          query = query.filter(key, value.operator, value.value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // 执行查询
    const { data, error } = await query;

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    const result = data || [];

    // 缓存结果
    if (this.cacheEnabled && options.cache !== false) {
      await CacheManager.set(cacheKey, result, options.cacheTTL || this.cacheTTL);
    }

    return result;
  }

  /**
   * 分页查询
   */
  async queryPaginated<T>(
    table: string,
    select: string = '*',
    filters: FilterOptions = {},
    pagination: PaginationOptions,
    options: QueryOptions = {}
  ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
    const cacheKey = this.generateCacheKey(table, select, filters, pagination);
    
    // 尝试从缓存获取
    if (this.cacheEnabled && options.cache !== false) {
      const cached = await CacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const { page, limit, orderBy, orderDirection = 'desc' } = pagination;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // 构建查询
    let query = this.supabase.from(table).select(select, { count: 'exact' });

    // 应用过滤器
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'object' && value.operator) {
          query = query.filter(key, value.operator, value.value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    // 应用排序
    if (orderBy) {
      query = query.order(orderBy, { ascending: orderDirection === 'asc' });
    }

    // 应用分页
    query = query.range(from, to);

    // 执行查询
    const { data, error, count } = await query;

    if (error) {
      throw new Error(`分页查询失败: ${error.message}`);
    }

    const result = {
      data: data || [],
      total: count || 0,
      page,
      limit
    };

    // 缓存结果
    if (this.cacheEnabled && options.cache !== false) {
      await CacheManager.set(cacheKey, result, options.cacheTTL || this.cacheTTL);
    }

    return result;
  }

  /**
   * 批量插入
   */
  async batchInsert<T>(
    table: string,
    records: Partial<T>[],
    options: { batchSize?: number } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || 100;
    const results: T[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { data, error } = await this.supabase
        .from(table)
        .insert(batch)
        .select();

      if (error) {
        throw new Error(`批量插入失败: ${error.message}`);
      }

      results.push(...(data || []));
    }

    // 清除相关缓存
    await this.invalidateCache(table);

    return results;
  }

  /**
   * 批量更新
   */
  async batchUpdate<T>(
    table: string,
    updates: Array<{ id: string; data: Partial<T> }>,
    options: { batchSize?: number } = {}
  ): Promise<T[]> {
    const batchSize = options.batchSize || 100;
    const results: T[] = [];

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const promises = batch.map(({ id, data }) =>
        this.supabase
          .from(table)
          .update(data)
          .eq('id', id)
          .select()
          .single()
      );

      const responses = await Promise.allSettled(promises);
      
      responses.forEach((response) => {
        if (response.status === 'fulfilled' && response.value.data) {
          results.push(response.value.data);
        } else if (response.status === 'rejected') {
          console.error('批量更新失败:', response.reason);
        }
      });
    }

    // 清除相关缓存
    await this.invalidateCache(table);

    return results;
  }

  /**
   * 批量删除
   */
  async batchDelete(
    table: string,
    ids: string[],
    options: { batchSize?: number } = {}
  ): Promise<void> {
    const batchSize = options.batchSize || 100;

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from(table)
        .delete()
        .in('id', batch);

      if (error) {
        throw new Error(`批量删除失败: ${error.message}`);
      }
    }

    // 清除相关缓存
    await this.invalidateCache(table);
  }

  /**
   * 执行原生SQL查询（仅限服务端）
   */
  async executeSQL<T>(sql: string, params: any[] = []): Promise<T[]> {
    const { data, error } = await this.supabase.rpc('execute_sql', {
      sql,
      params
    });

    if (error) {
      throw new Error(`SQL执行失败: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(
    table: string,
    select: string,
    filters: FilterOptions,
    pagination?: PaginationOptions
  ): string {
    const key = {
      table,
      select,
      filters,
      pagination
    };
    return CacheManager.generateKey('db:query', key);
  }

  /**
   * 清除表相关缓存
   */
  private async invalidateCache(table: string): Promise<void> {
    await CacheManager.invalidate(`db:query:${table}:*`);
  }
}

/**
 * 预定义的优化查询
 */
export class ShadowingQueries {
  constructor(private queryBuilder: OptimizedQueryBuilder) {}

  /**
   * 获取用户练习记录
   */
  async getUserAttempts(
    userId: string,
    lang?: string,
    limit: number = 10
  ) {
    const filters: FilterOptions = { user_id: userId };
    if (lang) filters.lang = lang;

    return this.queryBuilder.query(
      'shadowing_attempts',
      '*',
      filters,
      { cacheTTL: 120 } // 2分钟缓存
    );
  }

  /**
   * 获取推荐等级
   */
  async getRecommendedLevel(userId: string, lang: string): Promise<number> {
    const cacheKey = CacheManager.generateKey('recommended:level', { userId, lang });
    
    const cached = await CacheManager.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const attempts = await this.getUserAttempts(userId, lang, 8);
    
    if (attempts.length === 0) {
      const result = 2; // 默认推荐L2
      await CacheManager.set(cacheKey, result, 300);
      return result;
    }

    // 计算推荐等级逻辑
    const lastLevel = attempts[0].level;
    const recentSameLevel = attempts.filter(a => a.level === lastLevel).slice(0, 3);
    
    if (recentSameLevel.length >= 3) {
      const avgAccuracy = recentSameLevel.reduce((sum, attempt) => {
        const metrics = attempt.metrics || {};
        return sum + (metrics.accuracy || 0);
      }, 0) / recentSameLevel.length;

      let recommended = lastLevel;
      if (avgAccuracy >= 0.92) {
        recommended = Math.min(5, lastLevel + 1);
      } else if (avgAccuracy < 0.75) {
        recommended = Math.max(1, lastLevel - 1);
      }

      await CacheManager.set(cacheKey, recommended, 300);
      return recommended;
    }

    const result = lastLevel;
    await CacheManager.set(cacheKey, result, 300);
    return result;
  }

  /**
   * 获取题库统计
   */
  async getItemStats(lang?: string, level?: number) {
    const filters: FilterOptions = {};
    if (lang) filters.lang = lang;
    if (level) filters.level = level;

    return this.queryBuilder.query(
      'shadowing_items',
      'lang, level, count(*)',
      filters,
      { cacheTTL: 600 } // 10分钟缓存
    );
  }
}

export class ClozeQueries {
  constructor(private queryBuilder: OptimizedQueryBuilder) {}

  /**
   * 获取随机题目
   */
  async getRandomItem(lang: string, level: number) {
    const cacheKey = CacheManager.generateKey('cloze:random', { lang, level });
    
    const cached = await CacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    const items = await this.queryBuilder.query(
      'cloze_items',
      '*',
      { lang, level },
      { cacheTTL: 300 }
    );

    if (items.length === 0) {
      throw new Error('该等级暂无题目');
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    const selectedItem = items[randomIndex];

    await CacheManager.set(cacheKey, selectedItem, 300);
    return selectedItem;
  }
}

export class VocabQueries {
  constructor(private queryBuilder: OptimizedQueryBuilder) {}

  /**
   * 搜索词汇
   */
  async searchVocab(
    term: string,
    userId: string,
    lang?: string
  ) {
    const filters: FilterOptions = { 
      user_id: userId,
      term: { operator: 'ilike', value: `%${term}%` }
    };
    if (lang) filters.lang = lang;

    return this.queryBuilder.query(
      'vocab_entries',
      '*',
      filters,
      { cacheTTL: 180 } // 3分钟缓存
    );
  }

  /**
   * 批量创建词汇
   */
  async batchCreateVocab(entries: any[]) {
    return this.queryBuilder.batchInsert('vocab_entries', entries);
  }
}

/**
 * 创建查询实例的工厂函数
 */
export function createOptimizedQueries(supabase: SupabaseClient) {
  const queryBuilder = new OptimizedQueryBuilder(supabase);
  
  return {
    shadowing: new ShadowingQueries(queryBuilder),
    cloze: new ClozeQueries(queryBuilder),
    vocab: new VocabQueries(queryBuilder),
    queryBuilder
  };
}
