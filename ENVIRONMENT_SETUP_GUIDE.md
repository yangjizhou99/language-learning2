# 环境变量设置指南

## 概述

本项目需要配置多个环境变量才能正常运行。请根据你的需求配置相应的环境变量。

## 必需的环境变量

### 1. Supabase 数据库配置 (必需)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**获取方法：**
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 Settings → API
4. 复制 Project URL 和 anon public key
5. 复制 service_role secret key

## AI 提供商配置 (至少需要配置一个)

### 2. OpenRouter (推荐)
```bash
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
OPENROUTER_SITE_URL=https://your-domain.com
OPENROUTER_SITE_NAME=Language Learning App
```

**获取方法：**
1. 注册 [OpenRouter](https://openrouter.ai/)
2. 获取 API Key
3. 设置你的网站 URL 和名称

### 3. DeepSeek 直连
```bash
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

**获取方法：**
1. 注册 [DeepSeek](https://platform.deepseek.com/)
2. 获取 API Key

### 4. OpenAI 直连
```bash
OPENAI_API_KEY=sk-your-openai-key
```

**获取方法：**
1. 注册 [OpenAI](https://platform.openai.com/)
2. 获取 API Key

## 语音合成配置 (可选)

### 5. Google TTS
```bash
# 方法1：使用 Service Account JSON
GOOGLE_TTS_CREDENTIALS={"type":"service_account",...}
GOOGLE_TTS_PROJECT_ID=your-google-project-id

# 方法2：使用单独的凭据
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
GOOGLE_CLOUD_PROJECT_ID=your-google-project-id

# Gemini TTS 模型选择
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
```

**获取方法：**
1. 创建 [Google Cloud Project](https://console.cloud.google.com/)
2. 启用 Text-to-Speech API
3. 创建 Service Account
4. 下载 JSON 凭据文件

### 6. 科大讯飞 TTS
```bash
XUNFEI_APP_ID=your_xunfei_app_id
XUNFEI_API_KEY=your_xunfei_api_key
XUNFEI_API_SECRET=your_xunfei_api_secret
```

**获取方法：**
1. 注册 [科大讯飞开放平台](https://www.xfyun.cn/)
2. 创建应用
3. 获取 AppID、API Key 和 API Secret

## 应用配置

### 7. 基本应用设置
```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SITE_NAME=Language Learning App
NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET=tts
NEXT_PUBLIC_SHOW_DEBUG=0
ENABLE_PERFORMANCE_MONITORING=false
AI_PROVIDER=openrouter
AI_DEFAULT_MODEL=openai/gpt-4o-mini
```

## 本地开发设置

1. 复制 `env.template` 文件为 `.env.local`
2. 填入你的实际环境变量值
3. 运行 `npm run dev`

## Vercel 部署设置

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目
3. 进入 Settings → Environment Variables
4. 添加所有必需的环境变量
5. 重新部署项目

## 环境变量优先级

1. `.env.local` (本地开发)
2. Vercel Environment Variables (生产环境)
3. `vercel.json` 中的默认值

## 故障排除

### 常见问题

1. **Supabase 连接失败**
   - 检查 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确
   - 确保 Supabase 项目已激活

2. **AI API 调用失败**
   - 检查 API Key 是否有效
   - 确保有足够的 API 额度

3. **TTS 功能不工作**
   - 检查 Google TTS 或科大讯飞配置
   - 确保 API 凭据正确

4. **Vercel 部署失败**
   - 检查所有必需的环境变量是否已设置
   - 确保环境变量名称正确

## 安全提醒

- 永远不要将真实的 API Key 提交到代码仓库
- 使用 Vercel Secrets 存储敏感信息
- 定期轮换 API Key
- 监控 API 使用情况

## 支持

如果遇到问题，请检查：
1. 环境变量是否正确设置
2. API Key 是否有效
3. 网络连接是否正常
4. 查看控制台错误信息
