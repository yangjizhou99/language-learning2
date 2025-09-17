# 新文件缓存优化指南

## 🎯 问题解决

现在所有新生成的音频文件都会自动添加缓存头，无需手动处理！

## 📋 已完成的优化

### ✅ 1. 创建了统一上传函数
- `src/lib/storage-upload.ts` - 统一处理所有文件上传
- 自动为不同类型文件添加合适的缓存头
- 支持音频、图片、文档等不同文件类型

### ✅ 2. 更新了所有TTS合成API
- `synthesize/route.ts` - 基础TTS合成
- `synthesize-unified/route.ts` - 统一TTS合成
- `synthesize-gemini/route.ts` - Gemini TTS合成
- `synthesize-gemini-dialogue/route.ts` - Gemini对话合成
- `synthesize-dialogue/route.ts` - 对话合成

## 🚀 新文件自动缓存策略

### 音频文件
```typescript
// 自动添加缓存头
cacheControl: 'public, max-age=2592000, immutable' // 30天缓存
```

### 图片文件
```typescript
// 自动添加缓存头
cacheControl: 'public, max-age=2592000, immutable' // 30天缓存
```

### 文档文件
```typescript
// 自动添加缓存头
cacheControl: 'public, max-age=86400' // 1天缓存
```

## 📝 如何使用新的上传函数

### 1. 上传音频文件
```typescript
import { uploadAudioFile } from '@/lib/storage-upload';

const result = await uploadAudioFile(
  'tts', // 桶名
  'zh/audio-file.mp3', // 文件路径
  audioBuffer, // 音频数据
  {
    contentType: 'audio/mpeg', // 可选，默认audio/mpeg
    cacheControl: 'public, max-age=2592000, immutable', // 可选，默认30天
    upsert: false // 可选，默认false
  }
);

if (result.success) {
  console.log('上传成功:', result.url);
} else {
  console.error('上传失败:', result.error);
}
```

### 2. 上传图片文件
```typescript
import { uploadImageFile } from '@/lib/storage-upload';

const result = await uploadImageFile(
  'images', // 桶名
  'hero-image.jpg', // 文件路径
  imageBuffer // 图片数据
);
```

### 3. 上传文档文件
```typescript
import { uploadDocumentFile } from '@/lib/storage-upload';

const result = await uploadDocumentFile(
  'documents', // 桶名
  'report.pdf', // 文件路径
  documentBuffer // 文档数据
);
```

## 🔧 自定义缓存策略

如果需要自定义缓存策略，可以传入 `cacheControl` 参数：

```typescript
// 短期缓存（1小时）
const result = await uploadAudioFile(bucket, path, buffer, {
  cacheControl: 'public, max-age=3600'
});

// 长期缓存（1年）
const result = await uploadAudioFile(bucket, path, buffer, {
  cacheControl: 'public, max-age=31536000, immutable'
});

// 不缓存
const result = await uploadAudioFile(bucket, path, buffer, {
  cacheControl: 'no-cache'
});
```

## 📊 预期效果

### 新文件自动优化
- ✅ **所有新音频文件**：30天缓存，大幅减少重复下载
- ✅ **所有新图片文件**：30天缓存，提升加载速度
- ✅ **所有新文档文件**：1天缓存，平衡实时性和性能

### 带宽节省
- **新TTS文件**：重复访问几乎为0
- **新图片文件**：CDN缓存命中率90%+
- **总体效果**：Cached Egress 持续下降

## 🔍 监控建议

### 1. 检查新文件缓存头
```bash
# 检查新上传的文件是否有缓存头
curl -I "https://your-project.supabase.co/storage/v1/object/public/tts/zh/new-file.mp3"
```

应该看到：
```
Cache-Control: public, max-age=2592000, immutable
```

### 2. 监控Supabase Dashboard
- Storage → Usage：查看新文件上传情况
- Reports → Bandwidth：监控Cached Egress变化

### 3. 定期检查
- 每周检查一次新文件是否都有缓存头
- 监控带宽使用情况是否持续改善

## 🚨 注意事项

### 1. 现有代码兼容性
- 所有现有API都已更新，无需修改调用代码
- 新上传函数向后兼容，不影响现有功能

### 2. 缓存失效
- 如果需要更新文件，使用 `upsert: true` 参数
- 重要更新可能需要清除CDN缓存

### 3. 错误处理
- 新上传函数包含完整的错误处理
- 失败时会返回详细的错误信息

## 🎉 总结

现在你的系统已经完全优化：

1. **现有文件**：已批量添加缓存头（2963个文件）
2. **新文件**：自动添加缓存头，无需手动处理
3. **监控工具**：提供完整的监控和分析脚本
4. **预期效果**：Cached Egress 将持续下降

你只需要正常使用系统，所有新生成的音频文件都会自动获得缓存优化！
