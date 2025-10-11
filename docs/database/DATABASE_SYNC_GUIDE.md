# 数据库同步工具使用指南

## 概述

这个工具集提供了多种方式将本地数据库数据覆盖到云端数据库，支持完整的表数据同步。

## 环境配置

### 1. 环境变量设置

在 `.env.local` 文件中添加以下配置：

```bash
# 本地数据库连接（Supabase 本地实例）
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres

# 云端数据库连接（Supabase 云端项目）
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

### 方法一：Web 界面（推荐）

1. 启动开发服务器：
   ```bash
   pnpm dev
   ```

2. 访问同步管理页面：
   ```
   http://localhost:3000/admin/database-sync
   ```

3. 功能特性：
   - ✅ 环境变量检查
   - ✅ 表列表显示
   - ✅ 选择性同步表
   - ✅ 预览模式（不实际修改数据）
   - ✅ 实时同步进度
   - ✅ 详细结果报告

### 方法二：命令行工具

#### Windows 用户

1. 双击运行 `sync-database.bat`
2. 按照提示确认操作

#### Linux/Mac 用户

1. 给脚本添加执行权限：
   ```bash
   chmod +x sync-database.sh
   ```

2. 运行脚本：
   ```bash
   ./sync-database.sh
   ```

#### 直接使用 Node.js

```bash
# 同步所有表
node scripts/db-sync.js

# 使用简单同步脚本
node scripts/simple-sync.js

# 使用高级同步脚本（支持更多选项）
node scripts/sync-database.js --all
node scripts/sync-database.js --tables=users,posts --dry-run
```

### 方法三：API 接口

#### 预览同步

```bash
curl -X GET "http://localhost:3000/api/admin/database/sync?action=preview"
```

#### 执行同步

```bash
curl -X POST "http://localhost:3000/api/admin/database/sync" \
  -H "Content-Type: application/json" \
  -d '{"action": "sync", "tables": ["users", "posts"]}'
```

## 功能特性

### 1. 安全特性

- ✅ 表名和列名自动转义，防止 SQL 注入
- ✅ 仅允许访问 public schema 下的表
- ✅ 环境变量分离，云端连接串不会暴露到前端
- ✅ 事务安全，同步失败时自动回滚

### 2. 性能优化

- ✅ 批量插入，提高同步效率
- ✅ 流式处理，内存占用低
- ✅ 事务管理，确保数据一致性
- ✅ 进度跟踪，实时显示同步状态

### 3. 错误处理

- ✅ 连接错误检测
- ✅ 数据验证
- ✅ 事务回滚
- ✅ 详细错误信息

## 同步流程

1. **环境检查**：验证环境变量配置
2. **连接数据库**：建立本地和云端数据库连接
3. **获取表列表**：扫描本地数据库的所有表
4. **用户确认**：显示将要同步的表和行数
5. **执行同步**：
   - 清空云端目标表
   - 从本地读取数据
   - 批量插入到云端
   - 验证同步结果
6. **结果报告**：显示同步成功/失败统计

## 注意事项

### ⚠️ 重要警告

1. **数据覆盖**：此操作将完全清空云端数据库中的选定表
2. **不可逆操作**：同步后无法恢复云端原有数据
3. **备份建议**：同步前请务必备份云端数据库
4. **权限要求**：需要管理员权限才能执行同步操作

### 🔧 环境要求

- Node.js 16+ 
- PostgreSQL 数据库
- 有效的数据库连接权限

### 📋 支持的表类型

- ✅ 所有 public schema 下的表
- ✅ 包含各种数据类型的表
- ✅ 有外键约束的表（会级联清空）
- ✅ 大表（支持批量处理）

## 故障排除

### 常见问题

#### 1. 连接错误

**问题**：无法连接到数据库
**解决方案**：
- 检查环境变量是否正确设置
- 确认本地 Supabase 实例已启动
- 验证云端连接串的有效性

#### 2. 权限错误

**问题**：没有权限执行操作
**解决方案**：
- 确保数据库用户有足够的权限
- 检查 RLS 策略是否阻止了操作
- 确认使用的是管理员账户

#### 3. 同步失败

**问题**：部分表同步失败
**解决方案**：
- 检查表结构是否匹配
- 确认数据类型兼容性
- 查看错误日志获取详细信息

#### 4. 内存不足

**问题**：处理大表时内存不足
**解决方案**：
- 使用流式处理脚本
- 分批处理大表
- 增加系统内存

### 调试技巧

1. **启用详细日志**：
   ```bash
   DEBUG=* node scripts/db-sync.js
   ```

2. **预览模式**：
   ```bash
   node scripts/sync-database.js --dry-run
   ```

3. **单表测试**：
   ```bash
   node scripts/sync-database.js --tables=users
   ```

## 最佳实践

### 1. 数据备份

```sql
-- 同步前备份重要表
CREATE TABLE users_backup AS SELECT * FROM users;
CREATE TABLE posts_backup AS SELECT * FROM posts;
```

### 2. 分批同步

对于大量数据，建议分批同步：

```bash
# 先同步用户表
node scripts/sync-database.js --tables=users

# 再同步内容表
node scripts/sync-database.js --tables=posts,comments
```

### 3. 监控同步

使用 Web 界面可以实时监控同步进度和结果。

### 4. 定期同步

建议在开发完成后进行同步，避免频繁操作。

## 技术实现

### 核心组件

1. **数据库连接管理** (`src/lib/db.ts`)
2. **同步 API 接口** (`src/app/api/admin/database/sync/route.ts`)
3. **Web 管理界面** (`src/app/admin/database-sync/page.tsx`)
4. **命令行工具** (`scripts/db-sync.js`)

### 数据流程

```
本地数据库 → 读取数据 → 清空云端表 → 插入数据 → 验证结果
```

### 安全措施

- SQL 注入防护
- 权限验证
- 事务回滚
- 错误处理

## 总结

数据库同步工具提供了完整的数据迁移解决方案，支持多种使用方式，确保数据安全可靠地从本地同步到云端。通过合理的配置和操作，可以高效地完成数据库同步任务。

**推荐使用顺序：**
1. 首先使用 Web 界面进行预览
2. 确认无误后执行同步
3. 使用命令行工具进行批量操作
4. 通过 API 接口集成到自动化流程

