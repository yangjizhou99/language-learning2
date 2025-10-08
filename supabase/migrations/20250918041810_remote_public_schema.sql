

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  EXECUTE sql;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invitation_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      result text := '';
      i integer;
    BEGIN
      FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      RETURN result;
    END;
    $$;


ALTER FUNCTION "public"."generate_invitation_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_columns"("table_name_param" "text") RETURNS TABLE("column_name" "text", "data_type" "text", "is_nullable" "text", "column_default" "text", "ordinal_position" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;


ALTER FUNCTION "public"."get_table_columns"("table_name_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_table_list"() RETURNS TABLE("table_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name != 'spatial_ref_sys'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;


ALTER FUNCTION "public"."get_table_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer DEFAULT NULL::integer, "p_tokens" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_id uuid;
begin
  insert into public.shadowing_items (
    lang, level, title, text, audio_url, duration_ms, tokens
  ) values (
    p_lang, p_level, p_title, p_text, p_audio_url, p_duration_ms, p_tokens
  ) returning id into v_id;
  
  return v_id;
end;
$$;


ALTER FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer DEFAULT NULL::integer, "p_tokens" integer DEFAULT NULL::integer, "p_cefr" "text" DEFAULT NULL::"text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      new_id uuid;
    BEGIN
      INSERT INTO public.shadowing_items (
        lang, level, title, text, audio_url, duration_ms, tokens, cefr, meta
      ) VALUES (
        p_lang, p_level, p_title, p_text, p_audio_url, p_duration_ms, p_tokens, p_cefr, p_meta
      ) RETURNING id INTO new_id;

      RETURN new_id;
    END;
    $$;


ALTER FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS '检查当前用户是否是管理员';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shadowing_items_audio_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  b text;
  p text;
BEGIN
  -- 场景A：仅写入 audio_url（旧代码路径），自动解析出 bucket/path
  IF (NEW.audio_bucket IS NULL OR NEW.audio_path IS NULL)
     AND NEW.audio_url IS NOT NULL AND NEW.audio_url <> '' THEN
    -- 解析本地代理格式
    b := substring(NEW.audio_url from 'bucket=([^&]+)');
    p := substring(NEW.audio_url from 'path=([^&]+)');
    IF p IS NOT NULL THEN p := replace(p, '%2F', '/'); END IF;

    -- 若非代理格式，解析 Supabase 直链/签名链
    IF b IS NULL OR p IS NULL THEN
      b := substring(NEW.audio_url from '/storage/v1/object/(?:sign|public)/([^/]+)/');
      p := substring(NEW.audio_url from '/storage/v1/object/(?:sign|public)/[^/]+/([^?]+)');
    END IF;

    IF NEW.audio_bucket IS NULL AND b IS NOT NULL THEN NEW.audio_bucket := b; END IF;
    IF NEW.audio_path   IS NULL AND p IS NOT NULL THEN NEW.audio_path   := p; END IF;
  END IF;

  -- 场景B：写入 bucket/path（新代码路径），自动归一化 audio_url 为相对代理链接
  IF NEW.audio_bucket IS NOT NULL AND NEW.audio_path IS NOT NULL THEN
    NEW.audio_url := '/api/storage-proxy?path=' || NEW.audio_path || '&bucket=' || COALESCE(NEW.audio_bucket, 'tts');
  END IF;

  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."shadowing_items_audio_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_api_usage_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."update_api_usage_logs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_default_user_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_default_user_permissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_shadowing_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."update_shadowing_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_api_limits_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_user_api_limits_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_user_permissions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invitation_code"("code_text" "text") RETURNS TABLE("is_valid" boolean, "code_id" "uuid", "max_uses" integer, "used_count" integer, "expires_at" timestamp with time zone, "permissions" "jsonb", "error_message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      invitation_record record;
    BEGIN
      -- 查找邀请码
      SELECT * INTO invitation_record
      FROM public.invitation_codes
      WHERE code = code_text AND is_active = true;

      IF NOT FOUND THEN
        RETURN QUERY SELECT false, null::uuid, 0, 0, null::timestamptz, null::jsonb, '邀请码不存在或已失效'::text;
        RETURN;
      END IF;

      -- 检查是否过期
      IF invitation_record.expires_at IS NOT NULL AND invitation_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, '邀请码已过期'::text;
        RETURN;
      END IF;

      -- 检查使用次数
      IF invitation_record.used_count >= invitation_record.max_uses THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, '邀请码使用次数已达上限'::text;
        RETURN;
      END IF;

      -- 邀请码有效
      RETURN QUERY SELECT true, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                         invitation_record.expires_at, invitation_record.permissions, null::text;
    END;
    $$;


ALTER FUNCTION "public"."validate_invitation_code"("code_text" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."alignment_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subtopic_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "task_type" "text" NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "submission" "jsonb" NOT NULL,
    "submission_text" "text",
    "word_count" integer,
    "turn_count" integer,
    "duration_seconds" numeric,
    "score_total" numeric,
    "scores" "jsonb",
    "feedback" "text",
    "feedback_json" "jsonb",
    "ai_model" "text",
    "ai_response" "jsonb",
    "prev_attempt_id" "uuid",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alignment_attempts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "alignment_attempts_task_type_check" CHECK (("task_type" = ANY (ARRAY['dialogue'::"text", 'article'::"text", 'task_email'::"text", 'long_writing'::"text"])))
);


ALTER TABLE "public"."alignment_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alignment_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subtopic_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "task_type" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "is_current" boolean DEFAULT true NOT NULL,
    "task_prompt" "text" NOT NULL,
    "task_prompt_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "exemplar" "text" NOT NULL,
    "exemplar_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "knowledge_points" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "requirements" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "standard_answer" "text" NOT NULL,
    "standard_answer_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "core_sentences" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "rubric" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "dialogue_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "writing_meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ai_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_notes" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alignment_materials_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "alignment_materials_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "alignment_materials_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "alignment_materials_task_type_check" CHECK (("task_type" = ANY (ARRAY['dialogue'::"text", 'article'::"text", 'task_email'::"text", 'long_writing'::"text"])))
);


ALTER TABLE "public"."alignment_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alignment_packs" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "tags" "text"[],
    "level_min" integer,
    "level_max" integer,
    "preferred_style" "jsonb",
    "steps" "jsonb" NOT NULL,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."alignment_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alignment_subtopics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "theme_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title" "text" NOT NULL,
    "title_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title_normalized" "text" NOT NULL,
    "one_line" "text",
    "one_line_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "objectives" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alignment_subtopics_genre_check" CHECK (("genre" = ANY (ARRAY['dialogue'::"text", 'article'::"text", 'task_email'::"text", 'long_writing'::"text"]))),
    CONSTRAINT "alignment_subtopics_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "alignment_subtopics_level_check" CHECK ((("level" >= 1) AND ("level" <= 6))),
    CONSTRAINT "alignment_subtopics_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'needs_review'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."alignment_subtopics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alignment_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title" "text" NOT NULL,
    "title_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title_normalized" "text" NOT NULL,
    "summary" "text",
    "summary_translations" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "alignment_themes_genre_check" CHECK (("genre" = ANY (ARRAY['dialogue'::"text", 'article'::"text", 'task_email'::"text", 'long_writing'::"text"]))),
    CONSTRAINT "alignment_themes_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "alignment_themes_level_check" CHECK ((("level" >= 1) AND ("level" <= 6))),
    CONSTRAINT "alignment_themes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."alignment_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_limits" (
    "id" "uuid" NOT NULL,
    "enabled" boolean NOT NULL,
    "daily_calls_limit" integer NOT NULL,
    "daily_tokens_limit" integer NOT NULL,
    "daily_cost_limit" numeric NOT NULL,
    "monthly_calls_limit" integer NOT NULL,
    "monthly_tokens_limit" integer NOT NULL,
    "monthly_cost_limit" numeric NOT NULL,
    "alert_threshold" integer NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."api_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_usage_logs" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" character varying NOT NULL,
    "model" character varying NOT NULL,
    "tokens_used" integer,
    "cost" numeric,
    "request_data" "jsonb",
    "response_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."api_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_batch_items" (
    "id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "topic" "text",
    "difficulty" integer NOT NULL,
    "status" "text" NOT NULL,
    "result_draft_id" "uuid",
    "error" "text",
    "usage" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "article_batch_items_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
);


ALTER TABLE "public"."article_batch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_batches" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "words" integer NOT NULL,
    "temperature" double precision NOT NULL,
    "status" "text" NOT NULL,
    "totals" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."article_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_cloze" (
    "id" "uuid" NOT NULL,
    "article_id" "uuid",
    "version" "text" NOT NULL,
    "items" "jsonb" NOT NULL
);


ALTER TABLE "public"."article_cloze" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_drafts" (
    "id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "license" "text",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_params" "jsonb",
    "ai_usage" "jsonb",
    "keys" "jsonb",
    "cloze_short" "jsonb",
    "cloze_long" "jsonb",
    "validator_report" "jsonb",
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "published_article_id" "uuid",
    "ai_answer_provider" "text",
    "ai_answer_model" "text",
    "ai_answer_usage" "jsonb",
    "ai_text_provider" "text",
    "ai_text_model" "text",
    "ai_text_usage" "jsonb",
    "ai_text_suggestion" "jsonb"
);


ALTER TABLE "public"."article_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_keys" (
    "article_id" "uuid" NOT NULL,
    "pass1" "jsonb",
    "pass2" "jsonb",
    "pass3" "jsonb"
);


ALTER TABLE "public"."article_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "title" "text" NOT NULL,
    "source_url" "text",
    "license" "text",
    "text" "text" NOT NULL,
    "checksum" "text" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_attempts" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "answers" "jsonb" NOT NULL,
    "ai_result" "jsonb" NOT NULL,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."cloze_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_drafts" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text",
    "title" "text" NOT NULL,
    "passage" "text" NOT NULL,
    "blanks" "jsonb" NOT NULL,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."cloze_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_items" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text",
    "title" "text" NOT NULL,
    "passage" "text" NOT NULL,
    "blanks" "jsonb" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."cloze_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_shadowing_attempts_article" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_item_id" "uuid" NOT NULL,
    "total_sentences" integer NOT NULL,
    "correct_sentences" integer NOT NULL,
    "accuracy" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cloze_shadowing_attempts_article_accuracy_check" CHECK ((("accuracy" >= (0)::numeric) AND ("accuracy" <= (1)::numeric)))
);


ALTER TABLE "public"."cloze_shadowing_attempts_article" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_shadowing_attempts_sentence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_item_id" "uuid" NOT NULL,
    "cloze_item_id" "uuid" NOT NULL,
    "sentence_index" integer NOT NULL,
    "selected_options" "text"[] NOT NULL,
    "is_correct" boolean NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cloze_shadowing_attempts_sentence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_shadowing_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_item_id" "uuid" NOT NULL,
    "theme_id" "uuid",
    "subtopic_id" "uuid",
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "sentence_index" integer NOT NULL,
    "sentence_text" "text" NOT NULL,
    "blank_start" integer NOT NULL,
    "blank_length" integer NOT NULL,
    "correct_options" "text"[] NOT NULL,
    "distractor_options" "text"[] NOT NULL,
    "gen_seed" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT false NOT NULL,
    CONSTRAINT "cloze_shadowing_items_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "cloze_shadowing_items_level_check" CHECK ((("level" >= 1) AND ("level" <= 5)))
);


ALTER TABLE "public"."cloze_shadowing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."default_user_permissions" (
    "id" "text" NOT NULL,
    "can_access_shadowing" boolean DEFAULT true NOT NULL,
    "can_access_cloze" boolean DEFAULT true NOT NULL,
    "can_access_alignment" boolean DEFAULT true NOT NULL,
    "can_access_articles" boolean DEFAULT true NOT NULL,
    "allowed_languages" "text"[] DEFAULT ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"] NOT NULL,
    "allowed_levels" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5] NOT NULL,
    "max_daily_attempts" integer DEFAULT 50 NOT NULL,
    "ai_enabled" boolean DEFAULT false NOT NULL,
    "api_keys" "jsonb" DEFAULT '{}'::"jsonb",
    "model_permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_restrictions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."default_user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."glossary" (
    "id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "aliases" "text"[],
    "tags" "text"[],
    "lang" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."glossary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "max_uses" integer NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "permissions" "jsonb",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."invitation_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_uses" (
    "id" "uuid" NOT NULL,
    "code_id" "uuid" NOT NULL,
    "used_by" "uuid" NOT NULL,
    "used_at" timestamp with time zone
);


ALTER TABLE "public"."invitation_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phrases" (
    "id" "uuid" NOT NULL,
    "tag" "text",
    "text" "text" NOT NULL,
    "example" "text",
    "lang" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."phrases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "native_lang" "text",
    "target_langs" "text"[],
    "created_at" timestamp with time zone,
    "bio" "text",
    "goals" "text",
    "preferred_tone" "text",
    "domains" "text"[],
    "role" "text",
    "invited_by" "uuid",
    "invitation_code_id" "uuid",
    "invitation_used_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_config" (
    "id" "text" NOT NULL,
    "allow_direct_registration" boolean NOT NULL,
    "allow_invitation_registration" boolean NOT NULL,
    "require_email_verification" boolean NOT NULL,
    "allow_google_oauth" boolean NOT NULL,
    "allow_anonymous_login" boolean NOT NULL,
    "maintenance_mode" boolean NOT NULL,
    "maintenance_message" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."registration_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_type" "text",
    "topic" "text",
    "input" "jsonb",
    "output" "jsonb",
    "ai_feedback" "jsonb",
    "score" numeric,
    "created_at" timestamp with time zone,
    "duration_sec" numeric,
    "difficulty" "text",
    "lang" "text"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_attempts" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."shadowing_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_drafts" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text",
    "genre" "text",
    "register" "text",
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "notes" "jsonb",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone,
    "translations" "jsonb",
    "trans_updated_at" timestamp with time zone,
    "source" "jsonb",
    "theme_id" "uuid",
    "subtopic_id" "uuid"
);


ALTER TABLE "public"."shadowing_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_items" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration_ms" integer,
    "tokens" integer,
    "cefr" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone,
    "translations" "jsonb",
    "trans_updated_at" timestamp with time zone,
    "theme_id" "uuid",
    "subtopic_id" "uuid",
    "topic" "text",
    "genre" "text",
    "register" "text",
    "notes" "jsonb",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "status" "text",
    "created_by" "uuid",
    "updated_at" timestamp with time zone,
    "audio_bucket" "text",
    "audio_path" "text",
    "sentence_timeline" "jsonb"
);


ALTER TABLE "public"."shadowing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "recordings" "jsonb",
    "vocab_entry_ids" "text"[],
    "picked_preview" "jsonb",
    "notes" "jsonb",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."shadowing_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_subtopics" (
    "id" "uuid" NOT NULL,
    "theme_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title" "text" NOT NULL,
    "seed" "text",
    "one_line" "text",
    "tags" "text"[],
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb"
);


ALTER TABLE "public"."shadowing_subtopics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_themes" (
    "id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title" "text" NOT NULL,
    "desc" "text",
    "status" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "title_en" "text",
    "coverage" "jsonb"
);


ALTER TABLE "public"."shadowing_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_cards" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "lang" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "article_id" "uuid",
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."study_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tts_assets" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "path" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "voice_name" "text",
    "speaking_rate" numeric,
    "pitch" numeric,
    "topic" "text",
    "text_excerpt" "text",
    "text_len" integer,
    "created_at" timestamp with time zone
);


ALTER TABLE "public"."tts_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean NOT NULL,
    "daily_calls_limit" integer NOT NULL,
    "daily_tokens_limit" integer NOT NULL,
    "daily_cost_limit" numeric NOT NULL,
    "monthly_calls_limit" integer NOT NULL,
    "monthly_tokens_limit" integer NOT NULL,
    "monthly_cost_limit" numeric NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."user_api_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "can_access_shadowing" boolean NOT NULL,
    "can_access_cloze" boolean NOT NULL,
    "can_access_alignment" boolean NOT NULL,
    "can_access_articles" boolean NOT NULL,
    "allowed_languages" "text"[] NOT NULL,
    "allowed_levels" "text"[] NOT NULL,
    "max_daily_attempts" integer NOT NULL,
    "custom_restrictions" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "api_keys" "jsonb",
    "ai_enabled" boolean,
    "model_permissions" "jsonb"
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vocab_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "term" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "native_lang" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_id" "uuid",
    "context" "text",
    "tags" "text"[],
    "status" "text",
    "explanation" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "srs_due" timestamp with time zone,
    "srs_interval" integer,
    "srs_ease" double precision,
    "srs_reps" integer,
    "srs_lapses" integer,
    "srs_last" timestamp with time zone,
    "srs_state" "text"
);


ALTER TABLE "public"."vocab_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."voices" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "language_code" "text" NOT NULL,
    "ssml_gender" "text",
    "natural_sample_rate_hertz" integer,
    "pricing" "jsonb" NOT NULL,
    "characteristics" "jsonb" NOT NULL,
    "display_name" "text",
    "category" "text" NOT NULL,
    "is_active" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "provider" "text",
    "usecase" "text",
    "is_news_voice" boolean,
    "use_case" "text"
);


ALTER TABLE "public"."voices" OWNER TO "postgres";


ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_materials"
    ADD CONSTRAINT "alignment_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_subtopics"
    ADD CONSTRAINT "alignment_subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_themes"
    ADD CONSTRAINT "alignment_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_batch_items"
    ADD CONSTRAINT "article_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_article"
    ADD CONSTRAINT "cloze_shadowing_attempts_article_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_shadowing_items"
    ADD CONSTRAINT "cloze_shadowing_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_shadowing_items"
    ADD CONSTRAINT "cloze_shadowing_items_source_item_id_sentence_index_key" UNIQUE ("source_item_id", "sentence_index");



ALTER TABLE ONLY "public"."default_user_permissions"
    ADD CONSTRAINT "default_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_items"
    ADD CONSTRAINT "shadowing_items_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."shadowing_subtopics"
    ADD CONSTRAINT "shadowing_subtopics_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."shadowing_themes"
    ADD CONSTRAINT "shadowing_themes_id_unique" UNIQUE ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_pkey" PRIMARY KEY ("id");



CREATE INDEX "alignment_attempts_prev_idx" ON "public"."alignment_attempts" USING "btree" ("prev_attempt_id");



CREATE INDEX "alignment_attempts_subtopic_created_idx" ON "public"."alignment_attempts" USING "btree" ("subtopic_id", "created_at" DESC);



CREATE INDEX "alignment_attempts_user_subtopic_idx" ON "public"."alignment_attempts" USING "btree" ("user_id", "subtopic_id", "attempt_number");



CREATE UNIQUE INDEX "alignment_materials_current_idx" ON "public"."alignment_materials" USING "btree" ("subtopic_id") WHERE "is_current";



CREATE INDEX "alignment_materials_status_idx" ON "public"."alignment_materials" USING "btree" ("status");



CREATE INDEX "alignment_materials_subtopic_idx" ON "public"."alignment_materials" USING "btree" ("subtopic_id");



CREATE INDEX "alignment_subtopics_status_idx" ON "public"."alignment_subtopics" USING "btree" ("status");



CREATE UNIQUE INDEX "alignment_subtopics_unique_theme_title" ON "public"."alignment_subtopics" USING "btree" ("theme_id", "title_normalized");



CREATE INDEX "alignment_themes_status_idx" ON "public"."alignment_themes" USING "btree" ("status");



CREATE UNIQUE INDEX "alignment_themes_unique_lang_level_genre_title" ON "public"."alignment_themes" USING "btree" ("lang", "level", "genre", "title_normalized");



CREATE INDEX "idx_api_usage_logs_created_at" ON "public"."api_usage_logs" USING "btree" ("created_at");



CREATE INDEX "idx_cloze_shadowing_items_published" ON "public"."cloze_shadowing_items" USING "btree" ("source_item_id", "is_published");



CREATE INDEX "idx_vocab_entries_user_due" ON "public"."vocab_entries" USING "btree" ("user_id", "srs_due") WHERE ("status" <> 'archived'::"text");



CREATE UNIQUE INDEX "user_api_limits_user_id_key" ON "public"."user_api_limits" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "update_user_api_limits_updated_at" BEFORE UPDATE ON "public"."user_api_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_api_limits_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_vocab_entries_updated_at" BEFORE UPDATE ON "public"."vocab_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."alignment_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_prev_attempt_id_fkey" FOREIGN KEY ("prev_attempt_id") REFERENCES "public"."alignment_attempts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."alignment_subtopics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alignment_materials"
    ADD CONSTRAINT "alignment_materials_subtopic_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."alignment_subtopics"("id") ON DELETE CASCADE NOT VALID;



ALTER TABLE ONLY "public"."alignment_materials"
    ADD CONSTRAINT "alignment_materials_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."alignment_subtopics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alignment_subtopics"
    ADD CONSTRAINT "alignment_subtopics_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."alignment_themes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_article"
    ADD CONSTRAINT "cloze_shadowing_attempts_article_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "public"."shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_article"
    ADD CONSTRAINT "cloze_shadowing_attempts_article_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_cloze_item_id_fkey" FOREIGN KEY ("cloze_item_id") REFERENCES "public"."cloze_shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "public"."shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_items"
    ADD CONSTRAINT "cloze_shadowing_items_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "public"."shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_items"
    ADD CONSTRAINT "cloze_shadowing_items_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."shadowing_subtopics"("id");



ALTER TABLE ONLY "public"."cloze_shadowing_items"
    ADD CONSTRAINT "cloze_shadowing_items_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."shadowing_themes"("id");



ALTER TABLE "public"."alignment_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alignment_attempts_insert_own" ON "public"."alignment_attempts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "alignment_attempts_select_own" ON "public"."alignment_attempts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "alignment_attempts_update_own" ON "public"."alignment_attempts" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."alignment_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alignment_materials_select_active" ON "public"."alignment_materials" FOR SELECT USING ((("status" = ANY (ARRAY['pending_review'::"text", 'active'::"text"])) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "alignment_materials_service_write" ON "public"."alignment_materials" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."alignment_subtopics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alignment_subtopics_select_all" ON "public"."alignment_subtopics" FOR SELECT USING (true);



CREATE POLICY "alignment_subtopics_service_write" ON "public"."alignment_subtopics" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."alignment_themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alignment_themes_select_all" ON "public"."alignment_themes" FOR SELECT USING (true);



CREATE POLICY "alignment_themes_service_write" ON "public"."alignment_themes" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."cloze_shadowing_attempts_article" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cloze_shadowing_attempts_article_own_insert" ON "public"."cloze_shadowing_attempts_article" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cloze_shadowing_attempts_article_own_select" ON "public"."cloze_shadowing_attempts_article" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."cloze_shadowing_attempts_sentence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cloze_shadowing_attempts_sentence_own_insert" ON "public"."cloze_shadowing_attempts_sentence" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "cloze_shadowing_attempts_sentence_own_select" ON "public"."cloze_shadowing_attempts_sentence" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."cloze_shadowing_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cloze_shadowing_items_select_all" ON "public"."cloze_shadowing_items" FOR SELECT USING (true);



CREATE POLICY "cloze_shadowing_items_service_write" ON "public"."cloze_shadowing_items" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."default_user_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_permissions_combined" ON "public"."user_permissions" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."shadowing_items_audio_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."shadowing_items_audio_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."shadowing_items_audio_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shadowing_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_shadowing_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shadowing_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_api_limits_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_api_limits_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_api_limits_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invitation_code"("code_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invitation_code"("code_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invitation_code"("code_text" "text") TO "service_role";



GRANT ALL ON TABLE "public"."alignment_attempts" TO "anon";
GRANT ALL ON TABLE "public"."alignment_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."alignment_materials" TO "anon";
GRANT ALL ON TABLE "public"."alignment_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_materials" TO "service_role";



GRANT ALL ON TABLE "public"."alignment_packs" TO "anon";
GRANT ALL ON TABLE "public"."alignment_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_packs" TO "service_role";



GRANT ALL ON TABLE "public"."alignment_subtopics" TO "anon";
GRANT ALL ON TABLE "public"."alignment_subtopics" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_subtopics" TO "service_role";



GRANT ALL ON TABLE "public"."alignment_themes" TO "anon";
GRANT ALL ON TABLE "public"."alignment_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_themes" TO "service_role";



GRANT ALL ON TABLE "public"."api_limits" TO "anon";
GRANT ALL ON TABLE "public"."api_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."api_limits" TO "service_role";



GRANT ALL ON TABLE "public"."api_usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."api_usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."api_usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."article_batch_items" TO "anon";
GRANT ALL ON TABLE "public"."article_batch_items" TO "authenticated";
GRANT ALL ON TABLE "public"."article_batch_items" TO "service_role";



GRANT ALL ON TABLE "public"."article_batches" TO "anon";
GRANT ALL ON TABLE "public"."article_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."article_batches" TO "service_role";



GRANT ALL ON TABLE "public"."article_cloze" TO "anon";
GRANT ALL ON TABLE "public"."article_cloze" TO "authenticated";
GRANT ALL ON TABLE "public"."article_cloze" TO "service_role";



GRANT ALL ON TABLE "public"."article_drafts" TO "anon";
GRANT ALL ON TABLE "public"."article_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."article_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."article_keys" TO "anon";
GRANT ALL ON TABLE "public"."article_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."article_keys" TO "service_role";



GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_attempts" TO "anon";
GRANT ALL ON TABLE "public"."cloze_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_drafts" TO "anon";
GRANT ALL ON TABLE "public"."cloze_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_items" TO "anon";
GRANT ALL ON TABLE "public"."cloze_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_items" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_article" TO "anon";
GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_article" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_article" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_sentence" TO "anon";
GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_sentence" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_shadowing_attempts_sentence" TO "service_role";



GRANT ALL ON TABLE "public"."cloze_shadowing_items" TO "anon";
GRANT ALL ON TABLE "public"."cloze_shadowing_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cloze_shadowing_items" TO "service_role";



GRANT ALL ON TABLE "public"."default_user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."default_user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."default_user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."glossary" TO "anon";
GRANT ALL ON TABLE "public"."glossary" TO "authenticated";
GRANT ALL ON TABLE "public"."glossary" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_uses" TO "anon";
GRANT ALL ON TABLE "public"."invitation_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_uses" TO "service_role";



GRANT ALL ON TABLE "public"."phrases" TO "anon";
GRANT ALL ON TABLE "public"."phrases" TO "authenticated";
GRANT ALL ON TABLE "public"."phrases" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."registration_config" TO "anon";
GRANT ALL ON TABLE "public"."registration_config" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_config" TO "service_role";



GRANT ALL ON TABLE "public"."sessions" TO "anon";
GRANT ALL ON TABLE "public"."sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_attempts" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_drafts" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_items" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_items" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_items" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_sessions" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_subtopics" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_subtopics" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_subtopics" TO "service_role";



GRANT ALL ON TABLE "public"."shadowing_themes" TO "anon";
GRANT ALL ON TABLE "public"."shadowing_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."shadowing_themes" TO "service_role";



GRANT ALL ON TABLE "public"."study_cards" TO "anon";
GRANT ALL ON TABLE "public"."study_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."study_cards" TO "service_role";



GRANT ALL ON TABLE "public"."tts_assets" TO "anon";
GRANT ALL ON TABLE "public"."tts_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."tts_assets" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_api_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_limits" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_entries" TO "anon";
GRANT ALL ON TABLE "public"."vocab_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_entries" TO "service_role";



GRANT ALL ON TABLE "public"."voices" TO "anon";
GRANT ALL ON TABLE "public"."voices" TO "authenticated";
GRANT ALL ON TABLE "public"."voices" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;
