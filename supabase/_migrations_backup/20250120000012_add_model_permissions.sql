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
