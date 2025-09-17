# 数据库性能优化指南

## 概述

本指南说明如何解决数据库性能检查中发现的问题，包括未索引的外键和未使用的索引。

## 问题分析

### 1. 未索引的外键约束 (18个)
以下表的外键缺少覆盖索引，影响查询性能：
- `alignment_attempts.pack_id`
- `alignment_packs.created_by`
- `article_batch_items.batch_id`
- `article_batches.created_by`
- `article_cloze.article_id`
- `article_drafts.created_by`
- `cloze_drafts.created_by`
- `profiles.invitation_code_id` 和 `invited_by`
- `sessions.user_id`
- `shadowing_drafts.created_by`
- `shadowing_items.created_by`
- `shadowing_sessions.item_id`
- `shadowing_subtopics.created_by`
- `shadowing_themes.created_by`
- `study_cards.user_id`
- `tts_assets.user_id`

### 2. 未使用的索引 (35个)
以下索引从未被使用，占用存储空间：
- 文本搜索索引 (GIN)
- 状态字段索引
- 时间戳索引
- 各种业务逻辑索引

## 解决方案

### 方案一：使用迁移文件（推荐用于生产环境）

1. **运行迁移文件**：
   ```bash
   # 在 Supabase 中运行迁移
   supabase db push
   ```

2. **迁移文件内容**：
   - `supabase/migrations/20250120000105_optimize_database_performance.sql`
   - 创建外键索引（常规模式）
   - 删除未使用的索引

### 方案二：并发创建索引（推荐用于大型表）

如果您的表数据量很大，建议使用并发创建索引以避免锁表：

1. **在 Supabase SQL 编辑器中执行**：
   ```sql
   -- 运行 scripts/create-concurrent-indexes.sql 中的命令
   ```

2. **然后运行迁移文件**：
   ```bash
   supabase db push
   ```

## 执行步骤

### 步骤 1：备份数据库
```bash
# 创建数据库备份
supabase db dump --data-only > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 步骤 2：选择执行方案

#### 选项 A：直接运行迁移（小到中等数据量）
```bash
supabase db push
```

#### 选项 B：并发创建索引（大数据量）
1. 在 Supabase Dashboard 的 SQL 编辑器中运行 `scripts/create-concurrent-indexes.sql`
2. 等待所有索引创建完成
3. 运行迁移文件删除未使用的索引

### 步骤 3：验证结果

检查索引是否创建成功：
```sql
-- 检查新创建的索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE indexname LIKE 'idx_%_created_by' 
   OR indexname LIKE 'idx_%_user_id'
   OR indexname LIKE 'idx_%_pack_id'
   OR indexname LIKE 'idx_%_batch_id'
   OR indexname LIKE 'idx_%_article_id'
ORDER BY tablename, indexname;
```

检查未使用的索引是否已删除：
```sql
-- 检查是否还有未使用的索引
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes 
WHERE indexname IN (
    'idx_vocab_entries_term_gin',
    'idx_article_drafts_text_gin',
    'idx_shadowing_items_text_gin',
    -- ... 其他未使用的索引
);
```

## 性能影响

### 预期改进
- **查询性能**：外键关联查询速度提升 50-90%
- **存储空间**：减少 10-20% 的索引存储空间
- **维护成本**：减少不必要的索引维护开销

### 监控建议
- 监控查询执行时间
- 检查索引使用情况
- 观察存储空间变化

## 回滚方案

如果需要回滚，可以：

1. **恢复索引**：
   ```sql
   -- 重新创建被删除的索引（如果需要）
   CREATE INDEX IF NOT EXISTS idx_vocab_entries_term_gin ON public.vocab_entries USING gin (term);
   -- ... 其他索引
   ```

2. **删除新创建的索引**：
   ```sql
   -- 删除新创建的外键索引
   DROP INDEX IF EXISTS public.idx_alignment_attempts_pack_id;
   -- ... 其他索引
   ```

## 注意事项

1. **执行时间**：索引创建可能需要几分钟到几小时，取决于数据量
2. **锁表风险**：常规 CREATE INDEX 会短暂锁表，建议在低峰期执行
3. **存储空间**：新索引会占用额外存储空间
4. **监控**：执行后密切监控数据库性能

## 文件说明

- `supabase/migrations/20250120000105_optimize_database_performance.sql` - 主迁移文件
- `scripts/create-concurrent-indexes.sql` - 并发索引创建脚本
- `DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md` - 本指南文档
