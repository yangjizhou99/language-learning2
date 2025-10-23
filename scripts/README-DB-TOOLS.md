# 数据库工具说明

本目录包含便捷的数据库连接和迁移工具。

## 🔧 工具列表

### 1. `db-config.js` - 数据库配置管理

统一管理本地数据库连接配置，避免各脚本硬编码。

**功能：**
- ✅ 读取 `.env.local` 中的 `LOCAL_DB_URL`
- ✅ 自动检测本地数据库端口（54340、54322、5432）
- ✅ 测试数据库连接

**使用方法：**
```bash
# 测试连接并自动检测端口
node scripts/db-config.js
```

**在其他脚本中使用：**
```javascript
const dbConfig = require('./db-config');

// 获取连接字符串
console.log(dbConfig.LOCAL_DB_URL);

// 测试连接
await dbConfig.testConnection();

// 自动检测端口
const detected = await dbConfig.detectPort();
```

---

### 2. `apply-local-migration.js` - 本地迁移应用工具

快速应用SQL迁移文件到本地数据库。

**使用方法：**
```bash
# 应用生词本优化
node scripts/apply-local-migration.js apply_vocab_optimization.sql

# 应用任何迁移文件
node scripts/apply-local-migration.js supabase/migrations/xxxxx.sql
```

**特点：**
- ✅ 自动检测数据库端口
- ✅ 自动验证迁移结果
- ✅ 友好的错误提示

---

## 📝 配置文件

### `.env.local` (需要自己创建)

从 `.env.local.template` 复制并修改：

```bash
# 本地数据库连接
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54340/postgres

# 其他配置...
```

**如何确定正确的端口？**

运行自动检测：
```bash
node scripts/db-config.js
```

---

## 🚀 常见任务

### 检查本地数据库连接
```bash
node scripts/db-config.js
```

### 应用新的数据库迁移
```bash
node scripts/apply-local-migration.js <迁移文件.sql>
```

### 连接到本地数据库（psql）
```bash
# 使用检测到的端口
psql "postgres://postgres:postgres@127.0.0.1:54340/postgres"
```

---

## 📊 迁移文件位置

- **Supabase 迁移**: `supabase/migrations/`
- **独立脚本**: 项目根目录（如 `apply_vocab_optimization.sql`）

---

## 🐛 故障排查

### 问题：无法连接到数据库

**解决方案：**
1. 确认 Supabase 正在运行
   ```bash
   supabase status
   ```

2. 如果未运行，启动它
   ```bash
   supabase start
   ```

3. 自动检测端口
   ```bash
   node scripts/db-config.js
   ```

4. 更新 `.env.local` 中的 `LOCAL_DB_URL`

### 问题：端口不对

**常见端口：**
- `54340` - 某些 Supabase 配置
- `54322` - Supabase 默认端口
- `5432` - PostgreSQL 标准端口

运行自动检测找到正确端口：
```bash
node scripts/db-config.js
```

---

## 💡 最佳实践

1. **本地开发**：始终使用 `.env.local` 配置数据库连接
2. **迁移应用**：使用 `apply-local-migration.js` 而非直接 psql
3. **生产环境**：通过 Supabase Dashboard SQL Editor 应用迁移
4. **版本控制**：不要提交 `.env.local` 到 Git

---

## 📚 相关文档

- `docs/database/` - 完整数据库文档
- `.env.local.template` - 环境变量模板
- `apply_vocab_optimization.sql` - 示例迁移脚本

