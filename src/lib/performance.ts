/**
 * 性能监控工具
 * 提供API调用、组件渲染和数据库查询的性能监控
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  type: 'api' | 'component' | 'database' | 'custom';
  metadata?: Record<string, any>;
}

interface PerformanceConfig {
  enabled: boolean;
  slowThreshold: number;
  maxMetrics: number;
  onSlowOperation?: (metric: PerformanceMetric) => void;
}

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetric[] = [];
  private timers: Map<string, number> = new Map();

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enabled: process.env.NODE_ENV === 'development' || process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
      slowThreshold: 1000, // 1秒
      maxMetrics: 1000,
      ...config
    };
  }

  /**
   * 开始计时
   */
  startTimer(name: string): void {
    if (!this.config.enabled) return;
    this.timers.set(name, performance.now());
  }

  /**
   * 结束计时并记录指标
   */
  endTimer(
    name: string, 
    type: PerformanceMetric['type'] = 'custom',
    metadata?: Record<string, any>
  ): number {
    if (!this.config.enabled) return 0;

    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`计时器 "${name}" 未找到`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      type,
      metadata
    };

    this.recordMetric(metric);
    return duration;
  }

  /**
   * 记录性能指标
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enabled) return;

    this.metrics.push(metric);

    // 限制指标数量
    if (this.metrics.length > this.config.maxMetrics) {
      this.metrics = this.metrics.slice(-this.config.maxMetrics);
    }

    // 检查慢操作
    if (metric.duration > this.config.slowThreshold) {
      console.warn(`慢操作警告: ${metric.name} 耗时 ${metric.duration.toFixed(2)}ms`);
      this.config.onSlowOperation?.(metric);
    }
  }

  /**
   * 测量API调用性能
   */
  async measureApiCall<T>(
    name: string,
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name);
    
    try {
      const result = await apiCall();
      const duration = this.endTimer(name, 'api', metadata);
      
      if (duration > this.config.slowThreshold) {
        console.warn(`慢API调用: ${name} 耗时 ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      this.endTimer(name, 'api', { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * 测量组件渲染性能
   */
  measureComponentRender(
    componentName: string,
    renderFn: () => void,
    metadata?: Record<string, any>
  ): void {
    this.startTimer(`component:${componentName}`);
    renderFn();
    const duration = this.endTimer(`component:${componentName}`, 'component', metadata);
    
    if (duration > 16) { // 超过一帧时间
      console.warn(`组件渲染慢: ${componentName} 耗时 ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * 测量数据库查询性能
   */
  async measureDatabaseQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(queryName);
    
    try {
      const result = await queryFn();
      const duration = this.endTimer(queryName, 'database', metadata);
      
      if (duration > this.config.slowThreshold) {
        console.warn(`慢数据库查询: ${queryName} 耗时 ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      this.endTimer(queryName, 'database', { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * 获取性能统计
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    slowOperations: PerformanceMetric[];
    averageDuration: number;
    slowestOperations: PerformanceMetric[];
  } {
    const total = this.metrics.length;
    const byType: Record<string, number> = {};
    const slowOperations = this.metrics.filter(m => m.duration > this.config.slowThreshold);
    const averageDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;
    const slowestOperations = [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    this.metrics.forEach(metric => {
      byType[metric.type] = (byType[metric.type] || 0) + 1;
    });

    return {
      total,
      byType,
      slowOperations,
      averageDuration,
      slowestOperations
    };
  }

  /**
   * 清除所有指标
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * 导出指标数据
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 获取特定类型的指标
   */
  getMetricsByType(type: PerformanceMetric['type']): PerformanceMetric[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * 获取慢操作指标
   */
  getSlowMetrics(threshold?: number): PerformanceMetric[] {
    const thresholdToUse = threshold || this.config.slowThreshold;
    return this.metrics.filter(m => m.duration > thresholdToUse);
  }
}

// 全局性能监控实例
export const performanceMonitor = new PerformanceMonitor({
  slowThreshold: 1000,
  onSlowOperation: (metric) => {
    // 可以在这里发送到监控服务
    console.warn(`性能警告: ${metric.name} 耗时 ${metric.duration.toFixed(2)}ms`, metric);
  }
});

/**
 * 性能监控装饰器
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  type: PerformanceMetric['type'] = 'custom'
) {
  return async (...args: T): Promise<R> => {
    return performanceMonitor.measureApiCall(
      operationName,
      () => fn(...args),
      { args: args.length }
    );
  };
}

/**
 * React组件性能监控Hook
 */
export function usePerformanceMonitoring(componentName: string) {
  const startTime = performance.now();
  
  return {
    endRender: (metadata?: Record<string, any>) => {
      const duration = performance.now() - startTime;
      performanceMonitor.recordMetric({
        name: `component:${componentName}`,
        duration,
        timestamp: Date.now(),
        type: 'component',
        metadata
      });
    }
  };
}

/**
 * API路由性能监控中间件
 */
export function withApiPerformanceMonitoring(
  handler: (req: Request) => Promise<Response>,
  routeName: string
) {
  return async (req: Request): Promise<Response> => {
    return performanceMonitor.measureApiCall(
      `api:${routeName}`,
      () => handler(req),
      {
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent')
      }
    );
  };
}

/**
 * 数据库查询性能监控
 */
export function withDatabasePerformanceMonitoring<T>(
  queryFn: () => Promise<T>,
  queryName: string,
  metadata?: Record<string, any>
): Promise<T> {
  return performanceMonitor.measureDatabaseQuery(queryName, queryFn, metadata);
}

/**
 * 性能报告生成器
 */
export function generatePerformanceReport(): string {
  const stats = performanceMonitor.getStats();
  
  return `
性能监控报告
============
总操作数: ${stats.total}
平均耗时: ${stats.averageDuration.toFixed(2)}ms
慢操作数: ${stats.slowOperations.length}

按类型统计:
${Object.entries(stats.byType)
  .map(([type, count]) => `  ${type}: ${count}`)
  .join('\n')}

最慢的10个操作:
${stats.slowestOperations
  .map((op, index) => `${index + 1}. ${op.name}: ${op.duration.toFixed(2)}ms`)
  .join('\n')}
  `;
}

export default performanceMonitor;
