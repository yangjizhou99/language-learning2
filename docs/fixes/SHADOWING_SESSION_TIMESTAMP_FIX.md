# Shadowing Session 时间戳修复指南

## 问题描述

已完成练习的时间总是显示为 `1970/1/1 09:00:00`，这是因为：

1. `shadowing_sessions` 表的 `created_at` 字段没有设置默认值
2. API 在创建 session 时没有显式设置 `created_at`
3. 表中缺少 `updated_at` 字段来跟踪更新时间

## 修复内容

### 1. API 修复
**文件**: `src/app/api/shadowing/session/route.ts`

在创建新 session 时，现在会显式设置 `created_at`:
```typescript
const newSessionPayload = {
  id: randomUUID(),
  user_id: user.id,
  item_id: item_id_db,
  status,
  recordings,
  vocab_entry_ids,
  picked_preview,
  notes,
  created_at: new Date().toISOString(), // 新增
};
```

### 2. 数据库迁移
**文件**: `supabase/migrations/20251012000000_add_timestamps_to_shadowing_sessions.sql`

迁移脚本会：
- 添加 `updated_at` 列，默认值为 `now()`
- 为 `created_at` 设置默认值 `now()`
- 更新现有的 null 时间戳为当前时间
- 创建触发器自动更新 `updated_at`

## 应用修复

### 方法 1: 使用 Supabase CLI（推荐）

```bash
# 1. 确保已登录 Supabase
supabase login

# 2. 链接到项目
supabase link --project-ref your-project-ref

# 3. 应用迁移
supabase db push
```

### 方法 2: 手动执行 SQL

1. 登录 Supabase Dashboard
2. 进入 SQL Editor
3. 复制并执行 `supabase/migrations/20251012000000_add_timestamps_to_shadowing_sessions.sql` 的内容

### 方法 3: 使用本地 Supabase

```bash
# 1. 启动本地 Supabase
supabase start

# 2. 迁移会自动应用
# 如果需要重置数据库
supabase db reset
```

## 验证修复

### 1. 检查数据库结构

在 SQL Editor 中运行：
```sql
-- 查看表结构
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'shadowing_sessions'
  AND column_name IN ('created_at', 'updated_at');
```

应该看到：
- `created_at`: `timestamp with time zone`, 默认值 `now()`
- `updated_at`: `timestamp with time zone`, 默认值 `now()`

### 2. 检查触发器

```sql
-- 查看触发器
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'shadowing_sessions';
```

应该看到名为 `set_updated_at` 的触发器。

### 3. 测试功能

1. 在应用中完成一个 shadowing 练习
2. 检查完成时间是否显示正确的日期时间
3. 在数据库中验证：
   ```sql
   SELECT id, user_id, item_id, created_at, updated_at, status
   FROM shadowing_sessions
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## 影响范围

- **前端**: 无需修改，时间戳会自动正确显示
- **后端**: API 已更新，新创建的 session 会正确设置时间戳
- **数据库**: 现有的 null 时间戳会被更新为当前时间

## 注意事项

1. **现有数据**: 迁移会将所有现有的 null 时间戳更新为当前时间（执行迁移的时间），而不是实际的创建/更新时间
2. **时区**: 时间戳使用 UTC 时区，前端会根据用户的本地时区显示
3. **性能**: 触发器会在每次更新时自动设置 `updated_at`，对性能影响极小

## 回滚（如果需要）

如果需要回滚此修复：

```sql
-- 删除触发器
DROP TRIGGER IF EXISTS set_updated_at ON public.shadowing_sessions;

-- 删除函数（如果不被其他表使用）
-- DROP FUNCTION IF EXISTS public.update_shadowing_sessions_updated_at();

-- 删除 updated_at 列
ALTER TABLE public.shadowing_sessions DROP COLUMN IF EXISTS updated_at;

-- 移除 created_at 的默认值
ALTER TABLE public.shadowing_sessions ALTER COLUMN created_at DROP DEFAULT;
```

## 相关文件

- API 路由: `src/app/api/shadowing/session/route.ts`
- 前端组件: `src/components/shadowing/ChineseShadowingPage.tsx`
- 数据库迁移: `supabase/migrations/20251012000000_add_timestamps_to_shadowing_sessions.sql`

## 修复日期

2025-10-12

