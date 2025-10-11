# DeepSeek Chat 默认设置修改总结

## 修改概述

将所有 API 和前端组件的默认 AI 提供商和模型从 OpenRouter/OpenAI 改为 DeepSeek Chat。

## 修改的文件

### API 路由文件

1. `src/app/api/admin/shadowing/generate-from-subtopics/stream/route.ts`
   - provider: 'gemini' → 'deepseek'
   - model: 'gemini-1.5-flash' → 'deepseek-chat'

2. `src/app/api/admin/shadowing/subtopics/generate/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

3. `src/app/api/admin/shadowing/themes/generate/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

4. `src/app/api/admin/providers/models/route.ts`
   - 默认 provider: 'openrouter' → 'deepseek'

5. `src/app/api/admin/batch/stream/route.ts`
   - 默认 provider: 'openrouter' → 'deepseek'
   - 默认 model: 条件选择 → 'deepseek-chat'

6. `src/app/api/admin/shadowing/generate/stream/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

7. `src/app/api/admin/shadowing/generate/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

8. `src/app/api/admin/drafts/[id]/suggest-text/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

9. `src/app/api/admin/drafts/[id]/suggest-keys/route.ts`
   - provider: 'openrouter' → 'deepseek'
   - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

10. `src/app/api/admin/drafts/ai/route.ts`
    - provider: 'openrouter' → 'deepseek'
    - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

11. `src/app/api/admin/alignment/generate/stream/route.ts`
    - provider: 'openrouter' → 'deepseek'
    - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

12. `src/app/api/admin/alignment/generate/route.ts`
    - provider: 'openrouter' → 'deepseek'
    - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

13. `src/app/api/alignment/roleplay/turn/route.ts`
    - provider: 'openrouter' → 'deepseek'
    - model: 'openai/gpt-4o-mini' → 'deepseek-chat'

14. `src/app/api/vocab/explain/route.ts`
    - provider: 'openrouter' → 'deepseek'
    - model: 'anthropic/claude-3.5-sonnet' → 'deepseek-chat'

### 前端组件文件

1. `src/app/admin/shadowing/ai/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

2. `src/app/admin/shadowing/subtopics-gen/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

3. `src/app/practice/alignment/[id]/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

4. `src/app/admin/drafts/[id]/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

5. `src/app/admin/drafts/batch/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

6. `src/app/admin/batch-gen/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

7. `src/app/admin/articles/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'
   - 默认 model: 'openai/gpt-4o-mini' → 'deepseek-chat'

8. `src/app/admin/alignment/ai/page.tsx`
   - 默认 provider: 'openrouter' → 'deepseek'

9. `src/app/admin/shadowing/review/page.tsx`
   - 翻译模型: 'openai/gpt-4o-mini' → 'deepseek-chat'

10. `src/app/admin/shadowing/review/[id]/page.tsx`
    - 翻译模型: 'openai/gpt-4o-mini' → 'deepseek-chat'

## 影响范围

### 功能影响

- 所有 AI 生成功能现在默认使用 DeepSeek Chat
- 包括：内容生成、翻译、建议、评分等
- 用户仍可手动选择其他提供商和模型

### 性能影响

- DeepSeek Chat 通常比 OpenRouter 更便宜
- 响应速度可能有所不同
- 需要确保 DEEPSEEK_API_KEY 环境变量已设置

### 兼容性

- 所有现有功能保持兼容
- 用户界面和操作流程不变
- 只是默认选择发生变化

## 注意事项

1. **环境变量**：确保 `DEEPSEEK_API_KEY` 已正确设置
2. **模型可用性**：DeepSeek Chat 模型需要有效的 API 密钥
3. **回滚**：如需回滚，可以恢复这些文件的原始默认值
4. **测试**：建议测试所有 AI 功能确保正常工作

## 验证方法

1. 检查环境变量：`echo $DEEPSEEK_API_KEY`
2. 测试 AI 生成功能
3. 检查管理页面默认选择
4. 验证翻译功能
5. 测试批量生成功能

修改完成时间：$(date)
