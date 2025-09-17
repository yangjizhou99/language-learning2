# 数据库迁移工具使用指南

## 功能概述

这个工具提供了一个可视化的界面，让你能够从本地 Supabase 数据库高速迁移数据到云端数据库。使用 PostgreSQL 的 COPY 协议实现流式传输，速度远超逐行插入。

## 环境配置

### 1. 环境变量设置

在 `.env.local` 文件中添加以下配置：

```bash
# 数据库迁移配置（仅本地开发环境）
# 本地 Supabase Postgres（supabase start 的默认）
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
# 云端 Supabase Postgres（Dashboard -> Connection string）
PROD_DB_URL=postgres://postgres:<你的云端DB密码>@<host>:5432/postgres
```

**重要提示：**
- `LOCAL_DB_URL` 是本地 Supabase 实例的连接串（运行 `supabase start` 后的默认地址）
- `PROD_DB_URL` 是云端 Supabase 项目的连接串（在 Supabase Dashboard → Database → Connection string 获取）
- 云端连接串包含敏感信息，请勿提交到版本控制系统

### 2. 获取云端连接串

1. 登录 Supabase Dashboard
2. 选择你的项目
3. 进入 Database 页面
4. 在 "Connection string" 部分复制连接串
5. 替换 `<你的云端DB密码>` 为实际密码

## 使用方法

### 1. 启动本地开发环境

```bash
# 启动 Supabase 本地实例
supabase start

# 启动 Next.js 开发服务器
pnpm dev
```

### 2. 访问迁移页面

打开浏览器访问：`http://localhost:3000/migrate`

### 3. 配置迁移参数

- **表名**：要迁移的表名（在 public schema 下）
- **列**：要迁移的列名，用逗号分隔。留空表示迁移所有列
- **本地筛选 WHERE**：可选的筛选条件，用于从本地数据库筛选数据
- **模式**：
  - `insert`：直接插入，如果存在冲突会报错
  - `upsert`：如果存在冲突则更新，需要指定冲突键
- **冲突键**：当选择 upsert 模式时，指定用于检测冲突的列名

### 4. 执行迁移

1. 点击"预览前20行/总数"按钮查看要迁移的数据
2. 确认无误后点击"开始迁移"按钮
3. 等待迁移完成

## 技术特性

### 高速传输
- 使用 PostgreSQL COPY 协议进行流式传输
- 避免了逐行插入的性能瓶颈
- 支持大数据量的高效迁移

### 安全特性
- 表名和列名自动转义，防止 SQL 注入
- 仅允许访问 public schema 下的表
- 环境变量分离，云端连接串不会暴露到前端

### 灵活配置
- 支持选择性列迁移
- 支持 WHERE 条件筛选
- 支持 INSERT 和 UPSERT 两种模式
- 自动检测表结构

## 注意事项

1. **仅限本地开发环境使用**：此工具设计用于本地开发环境，不适合在生产环境使用
2. **Vercel Serverless 限制**：由于 Vercel 的 Serverless 环境限制，不适合长时间运行的 COPY 流式迁移
3. **数据备份**：迁移前建议备份重要数据
4. **权限检查**：确保本地和云端数据库有足够的权限执行相关操作

## 故障排除

### 连接错误
- 检查环境变量是否正确设置
- 确认本地 Supabase 实例已启动
- 验证云端连接串的有效性

### 权限错误
- 确保数据库用户有足够的权限
- 检查 RLS 策略是否阻止了操作

### 迁移失败
- 检查表结构是否匹配
- 确认冲突键设置正确
- 查看错误日志获取详细信息

## 高级用法

### 批量迁移多个表
可以编写脚本调用 API 接口批量迁移多个表：

```javascript
const tables = ['users', 'posts', 'comments'];
for (const table of tables) {
  await fetch('/api/migrate', {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({ table, mode: 'upsert', conflictKeys: 'id' })
  });
}
```

### 条件迁移
使用 WHERE 条件迁移特定数据：

```sql
-- 只迁移最近创建的数据
created_at >= '2025-01-01'

-- 只迁移特定状态的数据
status = 'active'
```

这个工具为你的数据迁移需求提供了一个强大而灵活的解决方案，让本地开发到云端部署的数据同步变得简单高效。
