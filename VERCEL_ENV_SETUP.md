# Vercel 环境变量配置指南

## 🚨 当前问题

部署失败原因：`Environment Variable "NEXT_PUBLIC_SUPABASE_URL" references Secret "supabase_url", which does not exist.`

## ✅ 解决方案

### 1. 在 Vercel 控制台设置环境变量

#### 方法一：通过 Vercel Dashboard

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择你的项目 `language-learning2`
3. 进入 **Settings** → **Environment Variables**
4. 添加以下环境变量：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI API 配置
OPENROUTER_API_KEY=your_openrouter_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key

# 应用配置
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

#### 方法二：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 设置环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPENROUTER_API_KEY
vercel env add DEEPSEEK_API_KEY
vercel env add OPENAI_API_KEY
vercel env add NEXT_PUBLIC_APP_URL

# 部署
vercel --prod
```

### 2. 环境变量详细说明

#### Supabase 配置

```bash
# 从 Supabase 项目设置中获取
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### AI API 配置

```bash
# OpenRouter API (用于多种AI模型)
OPENROUTER_API_KEY=sk-or-v1-...

# DeepSeek API (用于中文AI)
DEEPSEEK_API_KEY=sk-...

# OpenAI API (备用)
OPENAI_API_KEY=sk-...
```

#### 应用配置

```bash
# 应用URL (部署后会自动生成)
NEXT_PUBLIC_APP_URL=https://language-learning2-xxx.vercel.app
```

### 3. 验证配置

#### 检查环境变量

在 Vercel Dashboard 中确认所有环境变量都已正确设置：

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `OPENROUTER_API_KEY`
- ✅ `DEEPSEEK_API_KEY`
- ✅ `OPENAI_API_KEY`
- ✅ `NEXT_PUBLIC_APP_URL`

#### 重新部署

1. 在 Vercel Dashboard 中点击 **Redeploy**
2. 或者推送代码到 GitHub 触发自动部署

### 4. 故障排除

#### 常见问题

1. **环境变量未生效**：确保在正确的环境（Production/Preview/Development）中设置
2. **密钥格式错误**：检查API密钥是否完整，没有多余的空格
3. **权限问题**：确保 Supabase 服务角色密钥有足够权限

#### 调试步骤

1. 检查 Vercel 函数日志
2. 验证环境变量是否正确加载
3. 测试数据库连接
4. 检查 API 端点响应

### 5. 部署后验证

#### 功能测试清单

- [ ] 用户注册/登录
- [ ] 练习功能（影子跟读、完形填空、角色扮演）
- [ ] 管理后台访问
- [ ] API使用统计
- [ ] 用户权限管理
- [ ] AI功能调用

#### 性能检查

- [ ] 页面加载速度
- [ ] API响应时间
- [ ] 数据库查询性能
- [ ] 错误日志监控

---

## 🎯 快速修复步骤

1. **立即修复**：在 Vercel Dashboard 中添加缺失的环境变量
2. **重新部署**：点击 Redeploy 按钮
3. **验证功能**：测试核心功能是否正常工作

**预计修复时间：5-10分钟** ⏱️
