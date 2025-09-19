# 备份功能修复总结

## 问题分析

原始备份功能失败的原因是：
1. **数据库查询错误**：直接查询 `public.information_schema.tables` 在 Supabase 中不被支持
2. **权限问题**：需要创建专门的 RPC 函数来访问系统表
3. **存储桶备份**：虽然成功，但下载了 0 个文件，说明可能没有存储桶或文件

## 修复方案

### 1. 创建数据库 RPC 函数

在 `supabase/migrations/20250120000009_backup_restore_function.sql` 中创建了三个函数：

```sql
-- 执行 SQL 语句的函数
CREATE OR REPLACE FUNCTION exec_sql(sql text)

-- 获取表列表的函数
CREATE OR REPLACE FUNCTION get_table_list()

-- 获取表列信息的函数
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
```

### 2. 更新备份 API

修改了 `src/app/api/admin/backup/start/route.ts`：
- 使用 `supabase.rpc('get_table_list')` 替代直接查询
- 使用 `supabase.rpc('get_table_columns', { table_name_param: tableName })` 获取列信息
- 添加了类型注解以处理 RPC 返回的数据结构

### 3. 添加测试功能

创建了 `src/app/api/admin/backup/test/route.ts` 用于测试数据库连接和 RPC 函数。

在备份页面添加了"测试数据库连接"按钮，可以验证：
- 数据库连接是否正常
- RPC 函数是否工作
- 能获取到多少个表

## 使用步骤

### 1. 执行数据库迁移

首先需要在 Supabase 控制台中执行迁移文件：

```sql
-- 在 Supabase SQL Editor 中执行
\i supabase/migrations/20250120000009_backup_restore_function.sql
```

### 2. 测试连接

1. 访问 `/admin/backup` 页面
2. 点击"测试数据库连接"按钮
3. 查看测试结果，确认能正常获取表列表

### 3. 执行备份

1. 设置备份路径（默认：`D:\backups\language-learning`）
2. 点击"开始备份"
3. 观察备份进度和状态

## 功能特性

### 数据库备份
- ✅ 获取所有用户表（排除系统表）
- ✅ 导出表结构（CREATE TABLE 语句）
- ✅ 导出表数据（INSERT 语句）
- ✅ 支持所有 PostgreSQL 数据类型
- ✅ 分批处理大数据表

### 存储桶备份
- ✅ 遍历所有存储桶
- ✅ 下载所有文件到本地
- ✅ 保持目录结构
- ✅ 显示下载进度

### 恢复功能
- ✅ 支持 ZIP 文件上传
- ✅ 解压并恢复数据库
- ✅ 恢复存储桶文件
- ✅ 智能错误处理

## 注意事项

1. **权限要求**：需要管理员权限才能访问备份功能
2. **存储空间**：确保有足够的磁盘空间存储备份文件
3. **网络稳定**：大文件传输需要稳定的网络连接
4. **数据安全**：备份文件包含敏感数据，请妥善保管

## 故障排除

### 如果测试失败
1. 检查 Supabase 服务角色密钥配置
2. 确认 RPC 函数已正确创建
3. 查看控制台错误日志

### 如果备份失败
1. 检查备份路径权限
2. 确认数据库连接正常
3. 查看详细错误信息

### 如果恢复失败
1. 检查备份文件完整性
2. 确认数据库有足够空间
3. 查看恢复日志

## 下一步优化

1. **增量备份**：只备份变更的数据
2. **压缩优化**：使用更好的压缩算法
3. **云存储**：支持备份到云存储服务
4. **定时备份**：自动定时执行备份
5. **邮件通知**：备份完成后发送通知

## 技术细节

### RPC 函数说明
- `get_table_list()`: 返回所有用户表的名称
- `get_table_columns(table_name)`: 返回指定表的列信息
- `exec_sql(sql)`: 执行 SQL 语句（用于恢复）

### 文件结构
```
backup/
├── database-backup-YYYY-MM-DD.sql  # 数据库备份文件
└── storage/                         # 存储桶文件
    ├── bucket1/
    └── bucket2/
```

### 安全考虑
- 使用服务角色权限访问数据库
- 文件操作限制在指定目录
- 备份文件包含敏感数据，需要安全存储

