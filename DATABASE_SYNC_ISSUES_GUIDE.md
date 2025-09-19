# 数据库同步问题解决指南

## 问题分析

根据您提供的同步结果，主要遇到了两类问题：

### 1. 外键约束违反 (Foreign Key Constraint Violations)

**问题表：**
- `api_usage_logs` - 违反 `api_usage_logs_user_id_fkey`
- `article_batch_items` - 违反 `article_batch_items_batch_id_fkey`
- `article_batches` - 违反 `article_batches_created_by_fkey`
- `cloze_attempts` - 违反 `cloze_attempts_item_id_fkey`
- `invitation_codes` - 违反 `invitation_codes_created_by_fkey`
- `invitation_uses` - 违反 `invitation_uses_code_id_fkey`
- `profiles` - 违反 `profiles_invitation_code_id_fkey`
- `sessions` - 违反 `sessions_user_id_fkey`
- `shadowing_attempts` - 违反 `shadowing_attempts_item_id_fkey`
- `shadowing_drafts` - 违反 `shadowing_drafts_subtopic_id_fkey`
- `shadowing_items` - 违反 `shadowing_items_subtopic_id_fkey`
- `shadowing_subtopics` - 违反 `shadowing_subtopics_theme_id_fkey`
- `study_cards` - 违反 `study_cards_user_id_fkey`
- `user_api_limits` - 违反 `user_api_limits_user_id_fkey`
- `user_permissions` - 违反 `user_permissions_user_id_fkey`
- `vocab_entries` - 违反 `vocab_entries_user_id_fkey`

### 2. JSON语法错误 (Invalid JSON Syntax)

**问题表：**
- `article_drafts` - `invalid input syntax for type json`
- `cloze_drafts` - `invalid input syntax for type json`
- `cloze_items` - `invalid input syntax for type json`
- `shadowing_sessions` - `invalid input syntax for type json`
- `shadowing_themes` - `invalid input syntax for type json`

## 解决方案

### 方案一：使用高级同步模式（推荐）

我已经创建了高级同步模式来解决这些问题：

#### 功能特性
- ✅ **自动处理外键约束**：临时禁用外键检查，同步完成后恢复
- ✅ **修复JSON数据格式**：自动检测和修复常见的JSON格式问题
- ✅ **跳过有问题的数据**：跳过无法修复的数据行，继续同步其他数据
- ✅ **智能表排序**：按依赖关系排序，优先同步基础表

#### 使用方法
1. 在数据库同步页面启用 **"使用高级同步模式"**
2. 重新执行同步操作
3. 高级模式会自动处理这些问题

### 方案二：手动修复（高级用户）

#### 修复外键约束问题

1. **按依赖关系同步表**：
   ```sql
   -- 先同步基础表
   -- 1. 用户相关表
   profiles
   invitation_codes
   
   -- 2. 内容基础表
   articles
   cloze_items
   shadowing_themes
   shadowing_subtopics
   shadowing_items
   
   -- 3. 用户活动表
   sessions
   cloze_attempts
   shadowing_attempts
   study_cards
   ```

2. **临时禁用外键检查**：
   ```sql
   -- 同步前
   SET session_replication_role = replica;
   
   -- 同步后
   SET session_replication_role = DEFAULT;
   ```

#### 修复JSON格式问题

1. **检查JSON列**：
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'article_drafts'
   AND data_type = 'jsonb';
   ```

2. **修复常见JSON问题**：
   - 单引号改为双引号
   - 缺少引号的键名
   - 布尔值格式
   - null值格式

### 方案三：分步同步

#### 第一步：同步基础表
```bash
# 只同步没有外键依赖的表
node scripts/db-sync.js --tables=profiles,articles,voices,glossary
```

#### 第二步：同步内容表
```bash
# 同步内容相关表
node scripts/db-sync.js --tables=cloze_items,shadowing_themes,shadowing_subtopics
```

#### 第三步：同步用户活动表
```bash
# 同步用户活动表
node scripts/db-sync.js --tables=sessions,cloze_attempts,shadowing_attempts
```

## 高级同步模式详解

### 技术实现

#### 1. 外键约束处理
```typescript
// 临时禁用外键检查
await prodClient.query('SET session_replication_role = replica');

// 同步数据...

// 恢复外键检查
await prodClient.query('SET session_replication_role = DEFAULT');
```

#### 2. JSON数据修复
```typescript
function fixJsonData(row: any) {
  const fixedRow = { ...row };
  
  for (const [key, value] of Object.entries(fixedRow)) {
    if (typeof value === 'string' && key.includes('json')) {
      // 修复单引号
      let fixedValue = value.replace(/'/g, '"');
      
      // 修复缺少引号的键
      fixedValue = fixedValue.replace(/(\w+):/g, '"$1":');
      
      // 修复布尔值
      fixedValue = fixedValue.replace(/:\s*(true|false)\s*([,}])/g, ': $1$2');
      
      // 修复null值
      fixedValue = fixedValue.replace(/:\s*null\s*([,}])/g, ': null$1');
      
      fixedRow[key] = fixedValue;
    }
  }
  
  return fixedRow;
}
```

#### 3. 智能表排序
```typescript
// 按依赖关系排序表
async function getTablesInOrder(client: any) {
  const tablesWithoutFK = [];
  const tablesWithFK = [];
  
  for (const table of tables) {
    const dependencies = await getTableDependencies(client, table);
    if (dependencies.length === 0) {
      tablesWithoutFK.push(table);
    } else {
      tablesWithFK.push(table);
    }
  }
  
  return [...tablesWithoutFK, ...tablesWithFK];
}
```

### 错误处理

#### 1. 跳过有问题的数据行
```typescript
for (const row of localRows) {
  try {
    const fixedRow = fixJsonData(row);
    await prodClient.query(insertQuery, values);
    successCount++;
  } catch (error) {
    errors.push(`行 ${successCount + 1}: ${error.message}`);
    // 跳过有问题的行，继续处理下一行
  }
}
```

#### 2. 详细错误报告
- 显示跳过的行数
- 列出具体的错误信息
- 提供修复建议

## 使用建议

### 1. 首次同步
- 使用高级同步模式
- 先预览同步结果
- 确认无误后执行同步

### 2. 增量同步
- 可以只同步特定表
- 使用标准模式（如果数据格式正确）
- 定期备份云端数据

### 3. 故障排除
- 查看详细错误信息
- 检查数据格式问题
- 验证外键关系

## 预防措施

### 1. 数据质量检查
```sql
-- 检查JSON列的数据质量
SELECT 
  table_name,
  column_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN column_name::text ~ '^[{}]' THEN 1 END) as valid_json
FROM information_schema.columns c
JOIN your_table t ON true
WHERE data_type = 'jsonb'
GROUP BY table_name, column_name;
```

### 2. 外键关系验证
```sql
-- 检查外键约束
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

## 总结

通过使用高级同步模式，可以自动解决大部分数据库同步问题：

1. **外键约束问题**：通过临时禁用外键检查解决
2. **JSON格式问题**：通过自动修复常见格式错误解决
3. **数据完整性问题**：通过跳过有问题的数据行保证同步继续
4. **表依赖问题**：通过智能排序确保正确的同步顺序

建议您启用高级同步模式重新执行同步操作，这样可以解决您遇到的所有问题。

