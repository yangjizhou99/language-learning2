import { Pool, PoolClient } from 'pg';
import { Transform, Readable } from 'stream';

export interface CopySyncConfig {
  sourceUrl: string;
  targetUrl: string;
  batchSize?: number;
  tableMappings: TableMapping[];
}

export interface TableMapping {
  sourceTable: string;
  targetTable: string;
  columns: string[];
  whereClause?: string;
  transform?: (row: any) => any;
}

export interface SyncResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  errors: string[];
  duration: number;
}

export class PostgresCopySync {
  private sourcePool: Pool;
  private targetPool: Pool;
  private config: CopySyncConfig;

  constructor(config: CopySyncConfig) {
    this.config = {
      batchSize: 1000,
      ...config,
    };

    this.sourcePool = new Pool({
      connectionString: config.sourceUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.targetPool = new Pool({
      connectionString: config.targetUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * 执行流式同步
   */
  async syncAll(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const mapping of this.config.tableMappings) {
      try {
        const result = await this.syncTable(mapping);
        results.push(result);
      } catch (error) {
        results.push({
          table: mapping.sourceTable,
          success: false,
          rowsProcessed: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          duration: 0,
        });
      }
    }

    return results;
  }

  /**
   * 同步单个表
   */
  async syncTable(mapping: TableMapping): Promise<SyncResult> {
    const startTime = Date.now();
    let rowsProcessed = 0;
    const errors: string[] = [];

    const sourceClient = await this.sourcePool.connect();
    const targetClient = await this.targetPool.connect();

    try {
      // 开始事务
      await targetClient.query('BEGIN');

      // 清空目标表（可选）
      await targetClient.query(`TRUNCATE TABLE ${mapping.targetTable} CASCADE`);

      // 创建流式查询
      const query = this.buildSelectQuery(mapping);
      const sourceStream = new QueryStream(query);

      // 创建转换流
      const transformStream = new Transform({
        objectMode: true,
        transform: (row, encoding, callback) => {
          try {
            // 应用转换函数
            const transformedRow = mapping.transform ? mapping.transform(row) : row;

            // 确保列顺序正确
            const orderedRow = mapping.columns.map((col) => transformedRow[col]);

            callback(null, orderedRow);
            rowsProcessed++;
          } catch (error) {
            errors.push(
              `Row transform error: ${error instanceof Error ? error.message : String(error)}`,
            );
            callback(null, null); // 跳过错误行
          }
        },
      });

      // 创建COPY写入流
      const copyStream = new CopyToTextStream(
        `COPY ${mapping.targetTable} (${mapping.columns.join(', ')}) FROM STDIN WITH (FORMAT text)`,
      );

      // 管道连接
      await new Promise<void>((resolve, reject) => {
        sourceStream
          .pipe(transformStream)
          .pipe(copyStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      // 提交事务
      await targetClient.query('COMMIT');

      return {
        table: mapping.sourceTable,
        success: true,
        rowsProcessed,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      // 回滚事务
      await targetClient.query('ROLLBACK');
      throw error;
    } finally {
      sourceClient.release();
      targetClient.release();
    }
  }

  /**
   * 构建查询语句
   */
  private buildSelectQuery(mapping: TableMapping): string {
    const columns = mapping.columns.join(', ');
    const whereClause = mapping.whereClause ? `WHERE ${mapping.whereClause}` : '';

    return `SELECT ${columns} FROM ${mapping.sourceTable} ${whereClause}`;
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.sourcePool.end();
    await this.targetPool.end();
  }
}

/**
 * 查询流类
 */
class QueryStream extends Readable {
  private query: any;
  private cursor: any;
  private rowCount: number = 0;

  constructor(query: any) {
    super({ objectMode: true });
    this.query = query;
  }

  _read() {
    if (!this.cursor) {
      this.cursor = this.query.cursor();
    }

    this.cursor.read(100, (err: any, rows: any[]) => {
      if (err) {
        this.emit('error', err);
        return;
      }

      if (rows.length === 0) {
        this.push(null);
        return;
      }

      rows.forEach((row) => this.push(row));
      this.rowCount += rows.length;
    });
  }
}

/**
 * COPY文本流类
 */
class CopyToTextStream extends Transform {
  private query: any;

  constructor(query: any) {
    super({ objectMode: true });
    this.query = query;
  }

  _transform(row: any[], encoding: string, callback: Function) {
    if (row === null) {
      callback();
      return;
    }

    // 将行转换为COPY格式的文本
    const textRow =
      row
        .map((field) => {
          if (field === null) return '\\N';
          if (typeof field === 'string') {
            // 转义特殊字符
            return field
              .replace(/\\/g, '\\\\')
              .replace(/\t/g, '\\t')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
          }
          return String(field);
        })
        .join('\t') + '\n';

    this.push(textRow);
    callback();
  }
}

/**
 * 创建同步配置
 */
export function createSyncConfig(
  sourceUrl: string,
  targetUrl: string,
  tables: string[],
): CopySyncConfig {
  const tableMappings: TableMapping[] = tables.map((table) => ({
    sourceTable: table,
    targetTable: table,
    columns: getTableColumns(table),
    transform: getTableTransform(table),
  }));

  return {
    sourceUrl,
    targetUrl,
    batchSize: 1000,
    tableMappings,
  };
}

/**
 * 获取表列定义
 */
function getTableColumns(table: string): string[] {
  const columnMap: Record<string, string[]> = {
    shadowing_items: [
      'id',
      'lang',
      'level',
      'title',
      'text',
      'audio_url',
      'duration_ms',
      'tokens',
      'cefr',
      'meta',
      'created_at',
      'translations',
      'trans_updated_at',
      'theme_id',
      'subtopic_id',
    ],
    cloze_items: [
      'id',
      'lang',
      'level',
      'topic',
      'title',
      'passage',
      'blanks',
      'meta',
      'created_at',
    ],
    alignment_packs: [
      'id',
      'lang',
      'topic',
      'level_min',
      'level_max',
      'preferred_style',
      'steps',
      'ai_provider',
      'ai_model',
      'ai_usage',
      'status',
      'created_by',
      'created_at',
    ],
  };

  return columnMap[table] || [];
}

/**
 * 获取表转换函数
 */
function getTableTransform(table: string): ((row: any) => any) | undefined {
  const transforms: Record<string, (row: any) => any> = {
    shadowing_items: (row) => ({
      ...row,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
      translations:
        typeof row.translations === 'string' ? JSON.parse(row.translations) : row.translations,
    }),
    cloze_items: (row) => ({
      ...row,
      blanks: typeof row.blanks === 'string' ? JSON.parse(row.blanks) : row.blanks,
      meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
    }),
    alignment_packs: (row) => ({
      ...row,
      preferred_style:
        typeof row.preferred_style === 'string'
          ? JSON.parse(row.preferred_style)
          : row.preferred_style,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      ai_usage: typeof row.ai_usage === 'string' ? JSON.parse(row.ai_usage) : row.ai_usage,
    }),
  };

  return transforms[table];
}
