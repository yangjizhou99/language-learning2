# 数据库同步快速开始指南

## 🚀 快速开始

### 第一步：配置环境变量

在 `.env.local` 文件中添加以下配置：

```bash
# 本地数据库连接（Supabase 本地实例）
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres

# 云端数据库连接（从 Supabase Dashboard 获取）
PROD_DB_URL=postgres://postgres:<你的密码>@<你的主机>:5432/postgres
```

### 第二步：测试连接

运行测试脚本检查配置是否正确：

```bash
# 测试数据库连接
node scripts/test-sync.js
```

### 第三步：选择同步方式

#### 方式一：Web 界面（推荐）

1. 启动开发服务器：
   ```bash
   pnpm dev
   ```

2. 访问同步页面：
   ```
   http://localhost:3000/admin/database-sync
   ```

3. 按照界面提示操作

#### 方式二：命令行工具

```bash
# Windows 用户
sync-database.bat

# Linux/Mac 用户
./sync-database.sh

# 或直接使用 Node.js
node scripts/db-sync.js
```

## ⚠️ 重要提醒

1. **数据备份**：同步前请务必备份云端数据库
2. **数据覆盖**：此操作将完全清空云端数据库中的选定表
3. **权限要求**：需要管理员权限才能执行同步

## 🔧 故障排除

### 连接失败

- 检查环境变量是否正确
- 确认本地 Supabase 实例已启动 (`supabase start`)
- 验证云端连接串的有效性

### 权限错误

- 确保使用管理员账户
- 检查数据库用户权限

### 同步失败

- 查看错误日志
- 检查表结构是否匹配
- 确认数据类型兼容性

## 📞 获取帮助

- 查看详细文档：`DATABASE_SYNC_GUIDE.md`
- 运行测试脚本：`node scripts/test-sync.js`
- 使用预览模式：Web 界面中的"预览同步"功能

## 🎯 推荐流程

1. **测试连接** → `node scripts/test-sync.js`
2. **预览同步** → Web 界面预览模式
3. **执行同步** → 确认无误后执行
4. **验证结果** → 检查同步结果

---

**开始同步前，请确保您已经备份了云端数据库的重要数据！**

