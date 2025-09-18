import { Pool, PoolClient } from 'pg';
import { createClient } from '@supabase/supabase-js';

export interface PackingConfig {
  sourceUrl: string;
  targetUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export interface PackingResult {
  type: string;
  success: boolean;
  itemsCount: number;
  filesCount: number;
  themesCount: number;
  subtopicsCount: number;
  publishedCount: number; // 新增：发布的草稿数量
  errors: string[];
  duration: number;
}

/**
 * Shadowing题目专用打包器
 * 包含：题目数据 + 草稿数据 + 音频文件 + 翻译数据
 */
export class ShadowingPacker {
  private sourcePool: Pool;
  private targetPool: Pool;
  private supabase: any;
  private config: PackingConfig;

  constructor(config: PackingConfig) {
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

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  async packShadowingItems(filters: {
    lang?: string;
    level?: number;
    status?: string;
    limit?: number;
    publishDrafts?: boolean; // 新增：是否发布草稿
  } = {}): Promise<PackingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let itemsCount = 0;
    let filesCount = 0;
    let themesCount = 0;
    let subtopicsCount = 0;
    let publishedCount = 0;

    const sourceClient = await this.sourcePool.connect();
    const targetClient = await this.targetPool.connect();

    try {
      await targetClient.query('BEGIN');

      // 1. 获取已发布的题目
      const publishedItems = await this.getPublishedItems(sourceClient, filters);
      itemsCount += publishedItems.length;

      // 2. 获取草稿题目
      const draftItems = await this.getDraftItems(sourceClient, filters);
      itemsCount += draftItems.length;

      // 3. 同步主题和子主题数据
      const themeSubtopicCounts = await this.syncThemesAndSubtopics(sourceClient, targetClient, publishedItems.concat(draftItems));
      themesCount = themeSubtopicCounts.themes;
      subtopicsCount = themeSubtopicCounts.subtopics;

      // 4. 同步题目数据到目标数据库
      console.log(`同步 ${publishedItems.length} 个已发布题目到 shadowing_items`);
      await this.syncItemsToTarget(targetClient, publishedItems, 'shadowing_items');
      
      // 草稿保持草稿状态，同步到远程数据库的草稿表
      console.log(`同步 ${draftItems.length} 个草稿到 shadowing_drafts`);
      if (draftItems.length > 0) {
        console.log('草稿数据示例:', JSON.stringify(draftItems[0], null, 2));
      }
      await this.syncItemsToTarget(targetClient, draftItems, 'shadowing_drafts');

      // 5. 处理音频文件
      const audioFiles = await this.processAudioFiles(publishedItems.concat(draftItems));
      filesCount += audioFiles.length;

      // 6. 处理翻译数据
      await this.processTranslations(targetClient, publishedItems.concat(draftItems));

      // 7. 如果需要发布草稿，则发布到本地数据库
      if (filters.publishDrafts && draftItems.length > 0) {
        publishedCount = await this.publishDraftsToLocal(sourceClient, draftItems);
      }

      await targetClient.query('COMMIT');

      return {
        type: 'shadowing',
        success: true,
        itemsCount,
        filesCount,
        themesCount,
        subtopicsCount,
        publishedCount,
        errors,
        duration: Date.now() - startTime
      };

    } catch (error) {
      await targetClient.query('ROLLBACK');
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        type: 'shadowing',
        success: false,
        itemsCount,
        filesCount,
        themesCount,
        subtopicsCount,
        publishedCount,
        errors,
        duration: Date.now() - startTime
      };
    } finally {
      sourceClient.release();
      targetClient.release();
    }
  }

  private async getPublishedItems(client: PoolClient, filters: any) {
    let query = `
      SELECT si.*, 
             st.title as theme_title,
             st.genre as theme_genre,
             ss.title_cn as subtopic_title
      FROM shadowing_items si
      LEFT JOIN shadowing_themes st ON si.theme_id = st.id
      LEFT JOIN shadowing_subtopics ss ON si.subtopic_id = ss.id
    `;

    const conditions = [];
    const params = [];

    // 如果指定了选中的ID列表，只获取这些题目
    if (filters.selectedIds && filters.selectedIds.length > 0) {
      const placeholders = filters.selectedIds.map((_: any, index: number) => `$${params.length + index + 1}`).join(',');
      conditions.push(`si.id IN (${placeholders})`);
      params.push(...filters.selectedIds);
    } else {
      // 否则使用其他过滤条件
      if (filters.lang) {
        conditions.push(`si.lang = $${params.length + 1}`);
        params.push(filters.lang);
      }

      if (filters.level) {
        conditions.push(`si.level = $${params.length + 1}`);
        params.push(filters.level);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY si.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  }

  private async getDraftItems(client: PoolClient, filters: any) {
    let query = `
      SELECT sd.*, 
             st.title as theme_title,
             st.genre as theme_genre,
             ss.title_cn as subtopic_title
      FROM shadowing_drafts sd
      LEFT JOIN shadowing_themes st ON sd.theme_id = st.id
      LEFT JOIN shadowing_subtopics ss ON sd.subtopic_id = ss.id
      WHERE sd.status != 'published'
    `;

    const conditions = ['sd.status != \'published\''];
    const params = [];

    // 如果指定了选中的ID列表，只获取这些题目
    if (filters.selectedIds && filters.selectedIds.length > 0) {
      const placeholders = filters.selectedIds.map((_: any, index: number) => `$${params.length + index + 1}`).join(',');
      conditions.push(`sd.id IN (${placeholders})`);
      params.push(...filters.selectedIds);
    } else {
      // 否则使用其他过滤条件
      if (filters.lang) {
        conditions.push(`sd.lang = $${params.length + 1}`);
        params.push(filters.lang);
      }

      if (filters.level) {
        conditions.push(`sd.level = $${params.length + 1}`);
        params.push(filters.level);
      }
    }

    if (conditions.length > 0) {
      query = query.replace('WHERE sd.status != \'published\'', `WHERE ${conditions.join(' AND ')}`);
    }

    query += ` ORDER BY sd.created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  }

  private async syncItemsToTarget(client: PoolClient, items: any[], tableName: string) {
    if (items.length === 0) return;

    // 根据表名选择不同的字段
    let columns: string[];
    if (tableName === 'shadowing_drafts') {
      columns = [
        'id', 'lang', 'level', 'genre', 'title', 'text', 'status', 'created_at', 
        'notes', 'translations', 'trans_updated_at', 'theme_id', 'subtopic_id',
        'ai_provider', 'ai_model', 'ai_usage', 'topic', 'register'
      ];
    } else {
      columns = [
        'id', 'lang', 'level', 'title', 'text', 'audio_url', 'duration_ms', 
        'tokens', 'cefr', 'meta', 'created_at', 'translations', 'trans_updated_at',
        'theme_id', 'subtopic_id'
      ];
    }

    const values = items.map(item => 
      columns.map(col => {
        if (col === 'meta' || col === 'translations' || col === 'notes' || col === 'ai_usage') {
          return typeof item[col] === 'string' ? item[col] : JSON.stringify(item[col] || {});
        }
        // 为草稿表设置默认值
        if (tableName === 'shadowing_drafts') {
          if (col === 'status' && !item[col]) return 'draft';
          if (col === 'genre' && !item[col]) return 'monologue';
          if (col === 'register' && !item[col]) return 'neutral';
          if (col === 'topic' && !item[col]) return '';
        }
        return item[col];
      })
    );

    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    const flatValues = values.flat();
    console.log(`执行SQL: INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ...`);
    console.log(`参数数量: ${flatValues.length}, 记录数量: ${items.length}`);
    
    try {
      await client.query(query, flatValues);
      console.log(`成功同步 ${items.length} 条记录到 ${tableName}`);
    } catch (error) {
      console.error(`同步到 ${tableName} 失败:`, error);
      console.error('SQL查询:', query);
      console.error('参数:', flatValues.slice(0, 10)); // 只显示前10个参数
      throw error;
    }
  }

  private async processAudioFiles(items: any[]): Promise<string[]> {
    const audioFiles: string[] = [];
    
    for (const item of items) {
      if (item.audio_url) {
        try {
          // 从Supabase Storage下载音频文件
          const { data, error } = await this.supabase.storage
            .from('tts')
            .download(item.audio_url);

          if (!error && data) {
            // 上传到目标Supabase Storage
            const fileName = `shadowing/${item.lang}/${item.id}.wav`;
            const { error: uploadError } = await this.supabase.storage
              .from('tts')
              .upload(fileName, data, {
                contentType: 'audio/wav',
                upsert: true
              });

            if (!uploadError) {
              audioFiles.push(fileName);
              // 更新音频URL
              item.audio_url = `${this.config.supabaseUrl}/storage/v1/object/public/tts/${fileName}`;
            }
          }
        } catch (error) {
          console.error(`处理音频文件失败 ${item.id}:`, error);
        }
      }
    }

    return audioFiles;
  }

  private async processTranslations(client: PoolClient, items: any[]) {
    // 处理翻译数据，确保翻译内容完整
    for (const item of items) {
      if (item.translations && typeof item.translations === 'string') {
        try {
          const translations = JSON.parse(item.translations);
          // 可以在这里添加翻译数据的验证和补充逻辑
          item.translations = JSON.stringify(translations);
        } catch (error) {
          console.error(`处理翻译数据失败 ${item.id}:`, error);
        }
      }
    }
  }

  private async syncThemesAndSubtopics(sourceClient: PoolClient, targetClient: PoolClient, items: any[]): Promise<{themes: number, subtopics: number}> {
    // 收集所有需要的主题和子主题ID
    const themeIds = new Set<string>();
    const subtopicIds = new Set<string>();

    items.forEach(item => {
      if (item.theme_id) themeIds.add(item.theme_id);
      if (item.subtopic_id) subtopicIds.add(item.subtopic_id);
    });

    let themesCount = 0;
    let subtopicsCount = 0;

    // 同步主题数据
    if (themeIds.size > 0) {
      const themeIdsArray = Array.from(themeIds);
      const themeQuery = `
        SELECT * FROM shadowing_themes 
        WHERE id = ANY($1)
      `;
      const themes = await sourceClient.query(themeQuery, [themeIdsArray]);
      
      if (themes.rows.length > 0) {
        await this.syncThemesToTarget(targetClient, themes.rows);
        themesCount = themes.rows.length;
      }
    }

    // 同步子主题数据
    if (subtopicIds.size > 0) {
      const subtopicIdsArray = Array.from(subtopicIds);
      const subtopicQuery = `
        SELECT * FROM shadowing_subtopics 
        WHERE id = ANY($1)
      `;
      const subtopics = await sourceClient.query(subtopicQuery, [subtopicIdsArray]);
      
      if (subtopics.rows.length > 0) {
        await this.syncSubtopicsToTarget(targetClient, subtopics.rows);
        subtopicsCount = subtopics.rows.length;
      }
    }

    return { themes: themesCount, subtopics: subtopicsCount };
  }

  private async syncThemesToTarget(targetClient: PoolClient, themes: any[]) {
    if (themes.length === 0) return;

    const columns = [
      'id', 'lang', 'level', 'genre', 'title', '"desc"', 'status', 'created_by', 
      'created_at', 'updated_at', 'ai_provider', 'ai_model', 'ai_usage', 'title_en', 'coverage'
    ];

    const values = themes.map(theme => 
      columns.map(col => {
        // 处理带引号的列名
        const actualCol = col.replace(/"/g, '');
        if (actualCol === 'tags' || actualCol === 'meta' || actualCol === 'ai_usage' || actualCol === 'coverage') {
          return typeof theme[actualCol] === 'string' ? theme[actualCol] : JSON.stringify(theme[actualCol] || {});
        }
        return theme[actualCol];
      })
    );

    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO shadowing_themes (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    const flatValues = values.flat();
    await targetClient.query(query, flatValues);
  }

  private async syncSubtopicsToTarget(targetClient: PoolClient, subtopics: any[]) {
    if (subtopics.length === 0) return;

   const columns = [
     'id', 'theme_id', 'lang', 'level', 'genre', 'title_cn', 'seed_en', 
     'one_line_cn', 'tags', 'status', 'created_by', 'created_at', 'updated_at', 
     'ai_provider', 'ai_model', 'ai_usage'
   ];

    const values = subtopics.map(subtopic => 
      columns.map(col => {
        if (col === 'tags' || col === 'meta') {
          return typeof subtopic[col] === 'string' ? subtopic[col] : JSON.stringify(subtopic[col] || {});
        }
        return subtopic[col];
      })
    );

    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO shadowing_subtopics (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    const flatValues = values.flat();
    await targetClient.query(query, flatValues);
  }

  /**
   * 发布草稿到本地数据库
   * 将草稿数据移动到正式题目表，并删除草稿记录
   */
  private async publishDraftsToLocal(sourceClient: PoolClient, draftItems: any[]): Promise<number> {
    if (draftItems.length === 0) return 0;

    let publishedCount = 0;

    try {
      // 开始本地数据库事务
      await sourceClient.query('BEGIN');

      for (const draft of draftItems) {
        // 1. 将草稿数据插入到正式题目表
        const insertQuery = `
          INSERT INTO shadowing_items (
            id, lang, level, title, text, audio_url, duration_ms, 
            tokens, cefr, meta, created_at, translations, trans_updated_at,
            theme_id, subtopic_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            lang = EXCLUDED.lang,
            level = EXCLUDED.level,
            title = EXCLUDED.title,
            text = EXCLUDED.text,
            audio_url = EXCLUDED.audio_url,
            duration_ms = EXCLUDED.duration_ms,
            tokens = EXCLUDED.tokens,
            cefr = EXCLUDED.cefr,
            meta = EXCLUDED.meta,
            translations = EXCLUDED.translations,
            trans_updated_at = EXCLUDED.trans_updated_at,
            theme_id = EXCLUDED.theme_id,
            subtopic_id = EXCLUDED.subtopic_id,
            updated_at = NOW()
        `;

        const values = [
          draft.id,
          draft.lang,
          draft.level,
          draft.title,
          draft.text,
          draft.audio_url,
          draft.duration_ms,
          draft.tokens,
          draft.cefr,
          typeof draft.meta === 'string' ? draft.meta : JSON.stringify(draft.meta || {}),
          draft.created_at,
          typeof draft.translations === 'string' ? draft.translations : JSON.stringify(draft.translations || {}),
          draft.trans_updated_at,
          draft.theme_id,
          draft.subtopic_id
        ];

        await sourceClient.query(insertQuery, values);

        // 2. 删除草稿记录
        await sourceClient.query('DELETE FROM shadowing_drafts WHERE id = $1', [draft.id]);

        publishedCount++;
      }

      await sourceClient.query('COMMIT');
      console.log(`成功发布 ${publishedCount} 个草稿到本地数据库`);

    } catch (error) {
      await sourceClient.query('ROLLBACK');
      console.error('发布草稿失败:', error);
      throw error;
    }

    return publishedCount;
  }

  async close() {
    await this.sourcePool.end();
    await this.targetPool.end();
  }
}

/**
 * Cloze题目专用打包器
 * 包含：题目数据 + 草稿数据
 */
export class ClozePacker {
  private sourcePool: Pool;
  private targetPool: Pool;
  private config: PackingConfig;

  constructor(config: PackingConfig) {
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

  async packClozeItems(filters: {
    lang?: string;
    level?: number;
    status?: string;
    limit?: number;
  } = {}): Promise<PackingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let itemsCount = 0;

    const sourceClient = await this.sourcePool.connect();
    const targetClient = await this.targetPool.connect();

    try {
      await targetClient.query('BEGIN');

      // 1. 获取已发布的题目
      const publishedItems = await this.getPublishedItems(sourceClient, filters);
      itemsCount += publishedItems.length;

      // 2. 获取草稿题目
      const draftItems = await this.getDraftItems(sourceClient, filters);
      itemsCount += draftItems.length;

      // 3. 同步题目数据到目标数据库
      await this.syncItemsToTarget(targetClient, publishedItems, 'cloze_items');
      await this.syncItemsToTarget(targetClient, draftItems, 'cloze_drafts');

      await targetClient.query('COMMIT');

      return {
        type: 'cloze',
        success: true,
        itemsCount,
        filesCount: 0,
        themesCount: 0,
        subtopicsCount: 0,
        publishedCount: 0,
        errors,
        duration: Date.now() - startTime
      };

    } catch (error) {
      await targetClient.query('ROLLBACK');
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        type: 'cloze',
        success: false,
        itemsCount,
        filesCount: 0,
        themesCount: 0,
        subtopicsCount: 0,
        publishedCount: 0,
        errors,
        duration: Date.now() - startTime
      };
    } finally {
      sourceClient.release();
      targetClient.release();
    }
  }

  private async getPublishedItems(client: PoolClient, filters: any) {
    let query = `SELECT * FROM cloze_items`;
    const conditions = [];
    const params = [];

    // 如果指定了选中的ID列表，只获取这些题目
    if (filters.selectedIds && filters.selectedIds.length > 0) {
      const placeholders = filters.selectedIds.map((_: any, index: number) => `$${params.length + index + 1}`).join(',');
      conditions.push(`id IN (${placeholders})`);
      params.push(...filters.selectedIds);
    } else {
      // 否则使用其他过滤条件
      if (filters.lang) {
        conditions.push(`lang = $${params.length + 1}`);
        params.push(filters.lang);
      }

      if (filters.level) {
        conditions.push(`level = $${params.length + 1}`);
        params.push(filters.level);
      }
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  }

  private async getDraftItems(client: PoolClient, filters: any) {
    let query = `SELECT * FROM cloze_drafts WHERE status != 'published'`;
    const conditions = ['status != \'published\''];
    const params = [];

    // 如果指定了选中的ID列表，只获取这些题目
    if (filters.selectedIds && filters.selectedIds.length > 0) {
      const placeholders = filters.selectedIds.map((_: any, index: number) => `$${params.length + index + 1}`).join(',');
      conditions.push(`id IN (${placeholders})`);
      params.push(...filters.selectedIds);
    } else {
      // 否则使用其他过滤条件
      if (filters.lang) {
        conditions.push(`lang = $${params.length + 1}`);
        params.push(filters.lang);
      }

      if (filters.level) {
        conditions.push(`level = $${params.length + 1}`);
        params.push(filters.level);
      }
    }

    if (conditions.length > 0) {
      query = query.replace('WHERE status != \'published\'', `WHERE ${conditions.join(' AND ')}`);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  }

  private async syncItemsToTarget(client: PoolClient, items: any[], tableName: string) {
    if (items.length === 0) return;

    const columns = [
      'id', 'lang', 'level', 'topic', 'title', 'passage', 
      'blanks', 'meta', 'created_at'
    ];

    const values = items.map(item => 
      columns.map(col => {
        if (col === 'blanks' || col === 'meta') {
          return typeof item[col] === 'string' ? item[col] : JSON.stringify(item[col] || {});
        }
        return item[col];
      })
    );

    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    const flatValues = values.flat();
    await client.query(query, flatValues);
  }

  async close() {
    await this.sourcePool.end();
    await this.targetPool.end();
  }
}

/**
 * Alignment题目专用打包器
 * 包含：训练包数据
 */
export class AlignmentPacker {
  private sourcePool: Pool;
  private targetPool: Pool;
  private config: PackingConfig;

  constructor(config: PackingConfig) {
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

  async packAlignmentItems(filters: {
    lang?: string;
    level?: number;
    status?: string;
    limit?: number;
  } = {}): Promise<PackingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let itemsCount = 0;

    const sourceClient = await this.sourcePool.connect();
    const targetClient = await this.targetPool.connect();

    try {
      await targetClient.query('BEGIN');

      // 获取训练包数据
      const items = await this.getItems(sourceClient, filters);
      itemsCount = items.length;

      // 同步到目标数据库
      await this.syncItemsToTarget(targetClient, items);

      await targetClient.query('COMMIT');

      return {
        type: 'alignment',
        success: true,
        itemsCount,
        filesCount: 0,
        themesCount: 0,
        subtopicsCount: 0,
        publishedCount: 0,
        errors,
        duration: Date.now() - startTime
      };

    } catch (error) {
      await targetClient.query('ROLLBACK');
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        type: 'alignment',
        success: false,
        itemsCount,
        filesCount: 0,
        themesCount: 0,
        subtopicsCount: 0,
        publishedCount: 0,
        errors,
        duration: Date.now() - startTime
      };
    } finally {
      sourceClient.release();
      targetClient.release();
    }
  }

  private async getItems(client: PoolClient, filters: any) {
    let query = `SELECT * FROM alignment_packs`;
    const conditions = [];
    const params = [];

    if (filters.lang) {
      conditions.push(`lang = $${params.length + 1}`);
      params.push(filters.lang);
    }

    if (filters.level) {
      conditions.push(`level_min <= $${params.length + 1} AND level_max >= $${params.length + 1}`);
      params.push(filters.level);
    }

    if (filters.status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC`;

    if (filters.limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(filters.limit);
    }

    const result = await client.query(query, params);
    return result.rows;
  }

  private async syncItemsToTarget(client: PoolClient, items: any[]) {
    if (items.length === 0) return;

    const columns = [
      'id', 'lang', 'topic', 'tags', 'level_min', 'level_max', 
      'preferred_style', 'steps', 'ai_provider', 'ai_model', 
      'ai_usage', 'status', 'created_by', 'created_at'
    ];

    const values = items.map(item => 
      columns.map(col => {
        if (col === 'tags' || col === 'preferred_style' || col === 'steps' || col === 'ai_usage') {
          return typeof item[col] === 'string' ? item[col] : JSON.stringify(item[col] || {});
        }
        return item[col];
      })
    );

    const placeholders = values.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
    ).join(', ');

    const query = `
      INSERT INTO alignment_packs (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    const flatValues = values.flat();
    await client.query(query, flatValues);
  }

  async close() {
    await this.sourcePool.end();
    await this.targetPool.end();
  }
}

/**
 * 打包器工厂
 */
export class PackerFactory {
  static createPacker(type: string, config: PackingConfig) {
    switch (type) {
      case 'shadowing':
        return new ShadowingPacker(config);
      case 'cloze':
        return new ClozePacker(config);
      case 'alignment':
        return new AlignmentPacker(config);
      default:
        throw new Error(`未知的打包器类型: ${type}`);
    }
  }
}
