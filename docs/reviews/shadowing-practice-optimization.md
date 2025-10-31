# Shadowing 跟读练习界面代码审阅与优化建议
更新时间：2025-10-31

范围：
- `src/app/practice/shadowing/page.tsx`
- `src/components/shadowing/*`

---

**概览**
- 页面由 `src/app/practice/shadowing/page.tsx` 动态加载统一实现（`ChineseShadowingPage`），在客户端渲染中承载全部交互。
- 主体逻辑集中在 `src/components/shadowing/ChineseShadowingPage.tsx`，包含题库加载、筛选与搜索、分步骤跟读流程（盲听 → 生词 → 原文+翻译 → 录音评分）、音频控制、词汇查询与导入、生词解释缓存等。
- 列表区域已使用虚拟滚动（`react-virtuoso`），异步请求具备超时、取消与简易缓存，整体功能完整，移动端体验考虑较多。
- 仍存在可维护性、交互一致性、性能细节与可访问性方面的优化空间。

---

**主要流程梳理**
- 入口与动态加载：`src/app/practice/shadowing/page.tsx:10` 通过 `next/dynamic` 关闭 SSR 并提供 loading 占位。
- 数据加载：
  - 题库：`src/components/shadowing/ChineseShadowingPage.tsx:1510` `fetchItems()` 带条件/缓存/超时/Abort 控制加载 `/api/shadowing/catalog`。
  - 用户信息：`src/components/shadowing/ChineseShadowingPage.tsx:860` 拉取 `profiles.native_lang`，用于界面语言与默认翻译语言。
  - 主题/小主题：`loadThemes`/`loadSubtopics` 同步筛选参数加载并校验当前选择有效。
- 交互与筛选：
  - URL 与本地持久化：语言/等级/练习状态与 URL 双向同步并持久化（防抖 `200ms`）。
  - 搜索：`useDeferredValue` 降噪，列表 `useMemo` 按状态与标题排序（`Lx.编号.标题`）。
  - 词汇解释：`src/components/shadowing/ChineseShadowingPage.tsx:316` `searchVocabWithCache()` 使用内存+sessionStorage 缓存与请求去重。
- 学习流程：
  - 分步骤 gating（盲听/生词/原文+翻译/录音评分），关键按钮短暂高亮引导。
  - 音频：`EnhancedAudioPlayer` 分段播放、倍速、快进/后退（`src/components/shadowing/EnhancedAudioPlayer.tsx`）。
  - 录音与评分：完成时 `unifiedCompleteAndSave()` 保存 session、导入生词、记录尝试并清缓存（`src/components/shadowing/ChineseShadowingPage.tsx:3133`）。

---

**发现与问题**
- 交互与一致性
  - `alert()` 与 `toast` 混用：多处完成/错误提示使用 `alert`（如 `src/components/shadowing/ChineseShadowingPage.tsx:3318`, `:2923`），其余位置用 `sonner`。建议统一使用 `toast`，避免阻塞 UI，风格一致。
  - 首次词汇查询延迟：为减压在页面加载 2 秒后才允许搜索（`src/components/shadowing/ChineseShadowingPage.tsx:386`），但对快速操作的用户略显迟滞。可基于可视区触发（`IntersectionObserver`）或“首次 hover 立即+后续防抖”。
  - 完成后刷新：完成保存后以 `setTimeout(500ms)` 清理缓存再刷新列表（`src/components/shadowing/ChineseShadowingPage.tsx:3193`），偶发带来状态不一致。建议服务端返回最新汇总或主动推送/etag 校验。
  - 统一入口名：实际对多语言统一实现，组件名仍为 `ChineseShadowingPage`，易引起误解（建议更名为 `ShadowingPageUnified`）。
  - 入口 Loading 占位存在字符编码异常（`src/app/practice/shadowing/page.tsx:10`）。

- 性能
  - 组件体量过大：`src/components/shadowing/ChineseShadowingPage.tsx` 超 5k 行，状态/副作用/渲染耦合，影响可维护性与渲染开销。
  - 批量解释请求：`batchFetchExplanations` 对每个词调用 `/api/vocab/search` 并 `Promise.all` 并发，词汇多时放大抖动与失败面（建议限制并发或提供后端批量查询接口）。
  - 词汇缓存 key 未区分语种：目前切换语言时整体清空（`lang` effect），可直接将 `lang` 纳入 `cacheKey`，避免全量清理带来的“冷启动”。
  - 虚拟滚动细节：已用 `react-virtuoso`（`src/components/shadowing/ChineseShadowingPage.tsx:3927`），建议确认 `itemKey` 稳定与 `overscan` 配置，防止滚动频繁 re-mount。
  - 音频监听 effect 依赖 `audioRef.current`：`src/components/shadowing/EnhancedAudioPlayer.tsx:137` 使用该依赖不稳定，推荐依赖 `audioUrl` 或使用 ref 回调。

- 可访问性（a11y）
  - 操作按钮的语义与可达性有提升空间：快进/后退/重置等按钮可补充 `aria-label` 与 `title` 一致性；进度/分步导航可考虑 `aria-current` 与 `aria-live` 播报关键反馈。
  - 词汇解释悬停区域：为触屏设备增加显式触发方式，提升可达性与可理解度。

- 异常与健壮性
  - 401 处理已考虑 refresh，但 `refreshSession` 失败时未提供用户可见重试/重新登录 CTA。
  - 录音保存兜底：完成前尝试上传“未保存录音”，若失败仅 `console.warn`（`src/components/shadowing/ChineseShadowingPage.tsx:3109`），建议 toast 明示并允许稍后重试。

- 代码卫生
  - 存在 0 字节异常文件：`src/components/shadowing/ChineseShadowing����ʱʱ��Page.tsx`，建议清理。
  - `simple-analysis.tsx` 与 `performSimpleAnalysis` 存在功能重复，建议抽成共享 util（`src/app/practice/shadowing/simple-analysis.tsx:1` 与 `src/components/shadowing/ChineseShadowingPage.tsx:2992`）。

---

**改进建议（按优先级）**

P0｜快速收敛（本周）
- 统一提示机制
  - 将所有 `alert()` 改为 `toast` 成功/错误提示；如完成保存、导入失败、无录音等（参考 `src/components/shadowing/ChineseShadowingPage.tsx:3318`, `:3443`, `:2923`）。
- Loading 与编码
  - 修复入口 Loading 占位字符异常（`src/app/practice/shadowing/page.tsx:10`）。
- a11y 补齐
  - 为快进/后退/重置/倍速按钮补充一致的 `aria-label`；录音/保存/完成按钮增加 `aria-busy`/`aria-disabled` 联动。
- 代码卫生
  - 删除异常 0 字节文件；为统一实现组件更名或添加 TODO 说明。

P1｜近期优化（1–2 周）
- 模块化与状态拆分
  - 拆分 `ChineseShadowingPage` 为：数据加载与筛选（`useShadowingData`）、词汇与解释（`useVocabSelection`）、音频控制（`useAudioControl`）、练习流程（`usePracticeFlow`）。减少大组件重渲染面，便于单元测试。
- 词汇解释批量化
  - `batchFetchExplanations` 引入并发限制（如 `p-limit(4)`），并考虑新增 `/api/vocab/bulk_search`，采用单次请求带回多词解释。
- 缓存 key 与命中率
  - `searchVocabWithCache` 将 `lang` 纳入 key，例如 `vocab:{lang}:{term}`，避免跨语言清缓存；控制 TTL 及最大条目数。
- 虚拟滚动细节
  - 确保列表项 `key` 稳定、设置合适 `overscan`，避免滚动时选中态或音频内联播放器被重置。
- 完成态刷新
  - `unifiedCompleteAndSave()` 返回后直接合并本地状态；若需刷新，优先带回最新统计或通过后端 invalidation 命中最新缓存，避免 `setTimeout` 兜底（`src/components/shadowing/ChineseShadowingPage.tsx:3179` 附近逻辑）。

P2｜中期增强（2–4 周）
- 体验与可用性
  - 录音与评分过程增加可见的进度提示与中断/重试；完成后提供非阻塞的结果提示区域（代替 `alert`）。
  - 键盘操作：空格播放/暂停、左右方向键快进/后退、`S` 切换步进，提升桌面端效率。
- 可观测性
  - 埋点：各步停留时长、播放次数、词汇选择/解释命中率、导入词数、评分成功率；为推荐排序与难度适配提供闭环数据。
- 架构与加载
  - 题库列表可改为 Server Component + Suspense 边界，将重交互区域保留为 Client，降低初始包体。
  - 文本切分/相似度计算等可移入 Web Worker，避免主线程卡顿（长文本/长对话场景）。

---

**具体落地点位（代码参考）**
- 入口与加载
  - Loading 占位修复：`src/app/practice/shadowing/page.tsx:10`（修正为标准文本/骨架屏）。
- 词汇解释与缓存
  - 缓存/去重：`src/components/shadowing/ChineseShadowingPage.tsx:316`（把 `lang` 纳入 key；可增加最大缓存条目与 LRU）。
  - 悬停解释：`src/components/shadowing/ChineseShadowingPage.tsx:1015`（触屏可添加点击触发；增加 `aria-live` 在解释更新时播报）。
- 列表与筛选
  - 题库加载：`src/components/shadowing/ChineseShadowingPage.tsx:1510`（失败与 401 刷新路径统一 toast 通知，并提供重试）。
  - 搜索与排序：`src/components/shadowing/ChineseShadowingPage.tsx:1715`（`useDeferredValue` 已使用，确认搜索索引 `searchIndex` 的 memo 化与分词开销）。
- 完成与持久化
  - 统一完成：`src/components/shadowing/ChineseShadowingPage.tsx:3133`（移除 `alert`，完成后 toast 汇总：录音数/生词数/分数；失败提供重试与反馈）。
- 音频控制
  - 依赖优化：`src/components/shadowing/EnhancedAudioPlayer.tsx:137`（避免 `audioRef.current` 作为依赖，改为 `audioUrl` 或 ref 回调）。
- 代码健康
  - 重复逻辑合并：`src/app/practice/shadowing/simple-analysis.tsx:1` 与 `src/components/shadowing/ChineseShadowingPage.tsx:2992`（抽至 `lib/shadowing/simpleAnalysis.ts`）。

---

**实施路线**
- Sprint 1（3–5 天）
  - 统一通知（toast 替换 alert）、入口 Loading 修复、异常文件清理、a11y 补齐、小范围重构（完成态刷新与 401/错误提示一致化）。
- Sprint 2（5–7 天）
  - 模块化拆分核心组件/状态、词汇解释批量化/限流、虚拟滚动细节、缓存 key 优化、完成态直返最新统计。
- Sprint 3（2 周）
  - Web Worker 化文本分析、可观测性埋点体系、Server Component 引入与 Suspense 切分。

---

**附注**
- 现有实现对移动端体验已经做了较多优化（抽屉/吸顶工具栏/紧凑提示等），上述建议多为一致性与可维护性提升，不影响既有功能路径。
- 若短期不改后端接口，建议先引入并发限制与 LRU 缓存，以稳住词汇解释体验；后续再切批量 API。

