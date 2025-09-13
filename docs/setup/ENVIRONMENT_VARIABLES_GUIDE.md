# 环境变量配置完整指南

## 📋 项目环境变量清单

基于代码分析，本项目使用了以下环境变量：

### 🔴 必需配置

#### Supabase 数据库
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 🟡 功能配置

#### AI 服务（至少配置一个）
```env
# OpenAI API (推荐)
OPENAI_API_KEY=your_openai_key_here

# OpenRouter API (支持多种模型)
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_SITE_NAME=Lang Trainer

# DeepSeek API (性价比高)
DEEPSEEK_API_KEY=your_deepseek_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

#### 语音合成服务（至少配置一个）
```env
# Google TTS (推荐)
GOOGLE_TTS_CREDENTIALS=path/to/service-account.json
GOOGLE_TTS_PROJECT_ID=your_google_project_id

# 或者使用环境变量方式
GOOGLE_CLOUD_CLIENT_EMAIL=your_client_email
GOOGLE_CLOUD_PRIVATE_KEY=your_private_key
GOOGLE_CLOUD_PROJECT_ID=your_project_id

# Gemini TTS (Google 新模型)
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts

# 讯飞 TTS (中文支持好)
XUNFEI_APP_ID=your_xunfei_app_id
XUNFEI_API_KEY=your_xunfei_api_key
XUNFEI_API_SECRET=your_xunfei_api_secret
```

#### 应用配置
```env
# 站点配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET=tts

# 调试配置
NEXT_PUBLIC_SHOW_DEBUG=0
ENABLE_PERFORMANCE_MONITORING=false

# NextAuth 配置
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## 🚀 快速开始

### 1. 最小配置（仅基础功能）
```env
# 必需
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 可选但推荐
OPENAI_API_KEY=your_openai_key_here
GOOGLE_TTS_CREDENTIALS=path/to/service-account.json
```

### 2. 完整配置（所有功能）
使用项目根目录的 `.env.local` 文件，替换所有 `your_*_here` 为实际值。

## 📝 配置说明

### Supabase 配置
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建项目或选择现有项目
3. 进入 Settings > API
4. 复制：
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

### AI 服务配置

#### OpenAI
1. 访问 [OpenAI Platform](https://platform.openai.com)
2. 创建 API Key
3. 设置 `OPENAI_API_KEY`

#### DeepSeek
1. 访问 [DeepSeek Platform](https://platform.deepseek.com)
2. 创建 API Key
3. 设置 `DEEPSEEK_API_KEY`

#### OpenRouter
1. 访问 [OpenRouter](https://openrouter.ai)
2. 创建 API Key
3. 设置 `OPENROUTER_API_KEY`

### 语音合成配置

#### Google TTS
1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 启用 Text-to-Speech API
3. 创建服务账户并下载 JSON 文件
4. 设置 `GOOGLE_TTS_CREDENTIALS` 为文件路径或 JSON 内容

#### 讯飞 TTS
1. 访问 [讯飞开放平台](https://www.xfyun.cn)
2. 创建应用并获取密钥
3. 设置 `XUNFEI_APP_ID`、`XUNFEI_API_KEY`、`XUNFEI_API_SECRET`

## 🔧 功能对应关系

| 功能模块 | 必需的环境变量 | 说明 |
|----------|----------------|------|
| 基础功能 | `NEXT_PUBLIC_SUPABASE_URL`<br>`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 用户认证和基础数据 |
| 管理员功能 | `SUPABASE_SERVICE_ROLE_KEY` | 管理员权限验证 |
| AI 生成内容 | `OPENAI_API_KEY` 或 `OPENROUTER_API_KEY` 或 `DEEPSEEK_API_KEY` | AI 内容生成 |
| 语音合成 | `GOOGLE_TTS_CREDENTIALS` 或 讯飞配置 | TTS 功能 |
| 用户认证 | `NEXTAUTH_URL`<br>`NEXTAUTH_SECRET` | 用户登录 |

## ⚠️ 注意事项

1. **安全性**：永远不要将 `.env.local` 文件提交到版本控制
2. **生产环境**：使用环境变量或密钥管理服务
3. **定期轮换**：定期更新 API 密钥
4. **权限最小化**：只授予必要的权限

## 🐛 故障排除

### 常见错误

1. **`supabaseUrl is required`**
   - 检查 `NEXT_PUBLIC_SUPABASE_URL` 是否设置
   - 确保 `.env.local` 文件在项目根目录

2. **`DEEPSEEK_API_KEY is missing`**
   - 检查 AI 服务配置
   - 确保至少配置了一个 AI 服务

3. **`GOOGLE_TTS_CREDENTIALS missing`**
   - 检查语音合成服务配置
   - 确保至少配置了一个 TTS 服务

### 调试工具

访问 `/admin/setup` 页面查看环境变量配置状态。

## 📚 相关文档

- [Supabase 设置指南](./GOOGLE_TTS_SETUP.md)
- [Google TTS 设置](./GOOGLE_TTS_SETUP.md)
- [讯飞 TTS 设置](./XUNFEI_SETUP.md)
- [数据库设置](./MANUAL_DATABASE_SETUP.md)
