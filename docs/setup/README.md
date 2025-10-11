# ⚙️ 环境配置文档

本目录包含项目环境配置和初始化的所有文档。

## 📚 配置指南

### 🚀 快速开始
- `ENVIRONMENT_SETUP_GUIDE.md` - **完整的环境配置指南（推荐从这里开始）**
- `ENVIRONMENT_VARIABLES_SETUP.md` - 环境变量详细配置
- `PROJECT_ENV_SUMMARY.md` - 项目环境总结

### 🎙️ TTS服务配置
本项目支持多个TTS（文字转语音）服务提供商。

#### Google TTS
- `GOOGLE_TTS_SETUP.md` - Google Text-to-Speech 配置指南

#### Gemini TTS
- `GEMINI_TTS_INTEGRATION.md` - Gemini TTS 集成指南
- `GEMINI_TTS_INTEGRATION_SUMMARY.md` - 集成总结

#### 讯飞 TTS
- `XUNFEI_SETUP.md` - 科大讯飞 TTS 配置指南

### 📋 环境变量说明
- `ENV_README.md` - 环境变量详细说明文档

### 🤖 AI服务配置
- `DEEPSEEK_DEFAULT_CHANGES.md` - DeepSeek AI 默认配置更改

## 🔑 必需的环境变量

创建 `.env.local` 文件并配置以下变量：

### 基础配置
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 应用配置
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### TTS服务（选择其一或多个）

#### Google TTS
```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

#### Gemini TTS
```bash
GOOGLE_API_KEY=your_google_api_key
```

#### 讯飞 TTS
```bash
XUNFEI_APP_ID=your_app_id
XUNFEI_API_KEY=your_api_key
XUNFEI_API_SECRET=your_api_secret
```

### AI服务（可选）
```bash
# DeepSeek
DEEPSEEK_API_KEY=your_deepseek_api_key

# OpenAI（如果使用）
OPENAI_API_KEY=your_openai_api_key
```

详细说明请查看 `ENVIRONMENT_VARIABLES_SETUP.md`。

## 📝 配置步骤

### 1. 克隆项目
```bash
git clone <repository-url>
cd language-learning2
```

### 2. 安装依赖
```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 3. 配置环境变量
1. 复制 `env.template` 为 `.env.local`
2. 填写所有必需的环境变量
3. 参考 `ENVIRONMENT_VARIABLES_SETUP.md` 了解每个变量的用途

### 4. 配置数据库
参考 [../database/](../database/) 目录下的数据库配置文档。

### 5. 配置TTS服务
根据需要配置一个或多个TTS服务：
- Google TTS: 查看 `GOOGLE_TTS_SETUP.md`
- Gemini TTS: 查看 `GEMINI_TTS_INTEGRATION.md`
- 讯飞 TTS: 查看 `XUNFEI_SETUP.md`

### 6. 启动开发服务器
```bash
npm run dev
```

访问 `http://localhost:3000` 查看应用。

## 🔍 常见问题

### 环境变量不生效
1. 确保文件名是 `.env.local`（注意前面的点）
2. 重启开发服务器
3. 检查变量名是否拼写正确
4. 客户端变量必须以 `NEXT_PUBLIC_` 开头

### TTS服务无法使用
1. 检查相应的API密钥是否正确
2. 确认服务账号权限
3. 查看对应的TTS配置文档
4. 检查网络连接和API配额

### Supabase连接失败
1. 验证 URL 和 Key 是否正确
2. 检查 Supabase 项目是否已启动
3. 确认网络可以访问 Supabase
4. 查看 [../database/](../database/) 了解更多

## 🌐 网络配置

如果需要在局域网中访问开发服务器，请参考：
- [../中文文档/局域网访问开发服务器指南.md](../中文文档/局域网访问开发服务器指南.md)
- [../中文文档/局域网访问本地数据库配置指南.md](../中文文档/局域网访问本地数据库配置指南.md)

## 📱 多设备测试

如需在多设备上测试，请查看：
- [../中文文档/多设备测试指南.md](../中文文档/多设备测试指南.md)

## ⚠️ 安全提醒

1. **永远不要提交 `.env.local` 文件到版本控制**
2. **不要在代码中硬编码敏感信息**
3. **定期更新API密钥**
4. **使用不同的密钥用于开发和生产环境**
5. **限制服务账号权限到最小必需范围**

---

**返回**: [文档主页](../README.md)

