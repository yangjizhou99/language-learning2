-- 创建API使用日志表
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'deepseek', 'openrouter', 'openai', etc.
  model VARCHAR(100) NOT NULL, -- 'deepseek-chat', 'gpt-4o', etc.
  tokens_used INTEGER DEFAULT 0,
  cost DECIMAL(10, 6) DEFAULT 0.0,
  request_data JSONB, -- 存储请求数据（可选）
  response_data JSONB, -- 存储响应数据（可选）
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_provider ON api_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_created ON api_usage_logs(user_id, created_at);

-- 创建复合索引用于统计查询
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_stats ON api_usage_logs(user_id, provider, created_at);

-- 添加注释
COMMENT ON TABLE api_usage_logs IS 'API使用日志表，记录用户API调用情况';
COMMENT ON COLUMN api_usage_logs.user_id IS '用户ID';
COMMENT ON COLUMN api_usage_logs.provider IS 'API提供商';
COMMENT ON COLUMN api_usage_logs.model IS '使用的模型';
COMMENT ON COLUMN api_usage_logs.tokens_used IS '使用的Token数量';
COMMENT ON COLUMN api_usage_logs.cost IS '费用（美元）';
COMMENT ON COLUMN api_usage_logs.request_data IS '请求数据（JSON格式）';
COMMENT ON COLUMN api_usage_logs.response_data IS '响应数据（JSON格式）';

-- 启用RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 管理员可以查看所有日志
CREATE POLICY "Admins can view all api usage logs" ON api_usage_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_permissions 
      WHERE user_permissions.user_id = auth.uid() 
      AND user_permissions.is_admin = true
    )
  );

-- 用户可以查看自己的日志
CREATE POLICY "Users can view own api usage logs" ON api_usage_logs
  FOR SELECT USING (user_id = auth.uid());

-- 系统可以插入日志（通过服务角色）
CREATE POLICY "Service role can insert api usage logs" ON api_usage_logs
  FOR INSERT WITH CHECK (true);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_api_usage_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_usage_logs_updated_at
  BEFORE UPDATE ON api_usage_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_api_usage_logs_updated_at();
