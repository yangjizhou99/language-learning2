# 模型权限迁移指南

## 概述

本指南将帮助你将现有的"每日最大练习次数"限制升级为更细粒度的AI模型访问控制。

## 步骤1: 在Supabase Dashboard中添加数据库字段

### 1.1 访问Supabase Dashboard

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 "SQL Editor"

### 1.2 执行数据库迁移SQL

复制以下SQL代码并在SQL Editor中执行：

```sql
-- 添加模型权限字段到user_permissions表
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

-- 添加注释
COMMENT ON COLUMN user_permissions.model_permissions IS '用户可访问的AI模型权限配置，包含模型ID、名称、提供商、每日限制和token限制';
```

### 1.3 验证迁移结果

执行以下查询验证迁移是否成功：

```sql
-- 检查字段是否添加成功
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_permissions'
AND column_name = 'model_permissions';

-- 检查现有用户的模型权限
SELECT user_id, model_permissions
FROM user_permissions
LIMIT 5;
```

## 步骤2: 验证功能

### 2.1 检查数据库更新

运行以下命令检查数据库是否已正确更新：

```bash
node check-database-schema.js
```

### 2.2 测试权限管理页面

1. 访问权限管理页面：`http://localhost:3000/admin/users/82f4e416-ab28-4ba5-bbef-74938c2bfec3/permissions`
2. 点击"模型控制"标签页
3. 验证是否能看到模型权限配置界面

## 步骤3: 功能说明

### 3.1 新的权限结构

- **模型ID**: 唯一标识符（如 `deepseek-chat`）
- **模型名称**: 显示名称（如 `DeepSeek Chat`）
- **提供商**: 模型提供商（deepseek, openai, anthropic, openrouter）
- **每日限制**: 每天可以使用的次数
- **Token限制**: 每次请求的最大token数量
- **启用状态**: 是否允许用户使用该模型

### 3.2 默认配置

- **DeepSeek Chat**: 50次/日，100,000 tokens
- **GPT-4o**: 20次/日，50,000 tokens
- **Claude 3.5 Sonnet**: 30次/日，75,000 tokens

### 3.3 管理功能

- ✅ 添加新模型权限
- ✅ 编辑现有模型配置
- ✅ 启用/禁用特定模型
- ✅ 删除不需要的模型权限
- ✅ 实时权限摘要显示

## 故障排除

### 问题1: 字段添加失败

**错误**: `column "model_permissions" already exists`
**解决**: 字段已存在，可以继续下一步

### 问题2: 权限更新失败

**错误**: `permission denied for table user_permissions`
**解决**: 确保使用服务角色密钥，检查RLS策略

### 问题3: 页面显示错误

**错误**: 权限管理页面显示异常
**解决**: 检查浏览器控制台错误，确保代码已正确部署

## 回滚方案

如果需要回滚到原来的简单限制，可以执行：

```sql
-- 删除model_permissions字段（会丢失数据）
ALTER TABLE user_permissions DROP COLUMN IF EXISTS model_permissions;

-- 删除相关索引
DROP INDEX IF EXISTS idx_user_permissions_model_permissions;
```

## 总结

完成此迁移后，你将拥有：

1. 更细粒度的AI模型访问控制
2. 每个模型的独立使用限制
3. Token使用量控制
4. 灵活的模型权限管理界面

这将为你的语言学习应用提供更精确的资源管理和成本控制。
