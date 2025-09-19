# 备份功能故障排除指南

## 问题现象
点击"开始备份"后几秒钟就结束，没有实际进行备份操作。

## 解决步骤

### 第一步：运行完整诊断
1. 访问 `/admin/backup` 页面
2. 点击"完整诊断"按钮
3. 查看诊断结果，确认哪些检查项失败

### 第二步：检查 RPC 函数
如果诊断显示"RPC 函数检查"失败，需要执行数据库迁移：

1. 打开 Supabase 控制台
2. 进入 SQL Editor
3. 复制并执行以下 SQL 代码：

```sql
-- 创建执行SQL的函数，用于备份恢复
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 创建获取表列表的函数
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name != 'spatial_ref_sys'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

-- 创建获取表列信息的函数
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;

-- 授予服务角色执行权限
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;
```

### 第三步：检查环境变量
确保以下环境变量已正确设置：

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 第四步：重新测试
1. 执行 SQL 迁移后，点击"检查函数"按钮
2. 如果显示"✅ RPC函数已存在"，则点击"测试连接"按钮
3. 最后点击"完整诊断"按钮，确保所有检查都通过

### 第五步：尝试备份
如果所有检查都通过，再次点击"开始备份"按钮。

## 常见问题

### 1. RPC 函数不存在
**症状**：诊断显示"RPC 函数检查"失败
**解决**：执行上述 SQL 迁移代码

### 2. 环境变量未设置
**症状**：诊断显示"环境变量检查"失败
**解决**：检查 `.env.local` 文件中的环境变量配置

### 3. 权限不足
**症状**：诊断显示"Supabase 连接"失败
**解决**：检查服务角色密钥是否正确

### 4. 存储桶为空
**症状**：存储桶备份显示"共下载 0 个文件"
**解决**：这是正常的，如果您的项目中没有存储桶或文件

## 调试技巧

### 查看控制台日志
1. 打开浏览器开发者工具
2. 查看 Console 标签页
3. 点击"开始备份"后查看错误信息

### 查看网络请求
1. 打开浏览器开发者工具
2. 查看 Network 标签页
3. 点击"开始备份"后查看 API 请求的响应

### 查看服务器日志
如果部署在 Vercel 等平台，查看服务器日志：
1. 登录 Vercel 控制台
2. 进入项目页面
3. 查看 Functions 日志

## 预期行为

### 正常备份流程
1. 点击"开始备份"后，页面显示两个任务：
   - 数据库备份：状态从"等待中" → "进行中" → "已完成"
   - 存储桶备份：状态从"等待中" → "进行中" → "已完成"

2. 数据库备份会显示：
   - 找到 X 个表
   - 正在导出表: table_name
   - 数据库备份完成，共导出 X 个表

3. 存储桶备份会显示：
   - 找到 X 个存储桶
   - 正在下载存储桶: bucket_name
   - 存储桶备份完成，共下载 X 个文件

### 备份文件
备份完成后，会在指定路径生成：
- `database-backup-YYYY-MM-DD.sql` - 数据库备份文件
- `storage/` - 存储桶文件目录

## 联系支持

如果按照上述步骤仍无法解决问题，请提供：
1. 完整诊断结果截图
2. 浏览器控制台错误信息
3. 服务器日志（如果有）
4. 您的 Supabase 项目配置信息
