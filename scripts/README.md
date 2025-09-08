# 数据库索引优化脚本

## 问题解决

### 错误1：CREATE INDEX CONCURRENTLY cannot run inside a transaction block

这个错误是因为 `CREATE INDEX CONCURRENTLY` 不能在事务块中运行，而 Supabase 迁移默认在事务中执行。

### 错误2：column "status" does not exist

这个错误是因为某些表（如 `shadowing_items` 和 `cloze_items`）没有 `status` 列。只有草稿表（drafts）才有状态列。

### 错误3：functions in index predicate must be marked IMMUTABLE

这个错误是因为在索引的 `WHERE` 子句中使用了 `NOW()` 函数，而 `NOW()` 不是 `IMMUTABLE` 函数。PostgreSQL 要求索引谓词中的函数必须是 `IMMUTABLE` 的。

#### IMMUTABLE 函数说明

**可以在索引谓词中使用的函数：**
- `CURRENT_DATE` - 当前日期（IMMUTABLE）
- `CURRENT_TIME` - 当前时间（IMMUTABLE）
- `CURRENT_TIMESTAMP` - 当前时间戳（IMMUTABLE）
- 字符串函数：`LOWER()`, `UPPER()`, `TRIM()` 等
- 数学函数：`ABS()`, `ROUND()`, `FLOOR()` 等

**不能在索引谓词中使用的函数：**
- `NOW()` - 当前时间戳（VOLATILE）
- `CURRENT_USER` - 当前用户（STABLE）
- `RANDOM()` - 随机数（VOLATILE）

#### 时间相关索引的替代方案

如果需要创建基于时间的部分索引，可以使用以下方法：

```sql
-- 方法1：使用固定时间戳（需要定期更新）
CREATE INDEX idx_recent_items 
ON shadowing_items(id, lang, level) 
WHERE created_at > '2024-01-01'::timestamp;

-- 方法2：使用日期范围
CREATE INDEX idx_current_year_items 
ON shadowing_items(id, lang, level) 
WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE);

-- 方法3：创建普通索引，在查询时使用时间条件
CREATE INDEX idx_items_created_at 
ON shadowing_items(created_at DESC, lang, level);
```

#### 表结构说明

**有 status 列的表：**
- `cloze_drafts` - 状态：draft|needs_fix|approved
- `shadowing_drafts` - 状态：draft|approved  
- `alignment_packs` - 状态：draft|published|archived
- `article_drafts` - 状态：pending|needs_fix|approved|published|rejected
- `article_batches` - 状态：pending|running|done|canceled|failed
- `shadowing_sessions` - 状态：draft|completed

**没有 status 列的表：**
- `shadowing_items` - 正式题库，无需状态
- `cloze_items` - 正式题库，无需状态
- `articles` - 正式文章库，无需状态

## 解决方案

### 1. 开发环境（推荐）

使用修改后的迁移文件 `supabase/migrations/20250120000008_performance_indexes.sql`，该文件已：
- 移除 `CONCURRENTLY` 关键字以支持事务执行
- 移除不存在的 `status` 列相关索引
- 移除使用 `NOW()` 函数的索引（非 IMMUTABLE）
- 添加了正确的草稿表状态索引

```bash
npx supabase db push
```

### 2. 生产环境（可选）

如果需要在生产环境使用并发索引创建（避免长时间锁表），可以使用：

```bash
# 方法1：直接执行SQL文件
psql -h your-host -U your-user -d your-database -f scripts/create-indexes-concurrently.sql

# 方法2：通过Supabase CLI（需要手动执行每个命令）
npx supabase db reset --linked
```

## 索引创建说明

### 普通索引 vs 并发索引

- **普通索引** (`CREATE INDEX`): 在事务中执行，会短暂锁表，但执行速度快
- **并发索引** (`CREATE INDEX CONCURRENTLY`): 不在事务中执行，不锁表，但执行时间较长

### 推荐做法

1. **开发环境**: 使用普通索引（迁移文件）
2. **生产环境**: 
   - 如果数据量小（< 100万行），使用普通索引
   - 如果数据量大（> 100万行），使用并发索引

## 验证索引创建

执行以下查询验证索引是否创建成功：

```sql
-- 查看所有索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 查看特定表的索引
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'shadowing_items'
ORDER BY indexname;
```

## 性能监控

创建索引后，可以通过以下方式监控性能：

```sql
-- 查看索引使用情况
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 查看慢查询
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE mean_time > 1000  -- 超过1秒的查询
ORDER BY mean_time DESC
LIMIT 10;
```

## 注意事项

1. **索引维护**: 索引会占用额外存储空间，写入操作会稍微变慢
2. **定期清理**: 建议定期清理未使用的索引
3. **监控性能**: 创建索引后监控查询性能变化
4. **备份**: 在生产环境创建索引前建议先备份数据库

## 故障排除

### 如果索引创建失败

1. 检查表是否存在
2. 检查列名是否正确
3. 检查是否有权限创建索引
4. 查看PostgreSQL日志获取详细错误信息

### 如果性能没有提升

1. 确认查询使用了正确的索引
2. 检查查询计划：`EXPLAIN ANALYZE your_query;`
3. 考虑调整查询或添加更多索引
4. 检查数据分布是否均匀
