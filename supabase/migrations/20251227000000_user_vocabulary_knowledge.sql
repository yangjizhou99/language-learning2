-- 用户词汇知识追踪表
-- 记录用户对每个词的证据：是否标记为生词、接触次数、未标记次数等

CREATE TABLE IF NOT EXISTS user_vocabulary_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 词汇信息
    word TEXT NOT NULL,
    lemma TEXT,
    jlpt_level VARCHAR(5),
    frequency_rank INT,
    
    -- 证据数据
    marked_unknown BOOLEAN DEFAULT FALSE,      -- 是否明确标记为生词
    marked_at TIMESTAMPTZ,                     -- 标记时间
    
    exposure_count INT DEFAULT 0,              -- 文章接触次数
    not_marked_count INT DEFAULT 0,            -- 接触但未标记的次数
    
    correct_count INT DEFAULT 0,               -- 测验正确次数（预留）
    mistake_count INT DEFAULT 0,               -- 测验错误次数（预留）
    
    -- 时间戳
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, word)
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_uvk_user ON user_vocabulary_knowledge(user_id);
CREATE INDEX IF NOT EXISTS idx_uvk_word ON user_vocabulary_knowledge(word);
CREATE INDEX IF NOT EXISTS idx_uvk_level ON user_vocabulary_knowledge(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_uvk_marked ON user_vocabulary_knowledge(user_id, marked_unknown) WHERE marked_unknown = TRUE;

-- RLS 策略
ALTER TABLE user_vocabulary_knowledge ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own vocabulary knowledge"
    ON user_vocabulary_knowledge
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vocabulary knowledge"
    ON user_vocabulary_knowledge
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vocabulary knowledge"
    ON user_vocabulary_knowledge
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own vocabulary knowledge"
    ON user_vocabulary_knowledge
    FOR DELETE
    USING (auth.uid() = user_id);

-- 评论：这个表用于贝叶斯词汇预测系统
-- - marked_unknown: 用户在 shadowing 中标记为生词 → 强负向证据
-- - not_marked_count: 接触但未标记 → 弱正向证据（可能认识）
-- - exposure_count: 总接触次数
