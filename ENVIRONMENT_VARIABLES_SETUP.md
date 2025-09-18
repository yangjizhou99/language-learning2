# 环境变量设置指南

## 问题说明

在客户端组件中，`process.env` 只能访问以 `NEXT_PUBLIC_` 开头的环境变量。对于服务器端的环境变量（如 `LOCAL_DB_URL` 和 `PROD_DB_URL`），需要通过API来获取。

## 解决方案

### 1. 环境变量配置

在您的 `.env.local` 文件中添加以下配置：

```bash
# 数据库连接配置 (用于数据同步)
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres
PROD_DB_URL=postgresql://postgres:[your-password]@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres

# Supabase配置 (已存在)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. 系统架构

```
客户端组件 (specialized/page.tsx)
    ↓ 调用API
API路由 (env-config/route.ts)
    ↓ 读取环境变量
服务器端环境变量 (LOCAL_DB_URL, PROD_DB_URL)
```

### 3. 工作流程

1. **页面加载**：组件调用 `loadEnvConfig()`
2. **API请求**：向 `/api/admin/question-bank/env-config` 发送请求
3. **环境变量读取**：API路由读取服务器端环境变量
4. **配置更新**：客户端更新数据库配置状态
5. **数据同步**：使用获取到的配置进行数据同步

## 环境变量说明

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `LOCAL_DB_URL` | 本地数据库连接URL | `postgres://postgres:postgres@127.0.0.1:54322/postgres` |
| `PROD_DB_URL` | 生产数据库连接URL | `postgresql://postgres:[password]@db.project.supabase.co:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase项目URL | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名密钥 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务角色密钥 | 无 |
| `OPENROUTER_API_KEY` | OpenRouter API密钥 | 无 |
| `DEEPSEEK_API_KEY` | DeepSeek API密钥 | 无 |
| `OPENAI_API_KEY` | OpenAI API密钥 | 无 |

## 配置步骤

### 步骤1：创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 复制模板文件
cp env.template .env.local
```

### 步骤2：配置数据库连接

编辑 `.env.local` 文件，设置您的数据库连接：

```bash
# 本地数据库 (数据源)
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres

# 生产数据库 (数据目标)
PROD_DB_URL=postgresql://postgres:[your-actual-password]@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres
```

### 步骤3：配置Supabase

设置您的Supabase项目信息：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yyfyieqfuwwyqrlewswu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
```

### 步骤4：重启开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

## 验证配置

### 1. 检查环境变量API

访问 `http://localhost:3000/api/admin/question-bank/env-config` 查看环境变量是否正确加载。

### 2. 检查页面显示

在专项打包页面中，数据库配置部分应该显示：

- **源数据库**：`postgres://postgres:postgres@127.0.0.1:54322/postgres`
- **目标数据库**：`postgresql://postgres:[password]@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres`

### 3. 测试数据同步

选择一些题目进行打包测试，确保数据同步功能正常工作。

## 常见问题

### Q1: 环境变量显示为空

**原因**：环境变量未正确设置或服务器未重启。

**解决方案**：
1. 检查 `.env.local` 文件是否存在且格式正确
2. 重启开发服务器
3. 检查环境变量名称是否正确

### Q2: 数据库连接失败

**原因**：数据库URL格式错误或数据库服务未启动。

**解决方案**：
1. 检查数据库URL格式
2. 确保本地PostgreSQL服务正在运行
3. 验证Supabase数据库连接信息

### Q3: API调用失败

**原因**：API路由未正确创建或环境变量读取失败。

**解决方案**：
1. 检查 `src/app/api/admin/question-bank/env-config/route.ts` 文件是否存在
2. 查看浏览器控制台错误信息
3. 检查服务器端日志

## 安全注意事项

### 1. 环境变量安全

- 不要将 `.env.local` 文件提交到版本控制
- 在生产环境中使用环境变量管理服务
- 定期轮换数据库密码和API密钥

### 2. 数据库安全

- 使用强密码
- 启用SSL连接
- 限制数据库访问权限
- 定期备份数据

### 3. API安全

- 添加身份验证中间件
- 限制API访问频率
- 记录API调用日志
- 验证输入参数

## 生产环境部署

### Vercel部署

在Vercel项目设置中添加环境变量：

1. 进入项目设置
2. 选择 "Environment Variables"
3. 添加所有必需的环境变量
4. 重新部署项目

### 其他平台

根据您使用的部署平台，在相应的环境变量设置中添加配置。

## 总结

通过以上配置，您的专项打包系统将能够：

1. ✅ 自动读取环境变量配置
2. ✅ 正确连接本地和生产数据库
3. ✅ 安全地同步数据
4. ✅ 处理各种冲突情况
5. ✅ 提供详细的错误信息

如果遇到问题，请检查环境变量设置和服务器日志。
