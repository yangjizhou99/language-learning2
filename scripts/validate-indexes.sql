-- 验证增量索引命中（请在 Supabase SQL Editor 执行）

EXPLAIN ANALYZE
SELECT id
FROM public.article_drafts
WHERE status = 'pending' AND updated_at > now() - interval '30 days'
ORDER BY updated_at DESC
LIMIT 200;

EXPLAIN ANALYZE
SELECT id
FROM public.shadowing_items
WHERE status = 'approved' AND updated_at > now() - interval '30 days'
ORDER BY updated_at DESC
LIMIT 200;

EXPLAIN ANALYZE
SELECT id
FROM public.articles
WHERE lang = 'ja' AND genre = 'news' AND updated_at > now() - interval '30 days'
ORDER BY updated_at DESC
LIMIT 200;


