# 数据库冲突处理机制说明

## 概述

当打包传递数据到远程数据库时，可能会遇到相同ID的题目、主题、音频等数据。系统使用PostgreSQL的`ON CONFLICT`机制来处理这些重复数据，确保数据的一致性和完整性。

## 冲突处理策略

### 1. 题目数据冲突处理

#### Shadowing题目 (`shadowing_items` 和 `shadowing_drafts`)

```sql
INSERT INTO shadowing_items (id, lang, level, title, text, audio_url, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  lang = EXCLUDED.lang,
  level = EXCLUDED.level,
  title = EXCLUDED.title,
  text = EXCLUDED.text,
  audio_url = EXCLUDED.audio_url,
  -- 更新所有字段，除了id
```

**处理方式**：
- ✅ **ID冲突**：如果题目ID已存在，更新所有字段
- ✅ **数据覆盖**：用新数据覆盖旧数据
- ✅ **保持关联**：保持`theme_id`和`subtopic_id`的关联关系

#### 主题数据冲突处理

##### 大主题 (`shadowing_themes`)

```sql
INSERT INTO shadowing_themes (id, title, title_cn, genre, description, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  title_cn = EXCLUDED.title_cn,
  genre = EXCLUDED.genre,
  description = EXCLUDED.description,
  -- 更新所有字段
```

**处理方式**：
- ✅ **主题ID冲突**：如果主题ID已存在，更新主题信息
- ✅ **内容更新**：更新标题、描述、体裁等信息
- ✅ **保持关联**：保持与子主题的关联关系

##### 小主题 (`shadowing_subtopics`)

```sql
INSERT INTO shadowing_subtopics (id, theme_id, title, title_cn, ...)
VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  theme_id = EXCLUDED.theme_id,
  title = EXCLUDED.title,
  title_cn = EXCLUDED.title_cn,
  -- 更新所有字段
```

**处理方式**：
- ✅ **子主题ID冲突**：如果子主题ID已存在，更新子主题信息
- ✅ **主题关联更新**：更新与父主题的关联关系
- ✅ **内容同步**：同步最新的子主题内容

### 2. 音频文件冲突处理

#### Supabase Storage处理

```typescript
// 音频文件上传到Supabase Storage
const { error: uploadError } = await this.supabase.storage
  .from('tts')
  .upload(fileName, data, {
    contentType: 'audio/wav',
    upsert: true  // 关键：允许覆盖同名文件
  });
```

**处理方式**：
- ✅ **文件覆盖**：使用`upsert: true`参数，同名文件会被覆盖
- ✅ **URL更新**：更新题目中的`audio_url`字段
- ✅ **版本控制**：通过时间戳参数避免缓存问题

#### 音频URL更新

```typescript
// 更新音频URL
item.audio_url = `${this.config.supabaseUrl}/storage/v1/object/public/tts/${fileName}`;
```

**处理方式**：
- ✅ **URL同步**：确保音频URL指向正确的文件
- ✅ **缓存清理**：添加时间戳参数清理浏览器缓存

### 3. 翻译数据冲突处理

#### 翻译内容更新

```typescript
// 处理翻译数据
if (item.translations && typeof item.translations === 'string') {
  const translations = JSON.parse(item.translations);
  item.translations = JSON.stringify(translations);
}
```

**处理方式**：
- ✅ **JSON验证**：确保翻译数据格式正确
- ✅ **内容覆盖**：用新翻译覆盖旧翻译
- ✅ **多语言支持**：支持英文、日文等多种翻译

## 具体场景分析

### 场景1：相同题目ID

**情况**：本地有题目ID为`abc123`的草稿，远程数据库也有相同ID的题目

**处理结果**：
```sql
-- 远程数据库执行
UPDATE shadowing_drafts SET
  title = '新的标题',
  text = '新的内容',
  audio_url = '新的音频URL',
  translations = '新的翻译',
  updated_at = NOW()
WHERE id = 'abc123';
```

**结果**：题目内容被更新，保持ID不变

### 场景2：相同主题ID

**情况**：本地有主题ID为`theme_001`的主题，远程也有相同ID的主题

**处理结果**：
```sql
-- 远程数据库执行
UPDATE shadowing_themes SET
  title = '新的主题标题',
  description = '新的主题描述',
  genre = '新的体裁',
  updated_at = NOW()
WHERE id = 'theme_001';
```

**结果**：主题信息被更新，保持ID和关联关系

### 场景3：相同音频文件

**情况**：本地和远程都有相同名称的音频文件

**处理结果**：
```typescript
// Supabase Storage处理
await supabase.storage
  .from('tts')
  .upload('shadowing/zh/abc123.wav', newAudioData, {
    upsert: true  // 覆盖现有文件
  });
```

**结果**：音频文件被覆盖，URL保持不变

### 场景4：部分数据更新

**情况**：题目存在但某些字段为空或过时

**处理结果**：
```sql
-- 只更新有值的字段
UPDATE shadowing_drafts SET
  audio_url = COALESCE(EXCLUDED.audio_url, audio_url),
  translations = COALESCE(EXCLUDED.translations, translations),
  updated_at = NOW()
WHERE id = 'abc123';
```

**结果**：保留现有数据，只更新新提供的字段

## 数据一致性保证

### 1. 事务处理

```typescript
await targetClient.query('BEGIN');
try {
  // 同步主题和子主题
  await this.syncThemesAndSubtopics(sourceClient, targetClient, items);
  
  // 同步题目数据
  await this.syncItemsToTarget(targetClient, items, 'shadowing_drafts');
  
  // 处理音频文件
  await this.processAudioFiles(items);
  
  await targetClient.query('COMMIT');
} catch (error) {
  await targetClient.query('ROLLBACK');
  throw error;
}
```

**保证**：
- ✅ **原子性**：要么全部成功，要么全部回滚
- ✅ **一致性**：数据状态始终保持一致
- ✅ **隔离性**：避免并发操作冲突

### 2. 外键约束

```sql
-- 确保主题关联的有效性
ALTER TABLE shadowing_drafts 
ADD CONSTRAINT fk_theme_id 
FOREIGN KEY (theme_id) REFERENCES shadowing_themes(id);

ALTER TABLE shadowing_drafts 
ADD CONSTRAINT fk_subtopic_id 
FOREIGN KEY (subtopic_id) REFERENCES shadowing_subtopics(id);
```

**保证**：
- ✅ **引用完整性**：确保关联的主题和子主题存在
- ✅ **数据有效性**：防止无效的关联关系

### 3. 唯一性约束

```sql
-- 确保ID唯一性
ALTER TABLE shadowing_drafts ADD CONSTRAINT pk_drafts_id PRIMARY KEY (id);
ALTER TABLE shadowing_themes ADD CONSTRAINT pk_themes_id PRIMARY KEY (id);
ALTER TABLE shadowing_subtopics ADD CONSTRAINT pk_subtopics_id PRIMARY KEY (id);
```

**保证**：
- ✅ **ID唯一性**：防止重复ID
- ✅ **冲突检测**：自动检测和处理冲突

## 错误处理机制

### 1. 数据库错误

```typescript
try {
  await client.query(query, params);
} catch (error) {
  if (error.code === '23505') { // 唯一性约束违反
    console.error('数据冲突:', error.message);
  } else if (error.code === '23503') { // 外键约束违反
    console.error('关联数据不存在:', error.message);
  } else {
    console.error('数据库错误:', error.message);
  }
  throw error;
}
```

### 2. 文件上传错误

```typescript
try {
  const { error } = await supabase.storage
    .from('tts')
    .upload(fileName, data, { upsert: true });
  
  if (error) {
    console.error('音频上传失败:', error.message);
    // 使用原始URL作为备选
    return originalAudioUrl;
  }
} catch (error) {
  console.error('文件处理失败:', error.message);
  throw error;
}
```

### 3. 网络错误

```typescript
// 重试机制
const maxRetries = 3;
let retryCount = 0;

while (retryCount < maxRetries) {
  try {
    await syncData();
    break;
  } catch (error) {
    retryCount++;
    if (retryCount >= maxRetries) {
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
  }
}
```

## 最佳实践建议

### 1. 数据备份

在同步前建议备份远程数据库：
```sql
-- 创建备份表
CREATE TABLE shadowing_drafts_backup AS SELECT * FROM shadowing_drafts;
CREATE TABLE shadowing_themes_backup AS SELECT * FROM shadowing_themes;
CREATE TABLE shadowing_subtopics_backup AS SELECT * FROM shadowing_subtopics;
```

### 2. 增量同步

考虑实现增量同步机制：
```typescript
// 只同步修改时间晚于上次同步的数据
const lastSyncTime = await getLastSyncTime();
const items = await getItemsAfter(lastSyncTime);
```

### 3. 冲突日志

记录所有冲突处理：
```typescript
const conflictLog = {
  timestamp: new Date(),
  type: 'data_conflict',
  table: 'shadowing_drafts',
  id: item.id,
  action: 'updated',
  changes: Object.keys(updatedFields)
};
```

## 总结

系统使用PostgreSQL的`ON CONFLICT`机制确保：

1. **数据更新**：相同ID的数据会被更新而不是重复插入
2. **关联保持**：主题和子主题的关联关系得到维护
3. **文件同步**：音频文件通过`upsert`机制确保最新版本
4. **事务安全**：所有操作在事务中执行，保证数据一致性
5. **错误处理**：完善的错误处理和重试机制

这种设计确保了数据同步的可靠性和一致性，避免了重复数据的问题。

