## 语言学习应用（Next.js 15 + App Router）

本项目是基于 Next.js 的语言学习平台，集成 Supabase、AI 文本与语音能力（OpenRouter、OpenAI、DeepSeek、Google TTS、讯飞 TTS），并包含完整的管理后台与实践练习页面。

### 快速开始

1) 安装依赖（使用 npm）
```bash
npm install
```

2) 配置环境变量
```bash
cp env.template .env.local
# 根据注释填写你的密钥与连接串
```

3) 启动开发服务器
```bash
npm run dev
```
访问 http://localhost:3000

### 常用脚本
- 开发: `npm run dev`
- 构建: `npm run build`
- 启动: `npm start`
- 检查类型: `npm run typecheck`
- Lint: `npm run lint` / `npm run lint:fix`
- 代码格式化: `npm run format` / `npm run format:check`

### 环境变量
请参考 `env.template` 并复制为 `.env.local`。关键项：
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- AI Keys: `OPENROUTER_API_KEY` 或 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`
- 语音合成: Google TTS / 讯飞 TTS 相关密钥
- 本地/云端数据库连接：`LOCAL_DB_URL`, `PROD_DB_URL`

注意：`.env.local` 已在 `.gitignore` 中忽略，请勿提交真实密钥。

### 部署
- 推荐使用 Vercel。根目录已提供 `vercel.json` 与 `next.config.ts`。
- 在部署平台面板中配置与本地一致的环境变量后再部署。

### 目录结构（节选）
- `src/app`：App Router 页面与 API 路由（大量 `/api` 管理与练习接口）
- `src/components`：通用 UI 与功能组件
- `src/lib`：服务端/通用库（AI、TTS、数据库、缓存、权限等）
- `supabase`：数据库迁移与初始化脚本
- `scripts`：性能测试与运维脚本
- `docs`：📚 **项目文档中心** - 所有功能文档、指南和报告

### 📚 文档中心
项目的所有文档已整理到 `docs/` 目录下，按功能分类：

- **[docs/README.md](./docs/README.md)** - 📖 文档索引和导航
- **[docs/features/](./docs/features/)** - 🎯 各功能模块文档
- **[docs/database/](./docs/database/)** - 🗄️ 数据库相关文档
- **[docs/deployment/](./docs/deployment/)** - 🚀 部署指南
- **[docs/setup/](./docs/setup/)** - ⚙️ 环境配置指南
- **[docs/optimization/](./docs/optimization/)** - ⚡ 性能优化文档
- **[docs/guides/](./docs/guides/)** - 📖 操作指南
- **[docs/中文文档/](./docs/中文文档/)** - 🇨🇳 中文文档

💡 **开始使用**: 查看 [docs/README.md](./docs/README.md) 获取完整的文档导航

### 故障排查
- 环境变量无法读取：确认 `.env.local` 是否存在且已重启 dev
- Supabase 连接失败：检查连接串与网络，可先用本地 `LOCAL_DB_URL`
- 语音合成失败：检查 Google/讯飞 凭据格式
- 权限问题：参考 [docs/setup/](./docs/setup/) 和 [docs/guides/](./docs/guides/)
