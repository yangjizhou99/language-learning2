# Vercel 部署指南

## ✅ 构建状态

- **TypeScript 编译**: ✅ 通过
- **Next.js 构建**: ✅ 通过
- **所有类型错误**: ✅ 已修复

## 🚀 部署步骤

### 1. 环境变量配置

在 Vercel 控制台中设置以下环境变量：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI API 配置
OPENROUTER_API_KEY=your_openrouter_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key

# 应用配置
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 2. 数据库设置

确保 Supabase 数据库已正确配置：

1. **执行数据库迁移**：
   - 运行 `supabase/migrations/` 目录中的所有迁移文件
   - 确保所有表、字段、RLS 策略都已创建

2. **验证表结构**：
   ```sql
   -- 检查关键表是否存在
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name IN ('profiles', 'user_permissions', 'api_limits', 'user_api_limits', 'api_usage_logs');
   ```

### 3. 部署命令

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署到 Vercel
vercel --prod
```

### 4. 功能验证

部署完成后，验证以下功能：

#### 核心功能

- ✅ **用户认证**: 登录/注册功能
- ✅ **练习页面**: 影子跟读、完形填空、角色扮演
- ✅ **管理后台**: 用户管理、内容管理

#### API使用管理功能

- ✅ **API使用统计**: `/admin/api-usage`
- ✅ **全局限制设置**: 设置系统级别的API使用限制
- ✅ **用户级别限制**: 为特定用户设置独立限制
- ✅ **AI权限管理**: 控制用户的AI功能访问权限
- ✅ **模型权限控制**: 管理用户可访问的AI模型

#### 权限控制

- ✅ **AI功能阻止**: 未启用AI的用户无法使用AI功能
- ✅ **模型权限检查**: 只允许访问授权的模型
- ✅ **使用限制检查**: 实时检查并阻止超出限制的调用
- ✅ **API密钥验证**: 确保用户配置了必要的API密钥

### 5. 性能优化

- **构建大小**: 100kB 共享JS包
- **页面数量**: 45个静态页面
- **API路由**: 100+ 个API端点
- **函数超时**: 30秒（适合AI调用）

### 6. 监控和维护

- **错误监控**: 检查 Vercel 函数日志
- **性能监控**: 使用 Vercel Analytics
- **数据库监控**: 检查 Supabase 使用情况
- **API使用监控**: 通过管理后台查看使用统计

## 🔧 故障排除

### 常见问题

1. **环境变量未设置**: 检查 Vercel 环境变量配置
2. **数据库连接失败**: 验证 Supabase 配置
3. **权限检查失败**: 检查 RLS 策略设置
4. **AI功能不可用**: 验证 API 密钥配置

### 调试步骤

1. 检查 Vercel 函数日志
2. 验证环境变量是否正确设置
3. 测试数据库连接
4. 检查 API 端点响应

## 📊 部署统计

- **构建时间**: ~14秒
- **总页面数**: 45个
- **API端点**: 100+ 个
- **共享JS包**: 100kB
- **最大页面**: 27.6kB (shadowing页面)

---

**部署准备完成！** 🎉
