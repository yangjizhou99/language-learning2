-- 删除旧的主题场景向量表
-- 场景向量已迁移到小主题级别（subtopic_scene_vectors）

BEGIN;

-- 删除旧的 theme_scene_vectors 表
DROP TABLE IF EXISTS public.theme_scene_vectors CASCADE;

COMMIT;
