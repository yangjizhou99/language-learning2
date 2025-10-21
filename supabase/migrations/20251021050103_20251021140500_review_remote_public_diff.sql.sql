-- REVIEW: Potentially breaks automatic updated_at for shadowing_items; keep disabled until confirmed
-- drop trigger if exists "shadowing_items_set_updated_at" on "public"."shadowing_items";

drop policy "profiles_select_own" on "public"."profiles";

drop policy "profiles_update_own" on "public"."profiles";

-- en_phoneme_units table may not exist in remote database, skipping permissions revoke
-- revoke delete on table "public"."en_phoneme_units" from "anon";
-- revoke insert on table "public"."en_phoneme_units" from "anon";
-- revoke references on table "public"."en_phoneme_units" from "anon";
-- revoke select on table "public"."en_phoneme_units" from "anon";
-- revoke trigger on table "public"."en_phoneme_units" from "anon";
-- revoke truncate on table "public"."en_phoneme_units" from "anon";
-- revoke update on table "public"."en_phoneme_units" from "anon";
-- revoke delete on table "public"."en_phoneme_units" from "authenticated";
-- revoke insert on table "public"."en_phoneme_units" from "authenticated";
-- revoke references on table "public"."en_phoneme_units" from "authenticated";
-- revoke select on table "public"."en_phoneme_units" from "authenticated";
-- revoke trigger on table "public"."en_phoneme_units" from "authenticated";
-- revoke truncate on table "public"."en_phoneme_units" from "authenticated";
-- revoke update on table "public"."en_phoneme_units" from "authenticated";
-- revoke delete on table "public"."en_phoneme_units" from "service_role";
-- revoke insert on table "public"."en_phoneme_units" from "service_role";
-- revoke references on table "public"."en_phoneme_units" from "service_role";
-- revoke select on table "public"."en_phoneme_units" from "service_role";
-- revoke trigger on table "public"."en_phoneme_units" from "service_role";
-- revoke truncate on table "public"."en_phoneme_units" from "service_role";
-- revoke update on table "public"."en_phoneme_units" from "service_role";

-- ja_phoneme_units table does not exist in remote database, skipping permissions revoke
-- revoke delete on table "public"."ja_phoneme_units" from "anon";
-- revoke insert on table "public"."ja_phoneme_units" from "anon";
-- revoke references on table "public"."ja_phoneme_units" from "anon";
-- revoke select on table "public"."ja_phoneme_units" from "anon";
-- revoke trigger on table "public"."ja_phoneme_units" from "anon";
-- revoke truncate on table "public"."ja_phoneme_units" from "anon";
-- revoke update on table "public"."ja_phoneme_units" from "anon";
-- revoke delete on table "public"."ja_phoneme_units" from "authenticated";
-- revoke insert on table "public"."ja_phoneme_units" from "authenticated";
-- revoke references on table "public"."ja_phoneme_units" from "authenticated";
-- revoke select on table "public"."ja_phoneme_units" from "authenticated";
-- revoke trigger on table "public"."ja_phoneme_units" from "authenticated";
-- revoke truncate on table "public"."ja_phoneme_units" from "authenticated";
-- revoke update on table "public"."ja_phoneme_units" from "authenticated";
-- revoke delete on table "public"."ja_phoneme_units" from "service_role";
-- revoke insert on table "public"."ja_phoneme_units" from "service_role";
-- revoke references on table "public"."ja_phoneme_units" from "service_role";
-- revoke select on table "public"."ja_phoneme_units" from "service_role";
-- revoke trigger on table "public"."ja_phoneme_units" from "service_role";
-- revoke truncate on table "public"."ja_phoneme_units" from "service_role";
-- revoke update on table "public"."ja_phoneme_units" from "service_role";

revoke delete on table "public"."minimal_pairs" from "anon";

revoke insert on table "public"."minimal_pairs" from "anon";

revoke references on table "public"."minimal_pairs" from "anon";

revoke select on table "public"."minimal_pairs" from "anon";

revoke trigger on table "public"."minimal_pairs" from "anon";

revoke truncate on table "public"."minimal_pairs" from "anon";

revoke update on table "public"."minimal_pairs" from "anon";

revoke delete on table "public"."minimal_pairs" from "authenticated";

revoke insert on table "public"."minimal_pairs" from "authenticated";

revoke references on table "public"."minimal_pairs" from "authenticated";

revoke select on table "public"."minimal_pairs" from "authenticated";

revoke trigger on table "public"."minimal_pairs" from "authenticated";

revoke truncate on table "public"."minimal_pairs" from "authenticated";

revoke update on table "public"."minimal_pairs" from "authenticated";

revoke delete on table "public"."minimal_pairs" from "service_role";

revoke insert on table "public"."minimal_pairs" from "service_role";

revoke references on table "public"."minimal_pairs" from "service_role";

revoke select on table "public"."minimal_pairs" from "service_role";

revoke trigger on table "public"."minimal_pairs" from "service_role";

revoke truncate on table "public"."minimal_pairs" from "service_role";

revoke update on table "public"."minimal_pairs" from "service_role";

revoke delete on table "public"."pron_sentences" from "anon";

revoke insert on table "public"."pron_sentences" from "anon";

revoke references on table "public"."pron_sentences" from "anon";

revoke select on table "public"."pron_sentences" from "anon";

revoke trigger on table "public"."pron_sentences" from "anon";

revoke truncate on table "public"."pron_sentences" from "anon";

revoke update on table "public"."pron_sentences" from "anon";

revoke delete on table "public"."pron_sentences" from "authenticated";

revoke insert on table "public"."pron_sentences" from "authenticated";

revoke references on table "public"."pron_sentences" from "authenticated";

revoke select on table "public"."pron_sentences" from "authenticated";

revoke trigger on table "public"."pron_sentences" from "authenticated";

revoke truncate on table "public"."pron_sentences" from "authenticated";

revoke update on table "public"."pron_sentences" from "authenticated";

revoke delete on table "public"."pron_sentences" from "service_role";

revoke insert on table "public"."pron_sentences" from "service_role";

revoke references on table "public"."pron_sentences" from "service_role";

revoke select on table "public"."pron_sentences" from "service_role";

revoke trigger on table "public"."pron_sentences" from "service_role";

revoke truncate on table "public"."pron_sentences" from "service_role";

revoke update on table "public"."pron_sentences" from "service_role";

revoke delete on table "public"."sentence_units" from "anon";

revoke insert on table "public"."sentence_units" from "anon";

revoke references on table "public"."sentence_units" from "anon";

revoke select on table "public"."sentence_units" from "anon";

revoke trigger on table "public"."sentence_units" from "anon";

revoke truncate on table "public"."sentence_units" from "anon";

revoke update on table "public"."sentence_units" from "anon";

revoke delete on table "public"."sentence_units" from "authenticated";

revoke insert on table "public"."sentence_units" from "authenticated";

revoke references on table "public"."sentence_units" from "authenticated";

revoke select on table "public"."sentence_units" from "authenticated";

revoke trigger on table "public"."sentence_units" from "authenticated";

revoke truncate on table "public"."sentence_units" from "authenticated";

revoke update on table "public"."sentence_units" from "authenticated";

revoke delete on table "public"."sentence_units" from "service_role";

revoke insert on table "public"."sentence_units" from "service_role";

revoke references on table "public"."sentence_units" from "service_role";

revoke select on table "public"."sentence_units" from "service_role";

revoke trigger on table "public"."sentence_units" from "service_role";

revoke truncate on table "public"."sentence_units" from "service_role";

revoke update on table "public"."sentence_units" from "service_role";

revoke delete on table "public"."training_content" from "anon";

revoke insert on table "public"."training_content" from "anon";

revoke references on table "public"."training_content" from "anon";

revoke select on table "public"."training_content" from "anon";

revoke trigger on table "public"."training_content" from "anon";

revoke truncate on table "public"."training_content" from "anon";

revoke update on table "public"."training_content" from "anon";

revoke delete on table "public"."training_content" from "authenticated";

revoke insert on table "public"."training_content" from "authenticated";

revoke references on table "public"."training_content" from "authenticated";

revoke select on table "public"."training_content" from "authenticated";

revoke trigger on table "public"."training_content" from "authenticated";

revoke truncate on table "public"."training_content" from "authenticated";

revoke update on table "public"."training_content" from "authenticated";

revoke delete on table "public"."training_content" from "service_role";

revoke insert on table "public"."training_content" from "service_role";

revoke references on table "public"."training_content" from "service_role";

revoke select on table "public"."training_content" from "service_role";

revoke trigger on table "public"."training_content" from "service_role";

revoke truncate on table "public"."training_content" from "service_role";

revoke update on table "public"."training_content" from "service_role";

revoke delete on table "public"."unit_alias" from "anon";

revoke insert on table "public"."unit_alias" from "anon";

revoke references on table "public"."unit_alias" from "anon";

revoke select on table "public"."unit_alias" from "anon";

revoke trigger on table "public"."unit_alias" from "anon";

revoke truncate on table "public"."unit_alias" from "anon";

revoke update on table "public"."unit_alias" from "anon";

revoke delete on table "public"."unit_alias" from "authenticated";

revoke insert on table "public"."unit_alias" from "authenticated";

revoke references on table "public"."unit_alias" from "authenticated";

revoke select on table "public"."unit_alias" from "authenticated";

revoke trigger on table "public"."unit_alias" from "authenticated";

revoke truncate on table "public"."unit_alias" from "authenticated";

revoke update on table "public"."unit_alias" from "authenticated";

revoke delete on table "public"."unit_alias" from "service_role";

revoke insert on table "public"."unit_alias" from "service_role";

revoke references on table "public"."unit_alias" from "service_role";

revoke select on table "public"."unit_alias" from "service_role";

revoke trigger on table "public"."unit_alias" from "service_role";

revoke truncate on table "public"."unit_alias" from "service_role";

revoke update on table "public"."unit_alias" from "service_role";

revoke delete on table "public"."unit_catalog" from "anon";

revoke insert on table "public"."unit_catalog" from "anon";

revoke references on table "public"."unit_catalog" from "anon";

revoke select on table "public"."unit_catalog" from "anon";

revoke trigger on table "public"."unit_catalog" from "anon";

revoke truncate on table "public"."unit_catalog" from "anon";

revoke update on table "public"."unit_catalog" from "anon";

revoke delete on table "public"."unit_catalog" from "authenticated";

revoke insert on table "public"."unit_catalog" from "authenticated";

revoke references on table "public"."unit_catalog" from "authenticated";

revoke select on table "public"."unit_catalog" from "authenticated";

revoke trigger on table "public"."unit_catalog" from "authenticated";

revoke truncate on table "public"."unit_catalog" from "authenticated";

revoke update on table "public"."unit_catalog" from "authenticated";

revoke delete on table "public"."unit_catalog" from "service_role";

revoke insert on table "public"."unit_catalog" from "service_role";

revoke references on table "public"."unit_catalog" from "service_role";

revoke select on table "public"."unit_catalog" from "service_role";

revoke trigger on table "public"."unit_catalog" from "service_role";

revoke truncate on table "public"."unit_catalog" from "service_role";

revoke update on table "public"."unit_catalog" from "service_role";

revoke delete on table "public"."user_pron_attempts" from "anon";

revoke insert on table "public"."user_pron_attempts" from "anon";

revoke references on table "public"."user_pron_attempts" from "anon";

revoke select on table "public"."user_pron_attempts" from "anon";

revoke trigger on table "public"."user_pron_attempts" from "anon";

revoke truncate on table "public"."user_pron_attempts" from "anon";

revoke update on table "public"."user_pron_attempts" from "anon";

revoke delete on table "public"."user_pron_attempts" from "authenticated";

revoke insert on table "public"."user_pron_attempts" from "authenticated";

revoke references on table "public"."user_pron_attempts" from "authenticated";

revoke select on table "public"."user_pron_attempts" from "authenticated";

revoke trigger on table "public"."user_pron_attempts" from "authenticated";

revoke truncate on table "public"."user_pron_attempts" from "authenticated";

revoke update on table "public"."user_pron_attempts" from "authenticated";

revoke delete on table "public"."user_pron_attempts" from "service_role";

revoke insert on table "public"."user_pron_attempts" from "service_role";

revoke references on table "public"."user_pron_attempts" from "service_role";

revoke select on table "public"."user_pron_attempts" from "service_role";

revoke trigger on table "public"."user_pron_attempts" from "service_role";

revoke truncate on table "public"."user_pron_attempts" from "service_role";

revoke update on table "public"."user_pron_attempts" from "service_role";

revoke delete on table "public"."user_pron_verifications" from "anon";

revoke insert on table "public"."user_pron_verifications" from "anon";

revoke references on table "public"."user_pron_verifications" from "anon";

revoke select on table "public"."user_pron_verifications" from "anon";

revoke trigger on table "public"."user_pron_verifications" from "anon";

revoke truncate on table "public"."user_pron_verifications" from "anon";

revoke update on table "public"."user_pron_verifications" from "anon";

revoke delete on table "public"."user_pron_verifications" from "authenticated";

revoke insert on table "public"."user_pron_verifications" from "authenticated";

revoke references on table "public"."user_pron_verifications" from "authenticated";

revoke select on table "public"."user_pron_verifications" from "authenticated";

revoke trigger on table "public"."user_pron_verifications" from "authenticated";

revoke truncate on table "public"."user_pron_verifications" from "authenticated";

revoke update on table "public"."user_pron_verifications" from "authenticated";

revoke delete on table "public"."user_pron_verifications" from "service_role";

revoke insert on table "public"."user_pron_verifications" from "service_role";

revoke references on table "public"."user_pron_verifications" from "service_role";

revoke select on table "public"."user_pron_verifications" from "service_role";

revoke trigger on table "public"."user_pron_verifications" from "service_role";

revoke truncate on table "public"."user_pron_verifications" from "service_role";

revoke update on table "public"."user_pron_verifications" from "service_role";

revoke delete on table "public"."user_sentence_progress" from "anon";

revoke insert on table "public"."user_sentence_progress" from "anon";

revoke references on table "public"."user_sentence_progress" from "anon";

revoke select on table "public"."user_sentence_progress" from "anon";

revoke trigger on table "public"."user_sentence_progress" from "anon";

revoke truncate on table "public"."user_sentence_progress" from "anon";

revoke update on table "public"."user_sentence_progress" from "anon";

revoke delete on table "public"."user_sentence_progress" from "authenticated";

revoke insert on table "public"."user_sentence_progress" from "authenticated";

revoke references on table "public"."user_sentence_progress" from "authenticated";

revoke select on table "public"."user_sentence_progress" from "authenticated";

revoke trigger on table "public"."user_sentence_progress" from "authenticated";

revoke truncate on table "public"."user_sentence_progress" from "authenticated";

revoke update on table "public"."user_sentence_progress" from "authenticated";

revoke delete on table "public"."user_sentence_progress" from "service_role";

revoke insert on table "public"."user_sentence_progress" from "service_role";

revoke references on table "public"."user_sentence_progress" from "service_role";

revoke select on table "public"."user_sentence_progress" from "service_role";

revoke trigger on table "public"."user_sentence_progress" from "service_role";

revoke truncate on table "public"."user_sentence_progress" from "service_role";

revoke update on table "public"."user_sentence_progress" from "service_role";

revoke delete on table "public"."user_unit_stats" from "anon";

revoke insert on table "public"."user_unit_stats" from "anon";

revoke references on table "public"."user_unit_stats" from "anon";

revoke select on table "public"."user_unit_stats" from "anon";

revoke trigger on table "public"."user_unit_stats" from "anon";

revoke truncate on table "public"."user_unit_stats" from "anon";

revoke update on table "public"."user_unit_stats" from "anon";

revoke delete on table "public"."user_unit_stats" from "authenticated";

revoke insert on table "public"."user_unit_stats" from "authenticated";

revoke references on table "public"."user_unit_stats" from "authenticated";

revoke select on table "public"."user_unit_stats" from "authenticated";

revoke trigger on table "public"."user_unit_stats" from "authenticated";

revoke truncate on table "public"."user_unit_stats" from "authenticated";

revoke update on table "public"."user_unit_stats" from "authenticated";

revoke delete on table "public"."user_unit_stats" from "service_role";

revoke insert on table "public"."user_unit_stats" from "service_role";

revoke references on table "public"."user_unit_stats" from "service_role";

revoke select on table "public"."user_unit_stats" from "service_role";

revoke trigger on table "public"."user_unit_stats" from "service_role";

revoke truncate on table "public"."user_unit_stats" from "service_role";

revoke update on table "public"."user_unit_stats" from "service_role";

-- zh_pinyin_units table may not exist in remote database, skipping permissions revoke
-- revoke delete on table "public"."zh_pinyin_units" from "anon";
-- revoke insert on table "public"."zh_pinyin_units" from "anon";
-- revoke references on table "public"."zh_pinyin_units" from "anon";
-- revoke select on table "public"."zh_pinyin_units" from "anon";
-- revoke trigger on table "public"."zh_pinyin_units" from "anon";
-- revoke truncate on table "public"."zh_pinyin_units" from "anon";
-- revoke update on table "public"."zh_pinyin_units" from "anon";
-- revoke delete on table "public"."zh_pinyin_units" from "authenticated";
-- revoke insert on table "public"."zh_pinyin_units" from "authenticated";
-- revoke references on table "public"."zh_pinyin_units" from "authenticated";
-- revoke select on table "public"."zh_pinyin_units" from "authenticated";
-- revoke trigger on table "public"."zh_pinyin_units" from "authenticated";
-- revoke truncate on table "public"."zh_pinyin_units" from "authenticated";
-- revoke update on table "public"."zh_pinyin_units" from "authenticated";
-- revoke delete on table "public"."zh_pinyin_units" from "service_role";
-- revoke insert on table "public"."zh_pinyin_units" from "service_role";
-- revoke references on table "public"."zh_pinyin_units" from "service_role";
-- revoke select on table "public"."zh_pinyin_units" from "service_role";
-- revoke trigger on table "public"."zh_pinyin_units" from "service_role";
-- revoke truncate on table "public"."zh_pinyin_units" from "service_role";
-- revoke update on table "public"."zh_pinyin_units" from "service_role";

-- REVIEW: keep unique id constraints for shadowing_* unless confirmed to drop
-- alter table "public"."shadowing_subtopics" drop constraint "shadowing_subtopics_id_unique";

-- alter table "public"."shadowing_themes" drop constraint "shadowing_themes_id_unique";

alter table "public"."alignment_materials" drop constraint "alignment_materials_lang_check";

alter table "public"."alignment_subtopics" drop constraint "alignment_subtopics_lang_check";

alter table "public"."alignment_themes" drop constraint "alignment_themes_lang_check";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_lang_check";

-- REVIEW: do not drop primary key on shadowing_items locally
-- alter table "public"."shadowing_items" drop constraint "shadowing_items_pkey";

-- REVIEW: keep local indexes; comment out destructive drops
-- drop index if exists "public"."idx_en_phoneme_units_category";

-- drop index if exists "public"."idx_en_phoneme_units_subcategory";

-- drop index if exists "public"."shadowing_items_pkey";

-- drop index if exists "public"."shadowing_subtopics_id_unique";

-- drop index if exists "public"."shadowing_themes_id_unique";

-- REVIEW: keep base phoneme tables for local features
-- drop table "public"."en_phoneme_units";

-- drop table "public"."ja_phoneme_units";

-- REVIEW: keep audio_url_proxy and id/defaults locally to avoid app breakage
-- alter table "public"."shadowing_items" drop column "audio_url_proxy";

-- alter table "public"."shadowing_items" alter column "created_at" drop default;

-- alter table "public"."shadowing_items" alter column "id" drop default;

-- alter table "public"."shadowing_sessions" alter column "id" drop default;

alter table "public"."voices" alter column "characteristics" set default '{}'::jsonb;

alter table "public"."voices" alter column "created_at" set default now();

alter table "public"."voices" alter column "id" set default gen_random_uuid();

alter table "public"."voices" alter column "is_active" set default true;

alter table "public"."voices" alter column "is_news_voice" set default false;

alter table "public"."voices" alter column "pricing" set default '{}'::jsonb;

alter table "public"."voices" alter column "provider" set default 'google'::text;

alter table "public"."voices" alter column "updated_at" set default now();

alter table "public"."voices" enable row level security;

CREATE INDEX IF NOT EXISTS idx_voices_category ON public.voices USING btree (category);

CREATE INDEX IF NOT EXISTS idx_voices_language_code ON public.voices USING btree (language_code);

CREATE INDEX IF NOT EXISTS idx_voices_name ON public.voices USING btree (name);

CREATE INDEX IF NOT EXISTS idx_voices_provider ON public.voices USING btree (provider);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voices_provider_check') THEN
        ALTER TABLE "public"."voices" ADD CONSTRAINT "voices_provider_check" CHECK ((provider = ANY (ARRAY['google'::text, 'gemini'::text, 'xunfei'::text]))) not valid;
    END IF;
END $$;

alter table "public"."voices" validate constraint "voices_provider_check";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_materials_lang_check') THEN
        ALTER TABLE "public"."alignment_materials" ADD CONSTRAINT "alignment_materials_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text, 'ko'::text]))) not valid;
    END IF;
END $$;

alter table "public"."alignment_materials" validate constraint "alignment_materials_lang_check";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_subtopics_lang_check') THEN
        ALTER TABLE "public"."alignment_subtopics" ADD CONSTRAINT "alignment_subtopics_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text, 'ko'::text]))) not valid;
    END IF;
END $$;

alter table "public"."alignment_subtopics" validate constraint "alignment_subtopics_lang_check";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'alignment_themes_lang_check') THEN
        ALTER TABLE "public"."alignment_themes" ADD CONSTRAINT "alignment_themes_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text, 'ko'::text]))) not valid;
    END IF;
END $$;

alter table "public"."alignment_themes" validate constraint "alignment_themes_lang_check";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cloze_shadowing_items_lang_check') THEN
        ALTER TABLE "public"."cloze_shadowing_items" ADD CONSTRAINT "cloze_shadowing_items_lang_check" CHECK ((lang = ANY (ARRAY['en'::text, 'ja'::text, 'zh'::text, 'ko'::text]))) not valid;
    END IF;
END $$;

alter table "public"."cloze_shadowing_items" validate constraint "cloze_shadowing_items_lang_check";

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'voices_select_all' AND tablename = 'voices') THEN
        CREATE POLICY "voices_select_all"
        ON "public"."voices"
        AS PERMISSIVE
        FOR SELECT
        TO public
        USING ((is_active = true));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_own' AND tablename = 'profiles') THEN
        CREATE POLICY "profiles_select_own"
        ON "public"."profiles"
        AS PERMISSIVE
        FOR SELECT
        TO authenticated
        USING ((( SELECT auth.uid() AS uid) = id));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own' AND tablename = 'profiles') THEN
        CREATE POLICY "profiles_update_own"
        ON "public"."profiles"
        AS PERMISSIVE
        FOR UPDATE
        TO authenticated
        USING ((( SELECT auth.uid() AS uid) = id))
        WITH CHECK ((( SELECT auth.uid() AS uid) = id));
    END IF;
END $$;


-- =============================================
-- REVIEW REQUIRED
-- Generated by: supabase db diff --db-url $PROD_DB_URL --schema public
-- Purpose: Align schema with remote. This may be DESTRUCTIVE.
-- Notes:
-- 1) Contains DROP TRIGGER / DROP POLICY and many REVOKE statements.
-- 2) Re-adds policies for profiles; ok.
-- 3) Sets defaults + RLS + indexes + provider CHECK for table public.voices; ok.
-- 4) Adds language CHECK constraints limited to ('en','ja','zh') on several tables.
--    Your local migrations add Korean ('ko'): applying this file will REMOVE 'ko'.
-- 5) Do NOT run `supabase db reset` or push this migration before confirming each change.
-- =============================================

