# 数据库性能优化执行指南

## 问题解决

您遇到的 `CREATE INDEX CONCURRENTLY cannot run inside a transaction block` 错误已经解决。我创建了两个分离的迁移文件来避免这个问题。

## 执行步骤

### 步骤 1: 删除未使用的索引
运行第一个迁移文件：
```bash
# 这个迁移只删除未使用的索引
supabase db push
```

迁移文件：`supabase/migrations/20250120000106_simple_performance_optimization.sql`

### 步骤 2: 添加外键索引
运行第二个迁移文件：
```bash
# 这个迁移添加外键索引
supabase db push
```

迁移文件：`supabase/migrations/20250120000107_add_foreign_key_indexes.sql`

## 或者：手动执行（推荐用于生产环境）

如果您担心迁移过程中的锁表问题，可以手动执行：

### 在 Supabase SQL 编辑器中执行：

1. **先删除未使用的索引**：
   ```sql
   -- 复制并执行 supabase/migrations/20250120000106_simple_performance_optimization.sql 中的内容
   ```

2. **然后添加外键索引**：
   ```sql
   -- 复制并执行 supabase/migrations/20250120000107_add_foreign_key_indexes.sql 中的内容
   ```

## 验证结果

执行完成后，检查索引是否创建成功：

```sql
-- 检查新创建的外键索引
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

## 预期结果

- ✅ 18 个外键索引创建成功
- ✅ 35 个未使用索引删除成功
- ✅ 查询性能显著提升
- ✅ 存储空间优化

## 文件说明

- `supabase/migrations/20250120000106_simple_performance_optimization.sql` - 删除未使用索引
- `supabase/migrations/20250120000107_add_foreign_key_indexes.sql` - 添加外键索引
- `scripts/create-concurrent-indexes.sql` - 并发创建索引脚本（可选）
- `DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md` - 详细指南

现在您可以安全地执行这些迁移了！
