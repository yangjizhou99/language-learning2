# Shadowing ACU（最小可理解块）实施方案 v1

本方案在现有 Shadowing 流程上新增“最小可理解块（ACU, Atomic Comprehension Unit）”，实现：
- 管理端审核页支持对草稿一键批量生成 ACU（DeepSeek）。
- 发布后 ACU 数据随 notes 同步到题库。
- 学习端练习页（步骤 3）默认进入“ACU 点击选词”模式，保留原“自由框选”作为备选。
- 学习端可点击选择多个 ACU 块并合并为一段，弹出确认框：“已选择的文本：… 确认添加到生词本 / 取消”。

本文档为代码实施指引，覆盖数据结构、API、UI 改造、失败兜底与质检要点。

---

## 目标与范围

- 覆盖语言：`zh` / `en` / `ja` / `ko`（全部语言）。
- 对话体裁：按“每行 = 一个句子”切分后再做 S1/S2。
- 仅使用 DeepSeek 提供商与模型：`provider=deepseek`，`model=deepseek-chat`。
- ACU 结果仅先落到草稿 `notes`；发布时由现有发布逻辑原样复制到题库 `notes`。
- 不生成/显示“为何不可再拆”的解释信息。
- 失败兜底按“重试→回退→整句”的策略执行（见下）。

---

## 数据结构（notes）

发布与草稿统一采用 notes 承载 ACU 数据：

- `notes.acu_marked: string` — 整文插入 `*` 的最终 ACU 版本（S2 成果）。
- `notes.acu_units: Array<{ span: string; start: number; end: number; sid: number }>`
  - `span`: ACU 文本片段。
  - `start`/`end`: 在“全文原文（不含星号）”上的绝对偏移（半开区间）。
  - `sid`: 该片段所属句子编号（从 1 开始）。

注意：
- 去除 `*` 后必须与原文完全一致（本地校验）。
- 发布逻辑已经会将 `notes` 一并复制到 `shadowing_items`，无需额外改表。

---

## 端到端流程

1) 管理端在审核页批量生成 ACU（DeepSeek）→ notes 落库。
2) 审核详情页可单个草稿生成/刷新与预览 ACU。
3) 发布到题库后，学习端步骤 3 默认读取 ACU 渲染，支持点击选择多个块合并，确认后添加到生词本；可切换回“自由框选”。

---

## 句子切分策略

- 对话体裁：一行就是一句（`A: …`/`B: …`），不再做内部句号切分。
- 非对话体裁：各语言使用常见句末标点切分，尽量“宽松保守”。
  - `zh`：按 `。！？；` 等进行分句。
  - `en`：按 `.` `!` `?` 与空白进行分句（保留缩写边界，尽量不误切）。
  - `ja/ko`：按 `。`/`。`/`？`/`！` 与换行进行分句。
- 记录 `sid` 与每句在全文的 `sentenceAbsStart`。

---

## LLM 两阶段算法

- S1 过度细分（Over-Seg）：逐句请求，尽可能细地在句子中插入 `*` 作为边界。
- S2 最小化合并（Minimality Merge）：对 S1 结果逐句判断，仅当“再拆会伤理解”时才合并（移除部分 `*`）。

仅做“插 `*`/去 `*`”两种操作，不返回位置；位置全部由本地通过 `*` 还原与计算。

### 提示词（S1）

System
```
你是“学习最小单元”划分器。请在【原句】中尽可能细地插入星号*作为边界，且：
- 只能插入*；不得改动任何原字符（包括空格/标点/大小写）。
- * 只能插在两个原字符之间；不得出现在句首/句尾；不得出现连续**。
- 中文到“词级”，必要时按语素进一步；英文到词级并拆缩略/所有格；日/韩到形态素级（助词、词尾单独成块）。
- URL/邮箱/代码/公式/数字+单位视为整体，不在内部插*。
- 只输出插*后的句子，禁止任何解释。
```

User
```
语言: <zh|en|ja|ko>
原句: "<原句原文>"
```

### 提示词（S2）

System
```
你是“最小可理解块”裁判。输入为句子的“过度细分版”（已插*）。
任务：仅当“保留当前切分会损伤理解”（即再拆会导致片段无法独立解释/破坏固定搭配/名词化/短语动词等）时，才合并相邻片段；否则保持细分。
要求：
- 只能去掉某些*（进行合并）；不得改动任何原字符（含空格/标点/大小写），不得增加新*。
- 输出仍是插*后的句子（最小可理解块级别）。
- 绝不输出说明文字。
判断依据（示例）：
- 固定搭配/短语动词/惯用语：look up, take off, ～という、〜하기, 〜している 等 → 合为一块。
- 名词化结构：中文“V+结果/程度/抽象名词”、日语连体+名、韩语[连体形+것/수(+格助词)] → 合为一块。
- 名词+格助词（韩/日）、功能词链（て/で/は/が/を/に 等）通常应与核心词保持最小可理解边界，若拆后无法独立说明则合并。
- URL/邮箱/代码/公式/数字+单位保持整体。
```

User
```
过度细分版: "<来自S1的插*句子>"
```

---

## 校验与解析（本地）

TypeScript（前后端共用逻辑）：

```ts
export function validateMarkedSentence(original: string, marked: string) {
  if (marked.startsWith('*') || marked.endsWith('*') || /\*\*/.test(marked)) return false;
  return marked.replace(/\*/g, '') === original;
}

export function parseUnits(marked: string, sentenceAbsStart: number) {
  const parts = marked.split('*');
  const units: Array<{ span: string; start: number; end: number }> = [];
  let offset = 0;
  for (const p of parts) {
    const start = sentenceAbsStart + offset;
    const end = start + p.length;
    units.push({ span: p, start, end });
    offset += p.length;
  }
  return units;
}
```

---

## 失败与重试策略

- S1/S2 任一步 `validateMarkedSentence` 失败：自动重试 1 次（相同提示词与原句）。
- 若仍失败：回退使用上一步结果；若 S1 也不可用，则“整句一个块”。
- API 级重试：DeepSeek 请求失败（超时/429/5xx）→ 指数退避重试（最多 2 次）。

---

## 服务端 API 设计

新建：`src/app/api/admin/shadowing/acu/segment/route.ts`（POST）

请求体：
```json
{
  "id": "<draftId-可选>",
  "text": "<原文>",
  "lang": "zh|en|ja|ko",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "concurrency": 8,
  "retries": 2
}
```

处理流程：
- 标准化文本；对话体裁按行分句，否则按语言规则分句。
- 记录 `sid` 与句子在全文的 `sentenceAbsStart`。
- 逐句串行或有限并发执行 S1→S2；对每句进行 `validateMarkedSentence` 校验与兜底。
- 合并所有句子的 S2 结果为整文 `acu_marked`；用 `parseUnits` 计算 `acu_units`（带 `sid`）。
- 若传入 `id`，则更新 `shadowing_drafts.notes`：写入 `acu_marked` 与 `acu_units`。

返回：
```json
{
  "success": true,
  "acu_marked": "...",
  "units": [{"span":"…","start":0,"end":3,"sid":1}],
  "sentenceCount": 12,
  "provider": "deepseek",
  "model": "deepseek-chat"
}
```

安全与限制：
- 仅允许管理员调用（与其他 admin 路由一致 `requireAdmin`）。
- 对文本长度与 tokens 做保护：超长可分批按段落处理或限制为 5 万字符以内（与发布入库约束一致）。

---

## 管理端审核页改造（批量）

文件：`src/app/admin/shadowing/review/page.tsx`

- 在“批量操作”区新增按钮：`生成 ACU`（与“随机生成/清除音频/发布/撤回/删除”同级）。
- 交互复用现有的并发/重试/节流显示与逻辑（与 TTS 批处理一致），参数默认：并发 6~18、重试 2、节流 200ms。
- 对选中的草稿：依次调用 `/api/admin/shadowing/acu/segment`（传 `id`、`text`、`lang`）。
- 成功后无需再显式 PUT notes（API 已落库），仅刷新列表与 toast 成功数。

---

## 管理端详情页改造（单个）

文件：`src/app/admin/shadowing/review/[id]/page.tsx`

新增“ACU 预处理”卡片：
- 按钮：“生成/刷新 ACU”（POST `/api/admin/shadowing/acu/segment`）。
- 预览区：展示 `notes.acu_marked` 渲染效果（把 `*` 间切块上色）。
- 保存：无需额外保存（API 已落库），提供“覆盖/回退为整句”两项辅助按钮（可选）。

---

## 学习端（步骤 3）改造

文件：`src/components/shadowing/ChineseShadowingPage.tsx`

- 在步骤 3 位置（现有两处 `SelectablePassage` 引用），优先检测 `currentItem.notes?.acu_units`：
  - 若存在 → 渲染 `AcuText` 组件（新建）。
  - 若不存在 → 回退到现有 `SelectablePassage`（原自由框选模式）。
- 增加“模式切换”开关（仅步骤 3 显示）：
  - `ACU 选词`（默认）/ `自由框选`（备选）。

### 新组件：`AcuText`

职责：把整文按 `acu_units` 渲染为可点击块；支持多选→合并→确认添加到生词本。

- 输入：
  - `text: string`（原文）
  - `lang: 'zh'|'en'|'ja'|'ko'`
  - `units: Array<{ span:string; start:number; end:number; sid:number }>`
  - `onConfirm: (mergedText: string, context: string) => void`
- 交互：
  - 点击块 → 选中/取消选中（仅允许同句 `sid`、且要求连续块合并；若跨句或不相邻则提示“请选择同一句的相邻片段”）。
  - 选中后在底部或浮层显示：
    - `已选择的文本：<merged>`
    - 按钮：`确认添加到生词本` / `取消`
  - 点击“确认”→ 调用 `onConfirm(merged, context)`
    - `context` 取该 `sid` 句子的完整文本（按分句范围截取）。
  - 点击“取消”→ 清空选择态。
- 样式：
  - 未选中：浅色边框；选中：高亮背景与边框。
  - 与现有“已选择/生词本词条”的高亮不冲突（优先选中态显示）。
- 集成：
  - `onConfirm` 内部复用已有 `handleWordSelect(merged, context)` → 走 `/api/shadowing/session` 落库（与现有自由框选一致）。

---

## 质量与边界处理

- 连续性：合并仅允许同一句、相邻 ACU 块（避免跨句选择）。
- 去星一致性：`acu_marked.replace(/\*/g, '')` 必须与原文相等。
- 位置计算：`start/end` 基于全文绝对偏移，供 UI 与后续对齐使用。
- 超长文本：对“生成 ACU”提供显式提示与拒绝（大于 50,000 字符），避免 LLM 费用与失败率。
- notes 限长：与发布逻辑一致，注意不要超过 URL/文本字段长度约束。

---

## 并发与性能

- DeepSeek 并发：管理端批量调用沿用现有并发/节流/重试组件参数；API 端对句内 S1/S2 可使用小并发（如 8）。
- 重试：HTTP 失败指数退避（最多 2 次）。
- 缓存：v1 不做跨文档缓存；生成结果写入 notes 作为“长期缓存”。

---

## 开发清单（按优先顺序）

1) 新增 API：`/api/admin/shadowing/acu/segment`（DeepSeek 实现 S1/S2、校验、notes 落库）。
2) 管理端审核页：批量按钮“生成 ACU”，复用并发面板与进度。
3) 审核详情页：单个草稿“ACU 预处理”卡片（生成与预览）。
4) 学习端步骤 3：新增 `AcuText`，默认使用 ACU 选词；支持多选合并并确认添加到生词本；保留自由框选的切换开关。
5) 兜底链路与边界处理（重试、回退整句、长度限制、跨句选择拦截）。

---

## 验收与回归检查

- 管理端：
  - 批量对 10+ 草稿生成 ACU，进度与失败重试正常；`notes.acu_*` 正确落库。
  - 详情页生成/预览正常；发布后在题库条目上能看到 `notes.acu_*`。
- 学习端：
  - 步骤 3 默认 ACU 选词；点击多个相邻块后出现“已选择的文本”确认浮层；确认后生词成功落库并同步到“本次选中/之前的生词”列表。
  - 切换到自由框选后仍可按旧逻辑选词并落库。
- 兼容性：无 ACU 的旧内容自动回退到自由框选；移动端点击操作顺畅。

---

## 示例

- 韩语：
  - 原句：`저는 사과를 먹는 것을 좋아해요.`
  - S1：`저*는* 사과*를* 먹*는* 것*을* 좋아하*어요*.`
  - S2：`저는* 사과를 먹는 것을* 좋아해요.`
- 中文：
  - 原句：`我昨天在图书馆阅读机器学习导论。`
  - S1：`我*昨天*在*图书馆*阅读*机器*学习*导论*。`
  - S2：`我*昨天*在*图书馆*阅读*机器学习导论*。`
- 英语：
  - 原句：`He looked up the term quickly.`
  - S1：`He* looked* up* the* term* quickly*.`
  - S2：`He* looked up* the* term* quickly*.`

---

## 相关文件（参考）

- 管理端审核列表页：`src/app/admin/shadowing/review/page.tsx`
- 管理端审核详情页：`src/app/admin/shadowing/review/[id]/page.tsx`
- 发布到题库：`src/app/api/admin/shadowing/drafts/[id]/route.ts`（notes 原样复制）
- 学习页（中文版容器，含步骤引导与选词逻辑）：`src/components/shadowing/ChineseShadowingPage.tsx`
- 会话落库 API（picked_preview 等）：`src/app/api/shadowing/session/route.ts`

> 实施建议：先完成 API 与管理端批量入口，再接入学习端 ACU 选词，最后完善细节（移动端点击、相邻合并限制、提示文案）。

