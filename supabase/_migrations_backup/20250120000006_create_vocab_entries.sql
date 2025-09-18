-- 创建生词本表
CREATE TABLE IF NOT EXISTS vocab_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  lang TEXT NOT NULL, -- 目标语言 (en, ja, zh)
  native_lang TEXT NOT NULL, -- 用户母语 (zh, en, ja)
  source TEXT NOT NULL, -- 来源 (shadowing, manual, etc.)
  source_id UUID, -- 来源ID (如shadowing_item_id)
  context TEXT, -- 上下文句子
  tags TEXT[], -- 标签
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'starred', 'archived')),
  explanation JSONB, -- AI生成的解释
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_vocab_entries_user_id ON vocab_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_vocab_entries_term ON vocab_entries(term);
CREATE INDEX IF NOT EXISTS idx_vocab_entries_lang ON vocab_entries(lang);
CREATE INDEX IF NOT EXISTS idx_vocab_entries_status ON vocab_entries(status);
CREATE INDEX IF NOT EXISTS idx_vocab_entries_created_at ON vocab_entries(created_at);

-- 启用RLS
ALTER TABLE vocab_entries ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略：用户只能访问自己的生词
CREATE POLICY "Users can view own vocab entries" ON vocab_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocab entries" ON vocab_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocab entries" ON vocab_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocab entries" ON vocab_entries
  FOR DELETE USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vocab_entries_updated_at 
  BEFORE UPDATE ON vocab_entries 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
