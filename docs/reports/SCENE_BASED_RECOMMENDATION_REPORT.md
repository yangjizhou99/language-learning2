# 场景空间驱动的推荐系统改动说明

## 一、本次改动内容

### 1. 数据模型与数据库

1. 引入统一“场景标签”空间（scene_tags）
   - 新表：`public.scene_tags`
   - 用来描述稳定的学习场景维度，例如：日常生活、出行与问路、餐饮点餐、购物消费、学校与校园生活、工作与打工、家庭与人际、恋爱、兴趣爱好、考试与学习。
   - 每个场景有 `scene_id`（稳定字符串）、中文名、英文名和描述文案，供 LLM/前端解释使用。

2. 主题 → 场景向量（theme_scene_vectors）
   - 新表：`public.theme_scene_vectors`
   - 每条 `shadowing_themes` 记录在场景空间中的位置：`(theme_id, scene_id, weight)`，`weight ∈ [0,1]`。
   - 通过后台管理页面 `/admin/shadowing/themes` 上的「生成场景向量」功能调用 LLM 生成。

3. 用户 → 场景偏好（user_scene_preferences）
   - 新表：`public.user_scene_preferences`
   - 每个用户在统一场景空间的偏好权重：`(user_id, scene_id, weight)`，`weight ∈ [0,1]`。
   - 触发方式：用户在 `/profile` 保存个人资料后，自动调用 `/api/recommend/preferences?refresh=1`，由 DeepSeek 根据 `goals/domains/target_langs` 生成。

### 2. LLM 映射逻辑

1. 主题 → 场景（后台接口）
   - API：`POST /api/admin/shadowing/themes/map-scenes`
   - 输入：`theme_id`（可选传 provider/model/temperature，默认使用当前后台选择）。
   - Prompt 关键要素：
     - 主题信息：语言、等级、体裁、标题、描述（desc）、覆盖要点（coverage）。
     - 场景标签列表：每个 `scene_id` 的中文名和描述。
   - 输出 JSON：
     ```json
     {
       "weights": [
         { "scene_id": "daily_life", "weight": 0.8 },
         { "scene_id": "shopping", "weight": 1.0 }
       ]
     }
     ```
   - 行为：
     - 删除该 theme 旧的 `theme_scene_vectors` 记录；
     - 为每个 scene_id upsert 一条 `(theme_id, scene_id, weight)`。

2. 用户 Profile → 场景（统一推荐入口）
   - API：`GET /api/recommend/preferences?refresh=1`
   - 内部调用：`getUserPreferenceVectors(userId, { forceRefresh })` → `generateAndStoreScenePreferences`。
   - Prompt 关键要素：
     - 用户资料：`goals`, `domains`, `native_lang`, `target_langs`。
     - 场景标签列表：`scene_id + name_cn/name_en + description`。
   - 输出 JSON：
     ```json
     {
       "scenes": [
         { "scene_id": "daily_life", "weight": 0.9 },
         { "scene_id": "work_parttime", "weight": 0.9 },
         ...
       ]
     }
     ```
   - 行为：
     - 将每个场景的 weight upsert 到 `user_scene_preferences`（主键：`user_id, scene_id`）。

3. 统一推荐打分函数（后端）
   - 文件：`src/lib/recommendation/preferences.ts`
   - 逻辑：
     1. 从 `user_scene_preferences` 取用户场景向量 `U(scene)`；
     2. 从 `theme_scene_vectors` 取每个主题场景向量 `M_theme(scene)`；
     3. 对每个主题算：
        ```ts
        score_theme(theme) = Σ_scene U(scene) * M_theme(scene)
        ```
     4. 将 `score_theme` 裁剪到 [0,1]，得到 `themePrefs[theme_id]`；
     5. 通过 `/api/recommend/preferences` 对前端暴露为：
        ```json
        {
          "themes": [ { "theme_id": "...", "weight": 0.83, "theme": {...} }, ... ]
        }
        ```

### 3. 前端推荐排序逻辑

1. Shadowing 题库页（/practice/shadowing）
   - 文件：`src/components/shadowing/ChineseShadowingPage.tsx`
   - 新增：
     - 从后端获取：
       - 推荐等级：`GET /api/shadowing/recommended?lang=xx` → `recommendedLevel`；
       - 主题推荐权重：`GET /api/recommend/preferences` → `themePrefs[theme_id]`。
     - 顶部工具栏新增「排序」选择器：
       - 推荐（默认） / 最近练习 / 完成度优先。
   - “推荐”模式下的 per-item 打分：
     ```ts
     // 练习状态：未开始 > 草稿中 > 已完成
     const practiceWeight = item.isPracticed ? 0.1 : item.status === 'draft' ? 0.7 : 1.0;

     // 难度匹配推荐等级
     let difficultyWeight = 0.5;
     if (recommendedLevel != null) {
       const diff = Math.abs(item.level - recommendedLevel);
       if (diff === 0) difficultyWeight = 1.0;
       else if (diff === 1) difficultyWeight = 0.6;
       else if (diff === 2) difficultyWeight = 0.3;
       else difficultyWeight = 0.0;
     }

     // 场景偏好（大主题得分）
     const basePref = item.theme_id ? themePrefs[item.theme_id] ?? 0.3 : 0.3;
     const themeWeight = clamp01(basePref);

     // 综合分数：场景 > 难度 > 状态
     score = 0.5 * themeWeight + 0.3 * difficultyWeight + 0.2 * practiceWeight;
     ```
   - 其它排序模式：
     - 最近练习：按 `stats.lastPracticed`（无则按 `created_at`）降序；
     - 完成度优先：已完成优先，其内部按最近练习时间降序。

2. Cloze?Shadowing 题库页（/practice/cloze-shadowing）
   - 文件：`src/app/practice/cloze-shadowing/page.tsx`
   - 排序选项：推荐 / 最近练习 / 难度从低到高 / 难度从高到低 / 完成度优先。
   - “推荐”模式下：
     - 未做过的题优先；
     - 与推荐等级差值越小越靠前；
     - 若等级差相同，按 `themePrefs[theme_id]` 从大到小；
     - 最后按最近练习时间细排。

3. 个人资料保存后的同步行为
   - 文件：`src/app/profile/page.tsx`
   - 行为：
     1. upsert `profiles`；
     2. 显示“资料保存成功”；
     3. 同步调用 `/api/recommend/preferences?refresh=1`（使用 DeepSeek）刷新 `user_scene_preferences`；
     4. 通过 `toast.loading / success / error` 提示进度与结果；
     5. 在 `saving=true` 期间阻止浏览器关闭/刷新，避免中途打断生成。

4. 后台主题管理页的场景向量队列
   - 文件：`src/app/admin/shadowing/themes/page.tsx`
   - 新增：
     - 单个主题：靶心按钮（Target）→ 调用 `POST /api/admin/shadowing/themes/map-scenes` 生成场景向量；
     - 批量操作：
       - 「批量生成小主题」沿用原任务队列；
       - 新增「批量生成场景向量」，将选中的主题加入 `scene_map` 任务队列，复用现有并发/暂停/恢复逻辑。
   - 任务类型：`themes` / `subtopics` / `scene_map` 统一通过 `executeTask` 处理，`scene_map` 对应的 endpoint 为 `/api/admin/shadowing/themes/map-scenes`。

## 二、对当前产品的影响

1. 新用户冷启动
   - 填写个人资料（goals/domains/target_langs）后，会立即生成一份场景偏好向量；
   - Shadowing 和 Cloze 题库页的“推荐”排序会立刻根据这份向量和主题场景向量进行排序，冷启动推荐质量显著提高。

2. 题库扩展
   - 在现有大主题下增加题目：
     - 自动继承该 theme 的场景向量，用户偏好无需重新生成；
   - 新增大主题：
     - 只需在后台对新主题跑一次“生成场景向量”，即可接入现有推荐逻辑；
     - 无需为所有用户重算推荐，只使用已有的 `user_scene_preferences` 即可。

3. 推荐可解释性
   - 场景标签和说明文案为推荐结果提供了可解释的维度；
   - 后续可以在 UI 上直接展示“推荐原因”（例如：你的目标中多次提到打工/点餐 → 场景权重高 → 相关主题排序靠前）。

## 三、未来方向与优化建议

1. 更细粒度的内容表达
   - 目前场景向量在 theme 级别：所有挂在同一大主题下的题目共用同一组场景权重；
   - 后续可考虑：
     - 为 `shadowing_subtopics` 或单条 `shadowing_items` 也生成 `subtopic_scene_vectors` / `item_scene_vectors`；
     - 推荐时优先使用更细粒度的向量，theme 级别作为回退。

2. 在线学习与行为反馈
   - 现在的 `user_scene_preferences` 只来源于 profile（goals/domains），是“静态偏好”；
   - 可以逐渐引入行为信号：
     - 用户在哪些主题上做题更多、完成率更高、停留时间更长；
     - 用户手动标记的「喜欢 / 不感兴趣」；
   - 将这些信号以小步调整方式加权叠加到场景偏好向量上，实现轻量级在线学习。

3. 推荐解释与可视化
   - 为每条推荐题目生成一句解释文本：
     - 例如：“推荐这道题，因为它属于【出行与问路 + 餐饮点餐】场景，且难度接近你当前的 L2 推荐等级。”；
   - 在后台管理页增加“主题场景向量预览”，帮助人工审核 LLM 的打标签质量。

4. 更通用的打分工具
   - 将当前在 Shadowing / Cloze 前端各自实现的打分逻辑抽象为统一 `computeRecommendationScore(item, userVector)` 工具：
     - 输入：题目基础信息 + 主题场景得分 + 推荐等级 + 完成状态；
     - 输出：单一分数和解释结构；
   - 方便未来在其他练习类型（阅读、听力、词汇）中重用同一套推荐策略。

5. 高级模型与多模态
   - 当题库规模和用户规模增大后，可以考虑：
     - 使用文本 embedding + 相似度计算作为辅助，增强对细微语义的理解；
     - 将音频特征（语速、语调、口语难度）纳入难度和场景评估；
   - 但当前版本已足够支撑一个高质量的规则+场景驱动的推荐系统，无需立刻引入复杂模型。

---

本次改动的目标是：

> 把用户目标和题目内容统一投射到同一组“场景标签”维度上，
> 然后在这个空间里做匹配和打分，
> 使得新增题目只需做一次“内容 → 场景”的映射，用户偏好则通过 profile + 行为稳定演进。

这为后续所有练习类型（不止 Shadowing/Cloze）提供了一个可以复用的推荐基础设施。
