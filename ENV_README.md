# 环境变量配置文件说明

## 文件列表

| 文件名                       | 用途             | 说明                       |
| ---------------------------- | ---------------- | -------------------------- |
| `env.template`               | 完整环境变量模板 | 包含所有可能的环境变量配置 |
| `env.minimal`                | 最小化配置       | 仅包含必需的环境变量       |
| `env.example.bak`            | 原始示例文件     | 项目原有的环境变量示例     |
| `setup-env.js`               | 自动设置脚本     | 快速创建 .env.local 文件   |
| `ENVIRONMENT_SETUP_GUIDE.md` | 详细设置指南     | 完整的环境变量配置说明     |

## 快速开始

### 方法1：使用自动设置脚本

```bash
node setup-env.js
```

这会自动创建 `.env.local` 文件，然后你只需要编辑文件填入实际值。

### 方法2：手动复制模板

```bash
# 复制完整模板
cp env.template .env.local

# 或者复制最小化配置
cp env.minimal .env.local
```

## 必需配置

### 1. Supabase 数据库 (必需)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2. AI 提供商 (至少配置一个)

```bash
# OpenRouter (推荐)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key

# 或者 DeepSeek
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 或者 OpenAI
OPENAI_API_KEY=sk-your-openai-key
```

### 3. 应用配置

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SITE_NAME=Language Learning App
```

## Vercel 部署

1. 在 Vercel Dashboard 中设置环境变量
2. 使用 `vercel.json` 中定义的 secrets 名称
3. 重新部署项目

## 故障排除

- 确保所有必需的环境变量都已设置
- 检查 API Key 是否有效
- 查看控制台错误信息
- 参考 `ENVIRONMENT_SETUP_GUIDE.md` 获取详细帮助

## 安全提醒

- 永远不要将 `.env.local` 文件提交到代码仓库
- 使用 Vercel Secrets 存储生产环境变量
- 定期轮换 API Key
