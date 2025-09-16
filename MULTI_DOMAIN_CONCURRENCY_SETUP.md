# 多域名并发优化配置指南

## 概述

通过配置多个子域名来突破浏览器的6个并发连接限制，实现更高的并发处理能力。

## 原理

- 浏览器对同一域名的并发连接数限制为6个
- 通过使用多个子域名，每个域名可以有6个并发连接
- 3个域名 = 最多18个并发连接

## 配置步骤

### 1. DNS配置

在你的域名提供商处添加以下CNAME记录：

```
api1.yourdomain.com  CNAME  yourdomain.com
api2.yourdomain.com  CNAME  yourdomain.com
```

### 2. Vercel配置

在 `vercel.json` 中添加重写规则：

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

### 3. 本地开发配置

在 `next.config.ts` 中添加：

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
```

### 4. 环境变量

确保以下环境变量在所有域名下都可用：

```bash
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI API配置
OPENROUTER_API_KEY=your_openrouter_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
```

## 使用方法

1. 配置完成后，系统会自动轮询使用不同域名
2. 在管理界面中设置并发数为12-18
3. 系统会自动分配任务到不同的域名

## 监控

在浏览器开发者工具的Network标签中，你可以看到请求被分配到不同的域名：

- `yourdomain.com/api/...` (主域名)
- `api1.yourdomain.com/api/...` (子域名1)
- `api2.yourdomain.com/api/...` (子域名2)

## 注意事项

1. 确保所有子域名都指向同一个应用
2. 所有域名必须使用相同的SSL证书
3. 如果某个子域名不可用，系统会自动回退到主域名
4. 建议在生产环境中测试并发性能

## 性能提升

- 默认：6个并发连接
- 优化后：18个并发连接（3倍提升）
- 理论最大：可以添加更多子域名进一步提升

## 故障排除

如果遇到问题：

1. 检查DNS解析是否正确
2. 确认所有子域名都能正常访问
3. 查看浏览器控制台的网络请求日志
4. 检查SSL证书是否覆盖所有子域名
