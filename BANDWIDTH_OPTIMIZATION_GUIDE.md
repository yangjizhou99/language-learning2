# 带宽优化指南

## 🎯 优化目标
减少 Supabase Cached Egress 流量，降低带宽成本，提升用户体验。

## 📊 已实施的优化措施

### 1. Next.js 配置优化
- ✅ 添加了图片优化配置 (`next.config.ts`)
- ✅ 支持 Supabase Storage 远程图片优化
- ✅ 启用了 WebP/AVIF 格式自动转换
- ✅ 设置了 30 天图片缓存

### 2. Storage 文件缓存头
- ✅ 为所有音频文件上传添加了 30 天缓存头
- ✅ 创建了 Storage 代理路由 (`/api/storage-proxy`)
- ✅ 实现了 CDN 边缘缓存策略

### 3. API 路由缓存优化
- ✅ TTS API: 1天 CDN 缓存，1小时浏览器缓存
- ✅ Cloze API: 5分钟 CDN 缓存，1分钟浏览器缓存
- ✅ Shadowing API: 5分钟 CDN 缓存，1分钟浏览器缓存
- ✅ TTS Voices API: 1小时 CDN 缓存，30分钟浏览器缓存

### 4. 组件优化
- ✅ 创建了 `OptimizedImage` 组件
- ✅ 创建了 `OptimizedAudio` 组件
- ✅ 支持自动错误回退和加载状态

## 🚀 使用方法

### 1. 运行存储分析
```bash
# 在 Supabase SQL Editor 中运行
cat scripts/analyze-storage-usage.sql

# 或运行 Node.js 监控脚本
node scripts/monitor-bandwidth.js
```

### 2. 批量更新现有文件缓存头
```bash
# 确保环境变量已设置
node scripts/update-storage-cache-headers.js
```

### 3. 使用优化组件
```tsx
// 替换普通 img 标签
import OptimizedImage from '@/components/OptimizedImage';

<OptimizedImage
  src="https://your-project.supabase.co/storage/v1/object/public/tts/audio.mp3"
  alt="音频文件"
  width={300}
  height={200}
  quality={70}
/>

// 替换普通 audio 标签
import OptimizedAudio from '@/components/OptimizedAudio';

<OptimizedAudio
  src="https://your-project.supabase.co/storage/v1/object/public/tts/audio.mp3"
  controls
  preload="metadata"
/>
```

## 📈 预期效果

### 短期效果 (1-7天)
- **TTS 音频重复请求减少 60-80%**
- **API 响应缓存命中率提升 40-60%**
- **图片加载速度提升 30-50%**

### 中期效果 (1-4周)
- **Cached Egress 流量减少 50-70%**
- **用户页面加载速度提升 20-40%**
- **服务器响应时间减少 30-50%**

### 长期效果 (1-3个月)
- **带宽成本降低 40-60%**
- **用户体验显著提升**
- **系统稳定性增强**

## 🔧 进一步优化建议

### 1. 数据库层面
```sql
-- 为经常查询的字段添加索引
CREATE INDEX IF NOT EXISTS idx_cloze_items_lang_level 
ON cloze_items(lang, level);

CREATE INDEX IF NOT EXISTS idx_shadowing_items_lang_level 
ON shadowing_items(lang, level);

-- 定期清理过期数据
DELETE FROM storage.objects 
WHERE created_at < NOW() - INTERVAL '90 days' 
AND bucket_id = 'temp';
```

### 2. 应用层面
- 实现音频文件压缩 (MP3 → AAC)
- 添加图片懒加载
- 使用 Service Worker 缓存策略
- 实现增量更新机制

### 3. 架构层面
- 考虑使用 CDN (Cloudflare, AWS CloudFront)
- 实现文件去重机制
- 添加访问频率限制
- 使用 Redis 缓存热点数据

## 📊 监控指标

### 关键指标
1. **Cached Egress** - 应该持续下降
2. **API 响应时间** - 应该减少
3. **缓存命中率** - 应该提升
4. **用户页面加载时间** - 应该减少

### 监控方法
```bash
# 每日运行监控脚本
node scripts/monitor-bandwidth.js

# 检查 Supabase Dashboard
# - Storage → Usage
# - Edge Functions → Logs
# - Database → Performance
```

## 🚨 注意事项

### 1. 缓存失效
- 更新文件时需要清除相关缓存
- 重要更新需要强制刷新缓存

### 2. 存储成本
- 监控存储使用量
- 定期清理无用文件
- 考虑冷存储方案

### 3. 用户体验
- 确保缓存不会影响实时性
- 提供手动刷新选项
- 监控错误率变化

## 🔄 回滚方案

如果优化导致问题，可以快速回滚：

1. **恢复 Next.js 配置**
```bash
git checkout HEAD~1 next.config.ts
```

2. **移除缓存头**
```bash
# 在 Supabase 中运行
UPDATE storage.objects 
SET metadata = metadata - 'cacheControl'
WHERE metadata ? 'cacheControl';
```

3. **恢复 API 缓存设置**
```bash
git checkout HEAD~1 src/app/api/
```

## 📞 支持

如有问题，请检查：
1. 环境变量是否正确设置
2. Supabase 权限是否充足
3. 网络连接是否正常
4. 控制台错误日志

---

**最后更新**: 2025年1月20日
**版本**: 1.0.0
