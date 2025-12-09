drop extension if exists "pg_net";

drop trigger if exists "set_scene_tags_updated_at" on "public"."scene_tags";

drop trigger if exists "shadowing_items_set_updated_at" on "public"."shadowing_items";

drop policy "cloze_shadowing_items_select_all" on "public"."cloze_shadowing_items";

drop policy "cloze_shadowing_items_service_write" on "public"."cloze_shadowing_items";

drop policy "scene_tags_select_all_authenticated" on "public"."scene_tags";

drop policy "subtopic_scene_vectors_select_all_authenticated" on "public"."subtopic_scene_vectors";

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

revoke delete on table "public"."zh_pinyin_units" from "anon";

revoke insert on table "public"."zh_pinyin_units" from "anon";

revoke references on table "public"."zh_pinyin_units" from "anon";

revoke select on table "public"."zh_pinyin_units" from "anon";

revoke trigger on table "public"."zh_pinyin_units" from "anon";

revoke truncate on table "public"."zh_pinyin_units" from "anon";

revoke update on table "public"."zh_pinyin_units" from "anon";

revoke delete on table "public"."zh_pinyin_units" from "authenticated";

revoke insert on table "public"."zh_pinyin_units" from "authenticated";

revoke references on table "public"."zh_pinyin_units" from "authenticated";

revoke select on table "public"."zh_pinyin_units" from "authenticated";

revoke trigger on table "public"."zh_pinyin_units" from "authenticated";

revoke truncate on table "public"."zh_pinyin_units" from "authenticated";

revoke update on table "public"."zh_pinyin_units" from "authenticated";

revoke delete on table "public"."zh_pinyin_units" from "service_role";

revoke insert on table "public"."zh_pinyin_units" from "service_role";

revoke references on table "public"."zh_pinyin_units" from "service_role";

revoke select on table "public"."zh_pinyin_units" from "service_role";

revoke trigger on table "public"."zh_pinyin_units" from "service_role";

revoke truncate on table "public"."zh_pinyin_units" from "service_role";

revoke update on table "public"."zh_pinyin_units" from "service_role";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_material_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_prev_attempt_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_status_check";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_subtopic_id_fkey";

alter table "public"."alignment_attempts" drop constraint "alignment_attempts_task_type_check";

alter table "public"."cloze_attempts" drop constraint "cloze_attempts_item_id_fkey";

alter table "public"."cloze_shadowing_attempts_sentence" drop constraint "cloze_shadowing_attempts_sentence_cloze_item_id_fkey";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_lang_check";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_level_check";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_source_item_id_sentence_index_key";

alter table "public"."shadowing_attempts" drop constraint "shadowing_attempts_user_id_fkey";

alter table "public"."shadowing_subtopics" drop constraint "shadowing_subtopics_id_unique";

alter table "public"."shadowing_themes" drop constraint "shadowing_themes_id_unique";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_scene_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_subtopic_id_fkey";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_weight_check";

alter table "public"."cloze_attempts" drop constraint "cloze_attempts_user_id_fkey";

alter table "public"."invitation_uses" drop constraint "invitation_uses_code_id_fkey";

alter table "public"."invitation_uses" drop constraint "invitation_uses_used_by_fkey";

alter table "public"."cloze_shadowing_items" drop constraint "cloze_shadowing_items_pkey";

alter table "public"."scene_tags" drop constraint "scene_tags_pkey";

alter table "public"."shadowing_attempts" drop constraint "shadowing_attempts_pkey";

alter table "public"."shadowing_items" drop constraint "shadowing_items_pkey";

alter table "public"."shadowing_sessions" drop constraint "shadowing_sessions_pkey";

alter table "public"."subtopic_scene_vectors" drop constraint "subtopic_scene_vectors_pkey";

drop index if exists "public"."cloze_shadowing_items_pkey";

drop index if exists "public"."cloze_shadowing_items_source_item_id_sentence_index_key";

drop index if exists "public"."idx_cloze_shadowing_items_published";

drop index if exists "public"."idx_shadowing_items_dialogue_type";

drop index if exists "public"."idx_shadowing_subtopics_dialogue_type";

drop index if exists "public"."idx_shadowing_subtopics_sequence";

drop index if exists "public"."idx_shadowing_themes_dialogue_type";

drop index if exists "public"."idx_subtopic_scene_vectors_scene";

drop index if exists "public"."idx_subtopic_scene_vectors_subtopic";

drop index if exists "public"."scene_tags_pkey";

drop index if exists "public"."shadowing_attempts_pkey";

drop index if exists "public"."shadowing_items_pkey";

drop index if exists "public"."shadowing_sessions_pkey";

drop index if exists "public"."shadowing_subtopics_id_unique";

drop index if exists "public"."shadowing_themes_id_unique";

drop index if exists "public"."subtopic_scene_vectors_pkey";


  create table "public"."alignment_packs" (
    "id" uuid not null default gen_random_uuid(),
    "lang" text not null,
    "topic" text not null,
    "tags" text[] default '{}'::text[],
    "level_min" integer default 1,
    "level_max" integer default 6,
    "preferred_style" jsonb default '{}'::jsonb,
    "steps" jsonb not null,
    "ai_provider" text,
    "ai_model" text,
    "ai_usage" jsonb default '{}'::jsonb,
    "status" text not null default 'draft'::text,
    "created_by" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."alignment_packs" enable row level security;


  create table "public"."theme_scene_vectors" (
    "theme_id" uuid not null,
    "scene_id" text not null,
    "weight" numeric not null,
    "updated_at" timestamp with time zone not null
      );



  create table "public"."user_subtopic_preferences" (
    "user_id" uuid not null,
    "subtopic_id" uuid not null,
    "weight" numeric not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_subtopic_preferences" enable row level security;


  create table "public"."user_theme_preferences" (
    "user_id" uuid not null,
    "theme_id" uuid not null,
    "weight" numeric not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_theme_preferences" enable row level security;

alter table "public"."alignment_attempts" drop column "updated_at";

alter table "public"."alignment_attempts" add column "pack_id" uuid not null;

alter table "public"."alignment_attempts" add column "step_key" text not null;

alter table "public"."alignment_attempts" alter column "created_at" drop not null;

alter table "public"."alignment_attempts" alter column "submission" set data type text using "submission"::text;

alter table "public"."api_limits" drop column "daily_count";

alter table "public"."api_limits" alter column "alert_threshold" set default 80;

alter table "public"."api_limits" alter column "alert_threshold" set not null;

alter table "public"."api_limits" alter column "alert_threshold" set data type integer using "alert_threshold"::integer;

alter table "public"."api_limits" alter column "daily_calls_limit" set default 1000;

alter table "public"."api_limits" alter column "daily_calls_limit" set not null;

alter table "public"."api_limits" alter column "daily_cost_limit" set default 10.00;

alter table "public"."api_limits" alter column "daily_cost_limit" set not null;

alter table "public"."api_limits" alter column "daily_cost_limit" set data type numeric(10,2) using "daily_cost_limit"::numeric(10,2);

alter table "public"."api_limits" alter column "daily_tokens_limit" set default 1000000;

alter table "public"."api_limits" alter column "daily_tokens_limit" set not null;

alter table "public"."api_limits" alter column "enabled" set default false;

alter table "public"."api_limits" alter column "enabled" set not null;

alter table "public"."api_limits" alter column "monthly_calls_limit" set default 30000;

alter table "public"."api_limits" alter column "monthly_calls_limit" set not null;

alter table "public"."api_limits" alter column "monthly_cost_limit" set default 300.00;

alter table "public"."api_limits" alter column "monthly_cost_limit" set not null;

alter table "public"."api_limits" alter column "monthly_cost_limit" set data type numeric(10,2) using "monthly_cost_limit"::numeric(10,2);

alter table "public"."api_limits" alter column "monthly_tokens_limit" set default 30000000;

alter table "public"."api_limits" alter column "monthly_tokens_limit" set not null;

alter table "public"."api_usage_logs" drop column "duration_ms";

alter table "public"."api_usage_logs" alter column "cost" set default 0.0;

alter table "public"."api_usage_logs" alter column "cost" set data type numeric(10,6) using "cost"::numeric(10,6);

alter table "public"."api_usage_logs" alter column "model" set not null;

alter table "public"."api_usage_logs" alter column "model" set data type character varying(100) using "model"::character varying(100);

alter table "public"."api_usage_logs" alter column "provider" set not null;

alter table "public"."api_usage_logs" alter column "provider" set data type character varying(50) using "provider"::character varying(50);

alter table "public"."api_usage_logs" alter column "tokens_used" set default 0;

alter table "public"."api_usage_logs" enable row level security;

alter table "public"."article_batches" alter column "genre" set not null;

alter table "public"."article_batches" alter column "lang" set not null;

alter table "public"."article_batches" alter column "model" set not null;

alter table "public"."article_batches" alter column "name" set not null;

alter table "public"."article_batches" alter column "provider" set not null;

alter table "public"."article_batches" alter column "status" set default 'pending'::text;

alter table "public"."article_batches" alter column "status" set not null;

alter table "public"."article_batches" alter column "temperature" set default 0.6;

alter table "public"."article_batches" alter column "temperature" set not null;

alter table "public"."article_batches" alter column "totals" set default '{"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}'::jsonb;

alter table "public"."article_batches" alter column "totals" set not null;

alter table "public"."article_batches" alter column "words" set default 300;

alter table "public"."article_batches" alter column "words" set not null;

alter table "public"."cloze_attempts" drop column "score";

alter table "public"."cloze_attempts" alter column "ai_result" set not null;

alter table "public"."cloze_attempts" alter column "answers" set not null;

alter table "public"."cloze_attempts" alter column "item_id" set not null;

alter table "public"."cloze_attempts" alter column "lang" set not null;

alter table "public"."cloze_attempts" alter column "level" set not null;

alter table "public"."cloze_attempts" alter column "user_id" set not null;

alter table "public"."cloze_shadowing_items" alter column "created_at" drop default;

alter table "public"."cloze_shadowing_items" alter column "id" drop default;

alter table "public"."cloze_shadowing_items" alter column "is_published" drop default;

alter table "public"."cloze_shadowing_items" disable row level security;

alter table "public"."invitation_codes" enable row level security;

alter table "public"."invitation_uses" alter column "code_id" set not null;

alter table "public"."invitation_uses" alter column "used_by" set not null;

alter table "public"."profiles" enable row level security;

alter table "public"."scene_tags" alter column "created_at" drop default;

alter table "public"."scene_tags" alter column "updated_at" drop default;

alter table "public"."scene_tags" disable row level security;

alter table "public"."shadowing_attempts" drop column "recording_url";

alter table "public"."shadowing_attempts" drop column "score";

alter table "public"."shadowing_attempts" alter column "created_at" drop default;

alter table "public"."shadowing_attempts" alter column "id" drop default;

alter table "public"."shadowing_attempts" alter column "item_id" set not null;

alter table "public"."shadowing_attempts" alter column "lang" set not null;

alter table "public"."shadowing_attempts" alter column "level" set not null;

alter table "public"."shadowing_attempts" alter column "metrics" set not null;

alter table "public"."shadowing_attempts" alter column "user_id" set not null;

alter table "public"."shadowing_drafts" disable row level security;

alter table "public"."shadowing_items" alter column "audio_url_proxy" drop expression;

alter table "public"."shadowing_items" alter column "created_at" drop default;

alter table "public"."shadowing_items" alter column "id" drop default;

alter table "public"."shadowing_items" alter column "lex_profile" drop default;

alter table "public"."shadowing_sessions" drop column "imported_vocab_ids";

alter table "public"."shadowing_sessions" alter column "id" drop default;

alter table "public"."shadowing_sessions" alter column "notes" drop default;

alter table "public"."shadowing_sessions" alter column "picked_preview" drop default;

alter table "public"."shadowing_sessions" alter column "recordings" drop default;

alter table "public"."shadowing_sessions" alter column "status" drop default;

alter table "public"."shadowing_sessions" alter column "status" set not null;

alter table "public"."shadowing_sessions" alter column "vocab_entry_ids" drop default;

alter table "public"."shadowing_sessions" alter column "vocab_entry_ids" set data type text[] using "vocab_entry_ids"::text[];

alter table "public"."subtopic_scene_vectors" alter column "updated_at" drop default;

alter table "public"."subtopic_scene_vectors" disable row level security;

alter table "public"."user_api_limits" drop column "count";

alter table "public"."user_api_limits" drop column "max_limit";

alter table "public"."user_api_limits" drop column "reset_at";

alter table "public"."user_api_limits" alter column "daily_calls_limit" set default 0;

alter table "public"."user_api_limits" alter column "daily_calls_limit" set not null;

alter table "public"."user_api_limits" alter column "daily_cost_limit" set default 0.00;

alter table "public"."user_api_limits" alter column "daily_cost_limit" set not null;

alter table "public"."user_api_limits" alter column "daily_cost_limit" set data type numeric(10,2) using "daily_cost_limit"::numeric(10,2);

alter table "public"."user_api_limits" alter column "daily_tokens_limit" set default 0;

alter table "public"."user_api_limits" alter column "daily_tokens_limit" set not null;

alter table "public"."user_api_limits" alter column "enabled" set default false;

alter table "public"."user_api_limits" alter column "enabled" set not null;

alter table "public"."user_api_limits" alter column "monthly_calls_limit" set default 0;

alter table "public"."user_api_limits" alter column "monthly_calls_limit" set not null;

alter table "public"."user_api_limits" alter column "monthly_cost_limit" set default 0.00;

alter table "public"."user_api_limits" alter column "monthly_cost_limit" set not null;

alter table "public"."user_api_limits" alter column "monthly_cost_limit" set data type numeric(10,2) using "monthly_cost_limit"::numeric(10,2);

alter table "public"."user_api_limits" alter column "monthly_tokens_limit" set default 0;

alter table "public"."user_api_limits" alter column "monthly_tokens_limit" set not null;

alter table "public"."user_api_limits" enable row level security;

alter table "public"."vocab_entries" enable row level security;

CREATE UNIQUE INDEX alignment_packs_pkey ON public.alignment_packs USING btree (id);

CREATE INDEX idx_alignment_attempts_pack_id ON public.alignment_attempts USING btree (pack_id);

CREATE INDEX idx_alignment_attempts_user_pack ON public.alignment_attempts USING btree (user_id, pack_id);

CREATE INDEX idx_alignment_packs_created_by ON public.alignment_packs USING btree (created_by);

CREATE INDEX idx_alignment_packs_status_lang ON public.alignment_packs USING btree (status, lang);

CREATE UNIQUE INDEX idx_api_limits_single ON public.api_limits USING btree ((1));

CREATE INDEX idx_api_usage_logs_stats ON public.api_usage_logs USING btree (user_id, provider, created_at);

CREATE INDEX idx_article_batch_items_batch_id ON public.article_batch_items USING btree (batch_id);

CREATE INDEX idx_article_batches_created_by ON public.article_batches USING btree (created_by);

CREATE INDEX idx_cloze_attempts_item_id ON public.cloze_attempts USING btree (item_id);

CREATE INDEX idx_cloze_attempts_user_id ON public.cloze_attempts USING btree (user_id);

CREATE INDEX idx_invitation_codes_code ON public.invitation_codes USING btree (code);

CREATE INDEX idx_invitation_codes_created_by ON public.invitation_codes USING btree (created_by);

CREATE INDEX idx_invitation_uses_used_by ON public.invitation_uses USING btree (used_by);

CREATE INDEX idx_profiles_invitation_code_id ON public.profiles USING btree (invitation_code_id);

CREATE INDEX idx_profiles_invited_by ON public.profiles USING btree (invited_by);

CREATE INDEX idx_unit_catalog_en_us ON public.unit_catalog USING btree (lang) WHERE (lang = 'en-US'::text);

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);

CREATE INDEX idx_user_subtopic_preferences_subtopic ON public.user_subtopic_preferences USING btree (subtopic_id);

CREATE INDEX idx_user_subtopic_preferences_user ON public.user_subtopic_preferences USING btree (user_id);

CREATE INDEX idx_user_theme_preferences_theme ON public.user_theme_preferences USING btree (theme_id);

CREATE INDEX idx_user_theme_preferences_user ON public.user_theme_preferences USING btree (user_id);

CREATE INDEX idx_vocab_entries_created_at ON public.vocab_entries USING btree (created_at);

CREATE INDEX idx_vocab_entries_lang ON public.vocab_entries USING btree (lang);

CREATE INDEX idx_vocab_entries_status ON public.vocab_entries USING btree (status);

CREATE INDEX idx_vocab_entries_term ON public.vocab_entries USING btree (term);

CREATE INDEX idx_vocab_entries_term_lang ON public.vocab_entries USING btree (term, lang);

CREATE INDEX idx_vocab_entries_user_id ON public.vocab_entries USING btree (user_id);

CREATE INDEX idx_vocab_entries_user_lang ON public.vocab_entries USING btree (user_id, lang);

CREATE UNIQUE INDEX invitation_uses_code_id_used_by_key ON public.invitation_uses USING btree (code_id, used_by);

CREATE UNIQUE INDEX user_permissions_pkey ON public.user_permissions USING btree (id);

CREATE UNIQUE INDEX user_subtopic_preferences_pkey ON public.user_subtopic_preferences USING btree (user_id, subtopic_id);

CREATE UNIQUE INDEX user_theme_preferences_pkey ON public.user_theme_preferences USING btree (user_id, theme_id);

alter table "public"."alignment_packs" add constraint "alignment_packs_pkey" PRIMARY KEY using index "alignment_packs_pkey";

alter table "public"."user_permissions" add constraint "user_permissions_pkey" PRIMARY KEY using index "user_permissions_pkey";

alter table "public"."user_subtopic_preferences" add constraint "user_subtopic_preferences_pkey" PRIMARY KEY using index "user_subtopic_preferences_pkey";

alter table "public"."user_theme_preferences" add constraint "user_theme_preferences_pkey" PRIMARY KEY using index "user_theme_preferences_pkey";

alter table "public"."alignment_attempts" add constraint "alignment_attempts_pack_id_fkey" FOREIGN KEY (pack_id) REFERENCES public.alignment_packs(id) ON DELETE CASCADE not valid;

alter table "public"."alignment_attempts" validate constraint "alignment_attempts_pack_id_fkey";

alter table "public"."alignment_packs" add constraint "alignment_packs_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."alignment_packs" validate constraint "alignment_packs_created_by_fkey";

alter table "public"."api_limits" add constraint "api_limits_alert_threshold_check" CHECK (((alert_threshold >= 0) AND (alert_threshold <= 100))) not valid;

alter table "public"."api_limits" validate constraint "api_limits_alert_threshold_check";

alter table "public"."api_usage_logs" add constraint "api_usage_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."api_usage_logs" validate constraint "api_usage_logs_user_id_fkey";

alter table "public"."article_batch_items" add constraint "article_batch_items_batch_id_fkey" FOREIGN KEY (batch_id) REFERENCES public.article_batches(id) ON DELETE CASCADE not valid;

alter table "public"."article_batch_items" validate constraint "article_batch_items_batch_id_fkey";

alter table "public"."invitation_codes" add constraint "invitation_codes_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_codes" validate constraint "invitation_codes_created_by_fkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_code_id_used_by_key" UNIQUE using index "invitation_uses_code_id_used_by_key";

alter table "public"."profiles" add constraint "profiles_invitation_code_id_fkey" FOREIGN KEY (invitation_code_id) REFERENCES public.invitation_codes(id) not valid;

alter table "public"."profiles" validate constraint "profiles_invitation_code_id_fkey";

alter table "public"."profiles" add constraint "profiles_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_invited_by_fkey";

alter table "public"."user_api_limits" add constraint "user_api_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_api_limits" validate constraint "user_api_limits_user_id_fkey";

alter table "public"."user_api_limits" add constraint "user_api_limits_user_id_key" UNIQUE using index "user_api_limits_user_id_key";

alter table "public"."user_permissions" add constraint "user_permissions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_permissions" validate constraint "user_permissions_user_id_fkey";

alter table "public"."user_subtopic_preferences" add constraint "user_subtopic_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_subtopic_preferences" validate constraint "user_subtopic_preferences_user_id_fkey";

alter table "public"."user_subtopic_preferences" add constraint "user_subtopic_preferences_weight_check" CHECK (((weight >= (0)::numeric) AND (weight <= (1)::numeric))) not valid;

alter table "public"."user_subtopic_preferences" validate constraint "user_subtopic_preferences_weight_check";

alter table "public"."user_theme_preferences" add constraint "user_theme_preferences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_theme_preferences" validate constraint "user_theme_preferences_user_id_fkey";

alter table "public"."user_theme_preferences" add constraint "user_theme_preferences_weight_check" CHECK (((weight >= (0)::numeric) AND (weight <= (1)::numeric))) not valid;

alter table "public"."user_theme_preferences" validate constraint "user_theme_preferences_weight_check";

alter table "public"."vocab_entries" add constraint "vocab_entries_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'starred'::text, 'archived'::text]))) not valid;

alter table "public"."vocab_entries" validate constraint "vocab_entries_status_check";

alter table "public"."vocab_entries" add constraint "vocab_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."vocab_entries" validate constraint "vocab_entries_user_id_fkey";

alter table "public"."cloze_attempts" add constraint "cloze_attempts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."cloze_attempts" validate constraint "cloze_attempts_user_id_fkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_code_id_fkey" FOREIGN KEY (code_id) REFERENCES public.invitation_codes(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_uses" validate constraint "invitation_uses_code_id_fkey";

alter table "public"."invitation_uses" add constraint "invitation_uses_used_by_fkey" FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."invitation_uses" validate constraint "invitation_uses_used_by_fkey";

create or replace view "public"."english_phonemes_view" as  SELECT uc.unit_id,
    uc.symbol,
    epu.category,
    epu.subcategory,
    epu.examples,
    epu.description,
    uc.created_at
   FROM (public.unit_catalog uc
     LEFT JOIN public.en_phoneme_units epu ON ((uc.symbol = (epu.symbol)::text)))
  WHERE ((uc.lang = 'en-US'::text) AND (uc.unit_type = 'phoneme'::text))
  ORDER BY
        CASE epu.category
            WHEN 'vowel'::text THEN 1
            WHEN 'diphthong'::text THEN 2
            WHEN 'consonant'::text THEN 3
            ELSE 4
        END, uc.unit_id;


grant delete on table "public"."alignment_packs" to "anon";

grant insert on table "public"."alignment_packs" to "anon";

grant references on table "public"."alignment_packs" to "anon";

grant select on table "public"."alignment_packs" to "anon";

grant trigger on table "public"."alignment_packs" to "anon";

grant truncate on table "public"."alignment_packs" to "anon";

grant update on table "public"."alignment_packs" to "anon";

grant delete on table "public"."alignment_packs" to "authenticated";

grant insert on table "public"."alignment_packs" to "authenticated";

grant references on table "public"."alignment_packs" to "authenticated";

grant select on table "public"."alignment_packs" to "authenticated";

grant trigger on table "public"."alignment_packs" to "authenticated";

grant truncate on table "public"."alignment_packs" to "authenticated";

grant update on table "public"."alignment_packs" to "authenticated";

grant delete on table "public"."alignment_packs" to "service_role";

grant insert on table "public"."alignment_packs" to "service_role";

grant references on table "public"."alignment_packs" to "service_role";

grant select on table "public"."alignment_packs" to "service_role";

grant trigger on table "public"."alignment_packs" to "service_role";

grant truncate on table "public"."alignment_packs" to "service_role";

grant update on table "public"."alignment_packs" to "service_role";

grant delete on table "public"."theme_scene_vectors" to "anon";

grant insert on table "public"."theme_scene_vectors" to "anon";

grant references on table "public"."theme_scene_vectors" to "anon";

grant select on table "public"."theme_scene_vectors" to "anon";

grant trigger on table "public"."theme_scene_vectors" to "anon";

grant truncate on table "public"."theme_scene_vectors" to "anon";

grant update on table "public"."theme_scene_vectors" to "anon";

grant delete on table "public"."theme_scene_vectors" to "authenticated";

grant insert on table "public"."theme_scene_vectors" to "authenticated";

grant references on table "public"."theme_scene_vectors" to "authenticated";

grant select on table "public"."theme_scene_vectors" to "authenticated";

grant trigger on table "public"."theme_scene_vectors" to "authenticated";

grant truncate on table "public"."theme_scene_vectors" to "authenticated";

grant update on table "public"."theme_scene_vectors" to "authenticated";

grant delete on table "public"."theme_scene_vectors" to "service_role";

grant insert on table "public"."theme_scene_vectors" to "service_role";

grant references on table "public"."theme_scene_vectors" to "service_role";

grant select on table "public"."theme_scene_vectors" to "service_role";

grant trigger on table "public"."theme_scene_vectors" to "service_role";

grant truncate on table "public"."theme_scene_vectors" to "service_role";

grant update on table "public"."theme_scene_vectors" to "service_role";

grant delete on table "public"."user_subtopic_preferences" to "anon";

grant insert on table "public"."user_subtopic_preferences" to "anon";

grant references on table "public"."user_subtopic_preferences" to "anon";

grant select on table "public"."user_subtopic_preferences" to "anon";

grant trigger on table "public"."user_subtopic_preferences" to "anon";

grant truncate on table "public"."user_subtopic_preferences" to "anon";

grant update on table "public"."user_subtopic_preferences" to "anon";

grant delete on table "public"."user_subtopic_preferences" to "authenticated";

grant insert on table "public"."user_subtopic_preferences" to "authenticated";

grant references on table "public"."user_subtopic_preferences" to "authenticated";

grant select on table "public"."user_subtopic_preferences" to "authenticated";

grant trigger on table "public"."user_subtopic_preferences" to "authenticated";

grant truncate on table "public"."user_subtopic_preferences" to "authenticated";

grant update on table "public"."user_subtopic_preferences" to "authenticated";

grant delete on table "public"."user_subtopic_preferences" to "service_role";

grant insert on table "public"."user_subtopic_preferences" to "service_role";

grant references on table "public"."user_subtopic_preferences" to "service_role";

grant select on table "public"."user_subtopic_preferences" to "service_role";

grant trigger on table "public"."user_subtopic_preferences" to "service_role";

grant truncate on table "public"."user_subtopic_preferences" to "service_role";

grant update on table "public"."user_subtopic_preferences" to "service_role";

grant delete on table "public"."user_theme_preferences" to "anon";

grant insert on table "public"."user_theme_preferences" to "anon";

grant references on table "public"."user_theme_preferences" to "anon";

grant select on table "public"."user_theme_preferences" to "anon";

grant trigger on table "public"."user_theme_preferences" to "anon";

grant truncate on table "public"."user_theme_preferences" to "anon";

grant update on table "public"."user_theme_preferences" to "anon";

grant delete on table "public"."user_theme_preferences" to "authenticated";

grant insert on table "public"."user_theme_preferences" to "authenticated";

grant references on table "public"."user_theme_preferences" to "authenticated";

grant select on table "public"."user_theme_preferences" to "authenticated";

grant trigger on table "public"."user_theme_preferences" to "authenticated";

grant truncate on table "public"."user_theme_preferences" to "authenticated";

grant update on table "public"."user_theme_preferences" to "authenticated";

grant delete on table "public"."user_theme_preferences" to "service_role";

grant insert on table "public"."user_theme_preferences" to "service_role";

grant references on table "public"."user_theme_preferences" to "service_role";

grant select on table "public"."user_theme_preferences" to "service_role";

grant trigger on table "public"."user_theme_preferences" to "service_role";

grant truncate on table "public"."user_theme_preferences" to "service_role";

grant update on table "public"."user_theme_preferences" to "service_role";


  create policy "aa_owner_rw"
  on "public"."alignment_attempts"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "alignment_packs_combined"
  on "public"."alignment_packs"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admins can manage api limits"
  on "public"."api_limits"
  as permissive
  for all
  to authenticated
using (( SELECT public.is_admin() AS is_admin))
with check (( SELECT public.is_admin() AS is_admin));



  create policy "Service role can insert api usage logs"
  on "public"."api_usage_logs"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "api_usage_logs_combined_select"
  on "public"."api_usage_logs"
  as permissive
  for select
  to authenticated
using ((( SELECT public.is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));



  create policy "article_batch_items_combined"
  on "public"."article_batch_items"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "article_batches_combined"
  on "public"."article_batches"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "ca_owner_rw"
  on "public"."cloze_attempts"
  as permissive
  for all
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "default_user_permissions_admin_all"
  on "public"."default_user_permissions"
  as permissive
  for all
  to authenticated
using (public.is_admin())
with check (public.is_admin());



  create policy "invitation_codes_combined_insert"
  on "public"."invitation_codes"
  as permissive
  for insert
  to authenticated
with check ((( SELECT public.is_admin() AS is_admin) OR (created_by = ( SELECT auth.uid() AS uid))));



  create policy "invitation_codes_combined_select"
  on "public"."invitation_codes"
  as permissive
  for select
  to authenticated
using ((( SELECT public.is_admin() AS is_admin) OR (created_by = ( SELECT auth.uid() AS uid))));



  create policy "invitation_uses_admin_select"
  on "public"."invitation_uses"
  as permissive
  for select
  to authenticated
using (public.is_admin());



  create policy "invitation_uses_combined_select"
  on "public"."invitation_uses"
  as permissive
  for select
  to authenticated
using ((( SELECT public.is_admin() AS is_admin) OR (used_by = ( SELECT auth.uid() AS uid))));



  create policy "invitation_uses_insert"
  on "public"."invitation_uses"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "invitation_uses_user_select"
  on "public"."invitation_uses"
  as permissive
  for select
  to authenticated
using ((used_by = auth.uid()));



  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "user_api_limits_combined"
  on "public"."user_api_limits"
  as permissive
  for all
  to authenticated
using ((( SELECT public.is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)))
with check ((( SELECT public.is_admin() AS is_admin) OR (( SELECT auth.uid() AS uid) = user_id)));



  create policy "user_subtopic_preferences_select_own"
  on "public"."user_subtopic_preferences"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "user_subtopic_preferences_write_own"
  on "public"."user_subtopic_preferences"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "user_theme_preferences_select_own"
  on "public"."user_theme_preferences"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "user_theme_preferences_write_own"
  on "public"."user_theme_preferences"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users can delete own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for delete
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can insert own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for insert
  to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for update
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can view own vocab entries"
  on "public"."vocab_entries"
  as permissive
  for select
  to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER trigger_update_api_usage_logs_updated_at BEFORE UPDATE ON public.api_usage_logs FOR EACH ROW EXECUTE FUNCTION public.update_api_usage_logs_updated_at();

CREATE TRIGGER update_default_user_permissions_updated_at BEFORE UPDATE ON public.default_user_permissions FOR EACH ROW EXECUTE FUNCTION public.update_default_user_permissions_updated_at();

CREATE TRIGGER update_invitation_codes_updated_at BEFORE UPDATE ON public.invitation_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


  create policy "Users can delete their own recordings"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own recordings"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload their own recordings"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can view their own recordings"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'recordings'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



