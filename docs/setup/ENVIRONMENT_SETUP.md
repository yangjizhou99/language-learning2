# 环境变量配置指南

## 问题解决

如果您遇到 `supabaseUrl is required` 错误，说明缺少必要的环境变量配置。

## 快速解决

### 1. 创建环境变量文件

在项目根目录创建 `.env.local` 文件：

```bash
# 复制示例文件
cp env.example .env.local
```

### 2. 配置 Supabase（必需）

编辑 `.env.local` 文件，添加您的 Supabase 配置：

```env
# Supabase 配置（必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. 获取 Supabase 配置

1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 Settings > API
4. 复制以下信息：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

### 4. 重启开发服务器

```bash
npm run dev
# 或
pnpm dev
```

## 完整配置

### 必需的环境变量

```env
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 可选的环境变量

```env
# AI 服务配置（用于 AI 功能）
OPENAI_API_KEY=your_openai_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here

# OpenRouter 配置
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_SITE_NAME=Lang Trainer

# Google TTS 配置
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# 讯飞 TTS 配置
XUNFEI_APP_ID=your_xunfei_app_id
XUNFEI_API_KEY=your_xunfei_api_key
XUNFEI_API_SECRET=your_xunfei_api_secret

# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## 功能对应关系

| 功能 | 必需的环境变量 | 说明 |
|------|----------------|------|
| 基础功能 | `NEXT_PUBLIC_SUPABASE_URL`<br>`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 用户认证和基础数据 |
| 管理员功能 | `SUPABASE_SERVICE_ROLE_KEY` | 管理员权限验证 |
| AI 生成内容 | `OPENAI_API_KEY` 或 `OPENROUTER_API_KEY` 或 `DEEPSEEK_API_KEY` | AI 内容生成 |
| 语音合成 | `GOOGLE_APPLICATION_CREDENTIALS` 或 讯飞配置 | TTS 功能 |
| 用户认证 | `NEXTAUTH_URL`<br>`NEXTAUTH_SECRET` | 用户登录 |

## 故障排除

### 1. 仍然出现 supabaseUrl 错误

- 确保 `.env.local` 文件在项目根目录
- 检查环境变量名称是否正确（区分大小写）
- 重启开发服务器

### 2. 数据库连接错误

- 检查 Supabase URL 是否正确
- 确认 API 密钥是否有效
- 检查 Supabase 项目是否正常运行

### 3. 管理员功能不可用

- 确保配置了 `SUPABASE_SERVICE_ROLE_KEY`
- 检查数据库中是否有管理员用户

## 安全提醒

- 永远不要将 `.env.local` 文件提交到版本控制
- 生产环境使用环境变量或密钥管理服务
- 定期轮换 API 密钥
