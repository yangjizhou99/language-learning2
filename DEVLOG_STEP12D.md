# Step 12D: 两段式入库 + OpenRouter 接入 + 模型选择

## 🎯 完成功能

### 1. 草稿审核流水线

- **AI 先产草稿** → **管理员严格复核** → **才入正式题库**
- 新增 `article_drafts` 表，包含状态管理（pending/needs_fix/approved/published/rejected）
- 支持 AI 生成和手动录入两种草稿来源

### 2. 多 AI 提供商支持

- **统一 AI 客户端**：支持 OpenRouter、DeepSeek、OpenAI 三选一
- **OpenRouter 集成**：动态拉取模型列表，支持多种最新模型
- **模型选择界面**：管理员可在 UI 中选择 Provider 和具体模型

### 3. 新增 API 端点

- `GET /api/ai/models` - 获取可用模型列表（支持 OpenRouter 动态拉取）
- `POST /api/admin/drafts/ai` - AI 生成草稿
- `POST /api/admin/drafts/manual` - 手动创建草稿
- `GET /api/admin/drafts/list` - 草稿列表
- `GET /api/admin/drafts/[id]` - 草稿详情
- `PATCH /api/admin/drafts/[id]` - 修改草稿
- `POST /api/admin/drafts/[id]/publish` - 发布草稿到正式题库

### 4. 管理员 UI

- `/admin/drafts` - 草稿箱（按状态筛选）
- `/admin/drafts/[id]` - 草稿详情页（可编辑、审核、发布）
- `/admin/articles` - 更新 AI 生成面板，支持模型选择和草稿生成

## 🔧 技术实现

### 数据库结构

```sql
-- 草稿表
CREATE TABLE article_drafts (
  id uuid PRIMARY KEY,
  source text NOT NULL,           -- 'ai'|'manual'|'url'
  lang text NOT NULL,
  genre text NOT NULL,
  difficulty int NOT NULL,
  title text NOT NULL,
  text text NOT NULL,
  ai_provider text,               -- 'openrouter'|'deepseek'|'openai'
  ai_model text,                  -- 模型 ID
  ai_params jsonb,                -- 生成参数
  ai_usage jsonb,                 -- 使用统计
  keys jsonb,                     -- 预生成的答案键
  cloze_short jsonb,              -- 短版完形填空
  cloze_long jsonb,               -- 长版完形填空
  status text DEFAULT 'pending', -- 审核状态
  created_by uuid,
  published_article_id uuid       -- 发布后的正式文章 ID
);
```

### 统一 AI 客户端

```typescript
// src/lib/ai/client.ts
export async function chatJSON({
  provider,
  model,
  messages,
  temperature,
  response_json,
}: ChatJSONArgs) {
  // 统一处理 OpenRouter/DeepSeek/OpenAI 三种 API
}
```

### OpenRouter 集成

- **API Key**: `OPENROUTER_API_KEY`
- **请求头**: 包含 `Authorization: Bearer <key>` 和可选的 `HTTP-Referer`、`X-Title`
- **模型列表**: 从 `https://openrouter.ai/api/v1/models` 动态获取
- **对话端点**: `https://openrouter.ai/api/v1/chat/completions`

## 📋 使用流程

### 1. 环境配置

```bash
# 复制环境变量模板
cp env.example.bak .env.local

# 配置 API Keys
OPENROUTER_API_KEY=sk-or-v1-your-key
OPENROUTER_SITE_URL=https://your-domain.com
OPENROUTER_SITE_NAME=Your App Name
```

### 2. 数据库迁移

```bash
# 运行新的迁移文件
supabase db push
```

### 3. 管理员操作流程

1. **生成草稿**：
   - 访问 `/admin/articles`
   - 选择「AI 生成」标签页
   - 选择 Provider（推荐 OpenRouter）
   - 从下拉菜单选择具体模型
   - 填写语言、体裁、难度、主题等参数
   - 点击「生成草稿」

2. **审核草稿**：
   - 访问 `/admin/drafts`
   - 查看 pending 状态的草稿列表
   - 点击草稿标题进入详情页
   - 编辑标题和正文（如需要）
   - 查看预生成的答案键和 Cloze 摘要
   - 点击相应按钮：标记为已审/需要修改/拒绝

3. **发布到正式库**：
   - 在草稿详情页点击「发布 → 正式题库」
   - 系统自动将内容写入 `articles`、`article_keys`、`article_cloze` 三表
   - 草稿状态更新为 `published`

### 4. 学习者使用

- 发布后的文章自动出现在 `/practice/wideread` 等练习页面
- 学习者可正常进行各种练习

## 🌟 优势特点

1. **质量保证**：AI 生成 + 人工审核双重保障
2. **灵活模型选择**：OpenRouter 提供多种最新模型
3. **完整工作流**：从生成到发布的完整管理界面
4. **安全性**：草稿和正式库分离，避免未审核内容泄露
5. **可追溯性**：记录 AI 提供商、模型、参数等元信息
6. **高效性**：管理员可批量审核，一键发布

## 🔗 相关文档

- [OpenRouter API 文档](https://openrouter.ai/docs)
- [OpenRouter 模型列表](https://openrouter.ai/models)
- 草稿状态说明：
  - `pending`: 待审核
  - `needs_fix`: 需要修改
  - `approved`: 已审核通过
  - `published`: 已发布到正式库
  - `rejected`: 已拒绝
