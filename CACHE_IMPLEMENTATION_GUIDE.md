# 三层缓存 + 304 条件请求实现指南

## 📋 功能概述

本项目实现了完整的三层缓存系统，包括：

1. **前端缓存层**：SWR-like 钩子，支持去重和 stale-while-revalidate
2. **API 层缓存**：增强内存缓存 + ETag 生成
3. **页面层缓存**：Next.js ISR (Incremental Static Regeneration)
4. **条件请求**：304 Not Modified 支持

## 🏗️ 系统架构

```
[前端组件] → [useEnhancedFetch] → [API Route] → [EnhancedCacheManager] → [数据库]
     ↓               ↓                    ↓                 ↓
  浏览器缓存    请求去重缓存         ETag + 304           内存缓存
```

## 🚀 已实现的功能

### 1. 前端缓存 (`useEnhancedFetch`)

**位置**: `src/hooks/useEnhancedFetch.ts`

**特性**:

- ✅ 请求去重 (Deduplication)
- ✅ Stale-while-revalidate
- ✅ ETag 条件请求支持
- ✅ 窗口聚焦时重新验证
- ✅ 指数退避重试
- ✅ 容错机制

**使用示例**:

```typescript
import useEnhancedFetch from '@/hooks/useEnhancedFetch';

function MyComponent() {
  const { data, error, isLoading, isValidating, mutate } = useEnhancedFetch(
    '/api/shadowing/next?lang=en&level=2',
    {
      staleTime: 60 * 1000,      // 1分钟内不重复请求
      cacheTime: 5 * 60 * 1000,  // 5分钟缓存时间
      revalidateOnFocus: true,   // 窗口聚焦时验证
      dedupe: true,              // 启用去重
      retryCount: 3              // 重试3次
    }
  );

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Error: {error.message}</div>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      <button onClick={mutate}>Refresh</button>
    </div>
  );
}
```

### 2. API 层增强缓存 (`EnhancedCacheManager`)

**位置**: `src/lib/enhanced-cache.ts`

**特性**:

- ✅ 自动 ETag 生成 (SHA1 哈希)
- ✅ 条件请求处理 (If-None-Match)
- ✅ 304 Not Modified 响应
- ✅ 请求去重防止重复查询
- ✅ TTL 过期管理
- ✅ 缓存统计和监控

**API 路由示例**:

```typescript
// src/app/api/example/route.ts
export const revalidate = 60; // ISR: 页面级缓存

import { EnhancedCacheManager } from '@/lib/enhanced-cache';

export async function GET(req: NextRequest) {
  const cacheKey = EnhancedCacheManager.generateKey('example', {
    lang: 'en',
    level: 2,
  });

  const clientETag = req.headers.get('if-none-match');

  const result = await EnhancedCacheManager.dedupeWithETag(
    cacheKey,
    async () => {
      // 实际的数据获取逻辑
      return await fetchDataFromDatabase();
    },
    clientETag,
    300, // 5分钟缓存
  );

  // 返回 304 Not Modified
  if (result.shouldReturn304) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: result.etag,
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  }

  // 返回正常响应
  return NextResponse.json(result.data, {
    headers: {
      ETag: result.etag,
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}
```

### 3. 页面层 ISR 缓存

已在以下 API 路由中实现:

- ✅ `/api/shadowing/next` - 跟读练习
- ⚠️ `/api/cloze/next` - 需要添加 ISR 配置
- ⚠️ `/api/tts/voices` - 需要添加 ISR 配置

**配置方式**:

```typescript
export const revalidate = 60; // 60秒重新验证
export const dynamic = 'force-dynamic'; // 强制动态渲染（与 ISR 配合）
```

### 4. 演示页面

**位置**: `src/app/cache-demo/page.tsx`

**访问**: `http://localhost:3000/cache-demo`

**功能**:

- 🎯 实时缓存统计
- 📊 多端点测试
- 🔄 手动刷新和缓存清空
- ⚡ 预加载演示
- 📋 使用指南

## 🧪 测试和验证

### 1. 性能测试脚本

**位置**: `scripts/test-cache-performance.js`

**运行方式**:

```bash
# 测试本地环境
node scripts/test-cache-performance.js

# 测试部署环境
TEST_URL=https://your-domain.com node scripts/test-cache-performance.js
```

**测试内容**:

- ETag 头检查
- Cache-Control 头检查
- 304 响应验证
- 响应时间对比
- 并发请求测试
- 数据一致性检查

### 2. 浏览器验证

1. **打开开发者工具 Network 面板**
2. **访问任意 API 端点两次**
3. **检查第二次请求**:
   - Status: 304 (Not Modified)
   - Response Headers: 包含 ETag
   - Response Body: 空 (0 bytes)

### 3. 终端验证

```bash
# 第一次请求，获取 ETag
curl -I https://your-domain.com/api/shadowing/next?lang=en&level=2

# 第二次请求，带上 ETag
curl -I https://your-domain.com/api/shadowing/next?lang=en&level=2 \
  -H 'If-None-Match: "获取到的ETag值"'
```

期望结果: 第二次请求返回 `HTTP/1.1 304 Not Modified`

## 📊 性能指标目标

### 缓存命中率

- **列表接口**: >60% 请求命中缓存或 304
- **静态资源**: >80% 缓存命中

### 响应时间

- **缓存命中**: <50ms
- **304 响应**: <100ms
- **数据库查询**: 相比无缓存下降 50%+

### 带宽节省

- **304 响应**: 99% 带宽节省
- **CDN 缓存**: 80%+ 回源请求减少

## 🔧 配置选项

### 前端缓存配置

```typescript
const cacheOptions = {
  staleTime: 60 * 1000, // 1分钟内数据视为新鲜
  cacheTime: 5 * 60 * 1000, // 5分钟后清除缓存
  revalidateOnFocus: true, // 窗口聚焦时重新验证
  dedupe: true, // 启用请求去重
  retryCount: 3, // 失败重试次数
};
```

### API 层缓存配置

```typescript
const apiCacheConfig = {
  defaultTTL: 300, // 默认5分钟
  maxSize: 2000, // 最大缓存条目数
  cleanupInterval: 300000, // 5分钟清理一次
};
```

### ISR 配置

```typescript
export const revalidate = 60; // 页面60秒重新验证
export const dynamic = 'force-dynamic'; // 动态渲染
```

## 🐛 故障排查

### 1. ETag 不生成

**检查**:

- API 路由是否导入了 `EnhancedCacheManager`
- 响应是否使用了 `dedupeWithETag` 方法
- 响应头是否包含 ETag

### 2. 304 不返回

**检查**:

- 客户端是否发送 `If-None-Match` 头
- ETag 值是否匹配
- 缓存是否过期

### 3. 前端缓存不生效

**检查**:

- 是否使用了 `useEnhancedFetch`
- 缓存配置是否合理
- 浏览器开发者工具的网络面板禁用缓存选项

### 4. ISR 不工作

**检查**:

- API 路由是否导出 `revalidate`
- Vercel 部署是否启用了 ISR
- 是否设置了正确的 `Cache-Control` 头

## 🚀 部署注意事项

### Vercel 部署

1. **环境变量配置**:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

2. **Vercel 配置** (`vercel.json`):

   ```json
   {
     "functions": {
       "src/app/api/**/route.ts": {
         "maxDuration": 30
       }
     }
   }
   ```

3. **ISR 配置确认**:
   - 确保 API 路由导出 `revalidate`
   - 检查 Vercel 函数日志确认 ISR 生效

### 自托管部署

1. **Redis 缓存** (可选增强):

   ```typescript
   // 在 enhanced-cache.ts 中取消注释 Redis 部分
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   ```

2. **CDN 配置**:
   - 设置合适的 `Cache-Control` 头
   - 配置 CDN 遵守 `s-maxage` 指令

## 📈 监控和观察

### 缓存统计

```typescript
import { cacheManager } from '@/hooks/useEnhancedFetch';
import { EnhancedCacheManager } from '@/lib/enhanced-cache';

// 前端缓存统计
const frontendStats = cacheManager.getStats();

// API 层缓存统计
const apiStats = EnhancedCacheManager.getStats();
```

### 性能监控

```typescript
// 在 API 路由中添加
console.log('Cache hit:', !!cached);
console.log('Response time:', Date.now() - startTime);
```

## 🔄 维护和优化

### 定期任务

1. **缓存清理**: 自动清理过期缓存
2. **统计分析**: 定期分析缓存命中率
3. **性能监控**: 监控响应时间变化

### 优化建议

1. **调整 TTL**: 根据数据更新频率调整缓存时间
2. **预加载**: 对热门数据进行预加载
3. **缓存预热**: 部署后主动触发缓存
4. **监控告警**: 设置缓存命中率告警

## 🎯 下一步计划

- [ ] 添加 Redis 分布式缓存支持
- [ ] 实现缓存预热机制
- [ ] 添加缓存监控仪表板
- [ ] 优化缓存失效策略
- [ ] 添加 A/B 测试缓存策略

---

**测试完成时间**: ${new Date().toLocaleString()}
**实现状态**: ✅ 基础功能完成，🔄 持续优化中
