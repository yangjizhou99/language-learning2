-- 修复 shadowing_items 覆盖索引大小限制问题
-- 问题：idx_shadowing_items_cover 索引包含 text 字段，导致索引行超过 PostgreSQL 限制

-- 删除有问题的索引
DROP INDEX IF EXISTS idx_shadowing_items_cover;

-- 创建新的覆盖索引，不包含 text 字段
CREATE INDEX IF NOT EXISTS idx_shadowing_items_cover 
ON public.shadowing_items(lang, level) 
INCLUDE (id, title, audio_url, duration_ms, tokens, cefr);

-- 为 text 字段创建单独的全文搜索索引（如果需要）
-- 注意：这个索引不会影响插入，因为它不包含在覆盖索引中
CREATE INDEX IF NOT EXISTS idx_shadowing_items_text_gin 
ON public.shadowing_items USING gin(to_tsvector('english', text));
