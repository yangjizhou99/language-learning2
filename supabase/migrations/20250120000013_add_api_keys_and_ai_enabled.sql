-- 添加API密钥和AI功能开关字段到user_permissions表
-- 20250120000013_add_api_keys_and_ai_enabled.sql

-- 添加API密钥字段
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{
  "deepseek": "",
  "openrouter": ""
}'::jsonb;

-- 添加AI功能开关字段
ALTER TABLE user_permissions 
ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;

-- 为现有用户设置默认值
UPDATE user_permissions 
SET api_keys = '{
  "deepseek": "",
  "openrouter": ""
}'::jsonb
WHERE api_keys IS NULL;

UPDATE user_permissions 
SET ai_enabled = false
WHERE ai_enabled IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_permissions_api_keys 
ON user_permissions USING GIN (api_keys);

CREATE INDEX IF NOT EXISTS idx_user_permissions_ai_enabled 
ON user_permissions (ai_enabled);

-- 添加注释
COMMENT ON COLUMN user_permissions.api_keys IS '用户API密钥配置，包含DeepSeek和OpenRouter的API密钥';
COMMENT ON COLUMN user_permissions.ai_enabled IS '是否启用AI功能，控制用户是否可以使用AI生成内容';
