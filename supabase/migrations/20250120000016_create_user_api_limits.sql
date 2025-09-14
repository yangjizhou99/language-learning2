-- 创建用户API限制表
CREATE TABLE user_api_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  daily_calls_limit INTEGER NOT NULL DEFAULT 0,
  daily_tokens_limit INTEGER NOT NULL DEFAULT 0,
  daily_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  monthly_calls_limit INTEGER NOT NULL DEFAULT 0,
  monthly_tokens_limit INTEGER NOT NULL DEFAULT 0,
  monthly_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户只有一条记录
  UNIQUE(user_id)
);

-- 添加注释
COMMENT ON TABLE user_api_limits IS '用户API使用限制表';
COMMENT ON COLUMN user_api_limits.user_id IS '用户ID';
COMMENT ON COLUMN user_api_limits.enabled IS '是否启用限制';
COMMENT ON COLUMN user_api_limits.daily_calls_limit IS '每日调用次数限制';
COMMENT ON COLUMN user_api_limits.daily_tokens_limit IS '每日Token限制';
COMMENT ON COLUMN user_api_limits.daily_cost_limit IS '每日费用限制';
COMMENT ON COLUMN user_api_limits.monthly_calls_limit IS '每月调用次数限制';
COMMENT ON COLUMN user_api_limits.monthly_tokens_limit IS '每月Token限制';
COMMENT ON COLUMN user_api_limits.monthly_cost_limit IS '每月费用限制';

-- 启用RLS
ALTER TABLE user_api_limits ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 管理员可以查看和修改所有用户的限制
CREATE POLICY "Admins can manage user api limits" ON user_api_limits
  FOR ALL USING (public.is_admin());

-- 用户可以查看自己的限制
CREATE POLICY "Users can view own limits" ON user_api_limits
  FOR SELECT USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_user_api_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_api_limits_updated_at
  BEFORE UPDATE ON user_api_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_user_api_limits_updated_at();

-- 创建索引
CREATE INDEX idx_user_api_limits_user_id ON user_api_limits(user_id);
CREATE INDEX idx_user_api_limits_enabled ON user_api_limits(enabled);
