

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


COMMENT ON SCHEMA "public" IS '已删除未使用的表: article_cloze, article_keys, articles, registration_config, sessions, study_cards, tts_assets';



CREATE TYPE "public"."dialogue_type_enum" AS ENUM (
    'casual',
    'task',
    'emotion',
    'opinion',
    'request',
    'roleplay',
    'pattern'
);


ALTER TYPE "public"."dialogue_type_enum" OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text" DEFAULT NULL::"text", "p_level" integer DEFAULT NULL::integer, "p_practiced" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0, "p_since" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_allowed_languages" "text"[] DEFAULT NULL::"text"[], "p_allowed_levels" integer[] DEFAULT NULL::integer[], "p_dialogue_type" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "lang" "text", "level" integer, "title" "text", "text" "text", "audio_url" "text", "audio_bucket" "text", "audio_path" "text", "sentence_timeline" "jsonb", "topic" "text", "genre" "text", "dialogue_type" "text", "register" "text", "notes" "jsonb", "translations" "jsonb", "trans_updated_at" timestamp with time zone, "ai_provider" "text", "ai_model" "text", "ai_usage" "jsonb", "status" "text", "theme_id" "uuid", "subtopic_id" "uuid", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "theme_title" "text", "theme_desc" "text", "subtopic_title" "text", "subtopic_one_line" "text", "session_status" "text", "last_practiced" timestamp with time zone, "recording_count" integer, "vocab_count" integer, "practice_time_seconds" integer, "is_practiced" boolean, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH filtered_items AS (
    SELECT 
      i.id,
      i.lang,
      i.level,
      i.title,
      i.text,
      i.audio_url,
      i.audio_bucket,
      i.audio_path,
      i.sentence_timeline,
      i.topic,
      i.genre,
      i.dialogue_type,
      i.register,
      i.notes,
      i.translations,
      i.trans_updated_at,
      i.ai_provider,
      i.ai_model,
      i.ai_usage,
      i.status,
      i.theme_id,
      i.subtopic_id,
      i.created_at,
      i.updated_at,
      t.title as theme_title,
      t.desc as theme_desc,
      st.title as subtopic_title,
      st.one_line as subtopic_one_line,
      s.status as session_status,
      s.created_at as last_practiced,
      s.recordings,
      s.picked_preview,
      COUNT(*) OVER() as total_count
    FROM shadowing_items i
    LEFT JOIN shadowing_themes t ON i.theme_id = t.id
    LEFT JOIN shadowing_subtopics st ON i.subtopic_id = st.id
    LEFT JOIN shadowing_sessions s ON s.item_id = i.id AND s.user_id = p_user_id
    WHERE 
      i.status = 'approved'
      AND (
        p_dialogue_type IS NULL
        OR p_dialogue_type = 'all'
        OR i.dialogue_type::text = p_dialogue_type
      )
      AND (
        (p_lang IS NOT NULL AND i.lang = p_lang)
        OR (p_lang IS NULL AND (p_allowed_languages IS NULL OR i.lang = ANY(p_allowed_languages)))
      )
      AND (
        (p_level IS NOT NULL AND i.level = p_level)
        OR (p_level IS NULL AND (p_allowed_levels IS NULL OR i.level = ANY(p_allowed_levels)))
      )
      AND (
        p_practiced IS NULL OR 
        (p_practiced = 'true' AND s.status = 'completed') OR
        (p_practiced = 'false' AND (s.status IS NULL OR s.status != 'completed'))
      )
      AND (p_since IS NULL OR i.updated_at > p_since)
    ORDER BY 
      CASE WHEN p_since IS NOT NULL THEN i.updated_at ELSE i.created_at END DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    f.id,
    f.lang,
    f.level,
    f.title,
    f.text,
    f.audio_url,
    f.audio_bucket,
    f.audio_path,
    f.sentence_timeline,
    f.topic,
    f.genre,
    f.dialogue_type::text, -- Explicit cast to text
    f.register,
    f.notes,
    f.translations,
    f.trans_updated_at,
    f.ai_provider,
    f.ai_model,
    f.ai_usage,
    f.status,
    f.theme_id,
    f.subtopic_id,
    f.created_at,
    f.updated_at,
    f.theme_title,
    f.theme_desc,
    f.subtopic_title,
    f.subtopic_one_line,
    f.session_status,
    f.last_practiced,
    COALESCE(jsonb_array_length(f.recordings), 0)::int as recording_count,
    COALESCE(jsonb_array_length(f.picked_preview), 0)::int as vocab_count,
    (
      COALESCE(
        (
          SELECT SUM((rec->>'duration')::int)
          FROM jsonb_array_elements(COALESCE(f.recordings, '[]'::jsonb)) as rec
          WHERE (rec->>'duration') IS NOT NULL
        ), 
        0
      ) / 1000
    )::int as practice_time_seconds,
    (f.session_status = 'completed')::boolean as is_practiced,
    f.total_count
  FROM filtered_items f;
END;
$$;


ALTER FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text", "p_level" integer, "p_practiced" "text", "p_limit" integer, "p_offset" integer, "p_since" timestamp with time zone, "p_allowed_languages" "text"[], "p_allowed_levels" integer[], "p_dialogue_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text", "p_level" integer, "p_practiced" "text", "p_limit" integer, "p_offset" integer, "p_since" timestamp with time zone, "p_allowed_languages" "text"[], "p_allowed_levels" integer[], "p_dialogue_type" "text") IS '
Shadowing catalog optimized query with dialogue_type filtering support (fixed return type).
';



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


CREATE OR REPLACE FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE
    AS $$
  SELECT json_build_object(
    'byLanguage', (
      SELECT COALESCE(json_object_agg(lang, count), '{}'::json)
      FROM (
        SELECT lang, COUNT(*) as count 
        FROM vocab_entries 
        WHERE user_id = p_user_id 
        GROUP BY lang
      ) t
    ),
    'byStatus', (
      SELECT COALESCE(json_object_agg(status, count), '{}'::json)
      FROM (
        SELECT status, COUNT(*) as count 
        FROM vocab_entries 
        WHERE user_id = p_user_id 
        GROUP BY status
      ) t
    ),
    'withExplanation', (
      SELECT COUNT(*) 
      FROM vocab_entries 
      WHERE user_id = p_user_id AND explanation IS NOT NULL
    ),
    'withoutExplanation', (
      SELECT COUNT(*) 
      FROM vocab_entries 
      WHERE user_id = p_user_id AND explanation IS NULL
    )
  );
$$;


ALTER FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") IS '高效获取用户生词统计信息，使用SQL聚合避免内存统计';



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
    AS $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_set_timestamp"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."update_scene_tags_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_scene_tags_updated_at"() OWNER TO "postgres";


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
    "knowledge_points" "jsonb" DEFAULT '{"words": [], "sentences": []}'::"jsonb" NOT NULL,
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
    "practice_scenario" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "standard_dialogue" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "alignment_materials_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text", 'ko'::"text"]))),
    CONSTRAINT "alignment_materials_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "alignment_materials_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "alignment_materials_task_type_check" CHECK (("task_type" = ANY (ARRAY['dialogue'::"text", 'article'::"text", 'task_email'::"text", 'long_writing'::"text"])))
);


ALTER TABLE "public"."alignment_materials" OWNER TO "postgres";


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
    CONSTRAINT "alignment_subtopics_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text", 'ko'::"text"]))),
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
    CONSTRAINT "alignment_themes_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text", 'ko'::"text"]))),
    CONSTRAINT "alignment_themes_level_check" CHECK ((("level" >= 1) AND ("level" <= 6))),
    CONSTRAINT "alignment_themes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."alignment_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enabled" boolean DEFAULT true,
    "daily_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "daily_calls_limit" integer DEFAULT 0,
    "daily_tokens_limit" integer DEFAULT 0,
    "daily_cost_limit" double precision DEFAULT 0,
    "monthly_calls_limit" integer DEFAULT 0,
    "monthly_tokens_limit" integer DEFAULT 0,
    "monthly_cost_limit" double precision DEFAULT 0,
    "alert_threshold" double precision,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" "text",
    "method" "text",
    "status_code" integer,
    "duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text",
    "model" "text",
    "tokens_used" integer,
    "cost" double precision,
    "request_data" "jsonb",
    "response_data" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_batch_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "topic" "text",
    "difficulty" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "result_draft_id" "uuid",
    "error" "text",
    "usage" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "article_batch_items_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
);


ALTER TABLE "public"."article_batch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "provider" "text",
    "model" "text",
    "lang" "text",
    "genre" "text",
    "words" integer,
    "temperature" double precision,
    "status" "text",
    "totals" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."article_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text",
    "lang" "text",
    "genre" "text",
    "difficulty" integer,
    "title" "text",
    "text" "text",
    "license" "text",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_params" "jsonb",
    "ai_usage" "jsonb",
    "keys" "jsonb",
    "cloze_short" "jsonb",
    "cloze_long" "jsonb",
    "validator_report" "jsonb",
    "status" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_article_id" "uuid",
    "ai_answer_provider" "text",
    "ai_answer_model" "text",
    "ai_answer_usage" "jsonb",
    "ai_text_provider" "text",
    "ai_text_model" "text",
    "ai_text_usage" "jsonb",
    "ai_text_suggestion" "text"
);


ALTER TABLE "public"."article_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "item_id" "uuid",
    "score" integer,
    "answers" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lang" "text",
    "level" integer,
    "ai_result" "jsonb"
);


ALTER TABLE "public"."cloze_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text",
    "level" integer,
    "topic" "text",
    "title" "text",
    "passage" "text",
    "blanks" "jsonb",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb",
    "status" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cloze_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text",
    "level" integer,
    "topic" "text",
    "title" "text",
    "passage" "text",
    "blanks" "jsonb",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
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
    CONSTRAINT "cloze_shadowing_items_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text", 'ko'::"text"]))),
    CONSTRAINT "cloze_shadowing_items_level_check" CHECK ((("level" >= 1) AND ("level" <= 5)))
);


ALTER TABLE "public"."cloze_shadowing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."default_user_permissions" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
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
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."default_user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."en_phoneme_units" (
    "symbol" character varying(10) NOT NULL,
    "category" character varying(20) NOT NULL,
    "subcategory" character varying(20),
    "examples" "text"[],
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."en_phoneme_units" OWNER TO "postgres";


COMMENT ON TABLE "public"."en_phoneme_units" IS '英语音素辅助表：存储英语IPA音素的分类、示例和描述信息';



COMMENT ON COLUMN "public"."en_phoneme_units"."symbol" IS 'IPA音素符号';



COMMENT ON COLUMN "public"."en_phoneme_units"."category" IS '音素类别：vowel, diphthong, consonant';



COMMENT ON COLUMN "public"."en_phoneme_units"."subcategory" IS '音素子类别：如 short_vowel, stop, fricative 等';



COMMENT ON COLUMN "public"."en_phoneme_units"."examples" IS '包含该音素的示例词数组';



COMMENT ON COLUMN "public"."en_phoneme_units"."description" IS '音素描述信息';



CREATE TABLE IF NOT EXISTS "public"."invitation_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "max_uses" integer DEFAULT 1 NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "expires_at" timestamp with time zone,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitation_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitation_uses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_id" "uuid",
    "used_by" "uuid",
    "used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitation_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."minimal_pairs" (
    "pair_id" bigint NOT NULL,
    "lang" "text" NOT NULL,
    "unit_id_1" bigint,
    "unit_id_2" bigint,
    "word_1" "text" NOT NULL,
    "word_2" "text" NOT NULL,
    "pinyin_1" "text",
    "pinyin_2" "text",
    "difficulty" integer DEFAULT 1,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "minimal_pairs_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
);


ALTER TABLE "public"."minimal_pairs" OWNER TO "postgres";


COMMENT ON TABLE "public"."minimal_pairs" IS '最小对立词表：用于二次验证和针对性训练';



CREATE SEQUENCE IF NOT EXISTS "public"."minimal_pairs_pair_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."minimal_pairs_pair_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."minimal_pairs_pair_id_seq" OWNED BY "public"."minimal_pairs"."pair_id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "native_lang" "text",
    "target_langs" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "bio" "text",
    "goals" "text",
    "preferred_tone" "text",
    "domains" "text"[] DEFAULT '{}'::"text"[],
    "role" "text" DEFAULT 'user'::"text",
    "invited_by" "uuid",
    "invitation_code_id" "uuid",
    "invitation_used_at" timestamp with time zone,
    "ability_level" double precision DEFAULT 1.0,
    "vocab_unknown_rate" "jsonb" DEFAULT '{}'::"jsonb",
    "explore_config" "jsonb" DEFAULT '{"upRatio": 0.2, "downRatio": 0.2, "mainRatio": 0.6}'::"jsonb"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pron_sentences" (
    "sentence_id" bigint NOT NULL,
    "lang" "text" NOT NULL,
    "text" "text" NOT NULL,
    "level" integer DEFAULT 1,
    "domain_tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pron_sentences_level_check" CHECK ((("level" >= 1) AND ("level" <= 5)))
);


ALTER TABLE "public"."pron_sentences" OWNER TO "postgres";


COMMENT ON TABLE "public"."pron_sentences" IS '评测句子库';



CREATE SEQUENCE IF NOT EXISTS "public"."pron_sentences_sentence_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pron_sentences_sentence_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."pron_sentences_sentence_id_seq" OWNED BY "public"."pron_sentences"."sentence_id";



CREATE TABLE IF NOT EXISTS "public"."pronunciation_test_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "mode" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "reference_text" "text",
    "session_label" "text",
    "recognized_text" "text",
    "audio_duration_ms" integer,
    "audio_storage_path" "text",
    "overall_score" numeric,
    "accuracy_score" numeric,
    "fluency_score" numeric,
    "completeness_score" numeric,
    "prosody_score" numeric,
    "azure_detail" "jsonb",
    "azure_raw" "jsonb",
    "extra_metrics" "jsonb",
    "notes" "text",
    CONSTRAINT "pronunciation_test_runs_mode_check" CHECK (("mode" = ANY (ARRAY['batch'::"text", 'stream'::"text"])))
);


ALTER TABLE "public"."pronunciation_test_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_config" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "allow_direct_registration" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "allow_invitation_registration" boolean DEFAULT true,
    "require_email_verification" boolean DEFAULT true,
    "allow_google_oauth" boolean DEFAULT true,
    "allow_anonymous_login" boolean DEFAULT true,
    "maintenance_mode" boolean DEFAULT false,
    "maintenance_message" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."registration_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scene_tags" (
    "scene_id" "text" NOT NULL,
    "name_cn" "text" NOT NULL,
    "name_en" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE "public"."scene_tags" OWNER TO "postgres";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'scene_tags_pkey'
    ) THEN
        ALTER TABLE ONLY "public"."scene_tags"
            ADD CONSTRAINT "scene_tags_pkey" PRIMARY KEY ("scene_id");
    END IF;
END $$;


CREATE TABLE IF NOT EXISTS "public"."sentence_units" (
    "sentence_id" bigint NOT NULL,
    "unit_id" bigint NOT NULL,
    "count" integer DEFAULT 1
);


ALTER TABLE "public"."sentence_units" OWNER TO "postgres";


COMMENT ON TABLE "public"."sentence_units" IS '句子包含的Unit及出现次数（自动生成）';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "task_type" "text",
    "status" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "topic" "text",
    "input" "jsonb",
    "output" "jsonb",
    "ai_feedback" "jsonb",
    "score" integer,
    "duration_sec" integer,
    "difficulty" "text",
    "lang" "text"
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "item_id" "uuid",
    "score" integer,
    "recording_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lang" "text",
    "level" integer,
    "metrics" "jsonb"
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
    "subtopic_id" "uuid",
    "dialogue_type" "text"
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
    "sentence_timeline" "jsonb",
    "dialogue_type" "text"
);


ALTER TABLE "public"."shadowing_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "recordings" "jsonb" DEFAULT '[]'::"jsonb",
    "vocab_entry_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "picked_preview" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "jsonb" DEFAULT '{}'::"jsonb",
    "imported_vocab_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "self_difficulty" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shadowing_sessions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shadowing_sessions"."created_at" IS 'Timestamp when the session was created';



COMMENT ON COLUMN "public"."shadowing_sessions"."updated_at" IS 'Timestamp when the session was last updated';



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
    "ai_usage" "jsonb",
    "dialogue_type" "text"
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
    "coverage" "jsonb",
    "dialogue_type" "text"
);


ALTER TABLE "public"."shadowing_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."study_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lang" "text",
    "front" "text",
    "back" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "type" "text",
    "value" "text",
    "article_id" "uuid"
);


ALTER TABLE "public"."study_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."theme_scene_vectors" (
    "theme_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "weight" numeric NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."theme_scene_vectors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_content" (
    "content_id" bigint NOT NULL,
    "unit_id" bigint NOT NULL,
    "lang" "text" NOT NULL,
    "articulation_points" "text",
    "common_errors" "text",
    "tips" "text",
    "ipa_symbol" "text",
    "practice_words" "text"[],
    "practice_phrases" "text"[],
    "audio_url" "text",
    "difficulty" integer DEFAULT 2,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "training_content_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
);


ALTER TABLE "public"."training_content" OWNER TO "postgres";


COMMENT ON TABLE "public"."training_content" IS '训练内容表：发音要领、常见错误、练习材料';



CREATE SEQUENCE IF NOT EXISTS "public"."training_content_content_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."training_content_content_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."training_content_content_id_seq" OWNED BY "public"."training_content"."content_id";



CREATE TABLE IF NOT EXISTS "public"."unit_alias" (
    "lang" "text" NOT NULL,
    "alias" "text" NOT NULL,
    "unit_id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."unit_alias" OWNER TO "postgres";


COMMENT ON TABLE "public"."unit_alias" IS '音素别名映射表：仅用于真正的别名（如 lü ↔ lv）';



CREATE TABLE IF NOT EXISTS "public"."unit_catalog" (
    "unit_id" bigint NOT NULL,
    "lang" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "unit_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "unit_catalog_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['phoneme'::"text", 'syllable'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."unit_catalog" OWNER TO "postgres";


COMMENT ON TABLE "public"."unit_catalog" IS '发音单元规范表：存储各语言的音素/音节（统一用带空格格式）';



CREATE SEQUENCE IF NOT EXISTS "public"."unit_catalog_unit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."unit_catalog_unit_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."unit_catalog_unit_id_seq" OWNED BY "public"."unit_catalog"."unit_id";



CREATE TABLE IF NOT EXISTS "public"."user_api_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "limit_type" "text",
    "count" integer DEFAULT 0,
    "max_limit" integer DEFAULT 50,
    "reset_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "enabled" boolean DEFAULT true,
    "daily_calls_limit" integer,
    "daily_tokens_limit" integer,
    "daily_cost_limit" double precision,
    "monthly_calls_limit" integer,
    "monthly_tokens_limit" integer,
    "monthly_cost_limit" double precision
);


ALTER TABLE "public"."user_api_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "can_access_shadowing" boolean DEFAULT true NOT NULL,
    "can_access_cloze" boolean DEFAULT true NOT NULL,
    "can_access_alignment" boolean DEFAULT true NOT NULL,
    "can_access_articles" boolean DEFAULT true NOT NULL,
    "allowed_languages" "text"[] DEFAULT ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"] NOT NULL,
    "allowed_levels" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5] NOT NULL,
    "max_daily_attempts" integer DEFAULT 50 NOT NULL,
    "custom_restrictions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "api_keys" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_enabled" boolean DEFAULT false,
    "model_permissions" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."user_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_pron_attempts" (
    "attempt_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "sentence_id" bigint,
    "azure_raw_json" "jsonb",
    "accuracy" numeric(5,2),
    "fluency" numeric(5,2),
    "completeness" numeric(5,2),
    "prosody" numeric(5,2),
    "pron_score" numeric(5,2),
    "valid_flag" boolean DEFAULT true,
    "audio_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_pron_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_pron_attempts" IS '用户评测记录';



CREATE SEQUENCE IF NOT EXISTS "public"."user_pron_attempts_attempt_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_pron_attempts_attempt_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_pron_attempts_attempt_id_seq" OWNED BY "public"."user_pron_attempts"."attempt_id";



CREATE TABLE IF NOT EXISTS "public"."user_pron_verifications" (
    "verification_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "unit_id" bigint NOT NULL,
    "lang" "text" NOT NULL,
    "original_mean" numeric,
    "original_count" integer,
    "verification_mean" numeric,
    "verification_count" integer,
    "replaced" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_pron_verifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_pron_verifications" IS '二次验证历史记录';



CREATE SEQUENCE IF NOT EXISTS "public"."user_pron_verifications_verification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."user_pron_verifications_verification_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."user_pron_verifications_verification_id_seq" OWNED BY "public"."user_pron_verifications"."verification_id";



CREATE TABLE IF NOT EXISTS "public"."user_scene_preferences" (
    "user_id" "uuid" NOT NULL,
    "scene_id" "text" NOT NULL,
    "weight" numeric NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_scene_preferences_weight_check" CHECK ((("weight" >= (0)::numeric) AND ("weight" <= (1)::numeric)))
);


ALTER TABLE "public"."user_scene_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_scene_preferences" IS 'Per-user preference weights in unified scene space (scene_tags).';



CREATE TABLE IF NOT EXISTS "public"."user_sentence_progress" (
    "user_id" "uuid" NOT NULL,
    "sentence_id" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "attempts_count" integer DEFAULT 0,
    "best_score" numeric(5,2),
    "latest_score" numeric(5,2),
    "first_attempt_at" timestamp with time zone,
    "last_attempt_at" timestamp with time zone,
    CONSTRAINT "user_sentence_progress_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."user_sentence_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_sentence_progress" IS '用户句子练习进度';



CREATE TABLE IF NOT EXISTS "public"."user_unit_stats" (
    "user_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "unit_id" bigint NOT NULL,
    "n" integer DEFAULT 0,
    "mean" numeric(5,2) DEFAULT 0,
    "m2" numeric(12,4) DEFAULT 0,
    "ci_low" numeric(5,2),
    "ci_high" numeric(5,2),
    "difficulty" numeric(5,2),
    "last_updated" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_unit_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_unit_stats" IS '用户Unit统计（Welford在线统计）';



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
    "status" "text" DEFAULT 'new'::"text",
    "explanation" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cefr_level" "text",
    "cefr" "text",
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
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "language_code" "text" NOT NULL,
    "ssml_gender" "text",
    "natural_sample_rate_hertz" integer,
    "pricing" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "characteristics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "display_name" "text",
    "category" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "provider" "text" DEFAULT 'google'::"text",
    "usecase" "text",
    "is_news_voice" boolean DEFAULT false,
    "use_case" "text",
    CONSTRAINT "voices_provider_check" CHECK (("provider" = ANY (ARRAY['google'::"text", 'gemini'::"text", 'xunfei'::"text"])))
);


ALTER TABLE "public"."voices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zh_pinyin_units" (
    "symbol" "text" NOT NULL,
    "shengmu" "text",
    "yunmu" "text",
    "tone" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "zh_pinyin_units_tone_check" CHECK ((("tone" >= 1) AND ("tone" <= 5)))
);


ALTER TABLE "public"."zh_pinyin_units" OWNER TO "postgres";


COMMENT ON TABLE "public"."zh_pinyin_units" IS '中文拼音辅助表：声母、韵母、声调';



ALTER TABLE ONLY "public"."minimal_pairs" ALTER COLUMN "pair_id" SET DEFAULT "nextval"('"public"."minimal_pairs_pair_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."pron_sentences" ALTER COLUMN "sentence_id" SET DEFAULT "nextval"('"public"."pron_sentences_sentence_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."training_content" ALTER COLUMN "content_id" SET DEFAULT "nextval"('"public"."training_content_content_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."unit_catalog" ALTER COLUMN "unit_id" SET DEFAULT "nextval"('"public"."unit_catalog_unit_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_pron_attempts" ALTER COLUMN "attempt_id" SET DEFAULT "nextval"('"public"."user_pron_attempts_attempt_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."user_pron_verifications" ALTER COLUMN "verification_id" SET DEFAULT "nextval"('"public"."user_pron_verifications_verification_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_materials"
    ADD CONSTRAINT "alignment_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_subtopics"
    ADD CONSTRAINT "alignment_subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_themes"
    ADD CONSTRAINT "alignment_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_limits"
    ADD CONSTRAINT "api_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_usage_logs"
    ADD CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_batch_items"
    ADD CONSTRAINT "article_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_batches"
    ADD CONSTRAINT "article_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_drafts"
    ADD CONSTRAINT "article_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_drafts"
    ADD CONSTRAINT "cloze_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_items"
    ADD CONSTRAINT "cloze_items_pkey" PRIMARY KEY ("id");



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



DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'en_phoneme_units_symbol_key'
    ) THEN
        ALTER TABLE ONLY "public"."en_phoneme_units"
            ADD CONSTRAINT "en_phoneme_units_symbol_key" UNIQUE ("symbol");
    END IF;
END $$;



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."minimal_pairs"
    ADD CONSTRAINT "minimal_pairs_pkey" PRIMARY KEY ("pair_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pron_sentences"
    ADD CONSTRAINT "pron_sentences_pkey" PRIMARY KEY ("sentence_id");



ALTER TABLE ONLY "public"."pronunciation_test_runs"
    ADD CONSTRAINT "pronunciation_test_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_config"
    ADD CONSTRAINT "registration_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sentence_units"
    ADD CONSTRAINT "sentence_units_pkey" PRIMARY KEY ("sentence_id", "unit_id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_attempts"
    ADD CONSTRAINT "shadowing_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_sessions"
    ADD CONSTRAINT "shadowing_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_cards"
    ADD CONSTRAINT "study_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_content"
    ADD CONSTRAINT "training_content_pkey" PRIMARY KEY ("content_id");



ALTER TABLE ONLY "public"."training_content"
    ADD CONSTRAINT "training_content_unit_id_lang_key" UNIQUE ("unit_id", "lang");



ALTER TABLE ONLY "public"."unit_alias"
    ADD CONSTRAINT "unit_alias_pkey" PRIMARY KEY ("lang", "alias");



DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unit_catalog_lang_symbol_key'
    ) THEN
        ALTER TABLE ONLY "public"."unit_catalog"
            ADD CONSTRAINT "unit_catalog_lang_symbol_key" UNIQUE ("lang", "symbol");
    END IF;
END $$;



DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unit_catalog_pkey'
    ) THEN
        ALTER TABLE ONLY "public"."unit_catalog"
            ADD CONSTRAINT "unit_catalog_pkey" PRIMARY KEY ("unit_id");
    END IF;
END $$;



ALTER TABLE ONLY "public"."user_api_limits"
    ADD CONSTRAINT "user_api_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_pron_attempts"
    ADD CONSTRAINT "user_pron_attempts_pkey" PRIMARY KEY ("attempt_id");



ALTER TABLE ONLY "public"."user_pron_verifications"
    ADD CONSTRAINT "user_pron_verifications_pkey" PRIMARY KEY ("verification_id");



ALTER TABLE ONLY "public"."user_scene_preferences"
    ADD CONSTRAINT "user_scene_preferences_pkey" PRIMARY KEY ("user_id", "scene_id");



ALTER TABLE ONLY "public"."user_sentence_progress"
    ADD CONSTRAINT "user_sentence_progress_pkey" PRIMARY KEY ("user_id", "sentence_id");



ALTER TABLE ONLY "public"."user_unit_stats"
    ADD CONSTRAINT "user_unit_stats_pkey" PRIMARY KEY ("user_id", "lang", "unit_id");



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voices"
    ADD CONSTRAINT "voices_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."voices"
    ADD CONSTRAINT "voices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zh_pinyin_units"
    ADD CONSTRAINT "zh_pinyin_units_pkey" PRIMARY KEY ("symbol");



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



CREATE INDEX IF NOT EXISTS "idx_en_phoneme_units_category" ON "public"."en_phoneme_units" USING "btree" ("category");



CREATE INDEX IF NOT EXISTS "idx_en_phoneme_units_subcategory" ON "public"."en_phoneme_units" USING "btree" ("subcategory");



CREATE INDEX "idx_minimal_pairs_category" ON "public"."minimal_pairs" USING "btree" ("category");



CREATE INDEX "idx_minimal_pairs_lang" ON "public"."minimal_pairs" USING "btree" ("lang");



CREATE INDEX "idx_minimal_pairs_unit1" ON "public"."minimal_pairs" USING "btree" ("unit_id_1");



CREATE INDEX "idx_minimal_pairs_unit2" ON "public"."minimal_pairs" USING "btree" ("unit_id_2");



CREATE INDEX "idx_pron_sentences_lang" ON "public"."pron_sentences" USING "btree" ("lang");



CREATE INDEX "idx_pron_sentences_level" ON "public"."pron_sentences" USING "btree" ("level");



CREATE INDEX "idx_sentence_units_sentence" ON "public"."sentence_units" USING "btree" ("sentence_id");



CREATE INDEX "idx_sentence_units_unit" ON "public"."sentence_units" USING "btree" ("unit_id");



CREATE INDEX "idx_training_content_lang" ON "public"."training_content" USING "btree" ("lang");



CREATE INDEX "idx_training_content_unit" ON "public"."training_content" USING "btree" ("unit_id");



CREATE INDEX "idx_unit_alias_unit_id" ON "public"."unit_alias" USING "btree" ("unit_id");



CREATE INDEX "idx_unit_catalog_lang" ON "public"."unit_catalog" USING "btree" ("lang");



CREATE INDEX "idx_unit_catalog_symbol" ON "public"."unit_catalog" USING "btree" ("symbol");



CREATE INDEX "idx_user_pron_attempts_created" ON "public"."user_pron_attempts" USING "btree" ("created_at");



CREATE INDEX "idx_user_pron_attempts_sentence" ON "public"."user_pron_attempts" USING "btree" ("sentence_id");



CREATE INDEX "idx_user_pron_attempts_user" ON "public"."user_pron_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_user_pron_attempts_user_sentence" ON "public"."user_pron_attempts" USING "btree" ("user_id", "sentence_id");



CREATE INDEX "idx_user_pron_verifications_unit" ON "public"."user_pron_verifications" USING "btree" ("unit_id");



CREATE INDEX "idx_user_pron_verifications_user" ON "public"."user_pron_verifications" USING "btree" ("user_id");



CREATE INDEX "idx_user_scene_preferences_scene" ON "public"."user_scene_preferences" USING "btree" ("scene_id");



CREATE INDEX "idx_user_scene_preferences_user" ON "public"."user_scene_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_sentence_progress_status" ON "public"."user_sentence_progress" USING "btree" ("status");



CREATE INDEX "idx_user_sentence_progress_user" ON "public"."user_sentence_progress" USING "btree" ("user_id");



CREATE INDEX "idx_user_sentence_progress_user_status" ON "public"."user_sentence_progress" USING "btree" ("user_id", "status");



CREATE INDEX "idx_user_unit_stats_mean" ON "public"."user_unit_stats" USING "btree" ("mean");



CREATE INDEX "idx_user_unit_stats_user_lang" ON "public"."user_unit_stats" USING "btree" ("user_id", "lang");



CREATE INDEX "idx_vocab_entries_user_due" ON "public"."vocab_entries" USING "btree" ("user_id", "srs_due") WHERE ("status" <> 'archived'::"text");



CREATE INDEX "idx_vocab_entries_user_has_explanation" ON "public"."vocab_entries" USING "btree" ("user_id", "created_at" DESC) WHERE ("explanation" IS NOT NULL);



COMMENT ON INDEX "public"."idx_vocab_entries_user_has_explanation" IS '优化查询有解释的生词';



CREATE INDEX "idx_vocab_entries_user_lang_status" ON "public"."vocab_entries" USING "btree" ("user_id", "lang", "status", "created_at" DESC) WHERE (("lang" IS NOT NULL) AND ("status" IS NOT NULL));



COMMENT ON INDEX "public"."idx_vocab_entries_user_lang_status" IS '优化按用户、语言和状态筛选的查询';



CREATE INDEX "idx_vocab_entries_user_no_explanation" ON "public"."vocab_entries" USING "btree" ("user_id", "created_at" DESC) WHERE ("explanation" IS NULL);



COMMENT ON INDEX "public"."idx_vocab_entries_user_no_explanation" IS '优化查询无解释的生词';



CREATE INDEX "idx_vocab_entries_user_srs_due" ON "public"."vocab_entries" USING "btree" ("user_id", "srs_due") WHERE (("status" <> 'archived'::"text") OR ("status" IS NULL));



CREATE INDEX "idx_vocab_entries_user_status_created" ON "public"."vocab_entries" USING "btree" ("user_id", "status", "created_at" DESC) WHERE ("status" IS NOT NULL);



COMMENT ON INDEX "public"."idx_vocab_entries_user_status_created" IS '优化按用户和状态筛选的查询';



CREATE INDEX "idx_voices_category" ON "public"."voices" USING "btree" ("category");



CREATE INDEX "idx_voices_language_code" ON "public"."voices" USING "btree" ("language_code");



CREATE INDEX "idx_voices_name" ON "public"."voices" USING "btree" ("name");



CREATE INDEX "idx_voices_provider" ON "public"."voices" USING "btree" ("provider");



CREATE INDEX "pronunciation_test_runs_admin_idx" ON "public"."pronunciation_test_runs" USING "btree" ("admin_id");



CREATE INDEX "pronunciation_test_runs_created_at_idx" ON "public"."pronunciation_test_runs" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "user_api_limits_user_id_key" ON "public"."user_api_limits" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "set_timestamp_pron_sentences" BEFORE UPDATE ON "public"."pron_sentences" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."shadowing_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_shadowing_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_api_limits_updated_at" BEFORE UPDATE ON "public"."user_api_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_api_limits_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_vocab_entries_updated_at" BEFORE UPDATE ON "public"."vocab_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_voices_updated_at" BEFORE UPDATE ON "public"."voices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_material_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."alignment_materials"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."alignment_materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_prev_attempt_id_fkey" FOREIGN KEY ("prev_attempt_id") REFERENCES "public"."alignment_attempts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_prev_fkey" FOREIGN KEY ("prev_attempt_id") REFERENCES "public"."alignment_attempts"("id") ON DELETE SET NULL NOT VALID;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_subtopic_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."alignment_subtopics"("id") ON DELETE CASCADE NOT VALID;



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



ALTER TABLE ONLY "public"."article_batches"
    ADD CONSTRAINT "article_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."article_drafts"
    ADD CONSTRAINT "article_drafts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."cloze_items"("id");



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cloze_drafts"
    ADD CONSTRAINT "cloze_drafts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_article"
    ADD CONSTRAINT "cloze_shadowing_attempts_article_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_cloze_item_id_fkey" FOREIGN KEY ("cloze_item_id") REFERENCES "public"."cloze_shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_shadowing_attempts_sentence"
    ADD CONSTRAINT "cloze_shadowing_attempts_sentence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "public"."invitation_codes"("id");



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."minimal_pairs"
    ADD CONSTRAINT "minimal_pairs_unit_id_1_fkey" FOREIGN KEY ("unit_id_1") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."minimal_pairs"
    ADD CONSTRAINT "minimal_pairs_unit_id_2_fkey" FOREIGN KEY ("unit_id_2") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pronunciation_test_runs"
    ADD CONSTRAINT "pronunciation_test_runs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."sentence_units"
    ADD CONSTRAINT "sentence_units_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "public"."pron_sentences"("sentence_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sentence_units"
    ADD CONSTRAINT "sentence_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shadowing_attempts"
    ADD CONSTRAINT "shadowing_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."study_cards"
    ADD CONSTRAINT "study_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."training_content"
    ADD CONSTRAINT "training_content_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."unit_alias"
    ADD CONSTRAINT "unit_alias_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pron_attempts"
    ADD CONSTRAINT "user_pron_attempts_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "public"."pron_sentences"("sentence_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_pron_attempts"
    ADD CONSTRAINT "user_pron_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_pron_verifications"
    ADD CONSTRAINT "user_pron_verifications_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_scene_preferences"
    ADD CONSTRAINT "user_scene_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sentence_progress"
    ADD CONSTRAINT "user_sentence_progress_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "public"."pron_sentences"("sentence_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sentence_progress"
    ADD CONSTRAINT "user_sentence_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_unit_stats"
    ADD CONSTRAINT "user_unit_stats_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."unit_catalog"("unit_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_unit_stats"
    ADD CONSTRAINT "user_unit_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE "public"."api_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_batch_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloze_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloze_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloze_items" ENABLE ROW LEVEL SECURITY;


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


CREATE POLICY "invitation_codes_admin_delete" ON "public"."invitation_codes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invitation_codes_admin_insert" ON "public"."invitation_codes" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "invitation_codes_admin_select" ON "public"."invitation_codes" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invitation_codes_admin_update" ON "public"."invitation_codes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "invitation_codes_creator_insert" ON "public"."invitation_codes" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "invitation_codes_creator_select" ON "public"."invitation_codes" FOR SELECT TO "authenticated" USING (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."invitation_uses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."pron_sentences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pron_sentences_read" ON "public"."pron_sentences" FOR SELECT USING (true);



ALTER TABLE "public"."pronunciation_test_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registration_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sentence_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sentence_units_read" ON "public"."sentence_units" FOR SELECT USING (true);



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadowing_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."study_cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_content" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_content_select_all" ON "public"."training_content" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."unit_alias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_alias_read" ON "public"."unit_alias" FOR SELECT USING (true);



ALTER TABLE "public"."unit_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_catalog_read" ON "public"."unit_catalog" FOR SELECT USING (true);



ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_permissions_combined" ON "public"."user_permissions" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."user_pron_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_pron_attempts_own" ON "public"."user_pron_attempts" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_pron_verifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_pron_verifications_insert_service" ON "public"."user_pron_verifications" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "user_pron_verifications_select_own" ON "public"."user_pron_verifications" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_scene_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_scene_preferences_select_own" ON "public"."user_scene_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_scene_preferences_write_own" ON "public"."user_scene_preferences" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_sentence_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_sentence_progress_own" ON "public"."user_sentence_progress" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_unit_stats" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_unit_stats_own" ON "public"."user_unit_stats" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."voices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voices_select_all" ON "public"."voices" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."zh_pinyin_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zh_pinyin_units_read" ON "public"."zh_pinyin_units" FOR SELECT USING (true);



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



GRANT ALL ON FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text", "p_level" integer, "p_practiced" "text", "p_limit" integer, "p_offset" integer, "p_since" timestamp with time zone, "p_allowed_languages" "text"[], "p_allowed_levels" integer[], "p_dialogue_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text", "p_level" integer, "p_practiced" "text", "p_limit" integer, "p_offset" integer, "p_since" timestamp with time zone, "p_allowed_languages" "text"[], "p_allowed_levels" integer[], "p_dialogue_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shadowing_catalog"("p_user_id" "uuid", "p_lang" "text", "p_level" integer, "p_practiced" "text", "p_limit" integer, "p_offset" integer, "p_since" timestamp with time zone, "p_allowed_languages" "text"[], "p_allowed_levels" integer[], "p_dialogue_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_columns"("table_name_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_table_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_table_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_table_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vocab_stats"("p_user_id" "uuid") TO "service_role";



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



GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_api_usage_logs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_default_user_permissions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_scene_tags_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_scene_tags_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_scene_tags_updated_at"() TO "service_role";



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



GRANT ALL ON TABLE "public"."article_drafts" TO "anon";
GRANT ALL ON TABLE "public"."article_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."article_drafts" TO "service_role";



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



GRANT ALL ON TABLE "public"."en_phoneme_units" TO "anon";
GRANT ALL ON TABLE "public"."en_phoneme_units" TO "authenticated";
GRANT ALL ON TABLE "public"."en_phoneme_units" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."invitation_uses" TO "anon";
GRANT ALL ON TABLE "public"."invitation_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."invitation_uses" TO "service_role";



GRANT ALL ON TABLE "public"."minimal_pairs" TO "anon";
GRANT ALL ON TABLE "public"."minimal_pairs" TO "authenticated";
GRANT ALL ON TABLE "public"."minimal_pairs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."minimal_pairs_pair_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."minimal_pairs_pair_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."minimal_pairs_pair_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pron_sentences" TO "anon";
GRANT ALL ON TABLE "public"."pron_sentences" TO "authenticated";
GRANT ALL ON TABLE "public"."pron_sentences" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pron_sentences_sentence_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pron_sentences_sentence_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pron_sentences_sentence_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pronunciation_test_runs" TO "anon";
GRANT ALL ON TABLE "public"."pronunciation_test_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."pronunciation_test_runs" TO "service_role";



GRANT ALL ON TABLE "public"."registration_config" TO "anon";
GRANT ALL ON TABLE "public"."registration_config" TO "authenticated";
GRANT ALL ON TABLE "public"."registration_config" TO "service_role";



GRANT ALL ON TABLE "public"."scene_tags" TO "anon";
GRANT ALL ON TABLE "public"."scene_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."scene_tags" TO "service_role";



GRANT ALL ON TABLE "public"."sentence_units" TO "anon";
GRANT ALL ON TABLE "public"."sentence_units" TO "authenticated";
GRANT ALL ON TABLE "public"."sentence_units" TO "service_role";



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



GRANT ALL ON TABLE "public"."theme_scene_vectors" TO "anon";
GRANT ALL ON TABLE "public"."theme_scene_vectors" TO "authenticated";
GRANT ALL ON TABLE "public"."theme_scene_vectors" TO "service_role";



GRANT ALL ON TABLE "public"."training_content" TO "anon";
GRANT ALL ON TABLE "public"."training_content" TO "authenticated";
GRANT ALL ON TABLE "public"."training_content" TO "service_role";



GRANT ALL ON SEQUENCE "public"."training_content_content_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."training_content_content_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."training_content_content_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."unit_alias" TO "anon";
GRANT ALL ON TABLE "public"."unit_alias" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_alias" TO "service_role";



GRANT ALL ON TABLE "public"."unit_catalog" TO "anon";
GRANT ALL ON TABLE "public"."unit_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."unit_catalog" TO "service_role";



GRANT ALL ON SEQUENCE "public"."unit_catalog_unit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."unit_catalog_unit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."unit_catalog_unit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_api_limits" TO "anon";
GRANT ALL ON TABLE "public"."user_api_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_api_limits" TO "service_role";



GRANT ALL ON TABLE "public"."user_permissions" TO "anon";
GRANT ALL ON TABLE "public"."user_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."user_pron_attempts" TO "anon";
GRANT ALL ON TABLE "public"."user_pron_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pron_attempts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_pron_attempts_attempt_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_pron_attempts_attempt_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_pron_attempts_attempt_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_pron_verifications" TO "anon";
GRANT ALL ON TABLE "public"."user_pron_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_pron_verifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_pron_verifications_verification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_pron_verifications_verification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_pron_verifications_verification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_scene_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_scene_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_scene_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_sentence_progress" TO "anon";
GRANT ALL ON TABLE "public"."user_sentence_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sentence_progress" TO "service_role";



GRANT ALL ON TABLE "public"."user_unit_stats" TO "anon";
GRANT ALL ON TABLE "public"."user_unit_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_unit_stats" TO "service_role";



GRANT ALL ON TABLE "public"."vocab_entries" TO "anon";
GRANT ALL ON TABLE "public"."vocab_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."vocab_entries" TO "service_role";



GRANT ALL ON TABLE "public"."voices" TO "anon";
GRANT ALL ON TABLE "public"."voices" TO "authenticated";
GRANT ALL ON TABLE "public"."voices" TO "service_role";



GRANT ALL ON TABLE "public"."zh_pinyin_units" TO "anon";
GRANT ALL ON TABLE "public"."zh_pinyin_units" TO "authenticated";
GRANT ALL ON TABLE "public"."zh_pinyin_units" TO "service_role";



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
