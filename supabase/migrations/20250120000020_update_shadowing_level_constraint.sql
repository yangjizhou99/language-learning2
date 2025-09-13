-- 更新shadowing相关表的level约束，支持L1-L6等级
-- 更新shadowing_drafts表的level约束
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_drafts' AND column_name = 'level') THEN
        ALTER TABLE public.shadowing_drafts DROP CONSTRAINT IF EXISTS shadowing_drafts_level_check;
        ALTER TABLE public.shadowing_drafts ADD CONSTRAINT shadowing_drafts_level_check CHECK (level BETWEEN 1 AND 6);
    END IF;
END $$;

-- 更新shadowing_items表的level约束
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shadowing_items' AND column_name = 'level') THEN
        ALTER TABLE public.shadowing_items DROP CONSTRAINT IF EXISTS shadowing_items_level_check;
        ALTER TABLE public.shadowing_items ADD CONSTRAINT shadowing_items_level_check CHECK (level BETWEEN 1 AND 6);
    END IF;
END $$;

-- 更新cloze相关表的level约束
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cloze_drafts' AND column_name = 'level') THEN
        ALTER TABLE public.cloze_drafts DROP CONSTRAINT IF EXISTS cloze_drafts_level_check;
        ALTER TABLE public.cloze_drafts ADD CONSTRAINT cloze_drafts_level_check CHECK (level BETWEEN 1 AND 6);
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cloze_items' AND column_name = 'level') THEN
        ALTER TABLE public.cloze_items DROP CONSTRAINT IF EXISTS cloze_items_level_check;
        ALTER TABLE public.cloze_items ADD CONSTRAINT cloze_items_level_check CHECK (level BETWEEN 1 AND 6);
    END IF;
END $$;
