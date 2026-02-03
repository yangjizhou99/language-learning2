-- Add Primary Key to shadowing_themes if missing
-- Note: id should usually be PK.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shadowing_themes_pkey') THEN
        ALTER TABLE public.shadowing_themes ADD PRIMARY KEY (id);
    END IF;
END $$;

-- Cleanup orphans before adding constraints
DELETE FROM public.shadowing_drafts WHERE theme_id IS NOT NULL AND theme_id NOT IN (SELECT id FROM public.shadowing_themes);
DELETE FROM public.shadowing_items WHERE theme_id IS NOT NULL AND theme_id NOT IN (SELECT id FROM public.shadowing_themes);
DELETE FROM public.shadowing_subtopics WHERE theme_id IS NOT NULL AND theme_id NOT IN (SELECT id FROM public.shadowing_themes);

-- Add Foreign Keys with CASCADE
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_drafts_theme') THEN
        ALTER TABLE public.shadowing_drafts 
        ADD CONSTRAINT fk_drafts_theme FOREIGN KEY (theme_id) 
        REFERENCES public.shadowing_themes(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_items_theme') THEN
        ALTER TABLE public.shadowing_items 
        ADD CONSTRAINT fk_items_theme FOREIGN KEY (theme_id) 
        REFERENCES public.shadowing_themes(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subtopics_theme') THEN
        ALTER TABLE public.shadowing_subtopics 
        ADD CONSTRAINT fk_subtopics_theme FOREIGN KEY (theme_id) 
        REFERENCES public.shadowing_themes(id) ON DELETE CASCADE;
    END IF;
END $$;
