// 备份和恢复性能优化配置
// 允许根据服务器性能和网络条件调整并发参数

export interface BackupPerformanceConfig {
  // 数据库备份配置
  database: {
    concurrentTables: number;      // 同时处理的表数量
    batchSizeBase: number;         // 基础批处理大小
    maxBatchSize: number;          // 最大批处理大小
  };
  
  // 存储备份配置
  storage: {
    concurrentBuckets: number;     // 同时处理的存储桶数量
    concurrentDownloads: number;   // 同时下载的文件数量
    retryAttempts: number;         // 重试次数
    retryDelay: number;            // 重试延迟（毫秒）
  };
  
  // 恢复配置
  restore: {
    sqlBatchSize: {
      supabase: number;            // Supabase RPC 批处理大小
      postgresql: number;          // PostgreSQL 直连批处理大小
    };
    storageConcurrentUploads: number; // 并发上传数量
    maxRetries: number;            // 最大重试次数
  };
}

// 默认性能配置
export const DEFAULT_PERFORMANCE_CONFIG: BackupPerformanceConfig = {
  database: {
    concurrentTables: 5,
    batchSizeBase: 500,
    maxBatchSize: 2000,
  },
  storage: {
    concurrentBuckets: 2,
    concurrentDownloads: 10,
    retryAttempts: 3,
    retryDelay: 200,
  },
  restore: {
    sqlBatchSize: {
      supabase: 10,
      postgresql: 20,
    },
    storageConcurrentUploads: 30,
    maxRetries: 3,
  },
};

// 高性能配置（适用于高性能服务器）
export const HIGH_PERFORMANCE_CONFIG: BackupPerformanceConfig = {
  database: {
    concurrentTables: 8,
    batchSizeBase: 1000,
    maxBatchSize: 5000,
  },
  storage: {
    concurrentBuckets: 3,
    concurrentDownloads: 20,
    retryAttempts: 5,
    retryDelay: 100,
  },
  restore: {
    sqlBatchSize: {
      supabase: 15,
      postgresql: 30,
    },
    storageConcurrentUploads: 50,
    maxRetries: 5,
  },
};

// 保守配置（适用于资源有限的环境）
export const CONSERVATIVE_CONFIG: BackupPerformanceConfig = {
  database: {
    concurrentTables: 2,
    batchSizeBase: 200,
    maxBatchSize: 1000,
  },
  storage: {
    concurrentBuckets: 1,
    concurrentDownloads: 5,
    retryAttempts: 2,
    retryDelay: 500,
  },
  restore: {
    sqlBatchSize: {
      supabase: 5,
      postgresql: 10,
    },
    storageConcurrentUploads: 10,
    maxRetries: 2,
  },
};

// 获取当前性能配置
export function getPerformanceConfig(): BackupPerformanceConfig {
  const mode = process.env.BACKUP_PERFORMANCE_MODE || 'default';
  
  switch (mode.toLowerCase()) {
    case 'high':
      return HIGH_PERFORMANCE_CONFIG;
    case 'conservative':
      return CONSERVATIVE_CONFIG;
    default:
      return DEFAULT_PERFORMANCE_CONFIG;
  }
}

// 根据列数动态计算批处理大小
export function calculateOptimalBatchSize(
  columnCount: number, 
  config: BackupPerformanceConfig = getPerformanceConfig()
): number {
  const { batchSizeBase, maxBatchSize } = config.database;
  // 列数越多，批处理大小越小，避免内存过载
  const calculatedSize = Math.max(batchSizeBase, Math.floor(10000 / Math.max(columnCount, 1)));
  return Math.min(calculatedSize, maxBatchSize);
}

// 性能监控和统计
export interface PerformanceStats {
  startTime: number;
  endTime?: number;
  totalItems: number;
  processedItems: number;
  successItems: number;
  failedItems: number;
  skippedItems: number;
  avgProcessingTime: number;
  throughput: number; // 每秒处理项目数
}

export class PerformanceMonitor {
  private stats: PerformanceStats;
  
  constructor(totalItems: number) {
    this.stats = {
      startTime: Date.now(),
      totalItems,
      processedItems: 0,
      successItems: 0,
      failedItems: 0,
      skippedItems: 0,
      avgProcessingTime: 0,
      throughput: 0,
    };
  }
  
  recordSuccess() {
    this.stats.processedItems++;
    this.stats.successItems++;
    this.updateMetrics();
  }
  
  recordFailure() {
    this.stats.processedItems++;
    this.stats.failedItems++;
    this.updateMetrics();
  }
  
  recordSkipped() {
    this.stats.processedItems++;
    this.stats.skippedItems++;
    this.updateMetrics();
  }
  
  private updateMetrics() {
    const elapsed = Date.now() - this.stats.startTime;
    this.stats.avgProcessingTime = elapsed / this.stats.processedItems;
    this.stats.throughput = this.stats.processedItems / (elapsed / 1000);
  }
  
  getStats(): PerformanceStats {
    return { ...this.stats, endTime: Date.now() };
  }
  
  getProgressReport(): string {
    const progress = Math.round((this.stats.processedItems / this.stats.totalItems) * 100);
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const eta = this.stats.throughput > 0 
      ? Math.round((this.stats.totalItems - this.stats.processedItems) / this.stats.throughput)
      : 0;
    
    return `进度: ${progress}% (${this.stats.processedItems}/${this.stats.totalItems}), ` +
           `成功: ${this.stats.successItems}, 失败: ${this.stats.failedItems}, 跳过: ${this.stats.skippedItems}, ` +
           `速度: ${this.stats.throughput.toFixed(1)}/秒, 已用时: ${elapsed.toFixed(1)}秒, 预计剩余: ${eta}秒`;
  }
}
