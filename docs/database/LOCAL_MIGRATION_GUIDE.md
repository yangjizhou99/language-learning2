# 本地数据库迁移应用指南

## 概述

本指南介绍如何在本地 Supabase 数据库中应用迁移文件。

## 前提条件

确保本地 Supabase 已经启动：

```bash
# 检查 Supabase 状态
npx supabase status

# 如果没有启动，先启动
npx supabase start
```

## 方法1：使用 psql 命令（推荐）✅

### 步骤

```bash
# 1. 设置编码为 UTF-8（避免中文乱码）
export PGCLIENTENCODING=UTF8

# 2. 执行迁移文件
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" \
  -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql
```

### 一行命令版本

```bash
export PGCLIENTENCODING=UTF8 && psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql
```

### 优点

- ✅ 直接执行，不需要额外配置
- ✅ 可以看到详细的执行输出
- ✅ 支持事务回滚
- ✅ 不受 `.env.local` 文件编码问题影响

### 预期输出

```
DROP FUNCTION
CREATE FUNCTION
COMMENT
```

如果看到这些输出，说明迁移成功！

## 方法2：使用 Supabase CLI

### 步骤

```bash
# 应用所有未执行的迁移
npx supabase db push
```

### 注意事项

⚠️ 如果遇到 `.env.local` 编码问题：

```
failed to parse environment file: .env.local 
(unexpected character '»' in variable name)
```

**解决方案：**
1. 使用方法1（psql命令）代替
2. 或者修复 `.env.local` 文件编码（删除 BOM）

## 方法3：在 Supabase Studio 中执行

### 步骤

1. 打开 Supabase Studio：
   ```
   http://localhost:54323
   ```

2. 进入 SQL Editor

3. 复制 `supabase/migrations/20251024000000_create_optimized_catalog_function.sql` 的内容

4. 粘贴到 SQL Editor 并点击 "Run" 执行

### 优点

- ✅ 可视化界面
- ✅ 可以逐步执行
- ✅ 方便调试

## 验证迁移是否成功

### 1. 检查函数是否存在

```bash
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
  SELECT proname, prokind, prorettype::regtype 
  FROM pg_proc 
  WHERE proname = 'get_shadowing_catalog';
"
```

**预期输出：**
```
       proname        | prokind | prorettype
----------------------+---------+------------
 get_shadowing_catalog | f       | record
(1 row)
```

### 2. 检查索引是否创建

```bash
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
  SELECT indexname 
  FROM pg_indexes 
  WHERE indexname IN (
    'idx_shadowing_items_status_lang_level_created',
    'idx_shadowing_sessions_item_user_status'
  );
"
```

**预期输出：**
```
                indexname
------------------------------------------
 idx_shadowing_items_status_lang_level_created
 idx_shadowing_sessions_item_user_status
(2 rows)
```

### 3. 测试函数调用

```bash
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
  SELECT COUNT(*) as test_count 
  FROM get_shadowing_catalog(
    (SELECT id FROM auth.users LIMIT 1),
    'zh',
    2,
    NULL,
    10,
    0,
    NULL,
    NULL,
    NULL
  );
"
```

**预期输出：**
```
 test_count
------------
         10
(1 row)
```

如果能正常返回结果，说明函数工作正常！✅

## 常见问题

### Q1: 出现 "function already exists" 错误

**原因：** 函数已经存在

**解决方案：** 先删除旧函数

```bash
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
  DROP FUNCTION IF EXISTS get_shadowing_catalog(uuid,text,integer,text,integer,integer,timestamptz,text[],int[]);
"
```

然后重新执行迁移。

### Q2: 出现编码错误

**错误信息：**
```
ERROR: character with byte sequence 0xae 0xb5 in encoding "GBK" 
has no equivalent in encoding "UTF8"
```

**解决方案：** 设置正确的客户端编码

```bash
export PGCLIENTENCODING=UTF8
```

### Q3: 迁移执行后 API 报错

**错误信息：**
```
function get_shadowing_catalog does not exist
```

**可能原因：**
1. 函数参数数量不匹配
2. 函数未创建成功

**解决方案：**

1. 检查函数签名：
   ```sql
   SELECT proname, pronargs 
   FROM pg_proc 
   WHERE proname = 'get_shadowing_catalog';
   ```
   应该显示 9 个参数。

2. 如果参数不对，删除重建：
   ```bash
   # 删除所有版本的函数
   psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
     DROP FUNCTION IF EXISTS get_shadowing_catalog(uuid,text,integer,text,integer,integer);
     DROP FUNCTION IF EXISTS get_shadowing_catalog(uuid,text,integer,text,integer,integer,timestamptz,text[],int[]);
   "
   
   # 重新执行迁移
   export PGCLIENTENCODING=UTF8 && psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql
   ```

## 完整的迁移流程

### 首次应用迁移

```bash
# 1. 确保 Supabase 运行中
npx supabase status

# 2. 应用迁移
export PGCLIENTENCODING=UTF8 && psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql

# 3. 验证函数存在
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "SELECT proname FROM pg_proc WHERE proname = 'get_shadowing_catalog';"

# 4. 验证索引存在
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('shadowing_items', 'shadowing_sessions');"

# 5. 测试 API
curl http://localhost:3001/api/shadowing/catalog?lang=zh&level=2&limit=10
```

### 更新迁移（如果修改了迁移文件）

```bash
# 1. 删除旧函数
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "
  DROP FUNCTION IF EXISTS get_shadowing_catalog(uuid,text,integer,text,integer,integer,timestamptz,text[],int[]);
"

# 2. 重新应用迁移
export PGCLIENTENCODING=UTF8 && psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql

# 3. 验证
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "SELECT proname, pronargs FROM pg_proc WHERE proname = 'get_shadowing_catalog';"
```

## 数据库连接信息

### 本地 Supabase 默认配置

```
Host: 127.0.0.1
Port: 54340 (PostgreSQL)
Database: postgres
User: postgres
Password: postgres
```

### 连接字符串

```
postgres://postgres:postgres@127.0.0.1:54340/postgres
```

## 快速参考

### 常用命令

```bash
# 应用迁移
export PGCLIENTENCODING=UTF8 && psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -f supabase/migrations/20251024000000_create_optimized_catalog_function.sql

# 检查函数
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "\df get_shadowing_catalog"

# 查看函数定义
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "\sf get_shadowing_catalog"

# 删除函数
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "DROP FUNCTION IF EXISTS get_shadowing_catalog(uuid,text,integer,text,integer,integer,timestamptz,text[],int[]);"

# 查看表结构
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "\d shadowing_items"

# 查看索引
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres" -c "\di"
```

## 总结

✅ **推荐方法：** 使用 psql 命令直接执行迁移文件

✅ **验证步骤：** 检查函数、索引、测试调用

✅ **遇到问题：** 参考常见问题部分或删除重建

现在你的本地数据库已经应用了所有优化！🎉

