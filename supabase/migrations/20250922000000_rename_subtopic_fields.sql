-- Rename columns for shadowing_subtopics to unify naming across languages
ALTER TABLE public.shadowing_subtopics RENAME COLUMN title_cn TO title;
ALTER TABLE public.shadowing_subtopics RENAME COLUMN one_line_cn TO one_line;
ALTER TABLE public.shadowing_subtopics RENAME COLUMN seed_en TO seed;

-- Optional: update dependent views/materialized views if any (not present here)

