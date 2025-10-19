# AI 发音纠正系统 — 产品与技术方案 v1.0

> 目标：在 Web 端（Next.js 集成）构建一个支持 **英/中/日** 的 AI 发音评测与纠正系统，形成从「覆盖式测评 → 二次验证 → 针对性训练 → 再测 → 持续闭环」的完整学习路径；评分以 **A/B/C 等级 + 95% 置信区间** 呈现，并按**发音最小单元**（Unit）维护个人画像。

---

## 0. 电梯陈述（TL;DR）

* **用户体验**：

  1. 首次进入进行一次**麦克风自检**（一句超短句，立即给分确认设备正常）；
  2. 进入**覆盖式首轮测评**（每句读完即可进入下一句；评分在后台 1–2s 异步更新）；
  3. 自动生成**个人发音画像**（Unit 维度 A/B/C + CI），找出薄弱项；
  4. 对薄弱项触发**二次验证**（排除偶发性失误）；
  5. 推送**针对性训练**材料（不评分，仅练习与听辨）；
  6. **再测**并更新画像，形成**持续闭环**。
* **技术路线**：前端 Azure Speech SDK（短时 Token），后端 Next.js API；数据存储与音频文件用 Supabase；统计采用 Welford 在线更新与 95%CI；题库采用 Set Cover + 信息增益自适应出题。

---

## 1. 需求与成功指标

### 1.1 功能范围（MVP）

* 三语支持：**英语（en-US）/ 中文（zh-CN）/ 日语（ja-JP）**；
* 逐句脚本式评测（Pronunciation Assessment），返回音素/音节粒度分；
* 覆盖式选题（最小单元 Unit 覆盖优先），并计算覆盖度进度；
* A/B/C 等级 + 95% 置信区间展示；
* 二次验证机制（最小对立词 & 专项词表，5–7 次）与替换规则；
* 针对性训练页（不评分，含要领与对比音频）；
* 再测对比与闭环；
* 音频保存（默认 30 天，可配置）。

### 1.2 成功指标（KPI）

* 首日完成**麦克风自检**成功率 ≥ **98%**；
* 首轮 30 句的**Unit 覆盖率** ≥ **95%**（按目标语言 Unit 集合）；
* 人均完成**二次验证**后薄弱项**误判率**（验证前后大幅反转） ≤ **10%**；
* 「针对性训练 → 再测」后，薄弱 Unit 的平均分提升 ≥ **8 分**；
* 日活用户的单次会话**有效样本占比** ≥ **85%**（剔除无效样本）。

---

## 2. 用户画像与关键场景

* 画像：留学生/考证/求职者；具备耳机麦克风；可在桌面或移动端浏览器使用。
* 场景：碎片化练习（5–15 分钟）；希望快速定位问题与看到可量化进步。

### 2.1 用户旅程（简图）

```
[语言选择] → [麦克风自检] → [覆盖式测评] → [画像面板]
                                      ↓薄弱项
                                 [二次验证模块]
                                      ↓确认真薄弱
                                 [针对性训练]
                                      ↓
                                    [再测]
                                      ↓
                                  [持续闭环]
```

---

## 3. 系统架构

* **前端**：Next.js（App Router）+ Web Audio + Azure Speech SDK（脚本式评测，异步上报）
* **后端**：Next.js API Routes

  * `/api/speech/token`：交换短时 Token（隐藏主密钥）
  * `/api/attempts`：接收评测 JSON，做有效性判定、句→单元聚合、统计更新
  * `/api/next-sentences`：按覆盖度/信息增益推荐下一组句子
  * （可选）`/api/upload`：音频直传或服务端转存 Supabase Storage
* **数据层**：Supabase（Postgres + Storage + RLS）
* **外部服务**：Azure Speech（Pronunciation Assessment）

### 3.1 非功能指标（SLO）

* 端到端句级结果可用性（异步）**≤ 2s**（95 分位）；
* API 成功率 ≥ **99.9%**；
* 峰值并发：100 QPS（可水平扩展）；
* 存储：音频保留期默认 30 天（可按空间/合规调整）。

---

## 4. 发音最小单元（Unit）设计

* **英语**：音素（phoneme），如 /p/, /b/, /θ/，含长短与重音在训练规则中体现；
* **中文**：建议以**拼音音节（含声调）**为 Unit；也可拆为（声母, 韵母, 声调）三元；
* **日语**：音素为主，结合促音/长音/拗音规则（训练提示中强调时长与舌位）。

> 统一抽象：`unit_catalog(lang, symbol, unit_type)`，保证 UI 与统计对齐；SDK 的符号差异用自有映射兜底。

---

## 5. 数据模型（ER 概览）

* `unit_catalog(unit_id, lang, symbol, unit_type)`
* `sentences(sentence_id, lang, text, level, domain_tags[])`
* `sentence_units(sentence_id, unit_id, count)` — 句子包含的 Unit（离线预计算）
* `user_attempts(attempt_id, user_id, lang, sentence_id, ts, azure_raw_json, accuracy, fluency, completeness, prosody, pron_score, valid_flag, audio_path)`
* `user_unit_stats(user_id, lang, unit_id, n, mean, m2, ci_low, ci_high, difficulty, last_updated)`
* `user_sentence_progress(user_id, sentence_id, status, attempts_cnt, last_score, last_ts)`

> 访问控制：RLS 规则仅允许本人读取自己的 attempts 与音频；管理员可匿名化后做全局统计。

---

## 6. 评分、统计与等级展示

### 6.1 有效样本过滤

* 依据句级返回：若 `Completeness < 0.6` 或 `Omission+Insertion` 占比过高 → `valid_flag=false`（不计入统计）。

### 6.2 句→Unit 聚合

* 若 SDK 提供音素级分：按音素与出现次数加权平均；
* 若未提供：用自有 G2P 将词/汉字映射为 Unit，再按对齐时长/次数加权；
* 每个涉及的 Unit 取该句的聚合分，进入在线统计。

### 6.3 在线统计（Welford）

```
输入：当前统计 (n, mean, m2)，新样本 x
n' = n + 1
mean' = mean + (x - mean) / n'
m2' = m2 + (x - mean) * (x - mean')
```

* 样本方差 `s^2 = m2 / (n-1)`（n≥2）；标准误 `SE = sqrt(s^2 / n)`；
* **95% 置信区间**：`CI = mean ± 1.96 * SE`

### 6.4 等级映射（默认）

* **A**：`mean ≥ 85` 且 `CI_low ≥ 80`
* **B**：`75 ≤ mean < 85` 或 CI 穿越 80
* **C**：`mean < 75`

---

## 7. 覆盖式出题策略

### 7.1 目标

* 在最少句子数内覆盖目标语言的大部分 Unit；
* 对样本数少、CI 宽或均分低的 Unit 提高权重。

### 7.2 贪心 Set Cover + 信息增益（伪算法）

1. 为每个句子统计其覆盖的**仍需样本**的 Unit 数量（按 `need[unit]`）；
2. 选择“增益最大”的句子加入推荐集，更新 `need`；
3. 重复直到达到 k 句或 `need` 收敛；
4. 信息增益：对 `n` 小或 `CI` 宽的 Unit 提高初始 `need` 值；对 `mean` 低的再额外加权。

### 7.3 进入下一步的阈值（以中文示例）

* 若前 **30 句**已覆盖全部 Unit（或达到 95% 覆盖率）→ 可进入二次验证阶段；同时允许用户**继续多读**以收敛 CI。

---

## 8. 二次验证（排除偶发错误）

* 触发条件（默认）：某 Unit 满足 `mean < 75` 且 `CI_width < 8`；
* 出题：该 Unit 的**最小对立词**或**高频词**，连续 **5–7** 个；
* 计算新均值 `μ'`，与历史 `μ` 比较：

  * 若 `|μ' - μ| > max(8, 0.5 * CI_width)` → 视为原估计失真，**用 μ' 替换**；
  * 否则合并样本（更新 n/mean/m2）。

---

## 9. 针对性训练（不评分）

* 内容结构：

  1. **发音要领**（部位/清浊/送气/舌位/口形/时长）；
  2. **母语者常见错误**（中/日/英母语差异化提示）；
  3. **最小对立词**与**节奏/连读**练习；
  4. **对比音频**（TTS 标准读 + 可选真人样本）。
* 交互：分段播放 → 跟读录音（不评分）→ 自我听辨 → 标记“已掌握/仍困难”。

---

## 10. UI/UX 关键设计

* **麦克风自检卡**：一句话，立刻显示分数与“设备 OK”绿灯；
* **测评模式卡**：读取状态（进度圈）+“上一句评分处理中…”的轻提示；
* **画像面板**：

  * 雷达图/条形图（Unit 维度）：A/B/C + 95%CI + 覆盖度；
  * Top-K 薄弱 Unit 卡片（可点击进入训练或二次验证）。
* **训练页**：要领+最小对立词+音频控件；
* **再测页**：对比图（前后均值/CI/样本数变化）。

---

## 11. API 设计（MVP）

### 11.1 获取短时 Token

* `GET /api/speech/token` → `{ token, region, expiresAt }`
* 逻辑：服务端用主密钥向 Azure STS 换取短时 Token；前端仅持 Token。

### 11.2 上报一次尝试

* `POST /api/attempts`
* 入参：`{ sentence_id, lang, azure_json, audio_path? }`
* 返回：`{ valid, updated_units: [{unit_id, n, mean, ci_low, ci_high}], attempt_id }`

### 11.3 推荐下一组句子

* `GET /api/next-sentences?lang=ja-JP&k=5` → `[{sentence_id, text}]`

### 11.4 获取个人画像

* `GET /api/user/unit-stats?lang=en-US` → `[{unit_id, symbol, n, mean, ci_low, ci_high, grade}]`

---

## 12. 安全、隐私与合规

* 前端仅持短时 Token；主密钥仅后端保存；
* 音频默认保存 **30 天**，到期自动归档或删除；
* 明确的用户授权（勾选框）：用于评测与改进模型的匿名化使用；
* 采用 Supabase RLS：用户仅能访问自己的记录与音频；
* 审计日志：记录关键 API 调用与失败原因（脱敏）。

---

## 13. 日志与分析

* 业务埋点：自检成功率、有效样本占比、Unit 覆盖率、二次验证触发率、训练完成率、再测提升幅度；
* 性能监控：句级异步延迟分布（P50/P95/P99）、API 成功率；
* 质量监控：语言/设备维度的无效样本比例与异常分布。

---

## 14. 性能与伸缩

* 前端：单句识别 1–2s 异步返回；
* 后端：`/api/attempts` 为 CPU 轻量处理（JSON 解析 + 统计更新）；
* 可通过队列/批处理对高峰进行削峰；
* 静态资源与音频走 CDN；数据库设置合理索引（`(user_id, lang, unit_id)`）。

---

## 15. 测试计划

* **单元测试**：统计模块（Welford/CI/替换规则）、有效样本判定、覆盖算法；
* **集成测试**：从前端录音→SDK→`/api/attempts`→统计入库的端到端；
* **兼容测试**：浏览器与设备麦克风权限、移动端回声/降噪；
* **数据一致性**：随机抽样对比“句→Unit 聚合”与 Azure 原始结果；
* **可用性测试**：新手 5 分钟路径打通率。

---

## 16. 上线策略

* 内测白名单（10–30 人），以英语/日语先行；
* 观测 1 周：无效样本率、延迟、崩溃率；
* 逐步开放中文；
* 里程碑达标后开放公开试用。

---

## 17. 里程碑与排期（示例）

* **W1**：建表&Storage&RLS，Token API，麦克风自检页
* **W2**：覆盖式测评流&异步上报，画像面板（A/B/C+CI）
* **W3**：二次验证模块与替换规则，训练页（模板+音频）
* **W4**：再测闭环、推荐算法（Set Cover+信息增益）、日志与仪表盘
* **W5**：题库扩充与多语言映射；灰度发布与优化

---

## 18. 风险与缓解

* **语种间音素标注差异**：用自有 Unit 映射兜底，UI 与统计均以映射为准；
* **长音频时延或截断**：坚持逐句脚本式评测；
* **Prosody 语种差异**：在 UI 明确“某些语言不显示韵律分”；
* **题库偏差**：持续引入多来源文本、最小对立词校审；
* **误判**：二次验证 + 置信区间收敛约束。

---

## 19. 未来路线图

* 自适应学习：按学习曲线与遗忘曲线（SM-2 风格）调度训练；
* 组块化教学：从音素到音节/词/短语/韵律的渐进课程；
* 更精细的对齐：引入时间对齐可视化（音素时长/能量/共振峰）；
* 社区与打卡：连续打卡与排行榜；
* 教师端看板：班级画像与作业派发。

---

## 20. 附录 A：默认阈值与配置（可调）

* 有效样本：`Completeness ≥ 0.6` 且 `Omission+Insertion` 不超阈；
* 等级：A ≥85（且 CI_low≥80），B 75–85，C <75；
* 二次验证触发：`mean < 75` & `CI_width < 8`；验证题量 k = 5–7；
* 进入验证前的覆盖度阈值：≥95%（或中文 30 句达成全部 Unit）。

---

## 21. 附录 B：术语表

* **Unit**：发音最小单元（英语音素、中文拼音音节/声母韵母、日语音素）；
* **Welford**：在线计算均值/方差的数值稳定算法；
* **CI（Confidence Interval）**：基于样本的均值置信区间；
* **最小对立词（Minimal Pair）**：仅某个音位不同的词对（如 /l/ vs /r/）。

---

> 本方案为 MVP 交付导向文档，可直接据此创建任务清单与需求单元。如果需要，我可以按你的 Next.js 项目结构补充 3 个核心文件的范例实现（Token API / Attempts API / 录音评测组件）。

---

## 22. 附录 C：核心代码样例（可拷贝）

> 说明：以下为 **Next.js (App Router)** 项目中的最小可用样例。请根据你的目录结构调整导入路径与鉴权逻辑。

### 22.1 环境变量（`.env.local`）

```bash
# Azure Speech
AZURE_SPEECH_KEY="<your-speech-key>"
AZURE_SPEECH_REGION="japaneast"   # 示例：japaneast / eastus 等

# Supabase（服务端管理口令仅在服务端使用！）
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role>"
```

### 22.2 Supabase 服务端客户端（`/lib/supabaseAdmin.ts`）

```ts
// /lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: { headers: { 'x-application-name': 'pron-assess' } },
  }
)
```

### 22.3 获取短时 Token（`/app/api/speech/token/route.ts`）

```ts
// /app/api/speech/token/route.ts
export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!key || !region) {
    return new Response(
      JSON.stringify({ error: 'Azure Speech env missing' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }

  const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key },
    // body 为空即可
  })

  if (!resp.ok) {
    const text = await resp.text()
    return new Response(
      JSON.stringify({ error: 'IssueToken failed', detail: text }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    )
  }

  const token = await resp.text()
  const ttlMs = 9 * 60 * 1000 // 官方建议 10 分钟内有效，这里给前端 9 分钟缓存
  return new Response(
    JSON.stringify({ token, region, expiresAt: Date.now() + ttlMs }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}
```

### 22.4 统计工具（Welford + CI）（`/lib/stats.ts`）

```ts
// /lib/stats.ts
export type Stat = { n: number; mean: number; m2: number }

export function welfordUpdate(cur: Stat, x: number): Stat {
  const n = cur.n + 1
  const delta = x - cur.mean
  const mean = cur.mean + delta / n
  const delta2 = x - mean
  const m2 = cur.m2 + delta * delta2
  return { n, mean, m2 }
}

export function ci95(stat: Stat) {
  if (stat.n < 2) return { low: undefined, high: undefined, width: undefined }
  const s2 = stat.m2 / (stat.n - 1)
  const se = Math.sqrt(s2 / stat.n)
  return { low: stat.mean - 1.96 * se, high: stat.mean + 1.96 * se, width: 3.92 * se }
}

export function gradeFromMeanCI(mean: number, ciLow?: number) {
  if (ciLow === undefined) return mean >= 85 ? 'A' : mean >= 75 ? 'B' : 'C'
  if (mean >= 85 && ciLow >= 80) return 'A'
  if (mean >= 75) return 'B'
  return 'C'
}
```

### 22.5 上报一次尝试并聚合（`/app/api/attempts/route.ts`）

```ts
// /app/api/attempts/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { welfordUpdate, ci95 } from '@/lib/stats'

export const dynamic = 'force-dynamic'

// TODO: 替换为你的会话/鉴权逻辑
async function getUserId() {
  // 从 Session/Cookie 中解析用户 ID，MVP 可用占位符
  return '00000000-0000-0000-0000-000000000001'
}

// 解析 Azure JSON，容错提取句级与音素级（若缺失则回退到词级）
function parseAzure(json: any) {
  // 常见字段路径：NBest[0].PronunciationAssessment.{AccuracyScore,FluencyScore,CompletenessScore,ProsodyScore,PronScore}
  const nbest0 = json?.NBest?.[0] ?? json?.nBest?.[0]
  const pa = nbest0?.PronunciationAssessment || nbest0?.pronunciationAssessment || json?.PronunciationAssessment

  const accuracy = Number(pa?.AccuracyScore ?? pa?.accuracyScore ?? 0)
  const fluency = Number(pa?.FluencyScore ?? pa?.fluencyScore ?? 0)
  const completeness = Number(pa?.CompletenessScore ?? pa?.completenessScore ?? 0)
  const prosody = pa?.ProsodyScore ?? pa?.prosodyScore
  const pronScore = Number(pa?.PronScore ?? pa?.pronScore ?? 0)

  // 音素级（若可用）
  const units: Array<{ symbol: string; score: number }> = []
  const words = nbest0?.Words || nbest0?.words || []
  for (const w of words) {
    const phonemes = w?.Phonemes || w?.phonemes || []
    if (Array.isArray(phonemes) && phonemes.length) {
      for (const p of phonemes) {
        const sym = String(p?.Phoneme || p?.phoneme || '').trim()
        const sc = Number(
          p?.PronunciationAssessment?.AccuracyScore ??
            p?.pronunciationAssessment?.accuracyScore ??
            w?.PronunciationAssessment?.AccuracyScore ??
            w?.pronunciationAssessment?.accuracyScore ??
            0
        )
        if (sym) units.push({ symbol: sym, score: sc })
      }
    } else {
      // 回退：按词级精度近似分摊（需要你的 G2P 才能更精确）
      const wordAcc = Number(
        w?.PronunciationAssessment?.AccuracyScore ??
          w?.pronunciationAssessment?.accuracyScore ??
          0
      )
      const sym = (w?.Word || w?.word || '').toString()
      if (sym) units.push({ symbol: sym, score: wordAcc })
    }
  }

  return { accuracy, fluency, completeness, prosody, pronScore, units }
}

// 获取/创建 unit_id（按语言与符号）
async function ensureUnitId(lang: string, symbol: string) {
  const { data: found, error: e1 } = await supabaseAdmin
    .from('unit_catalog')
    .select('unit_id')
    .eq('lang', lang)
    .eq('symbol', symbol)
    .maybeSingle()
  if (e1) throw e1
  if (found) return found.unit_id as number

  const unitType = lang === 'zh-CN' ? 'syllable' : 'phoneme'
  const { data: ins, error: e2 } = await supabaseAdmin
    .from('unit_catalog')
    .insert({ lang, symbol, unit_type: unitType })
    .select('unit_id')
    .single()
  if (e2) throw e2
  return ins.unit_id as number
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    const body = await req.json()
    const { sentence_id, lang, azure_json, audio_path } = body || {}

    if (!sentence_id || !lang || !azure_json) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const parsed = parseAzure(azure_json)
    const valid = parsed.completeness >= 0.6 // 规则可配置

    // 1) 记录尝试
    const { data: attempt, error: e1 } = await supabaseAdmin
      .from('user_attempts')
      .insert({
        user_id: userId,
        lang,
        sentence_id,
        azure_raw_json: azure_json,
        accuracy: parsed.accuracy,
        fluency: parsed.fluency,
        completeness: parsed.completeness,
        prosody: parsed.prosody ?? null,
        pron_score: parsed.pronScore,
        valid_flag: valid,
        audio_path: audio_path ?? null,
      })
      .select('attempt_id')
      .single()
    if (e1) throw e1

    // 2) 若有效：按 Unit 聚合更新统计
    const updated_units: Array<{ unit_id: number; n: number; mean: number; ci_low?: number; ci_high?: number }> = []

    if (valid) {
      // 将同一符号多次出现求平均
      const bySymbol = new Map<string, { sum: number; cnt: number }>()
      for (const u of parsed.units) {
        const it = bySymbol.get(u.symbol) || { sum: 0, cnt: 0 }
        it.sum += u.score
        it.cnt += 1
        bySymbol.set(u.symbol, it)
      }

      for (const [symbol, agg] of bySymbol.entries()) {
        const unit_id = await ensureUnitId(lang, symbol)
        const score = agg.sum / Math.max(1, agg.cnt)

        // 读当前统计
        const { data: cur, error: e2 } = await supabaseAdmin
          .from('user_unit_stats')
          .select('n, mean, m2')
          .eq('user_id', userId)
          .eq('lang', lang)
          .eq('unit_id', unit_id)
          .maybeSingle()
        if (e2) throw e2

        const stat = cur ?? { n: 0, mean: 0, m2: 0 }
        const next = welfordUpdate(stat, score)
        const ci = ci95(next)

        const { error: e3 } = await supabaseAdmin
          .from('user_unit_stats')
          .upsert({
            user_id: userId,
            lang,
            unit_id,
            n: next.n,
            mean: next.mean,
            m2: next.m2,
            ci_low: ci.low,
            ci_high: ci.high,
            last_updated: new Date().toISOString(),
          })
        if (e3) throw e3

        updated_units.push({ unit_id, n: next.n, mean: next.mean, ci_low: ci.low, ci_high: ci.high })
      }
    }

    return new Response(
      JSON.stringify({
        attempt_id: attempt.attempt_id,
        valid,
        updated_units,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[attempts] error', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
```

### 22.6 下一组句子推荐（覆盖优先）（`/app/api/next-sentences/route.ts`）

```ts
// /app/api/next-sentences/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 简化策略：优先覆盖 n<3 的 Unit；按句子覆盖“仍需样本”的单位数排序
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') || 'en-US'
  const k = Number(searchParams.get('k') ?? '5')
  const userId = '00000000-0000-0000-0000-000000000001' // TODO: 替换鉴权

  // 需要的 Unit（n<3）
  const { data: needs, error: e1 } = await supabaseAdmin
    .from('user_unit_stats')
    .select('unit_id, n')
    .eq('user_id', userId)
    .eq('lang', lang)
  if (e1) throw e1
  const needMap = new Map<number, number>()
  for (const r of needs || []) {
    const rest = Math.max(0, 3 - (r.n ?? 0))
    if (rest > 0) needMap.set(r.unit_id, rest)
  }

  // 候选句子与其覆盖单元
  const { data: candidates, error: e2 } = await supabaseAdmin
    .from('sentences')
    .select('sentence_id, text')
    .eq('lang', lang)
    .limit(200)
  if (e2) throw e2

  const sentenceUnits = new Map<number, Array<{ unit_id: number; count: number }>>()
  const sentenceIds = (candidates || []).map((c) => c.sentence_id)
  if (sentenceIds.length) {
    const { data: sus, error: e3 } = await supabaseAdmin
      .from('sentence_units')
      .select('sentence_id, unit_id, count')
      .in('sentence_id', sentenceIds)
    if (e3) throw e3
    for (const su of sus || []) {
      const arr = sentenceUnits.get(su.sentence_id) || []
      arr.push({ unit_id: su.unit_id, count: su.count })
      sentenceUnits.set(su.sentence_id, arr)
    }
  }

  // 评分：覆盖越多“仍需样本”的句子越优
  const scored = (candidates || []).map((c) => {
    let gain = 0
    const units = sentenceUnits.get(c.sentence_id) || []
    for (const u of units) {
      const rest = needMap.get(u.unit_id) || 0
      if (rest > 0) gain += Math.min(rest, u.count)
    }
    return { sentence_id: c.sentence_id, text: c.text, gain }
  })
  scored.sort((a, b) => b.gain - a.gain)

  const picked = scored.filter((x) => x.gain > 0).slice(0, k)
  // 若覆盖需求已满足，则退而选常规练习（随机）
  const fallback = scored.filter((x) => x.gain === 0).slice(0, Math.max(0, k - picked.length))

  return new Response(
    JSON.stringify({ items: [...picked, ...fallback] }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )
}
```

### 22.7 前端录音评测组件（含一次“麦克风自检”）（`/components/RecorderCard.tsx`）

```tsx
// /components/RecorderCard.tsx
'use client'
import React from 'react'
import * as sdk from 'microsoft-cognitiveservices-speech-sdk'

async function fetchToken() {
  const r = await fetch('/api/speech/token')
  if (!r.ok) throw new Error('Token fetch failed')
  return r.json() as Promise<{ token: string; region: string; expiresAt: number }>
}

function createRecognizer(token: string, region: string, lang: string, referenceText: string) {
  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
  speechConfig.speechRecognitionLanguage = lang
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

  const paConfig = new sdk.PronunciationAssessmentConfig(
    referenceText,
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true // 统计漏读/插入
  )
  paConfig.applyTo(recognizer)
  return recognizer
}

export default function RecorderCard() {
  const [lang, setLang] = React.useState<'en-US' | 'zh-CN' | 'ja-JP'>('en-US')
  const [text, setText] = React.useState<string>('Today is a sunny day.')
  const [busy, setBusy] = React.useState(false)
  const [last, setLast] = React.useState<any>(null)

  async function micCheck() {
    setBusy(true)
    try {
      const { token, region } = await fetchToken()
      const recognizer = createRecognizer(token, region, lang, text)
      await new Promise<void>((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            const pa = sdk.PronunciationAssessmentResult.fromResult(result)
            setLast({
              accuracy: pa.accuracyScore,
              fluency: pa.fluencyScore,
              completeness: pa.completenessScore,
              prosody: (pa as any).prosodyScore,
              raw: JSON.parse(result.json),
            })
            recognizer.close()
            resolve()
          },
          (err) => {
            recognizer.close()
            reject(err)
          }
        )
      })
    } catch (e) {
      console.error(e)
      alert('Mic check failed')
    } finally {
      setBusy(false)
    }
  }

  async function assessOnce(sentenceId = 1) {
    setBusy(true)
    try {
      const { token, region } = await fetchToken()
      const recognizer = createRecognizer(token, region, lang, text)
      // 用户读完即可进入下一句；评分异步上报
      recognizer.recognizeOnceAsync(
        async (result) => {
          const raw = JSON.parse(result.json)
          setLast({ raw }) // 本地仅做占位显示
          await fetch('/api/attempts', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sentence_id: sentenceId, lang, azure_json: raw }),
          })
          recognizer.close()
          alert('已提交，后台将更新你的画像')
        },
        (err) => {
          recognizer.close()
          console.error(err)
          alert('Assess failed')
        }
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl w-full rounded-2xl border p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <select
          className="border rounded px-2 py-1"
          value={lang}
          onChange={(e) => setLang(e.target.value as any)}
        >
          <option value="en-US">English (US)</option>
          <option value="zh-CN">中文（普通话）</option>
          <option value="ja-JP">日本語</option>
        </select>
        <button
          onClick={micCheck}
          disabled={busy}
          className="ml-auto rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
        >
          麦克风自检（一句）
        </button>
      </div>

      <textarea
        className="w-full border rounded p-2 min-h-[80px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => assessOnce(1)}
          disabled={busy}
          className="rounded-xl border px-3 py-1 hover:bg-gray-50 disabled:opacity-50"
        >
          读取本句并异步评测
        </button>
      </div>

      {last && (
        <pre className="bg-gray-50 rounded p-2 text-xs overflow-auto max-h-64">
          {JSON.stringify(last, null, 2)}
        </pre>
      )}
    </div>
  )
}
```

### 22.8 目录与接入指引

```
/app
  /api
    /speech/token/route.ts
    /attempts/route.ts
    /next-sentences/route.ts
/components
  RecorderCard.tsx
/lib
  supabaseAdmin.ts
  stats.ts
```

* 在某个页面中引入组件：

```tsx
// /app/pron/page.tsx
import RecorderCard from '@/components/RecorderCard'
export default function Page() { return (
  <main className="p-6">
    <h1 className="text-2xl font-semibold mb-4">发音测评（MVP）</h1>
    <RecorderCard />
  </main>
)}
```

### 22.9 安全与上线要点（代码相关）

* **不要**在前端注入 `AZURE_SPEECH_KEY`；前端只拿 `/api/speech/token` 返回的短时 Token；
* `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端使用；RLS 打开后，若改用“用户态”插入，请在 API 层做权限校验；
* `parseAzure()` 针对不同大小写/字段名做了容错，建议上线前用真实返回样本回归测试；
* 若要**保存音频**，可在前端并行用 WebAudio 录制 WAV，上传至 `/api/upload` 并将 `audio_path` 一并传给 `/api/attempts`；
* `next-sentences` 的策略是简化版，后续可引入 CI 宽度与均分的权重、冷启动覆盖度阈值等。

---

### 22.10 音频上传 API（`/app/api/upload/route.ts`）

> 以 **FormData** 方式上传音频文件到 Supabase Storage（bucket: `attempts`）。

```ts
// /app/api/upload/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// TODO: 替换为你的会话/鉴权逻辑
async function getUserId() {
  return '00000000-0000-0000-0000-000000000001'
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId()
    const form = await req.formData()
    const file = form.get('file') as unknown as File
    const ext = (form.get('ext') as string) || 'webm'

    if (!file || typeof file.arrayBuffer !== 'function') {
      return new Response(JSON.stringify({ error: 'no file' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const arrayBuf = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    const now = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    // 重要：将 userId 作为对象路径前缀，便于 RLS 按前缀授权
    const objectPath = `${userId}/${now}-${rand}.${ext}`

    const { data, error } = await supabaseAdmin.storage
      .from('attempts')
      .upload(objectPath, bytes, {
        contentType: file.type || `audio/${ext}`,
        upsert: false,
      })

    if (error) throw error

    return new Response(
      JSON.stringify({ path: data?.path ?? objectPath }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[upload] error', err)
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
```

> **Storage/RLS 建议**：创建 `attempts` bucket，并将对象路径固定为 `{userId}/...`。在 `storage.objects` 上配置策略，仅允许 `auth.uid()` 读取/列举自己前缀下的对象。

```sql
-- 创建 bucket（控制台或 SQL）
-- 注意：若控制台已建，可忽略
select storage.create_bucket('attempts', public := false);

-- 仅允许登录用户读取自己前缀的对象
create policy "read own attempts"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attempts'
    and (name like (auth.uid()::text || '/%'))
  );

-- 插入/更新：允许服务端（service role）或在你的 API 鉴权通过时执行
-- 可在应用层用 service role 执行，不强开匿名 insert 策略
```

### 22.11 前端：并行录音 + 上传 + 评测（RecorderCard 扩展）

```tsx
// 追加到 /components/RecorderCard.tsx 中（替换 assessOnce）
async function assessOnceWithUpload(sentenceId = 1) {
  setBusy(true)
  let media: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  try {
    // 1) 开始本地录音（与 Speech SDK 并行）
    media = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(media, { mimeType: 'audio/webm' })
    recorder.ondataavailable = (e) => e.data && chunks.push(e.data)
    recorder.start()

    // 2) Speech SDK 评测
    const { token, region } = await fetchToken()
    const recognizer = createRecognizer(token, region, lang, text)

    recognizer.recognizeOnceAsync(
      async (result) => {
        // 3) 停止录音并上传
        recorder?.stop()
        await new Promise<void>((res) => (recorder!.onstop = () => res()))
        media?.getTracks().forEach((t) => t.stop())

        const blob = new Blob(chunks, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('file', blob, 'audio.webm')
        fd.append('ext', 'webm')
        const up = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!up.ok) throw new Error('upload failed')
        const { path } = await up.json()

        const raw = JSON.parse(result.json)
        setLast({ raw, audio_path: path })

        // 4) 上报 attempts（携带 audio_path）
        await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sentence_id: sentenceId, lang, azure_json: raw, audio_path: path }),
        })
        recognizer.close()
        alert('已提交：音频已保存，画像将后台更新')
      },
      (err) => {
        console.error(err)
        try {
          recorder?.stop(); media?.getTracks().forEach((t) => t.stop())
        } catch {}
        alert('Assess failed')
      }
    )
  } catch (e) {
    console.error(e)
    try { recorder?.stop(); media?.getTracks().forEach((t) => t.stop()) } catch {}
    alert('录音或评测失败')
  } finally {
    setBusy(false)
  }
}
```

---

## 23. 附录 D：中文/日语 Unit 映射基础表与种子数据

> 目标：为 **unit_catalog** 提供可复用的“规范化符号”，并允许将 SDK 返回的符号或你自有 G2P 的输出映射到这些规范符号上。

### 23.1 表结构（规范表 + 别名表）

```sql
-- 规范表：所有语言共享的 unit_catalog 已存在
-- 这里为中文/日语补充“别名→规范”的映射表

create table unit_alias (
  lang text not null,
  alias text not null,       -- SDK/G2P 可能输出的符号
  unit_id bigint not null references unit_catalog(unit_id) on delete cascade,
  primary key (lang, alias)
);
```

### 23.2 中文（拼音音节）

> 推荐以“**带声调的全拼音节**”作为规范符号，例如 `han4`, `shi4`, `lü4`。这样：
>
> * 粒度与学习认知一致；
> * 可在需要时进一步拆分为（声母/韵母/声调）用于统计。

**(1) 辅助表：拼音音节词表（可从 CSV 导入）**

```sql
create table zh_pinyin_units (
  symbol text primary key,         -- 如 'han4'
  shengmu text,                    -- h
  yunmu text,                      -- an
  tone int check (tone between 1 and 5)  -- 1~4 声，5=轻声
);
```

**(2) 将拼音音节导入 unit_catalog（一次性）**

```sql
-- 假设 zh_pinyin_units 已插入若干行
insert into unit_catalog (lang, symbol, unit_type)
select 'zh-CN', symbol, 'syllable'
from zh_pinyin_units
on conflict do nothing;
```

**(3) 将别名映射到规范符号**

* 例：`lü4` 的别名可能出现为 `lv4`；`shi4` 可能出现 `shih4`（某些库习惯）

```sql
-- 示例：为常见别名建立映射（按需扩充）
insert into unit_alias (lang, alias, unit_id)
select 'zh-CN', 'lv4', uc.unit_id
from unit_catalog uc where uc.lang='zh-CN' and uc.symbol='lü4'
on conflict do nothing;
```

**(4) 小型种子（示范 20 条，实际建议 CSV 全量 400+ 条）**

```sql
insert into zh_pinyin_units (symbol, shengmu, yunmu, tone) values
('ma1','m','a',1),('ma2','m','a',2),('ma3','m','a',3),('ma4','m','a',4),('ma5','m','a',5),
('shi4','sh','i',4),('shi2','sh','i',2),('chi1','ch','i',1),('zhi1','zh','i',1),
('han4','h','an',4),('hang2','h','ang',2),('liang3','l','iang',3),('yue4','∅','ue',4),
('lü4','l','ü',4),('lu:4','l','ü',4), -- 兼容输入
('qing1','q','ing',1),('qiong2','q','iong',2),('xue2','x','ue',2),
('er2','∅','er',2),('de5','d','e',5);
```

> **句→Unit 的离线生成**：对中文句子，使用你选定的 G2P（如 pypinyin + 你自定义规则）生成带调音节序列，再统计到 `sentence_units`。

### 23.3 日语（音素 + 特殊时长/促音）

> 规范思路：将日语音系拆为**元音** + **辅音** 音素集合，促音（小っ）与长音作为**时长特征**，在统计时可作为独立 Unit 或作为某音素的“时长属性”附加统计。

**(1) 基础音素集合（IPA 风格，示范）**

```sql
-- 先插入规范音素到 unit_catalog（lang='ja-JP', unit_type='phoneme'）
insert into unit_catalog (lang, symbol, unit_type) values
('ja-JP','a','phoneme'),('ja-JP','i','phoneme'),('ja-JP','ɯ','phoneme'),('ja-JP','e','phoneme'),('ja-JP','o','phoneme'),
('ja-JP','k','phoneme'),('ja-JP','g','phoneme'),('ja-JP','s','phoneme'),('ja-JP','z','phoneme'),('ja-JP','ɕ','phoneme'),('ja-JP','ʑ','phoneme'),
('ja-JP','t','phoneme'),('ja-JP','d','phoneme'),('ja-JP','t͡ɕ','phoneme'),('ja-JP','d͡ʑ','phoneme'),('ja-JP','ts','phoneme'),
('ja-JP','n','phoneme'),('ja-JP','h','phoneme'),('ja-JP','ɸ','phoneme'),('ja-JP','b','phoneme'),('ja-JP','p','phoneme'),
('ja-JP','m','phoneme'),('ja-JP','ɾ','phoneme'),('ja-JP','j','phoneme'),('ja-JP','w','phoneme')
on conflict do nothing;
```

**(2) 时长/促音/长音（可选为“特征 Unit”）**

```sql
-- 若希望单独统计：
insert into unit_catalog (lang, symbol, unit_type) values
('ja-JP','Q','custom'),   -- 促音（小っ），以 Q 作为惯用记号
('ja-JP',':','custom')    -- 长音（如 おう/えい 的音长），以 : 标记
on conflict do nothing;
```

**(3) 别名映射**

> Azure/其他 G2P 可能输出 SAPI/罗马字/片假名：建立别名以归一。

```sql
-- 例：'shi' → 'ɕi' 的辅音部分归一到 'ɕ'
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','shi', uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol='ɕ' on conflict do nothing;
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','chi', uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol='t͡ɕ' on conflict do nothing;
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','ji',  uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol='d͡ʑ' on conflict do nothing;
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','tsu', uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol='ts' on conflict do nothing;
-- 促音/长音
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','っ', uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol='Q' on conflict do nothing;
insert into unit_alias (lang, alias, unit_id)
select 'ja-JP','ー', uc.unit_id from unit_catalog uc where uc.lang='ja-JP' and uc.symbol=':' on conflict do nothing;
```

**(4) 句→Unit 的离线生成**

* 方式 A：使用你已有的日文 G2P，将 mora/音素序列映射到上述规范；
* 方式 B：若仅有假名，按规则拆分为音素（例：し→ɕi，ち→t͡ɕi，じ→d͡ʑi，ふ→ɸɯ），并检测「っ」「ー」生成 Q、: 特征；
* 统计到 `sentence_units`（同一个音素出现多次计数累加）。

---

## 24. 下一步建议

1. 依据你已有的中文/日语 G2P，准备 **CSV**（规范符号 + 别名）并批量导入；
2. 前端将 `assessOnce` 切换为 `assessOnceWithUpload`，确保保存与评测同源音频；
3. 在画像页加入「下载签名链接」能力（服务端生成签名 URL，时效 5~15 分钟，用于用户自检音频）。
