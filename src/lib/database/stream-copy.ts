import { Pool, PoolClient } from 'pg';
import { Transform } from 'stream';
import * as copyStreams from 'pg-copy-streams';

export interface StreamCopyConfig {
  sourceUrl: string;
  targetUrl: string;
  tables: TableConfig[];
}

export interface TableConfig {
  name: string;
  columns: string[];
  whereClause?: string;
  transform?: (row: any) => any;
}

export interface CopyResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  duration: number;
  error?: string;
}

export class StreamCopySync {
  private sourcePool: Pool;
  private targetPool: Pool;
  private config: StreamCopyConfig;

  constructor(config: StreamCopyConfig) {
    this.config = config;

    this.sourcePool = new Pool({
      connectionString: config.sourceUrl,
      max: 5,
      idleTimeoutMillis: 30000,
    });

    this.targetPool = new Pool({
      connectionString: config.targetUrl,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }

  /**
   * 执行所有表的流式复制
   */
  async syncAll(): Promise<CopyResult[]> {
    const results: CopyResult[] = [];

    for (const tableConfig of this.config.tables) {
      try {
        const result = await this.copyTable(tableConfig);
        results.push(result);
      } catch (error) {
        results.push({
          table: tableConfig.name,
          success: false,
          rowsProcessed: 0,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 复制单个表
   */
  async copyTable(tableConfig: TableConfig): Promise<CopyResult> {
    const startTime = Date.now();
    let rowsProcessed = 0;

    const sourceClient = await this.sourcePool.connect();
    const targetClient = await this.targetPool.connect();

    try {
      // 开始事务
      await targetClient.query('BEGIN');

      // 清空目标表
      await targetClient.query(`TRUNCATE TABLE ${tableConfig.name} CASCADE`);

      // 构建查询语句
      const selectQuery = this.buildSelectQuery(tableConfig);

      // 使用简单的批量复制方式
      const result = await sourceClient.query(selectQuery);

      if (result.rows.length > 0) {
        // 准备数据
        const values = result.rows
          .map((row) => {
            const transformedRow = tableConfig.transform ? tableConfig.transform(row) : row;
            const orderedRow = tableConfig.columns.map((col) => transformedRow[col]);

            // 将值转换为PostgreSQL COPY格式
            return orderedRow
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
              .join('\t');
          })
          .join('\n');

        // 执行COPY命令
        const copyQuery = `COPY ${tableConfig.name} (${tableConfig.columns.join(', ')}) FROM STDIN WITH (FORMAT text)`;
        await targetClient.query(copyQuery + '\n' + values + '\n\\\\.');

        rowsProcessed = result.rows.length;
      }

      // 提交事务
      await targetClient.query('COMMIT');

      return {
        table: tableConfig.name,
        success: true,
        rowsProcessed,
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
   * 构建SELECT查询
   */
  private buildSelectQuery(tableConfig: TableConfig): string {
    const columns = tableConfig.columns.join(', ');
    const whereClause = tableConfig.whereClause ? `WHERE ${tableConfig.whereClause}` : '';

    return `SELECT ${columns} FROM ${tableConfig.name} ${whereClause}`;
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
 * 创建表配置
 */
export function createTableConfigs(tables: string[]): TableConfig[] {
  return tables.map((tableName) => ({
    name: tableName,
    columns: getTableColumns(tableName),
    transform: getTableTransform(tableName),
  }));
}

/**
 * 获取表列定义
 */
function getTableColumns(tableName: string): string[] {
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

  return columnMap[tableName] || [];
}

/**
 * 获取表转换函数
 */
function getTableTransform(tableName: string): ((row: any) => any) | undefined {
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

  return transforms[tableName];
}
