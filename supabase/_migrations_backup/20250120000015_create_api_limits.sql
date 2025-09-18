-- 创建API限制设置表
CREATE TABLE IF NOT EXISTS api_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  daily_calls_limit INTEGER NOT NULL DEFAULT 1000,
  daily_tokens_limit INTEGER NOT NULL DEFAULT 1000000,
  daily_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  monthly_calls_limit INTEGER NOT NULL DEFAULT 30000,
  monthly_tokens_limit INTEGER NOT NULL DEFAULT 30000000,
  monthly_cost_limit DECIMAL(10, 2) NOT NULL DEFAULT 300.00,
  alert_threshold INTEGER NOT NULL DEFAULT 80 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建唯一约束，确保只有一条记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_limits_single ON api_limits ((1));

-- 添加注释
COMMENT ON TABLE api_limits IS 'API使用限制设置表，存储全局API使用限制配置';
COMMENT ON COLUMN api_limits.enabled IS '是否启用API使用限制';
COMMENT ON COLUMN api_limits.daily_calls_limit IS '每日调用次数限制';
COMMENT ON COLUMN api_limits.daily_tokens_limit IS '每日Token数量限制';
COMMENT ON COLUMN api_limits.daily_cost_limit IS '每日费用限制（美元）';
COMMENT ON COLUMN api_limits.monthly_calls_limit IS '每月调用次数限制';
COMMENT ON COLUMN api_limits.monthly_tokens_limit IS '每月Token数量限制';
COMMENT ON COLUMN api_limits.monthly_cost_limit IS '每月费用限制（美元）';
COMMENT ON COLUMN api_limits.alert_threshold IS '警告阈值（百分比）';

-- 启用RLS
ALTER TABLE api_limits ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 管理员可以查看和修改限制设置
CREATE POLICY "Admins can manage api limits" ON api_limits
  FOR ALL USING (public.is_admin());

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_api_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_limits_updated_at
  BEFORE UPDATE ON api_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_api_limits_updated_at();

-- 插入默认记录
INSERT INTO api_limits (id, enabled, daily_calls_limit, daily_tokens_limit, daily_cost_limit, monthly_calls_limit, monthly_tokens_limit, monthly_cost_limit, alert_threshold)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  false,
  1000,
  1000000,
  10.00,
  30000,
  30000000,
  300.00,
  80
) ON CONFLICT (id) DO NOTHING;
