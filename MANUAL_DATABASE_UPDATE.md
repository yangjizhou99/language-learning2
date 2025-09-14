# 手动数据库更新指南

## 问题
当前代码中使用了`model_permissions`字段，但该字段在数据库中不存在，导致"Cannot read properties of undefined (reading 'map')"错误。

## 解决方案

### 方法1：在Supabase Dashboard中添加字段（推荐）

1. 登录到 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择您的项目
3. 进入 **SQL Editor**
4. 执行以下SQL语句：

```sql
-- 添加model_permissions字段
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS model_permissions JSONB DEFAULT '[]'::jsonb;

-- 为现有用户添加默认模型权限
UPDATE user_permissions
SET model_permissions = '[
  {
    "model_id": "deepseek-chat",
    "model_name": "DeepSeek Chat",
    "provider": "deepseek",
    "daily_limit": 50,
    "token_limit": 100000,
    "enabled": true
  },
  {
    "model_id": "gpt-4o",
    "model_name": "GPT-4o",
    "provider": "openai",
    "daily_limit": 20,
    "token_limit": 50000,
    "enabled": true
  },
  {
    "model_id": "claude-3.5-sonnet",
    "model_name": "Claude 3.5 Sonnet",
    "provider": "anthropic",
    "daily_limit": 30,
    "token_limit": 75000,
    "enabled": true
  }
]'::jsonb
WHERE model_permissions IS NULL OR model_permissions = '[]'::jsonb;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_permissions_model_permissions
ON user_permissions USING GIN (model_permissions);
```

### 方法2：使用Supabase CLI（如果已配置）

```bash
# 创建迁移文件
npx supabase migration new add_model_permissions

# 在生成的迁移文件中添加上述SQL
# 然后应用迁移
npx supabase db push
```

## 验证更新

执行以下命令验证字段是否添加成功：

```bash
node add-model-permissions-direct.js
```

## 临时解决方案

如果暂时无法更新数据库，代码已经修改为：
- 在`model_permissions`为`undefined`时使用空数组`[]`
- 在权限管理页面中提供默认的模型权限配置
- 确保所有`map`操作都有安全检查

## 功能说明

添加`model_permissions`字段后，您将获得：

1. **AI模型访问控制**：管理员可以为每个用户配置可访问的AI模型
2. **每日使用限制**：为每个模型设置每日使用次数限制
3. **Token限制**：为每个模型设置Token使用限制
4. **模型启用/禁用**：可以启用或禁用特定模型
5. **动态管理**：支持添加、删除和修改模型权限

## 注意事项

- 确保在添加字段前备份数据库
- 字段添加后，现有用户将自动获得默认的模型权限
- 建议在生产环境执行前先在测试环境验证
