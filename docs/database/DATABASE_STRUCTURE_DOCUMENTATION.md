# 数据库结构文档

生成时间: 2025-09-14T09:15:12.722Z

## 概述

这是一个语言学习应用的数据库结构文档，包含以下主要功能模块：

- 用户管理和权限控制
- 练习记录和统计
- 内容管理（文章、题目等）
- 语音和TTS功能

## 表结构

### shadowing_themes

**类型**: BASE TABLE

| 列名        | 数据类型 | 可空 | 默认值 | 说明 |
| ----------- | -------- | ---- | ------ | ---- |
| id          | text     | 是   | -      | -    |
| lang        | text     | 是   | -      | -    |
| level       | integer  | 是   | -      | -    |
| genre       | text     | 是   | -      | -    |
| title       | text     | 是   | -      | -    |
| desc        | text     | 是   | -      | -    |
| status      | text     | 是   | -      | -    |
| created_by  | text     | 是   | -      | -    |
| created_at  | text     | 是   | -      | -    |
| updated_at  | text     | 是   | -      | -    |
| ai_provider | text     | 是   | -      | -    |
| ai_model    | text     | 是   | -      | -    |
| ai_usage    | jsonb    | 是   | -      | -    |
| title_en    | text     | 是   | -      | -    |
| coverage    | text[]   | 是   | -      | -    |

### shadowing_subtopics

**类型**: BASE TABLE

| 列名        | 数据类型 | 可空 | 默认值 | 说明 |
| ----------- | -------- | ---- | ------ | ---- |
| id          | text     | 是   | -      | -    |
| theme_id    | text     | 是   | -      | -    |
| lang        | text     | 是   | -      | -    |
| level       | integer  | 是   | -      | -    |
| genre       | text     | 是   | -      | -    |
| title_cn    | text     | 是   | -      | -    |
| seed_en     | text     | 是   | -      | -    |
| one_line_cn | text     | 是   | -      | -    |
| tags        | text     | 是   | -      | -    |
| status      | text     | 是   | -      | -    |
| created_by  | text     | 是   | -      | -    |
| created_at  | text     | 是   | -      | -    |
| updated_at  | text     | 是   | -      | -    |
| ai_provider | text     | 是   | -      | -    |
| ai_model    | text     | 是   | -      | -    |
| ai_usage    | jsonb    | 是   | -      | -    |

### article_drafts

**类型**: BASE TABLE

| 列名                 | 数据类型 | 可空 | 默认值 | 说明 |
| -------------------- | -------- | ---- | ------ | ---- |
| id                   | text     | 是   | -      | -    |
| source               | text     | 是   | -      | -    |
| lang                 | text     | 是   | -      | -    |
| genre                | text     | 是   | -      | -    |
| difficulty           | integer  | 是   | -      | -    |
| title                | text     | 是   | -      | -    |
| text                 | text     | 是   | -      | -    |
| license              | text     | 是   | -      | -    |
| ai_provider          | text     | 是   | -      | -    |
| ai_model             | text     | 是   | -      | -    |
| ai_params            | jsonb    | 是   | -      | -    |
| ai_usage             | jsonb    | 是   | -      | -    |
| keys                 | jsonb    | 是   | -      | -    |
| cloze_short          | text[]   | 是   | -      | -    |
| cloze_long           | text[]   | 是   | -      | -    |
| validator_report     | jsonb    | 是   | -      | -    |
| status               | text     | 是   | -      | -    |
| created_by           | text     | 是   | -      | -    |
| created_at           | text     | 是   | -      | -    |
| updated_at           | text     | 是   | -      | -    |
| published_article_id | text     | 是   | -      | -    |
| ai_answer_provider   | text     | 是   | -      | -    |
| ai_answer_model      | text     | 是   | -      | -    |
| ai_answer_usage      | jsonb    | 是   | -      | -    |
| ai_text_provider     | text     | 是   | -      | -    |
| ai_text_model        | text     | 是   | -      | -    |
| ai_text_usage        | jsonb    | 是   | -      | -    |
| ai_text_suggestion   | jsonb    | 是   | -      | -    |

### shadowing_items

**类型**: BASE TABLE

| 列名             | 数据类型 | 可空 | 默认值 | 说明 |
| ---------------- | -------- | ---- | ------ | ---- |
| id               | text     | 是   | -      | -    |
| lang             | text     | 是   | -      | -    |
| level            | integer  | 是   | -      | -    |
| title            | text     | 是   | -      | -    |
| text             | text     | 是   | -      | -    |
| audio_url        | text     | 是   | -      | -    |
| duration_ms      | text     | 是   | -      | -    |
| tokens           | text     | 是   | -      | -    |
| cefr             | text     | 是   | -      | -    |
| meta             | jsonb    | 是   | -      | -    |
| created_at       | text     | 是   | -      | -    |
| translations     | jsonb    | 是   | -      | -    |
| trans_updated_at | text     | 是   | -      | -    |
| theme_id         | text     | 是   | -      | -    |
| subtopic_id      | text     | 是   | -      | -    |

### shadowing_attempts

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### alignment_packs

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### alignment_attempts

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### cloze_drafts

**类型**: BASE TABLE

| 列名        | 数据类型 | 可空 | 默认值 | 说明 |
| ----------- | -------- | ---- | ------ | ---- |
| id          | text     | 是   | -      | -    |
| lang        | text     | 是   | -      | -    |
| level       | integer  | 是   | -      | -    |
| topic       | text     | 是   | -      | -    |
| title       | text     | 是   | -      | -    |
| passage     | text     | 是   | -      | -    |
| blanks      | text[]   | 是   | -      | -    |
| ai_provider | text     | 是   | -      | -    |
| ai_model    | text     | 是   | -      | -    |
| ai_usage    | jsonb    | 是   | -      | -    |
| status      | text     | 是   | -      | -    |
| created_by  | text     | 是   | -      | -    |
| created_at  | text     | 是   | -      | -    |

### cloze_items

**类型**: BASE TABLE

| 列名       | 数据类型 | 可空 | 默认值 | 说明 |
| ---------- | -------- | ---- | ------ | ---- |
| id         | text     | 是   | -      | -    |
| lang       | text     | 是   | -      | -    |
| level      | integer  | 是   | -      | -    |
| topic      | text     | 是   | -      | -    |
| title      | text     | 是   | -      | -    |
| passage    | text     | 是   | -      | -    |
| blanks     | text[]   | 是   | -      | -    |
| meta       | jsonb    | 是   | -      | -    |
| created_at | text     | 是   | -      | -    |

### cloze_attempts

**类型**: BASE TABLE

| 列名       | 数据类型 | 可空 | 默认值 | 说明 |
| ---------- | -------- | ---- | ------ | ---- |
| id         | text     | 是   | -      | -    |
| user_id    | text     | 是   | -      | -    |
| item_id    | text     | 是   | -      | -    |
| lang       | text     | 是   | -      | -    |
| level      | integer  | 是   | -      | -    |
| answers    | jsonb    | 是   | -      | -    |
| ai_result  | jsonb    | 是   | -      | -    |
| created_at | text     | 是   | -      | -    |

### vocab_entries

**类型**: BASE TABLE

| 列名        | 数据类型 | 可空 | 默认值 | 说明 |
| ----------- | -------- | ---- | ------ | ---- |
| id          | text     | 是   | -      | -    |
| user_id     | text     | 是   | -      | -    |
| term        | text     | 是   | -      | -    |
| lang        | text     | 是   | -      | -    |
| native_lang | text     | 是   | -      | -    |
| source      | text     | 是   | -      | -    |
| source_id   | text     | 是   | -      | -    |
| context     | text     | 是   | -      | -    |
| tags        | text[]   | 是   | -      | -    |
| status      | text     | 是   | -      | -    |
| explanation | jsonb    | 是   | -      | -    |
| created_at  | text     | 是   | -      | -    |
| updated_at  | text     | 是   | -      | -    |

### shadowing_sessions

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### user_permissions

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### voices

**类型**: BASE TABLE

| 列名                      | 数据类型 | 可空 | 默认值 | 说明 |
| ------------------------- | -------- | ---- | ------ | ---- |
| id                        | text     | 是   | -      | -    |
| name                      | text     | 是   | -      | -    |
| language_code             | text     | 是   | -      | -    |
| ssml_gender               | text     | 是   | -      | -    |
| natural_sample_rate_hertz | integer  | 是   | -      | -    |
| pricing                   | jsonb    | 是   | -      | -    |
| characteristics           | jsonb    | 是   | -      | -    |
| display_name              | text     | 是   | -      | -    |
| category                  | text     | 是   | -      | -    |
| is_active                 | boolean  | 是   | -      | -    |
| created_at                | text     | 是   | -      | -    |
| updated_at                | text     | 是   | -      | -    |
| provider                  | text     | 是   | -      | -    |
| usecase                   | text     | 是   | -      | -    |

### profiles

**类型**: BASE TABLE

| 列名           | 数据类型 | 可空 | 默认值 | 说明 |
| -------------- | -------- | ---- | ------ | ---- |
| id             | text     | 是   | -      | -    |
| username       | text     | 是   | -      | -    |
| native_lang    | text     | 是   | -      | -    |
| target_langs   | text[]   | 是   | -      | -    |
| created_at     | text     | 是   | -      | -    |
| bio            | text     | 是   | -      | -    |
| goals          | text     | 是   | -      | -    |
| preferred_tone | text     | 是   | -      | -    |
| domains        | text[]   | 是   | -      | -    |
| role           | text     | 是   | -      | -    |

### articles

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### article_keys

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### article_cloze

**类型**: BASE TABLE

| 列名 | 数据类型 | 可空 | 默认值 | 说明 |
| ---- | -------- | ---- | ------ | ---- |

### study_cards

**类型**: BASE TABLE

| 列名       | 数据类型 | 可空 | 默认值 | 说明 |
| ---------- | -------- | ---- | ------ | ---- |
| id         | text     | 是   | -      | -    |
| user_id    | text     | 是   | -      | -    |
| lang       | text     | 是   | -      | -    |
| type       | text     | 是   | -      | -    |
| value      | jsonb    | 是   | -      | -    |
| article_id | text     | 是   | -      | -    |
| created_at | text     | 是   | -      | -    |

### article_batches

**类型**: BASE TABLE

| 列名        | 数据类型 | 可空 | 默认值 | 说明 |
| ----------- | -------- | ---- | ------ | ---- |
| id          | text     | 是   | -      | -    |
| name        | text     | 是   | -      | -    |
| provider    | text     | 是   | -      | -    |
| model       | text     | 是   | -      | -    |
| lang        | text     | 是   | -      | -    |
| genre       | text     | 是   | -      | -    |
| words       | integer  | 是   | -      | -    |
| temperature | numeric  | 是   | -      | -    |
| status      | text     | 是   | -      | -    |
| totals      | jsonb    | 是   | -      | -    |
| created_by  | text     | 是   | -      | -    |
| created_at  | text     | 是   | -      | -    |
| updated_at  | text     | 是   | -      | -    |

### article_batch_items

**类型**: BASE TABLE

| 列名            | 数据类型 | 可空 | 默认值 | 说明 |
| --------------- | -------- | ---- | ------ | ---- |
| id              | text     | 是   | -      | -    |
| batch_id        | text     | 是   | -      | -    |
| topic           | text     | 是   | -      | -    |
| difficulty      | integer  | 是   | -      | -    |
| status          | text     | 是   | -      | -    |
| result_draft_id | text     | 是   | -      | -    |
| error           | text     | 是   | -      | -    |
| usage           | jsonb    | 是   | -      | -    |
| created_at      | text     | 是   | -      | -    |
| updated_at      | text     | 是   | -      | -    |

### shadowing_drafts

**类型**: BASE TABLE

| 列名             | 数据类型 | 可空 | 默认值 | 说明 |
| ---------------- | -------- | ---- | ------ | ---- |
| id               | text     | 是   | -      | -    |
| lang             | text     | 是   | -      | -    |
| level            | integer  | 是   | -      | -    |
| topic            | text     | 是   | -      | -    |
| genre            | text     | 是   | -      | -    |
| register         | text     | 是   | -      | -    |
| title            | text     | 是   | -      | -    |
| text             | text     | 是   | -      | -    |
| notes            | jsonb    | 是   | -      | -    |
| ai_provider      | text     | 是   | -      | -    |
| ai_model         | text     | 是   | -      | -    |
| ai_usage         | jsonb    | 是   | -      | -    |
| status           | text     | 是   | -      | -    |
| created_by       | text     | 是   | -      | -    |
| created_at       | text     | 是   | -      | -    |
| translations     | jsonb    | 是   | -      | -    |
| trans_updated_at | text     | 是   | -      | -    |
| source           | text     | 是   | -      | -    |
| theme_id         | text     | 是   | -      | -    |
| subtopic_id      | text     | 是   | -      | -    |

## 统计信息

- 表数量: 22
- 外键数量: 0
- 索引数量: 0
- 触发器数量: 0
- 函数数量: 0
- RLS策略数量: 0
