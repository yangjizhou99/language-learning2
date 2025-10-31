# Cloze‑Shadowing 做题界面代码审阅与优化建议

更新时间：2025-10-31

范围：`src/app/practice/cloze-shadowing/[articleId]/page.tsx`

---

**概览**
- 该页实现了基于句级挖空的 Cloze‑Shadowing 练习：加载题面、作答、即时判定、整篇提交、展示答案与汇总。
- 整体结构清晰，状态拆分合理，具备「仅未完成」过滤、进度条与底部浮动操作条等良好体验。
- 存在若干可用性、可访问性、性能与可维护性方面的改进空间，可作为后续优化方向。

---

**主要流程梳理**
- 加载数据：`loadAll()` 拉取整篇数据并初始化状态（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:87`）。
- 选择作答：`handleSelect` 逐项追加，达到 `num_correct` 时触发即时判定（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:129`）。
- 即时判定：`/api/cloze-shadowing/check` 判定并更新反馈态（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:167`）。
- 提交整篇：逐句 `attempt` + 汇总 `finish` + 拉取 `solution`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:251`）。
- 展示答案：整篇原文、翻译和逐句对照（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:449`）。

---

**发现与问题**
- 交互与可用性
  - 无快速撤销操作：当前取消重选被禁用，但仍保留未使用的清除逻辑（`handleClearOne`）（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:185`）。
  - 键盘可达性不足：无法用快捷键选项/切换/跳转（移动端可长按撤销、桌面端可提供快捷键）。
  - 音频融入度不够：练习阶段无逐句或全文音频控制，仅在答案页展示音频（`solution.audio_url`）。
  - 错误引导弱：即时判错仅变色，无引导「重试/提示」策略（如多选时提示剩余数量、错误高亮、可选提示数）。
  - 进度跳转：顶部圆点导航友好，但「仅未完成」模式下点击已完成需要先退出再滚动，流畅性可再优化（目前已有处理，仍可细化动效/定位）。

- 可访问性（a11y）
  - 进度条缺少语义属性：建议添加 `role="progressbar"`、`aria-valuenow/max`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:336`）。
  - 反馈缺少读屏播报：即时判定可通过 `aria-live="polite"` 向读屏播报「正确/再试一次」（`renderSentenceInline` 区域，`src/app/practice/cloze-shadowing/[articleId]/page.tsx:203`）。
  - 选项按钮可增加 `aria-pressed` 状态，选中/未选中更易于理解（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:234`）。

- 性能
  - 长列表渲染：句子多、选项多时页面渲染成本高；建议对「句子卡片」和「选项列表」做虚拟化或分段渲染（`renderOptions`，`src/app/practice/cloze-shadowing/[articleId]/page.tsx:225`）。
  - 事件引用稳定性：`handleSelect`/`handleDotClick` 等可 `useCallback`，配合子组件拆分减少不必要重渲染。
  - 批量提交时并发请求量大：整篇 `Promise.all` 逐句 `attempt`，题量大时服务端压力和失败概率上升（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:267`）。
  - CSS 动画定义在组件内的 `<style jsx>`：频繁挂载/卸载会重复注入，建议迁移到全局样式或 `@layer utilities`。

- 可维护性
  - 未使用状态：`animatingOut`、`shaking` 定义但未设置（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:33`, `:34`, `:35`）。
  - 未使用函数：`handleClearOne` 无引用（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:185`）。
  - 重复逻辑：`needCountForSentence` 分散使用，可抽成 util 并在渲染/提交/判定处统一引用（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:39`）。
  - 数据规范化：答案对照仅 `trim().toLowerCase()`，对日/韩/中等语种可考虑 `NFKC` 规范化、半/全角统一、假名/音读兼容等。

- 异常与持久化
  - 错误处理：练习页出错仅展示错误文案，缺少「重试/刷新」入口与快速回滚（对齐列表页的「重试」按钮，`/practice/cloze-shadowing/page.tsx` 已实现）。
  - 进度持久化：作答中途刷新会丢失，建议以 `articleId` 为 key 缓存 `answersByIndex`，并在 `loadAll()` 后尝试恢复。

---

**改进建议（按优先级）**

P0｜本周可落地的快速收益
- 移除死代码/状态（减少心智负担）
  - 删除 `animatingOut`、`shaking` 状态与相关样式引用，或在即时判错时真正赋值使用（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:33`, `:34`, `:35`）。
  - 删除未使用的 `handleClearOne`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:185`）。
- a11y 加固
  - 进度条添加语义属性与文本替代（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:336`）。
  - 选项按钮添加 `aria-pressed`，即时反馈通过 `aria-live` 播报（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:234`, `:203`）。
- 快速撤销与键盘导航
  - 提供「撤销最近一次选择」：支持键盘 `Backspace` 或 UI 上的小型撤销按钮；如保留「禁止重选」策略，可仅允许在达到所需项数前撤销。
  - 数字快捷键选择当前题的第 N 个选项；`Enter` 跳到下一未完成；`Space` 播放/暂停音频。
- 错误/空态引导
  - 为练习页加入与题库页一致的「重试」按钮和 loading skeleton。
- 样式组织
  - 将 `<style jsx>` 中的动画迁移到全局 `@layer utilities`，减少重复注入与样式抖动。

P1｜近期优化（1–2 周）
- 组件拆分与重渲染控制
  - 拆分为 `SentenceCard`、`OptionsGrid`、`FooterBar`、`HeaderProgress` 等子组件；核心回调 `useCallback`；选项项 `memo` 化。
  - 选项 `key` 优先使用稳定值（`opt`）而非索引 `i`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:235`）。
- 列表/选项虚拟化
  - 句子多时对卡片列表做虚拟滚动（如 `react-window`）；选项非常多时分组/分屏或虚拟化。
- 批量提交接口
  - 新增批量 `attempts` 接口（一次提交所有句子的选择），减少并发与失败面；保留逐句接口作为降级路径（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:267`）。
- 练习期音频
  - 顶部提供全文音频控件；若后端有句级时间戳，支持逐句播放与自动下一句。
- 进度持久化
  - 将 `answersByIndex` 以 `localStorage`（或用户草稿表）缓存，进入页面时尝试恢复；提交成功后清理缓存。

P2｜中期增强（2–4 周）
- 规范化与判定策略
  - 引入文本规范化（`NFKC`、全/半角、片/平假名、大小写/标点同化）；可配置「宽松/严格」判定模式。
- 引导式学习
  - 错误 2 次后允许查看提示（首字母/字数/同义项），或允许「揭示其中一个正确项」。
- 可观测性
  - 埋点：每句耗时、正确率、提示使用率、撤销率；为题目推荐/排序提供数据闭环。
- i18n
  - 界面文案改造为多语言可配置，适配非中文 UI。

---

**具体落地点位（代码参考）**
- 选择与判定
  - `handleSelect`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:129`）：用 `useCallback` 包裹；达到 `need` 时触发 `checkImmediateFeedback` 已合理，可在错误时设置 `shaking[sIndex]=true` 并在 200ms 后复位。
  - `checkImmediateFeedback`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:167`）：错误时将该卡片 `aria-live` 区域播报「再试一次」。
- 渲染
  - `renderSentenceInline`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:193`）：为空格下划线占位添加 `aria-label` 描述，例如「请输入填空」。
  - `renderOptions`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:225`）：按钮加入 `aria-pressed={active}`；考虑将 `key` 从 `i` 改为 `opt`（若后端保证唯一）。
- 提交
  - `submitAll`（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:251`）：改造为调用「批量提交」接口，并针对失败做重试/回退；提交成功后拉取 `solution` 并清空本地草稿。
- 进度/导航
  - 头部进度条（`src/app/practice/cloze-shadowing/[articleId]/page.tsx:336`）：加 `role="progressbar"`、`aria-valuenow`、`aria-valuemax`；圆点按钮已具 `aria-label`，可在「仅未完成」时增加辅助提示。

---

**实施路线图**
- Sprint 1（1–2 天）
  - 清理死代码（P0）；a11y 补齐；错误/加载态统一；本地进度持久化。
- Sprint 2（3–5 天）
  - 组件拆分、回调稳定化、虚拟化；批量提交接口与前端适配；练习页加入全文音频。
- Sprint 3（1–2 周）
  - 判定规范化、引导式提示与埋点体系；多语言 UI。

---

**附注**
- 若后端暂不具备句级音频切片/时间戳，可先提供全文播放与快捷键，后续按需扩展。
- 对于「禁止重选」策略，可在教学设计层面确认：是否允许在达到所需项数前撤销（更贴近学习过程），或维持刚性一次性选择（更贴近测验场景）。

