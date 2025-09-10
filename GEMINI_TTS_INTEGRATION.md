# Gemini TTS 集成说明

## 概述

本项目已成功集成 Google Cloud Text-to-Speech 的 Gemini TTS 功能，为 shadowing review 页面提供了更先进的 AI 增强语音合成选项。

## 功能特性

### 1. 双 TTS 提供商支持
- **Google TTS (传统)**: 使用现有的 Google Cloud TTS API，稳定可靠
- **Gemini TTS (AI增强)**: 使用 Gemini 2.5 模型，支持更自然的语音合成

### 2. 智能音色分配
- 自动为对话中的不同角色分配合适的音色
- 支持 10 种预置 Gemini 音色：Kore, Orus, Callirrhoe, Puck, Charon, Enceladus, Aoede, Pulcherrima, Umbriel, Vindemiatrix
- 根据语言和角色特征智能推荐音色

### 3. 对话格式支持
- 自动检测对话格式 (A: xxx, B: xxx)
- 为不同角色分配不同音色和风格
- 支持多角色对话合成

## 文件结构

```
src/
├── lib/
│   ├── gemini-tts.ts              # Gemini TTS 核心功能库
│   └── gemini-voices.json         # 音色配置文件
├── app/
│   ├── api/admin/shadowing/
│   │   ├── synthesize-gemini/route.ts           # Gemini TTS 单句合成 API
│   │   └── synthesize-gemini-dialogue/route.ts  # Gemini TTS 对话合成 API
│   └── admin/shadowing/review/page.tsx          # 更新的审核页面
└── env.example.bak                # 更新的环境变量配置
```

## 环境变量配置

在 `.env.local` 文件中添加以下配置：

```env
# Gemini TTS 配置
GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts
```

可选模型：
- `gemini-2.5-flash-preview-tts` (推荐，性价比高)
- `gemini-2.5-pro-preview-tts` (质量更高)

## 使用方法

### 1. 在 Shadowing Review 页面使用

1. 访问 `http://localhost:3000/admin/shadowing/review`
2. 在"性能优化参数"卡片中选择 TTS 提供商
3. 选择"Gemini TTS (AI增强)"选项
4. 选择要合成的草稿，点击"批量合成 Gemini TTS"

### 2. API 调用示例

#### 单句合成
```javascript
const response = await fetch('/api/admin/shadowing/synthesize-gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "Hello, how are you?",
    lang: "en",
    voiceName: "Kore",
    stylePrompt: "以自然、清晰的风格朗读",
    speakingRate: 1.0,
    pitch: 0
  })
});
```

#### 对话合成
```javascript
const response = await fetch('/api/admin/shadowing/synthesize-gemini-dialogue', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: "A: Hello, how are you?\nB: I'm fine, thank you!",
    lang: "en",
    speakers: ["A", "B"],
    stylePrompts: {
      "A": "以女性、清晰、自然的风格朗读",
      "B": "以男性、中性、随意的风格朗读"
    }
  })
});
```

## 音色配置

### 预置音色列表

| 音色名称 | 特征 | 适用场景 |
|---------|------|----------|
| Kore | 女性，清晰，新闻风格，平静 | 新闻播报，正式场合 |
| Orus | 男性，中性，随意 | 日常对话，中性场景 |
| Callirrhoe | 女性，明亮，友好 | 轻松对话，友好交流 |
| Puck | 男性，年轻，活泼 | 年轻角色，活泼场景 |
| Charon | 男性，深沉，严肃 | 严肃话题，权威角色 |
| Enceladus | 男性，正式 | 商务场合，正式对话 |
| Aoede | 女性，柔和 | 温柔角色，柔和场景 |
| Pulcherrima | 女性，温暖 | 温馨场景，温暖交流 |
| Umbriel | 男性，圆润 | 成熟角色，稳重场景 |
| Vindemiatrix | 女性，成熟 | 成熟女性，专业场景 |

### 自定义音色分配

可以通过修改 `src/lib/gemini-tts.ts` 中的 `recommendVoiceForSpeaker` 函数来自定义音色分配逻辑。

## 技术特性

### 1. 智能文本处理
- 自动分割长文本为合适长度的片段
- 支持多种语言的分句规则
- 智能处理特殊字符和标点符号

### 2. 音频合并
- 使用 FFmpeg 进行高质量音频合并
- 自动添加自然间隔
- 支持多种音频格式输出

### 3. 错误处理
- 完善的错误处理和重试机制
- 详细的错误日志记录
- 优雅的降级处理

## 性能优化

### 1. 并发控制
- 支持可配置的并发数量
- 智能的节流控制
- 避免 API 限流

### 2. 缓存机制
- 音频文件自动上传到 Supabase Storage
- 生成长期有效的签名 URL
- 避免重复合成

## 注意事项

1. **API 配额**: Gemini TTS 是预览功能，有使用配额限制
2. **语言支持**: 目前主要支持英语，其他语言可能需要调整
3. **成本控制**: 建议在生产环境中监控使用量和成本
4. **权限要求**: 需要 Google Cloud Text-to-Speech 和 Vertex AI 权限

## 故障排除

### 常见问题

1. **权限错误**: 确保服务账号有 `aiplatform.user` 权限
2. **模型不可用**: 检查 `GEMINI_TTS_MODEL` 环境变量设置
3. **音频合成失败**: 检查文本长度是否超过限制（约900字节）
4. **音色不匹配**: 检查音色名称是否正确

### 调试方法

1. 查看浏览器控制台日志
2. 检查服务器端日志
3. 验证环境变量配置
4. 测试 API 端点连通性

## 更新日志

- **v1.0.0**: 初始集成，支持基本的 Gemini TTS 功能
- 支持单句和对话合成
- 集成到 shadowing review 页面
- 添加音色配置和智能分配

## 未来计划

- [ ] 支持更多语言
- [ ] 添加音色试听功能
- [ ] 支持自定义音色参数
- [ ] 添加批量音色测试工具
- [ ] 集成音色质量评估
