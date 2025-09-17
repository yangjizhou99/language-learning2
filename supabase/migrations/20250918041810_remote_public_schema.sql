

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
    SET "search_path" TO 'public'
    AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION "public"."update_user_api_limits_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_permissions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    "pack_id" "uuid" NOT NULL,
    "step_key" "text" NOT NULL,
    "submission" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alignment_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alignment_packs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "topic" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "level_min" integer DEFAULT 1,
    "level_max" integer DEFAULT 6,
    "preferred_style" "jsonb" DEFAULT '{}'::"jsonb",
    "steps" "jsonb" NOT NULL,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."alignment_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."api_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "daily_calls_limit" integer DEFAULT 1000 NOT NULL,
    "daily_tokens_limit" integer DEFAULT 1000000 NOT NULL,
    "daily_cost_limit" numeric(10,2) DEFAULT 10.00 NOT NULL,
    "monthly_calls_limit" integer DEFAULT 30000 NOT NULL,
    "monthly_tokens_limit" integer DEFAULT 30000000 NOT NULL,
    "monthly_cost_limit" numeric(10,2) DEFAULT 300.00 NOT NULL,
    "alert_threshold" integer DEFAULT 80 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "api_limits_alert_threshold_check" CHECK ((("alert_threshold" >= 0) AND ("alert_threshold" <= 100)))
);


ALTER TABLE "public"."api_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_limits" IS '全局API使用限制表';



CREATE TABLE IF NOT EXISTS "public"."api_usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "model" character varying(100) NOT NULL,
    "tokens_used" integer DEFAULT 0,
    "cost" numeric(10,6) DEFAULT 0.0,
    "request_data" "jsonb",
    "response_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."api_usage_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_usage_logs" IS 'API使用日志表';



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
    "name" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "model" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "words" integer DEFAULT 300 NOT NULL,
    "temperature" double precision DEFAULT 0.6 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "totals" "jsonb" DEFAULT '{"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."article_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_cloze" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid",
    "version" "text" NOT NULL,
    "items" "jsonb" NOT NULL
);


ALTER TABLE "public"."article_cloze" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "license" "text",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_params" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "keys" "jsonb" DEFAULT '{}'::"jsonb",
    "cloze_short" "jsonb" DEFAULT '[]'::"jsonb",
    "cloze_long" "jsonb" DEFAULT '[]'::"jsonb",
    "validator_report" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_article_id" "uuid",
    "ai_answer_provider" "text",
    "ai_answer_model" "text",
    "ai_answer_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_text_provider" "text",
    "ai_text_model" "text",
    "ai_text_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_text_suggestion" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "article_drafts_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
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
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "genre" "text" NOT NULL,
    "difficulty" integer NOT NULL,
    "title" "text" NOT NULL,
    "source_url" "text",
    "license" "text",
    "text" "text" NOT NULL,
    "checksum" "text" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "articles_difficulty_check" CHECK ((("difficulty" >= 1) AND ("difficulty" <= 5)))
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "answers" "jsonb" NOT NULL,
    "ai_result" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cloze_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text" DEFAULT ''::"text",
    "title" "text" NOT NULL,
    "passage" "text" NOT NULL,
    "blanks" "jsonb" NOT NULL,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cloze_drafts_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "cloze_drafts_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."cloze_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cloze_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text" DEFAULT ''::"text",
    "title" "text" NOT NULL,
    "passage" "text" NOT NULL,
    "blanks" "jsonb" NOT NULL,
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cloze_items_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "cloze_items_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."cloze_items" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."glossary" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "term" "text" NOT NULL,
    "definition" "text" NOT NULL,
    "aliases" "text"[] DEFAULT ARRAY[]::"text"[],
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "lang" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "glossary_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"])))
);


ALTER TABLE "public"."glossary" OWNER TO "postgres";


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
    "code_id" "uuid" NOT NULL,
    "used_by" "uuid" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitation_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phrases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tag" "text",
    "text" "text" NOT NULL,
    "example" "text",
    "lang" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "phrases_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"])))
);


ALTER TABLE "public"."phrases" OWNER TO "postgres";


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
    "invitation_used_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registration_config" (
    "id" "text" DEFAULT 'main'::"text" NOT NULL,
    "allow_direct_registration" boolean DEFAULT false NOT NULL,
    "allow_invitation_registration" boolean DEFAULT true NOT NULL,
    "require_email_verification" boolean DEFAULT true NOT NULL,
    "allow_google_oauth" boolean DEFAULT false NOT NULL,
    "allow_anonymous_login" boolean DEFAULT false NOT NULL,
    "maintenance_mode" boolean DEFAULT false NOT NULL,
    "maintenance_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."registration_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."registration_config" IS '注册配置表';



COMMENT ON COLUMN "public"."registration_config"."allow_direct_registration" IS '是否允许直接注册（邮箱密码）';



COMMENT ON COLUMN "public"."registration_config"."allow_invitation_registration" IS '是否允许邀请码注册';



COMMENT ON COLUMN "public"."registration_config"."require_email_verification" IS '是否需要邮箱验证';



COMMENT ON COLUMN "public"."registration_config"."allow_google_oauth" IS '是否允许Google OAuth登录';



COMMENT ON COLUMN "public"."registration_config"."allow_anonymous_login" IS '是否允许匿名登录';



COMMENT ON COLUMN "public"."registration_config"."maintenance_mode" IS '是否开启维护模式';



COMMENT ON COLUMN "public"."registration_config"."maintenance_message" IS '维护模式提示信息';



CREATE TABLE IF NOT EXISTS "public"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_type" "text",
    "topic" "text",
    "input" "jsonb",
    "output" "jsonb",
    "ai_feedback" "jsonb",
    "score" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "duration_sec" numeric,
    "difficulty" "text",
    "lang" "text",
    CONSTRAINT "sessions_task_type_check" CHECK (("task_type" = ANY (ARRAY['cloze'::"text", 'sft'::"text", 'shadowing'::"text"])))
);


ALTER TABLE "public"."sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shadowing_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "topic" "text" DEFAULT ''::"text",
    "genre" "text" DEFAULT 'monologue'::"text",
    "register" "text" DEFAULT 'neutral'::"text",
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "notes" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "translations" "jsonb" DEFAULT '{}'::"jsonb",
    "trans_updated_at" timestamp with time zone,
    "source" "jsonb",
    "theme_id" "uuid",
    "subtopic_id" "uuid",
    CONSTRAINT "shadowing_drafts_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "shadowing_drafts_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."shadowing_drafts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shadowing_drafts"."translations" IS '存储翻译内容，格式：{"en": "英文翻译", "ja": "日文翻译", "zh": "中文翻译"}';



COMMENT ON COLUMN "public"."shadowing_drafts"."trans_updated_at" IS '翻译最后更新时间';



COMMENT ON COLUMN "public"."shadowing_drafts"."theme_id" IS '关联的大主题ID';



COMMENT ON COLUMN "public"."shadowing_drafts"."subtopic_id" IS '关联的小主题ID';



CREATE TABLE IF NOT EXISTS "public"."shadowing_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "title" "text" NOT NULL,
    "text" "text" NOT NULL,
    "audio_url" "text" NOT NULL,
    "duration_ms" integer,
    "tokens" integer,
    "cefr" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "translations" "jsonb" DEFAULT '{}'::"jsonb",
    "trans_updated_at" timestamp with time zone,
    "theme_id" "uuid",
    "subtopic_id" "uuid",
    "topic" "text" DEFAULT ''::"text",
    "genre" "text" DEFAULT 'monologue'::"text",
    "register" "text" DEFAULT 'neutral'::"text",
    "notes" "jsonb" DEFAULT '{}'::"jsonb",
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'approved'::"text",
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shadowing_items_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."shadowing_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shadowing_items"."translations" IS '存储翻译内容，格式：{"en": "英文翻译", "ja": "日文翻译", "zh": "中文翻译"}';



COMMENT ON COLUMN "public"."shadowing_items"."trans_updated_at" IS '翻译最后更新时间';



COMMENT ON COLUMN "public"."shadowing_items"."theme_id" IS '关联的大主题ID';



COMMENT ON COLUMN "public"."shadowing_items"."subtopic_id" IS '关联的小主题ID';



CREATE TABLE IF NOT EXISTS "public"."shadowing_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'in_progress'::"text" NOT NULL,
    "recordings" "jsonb" DEFAULT '[]'::"jsonb",
    "vocab_entry_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "picked_preview" "jsonb" DEFAULT '[]'::"jsonb",
    "notes" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shadowing_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shadowing_subtopics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "theme_id" "uuid" NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title_cn" "text" NOT NULL,
    "seed_en" "text",
    "one_line_cn" "text",
    "tags" "text"[],
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "shadowing_subtopics_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "shadowing_subtopics_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."shadowing_subtopics" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shadowing_subtopics"."ai_provider" IS 'AI 提供者：openrouter/deepseek/openai';



COMMENT ON COLUMN "public"."shadowing_subtopics"."ai_model" IS 'AI 模型名称';



COMMENT ON COLUMN "public"."shadowing_subtopics"."ai_usage" IS 'AI 使用统计：{prompt_tokens, completion_tokens, total_tokens}';



CREATE TABLE IF NOT EXISTS "public"."shadowing_themes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lang" "text" NOT NULL,
    "level" integer NOT NULL,
    "genre" "text" NOT NULL,
    "title" "text" NOT NULL,
    "desc" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "ai_provider" "text",
    "ai_model" "text",
    "ai_usage" "jsonb" DEFAULT '{}'::"jsonb",
    "title_en" "text",
    "coverage" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "shadowing_themes_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text", 'zh'::"text"]))),
    CONSTRAINT "shadowing_themes_level_check" CHECK ((("level" >= 1) AND ("level" <= 6)))
);


ALTER TABLE "public"."shadowing_themes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shadowing_themes"."ai_provider" IS 'AI 提供者：openrouter/deepseek/openai';



COMMENT ON COLUMN "public"."shadowing_themes"."ai_model" IS 'AI 模型名称';



COMMENT ON COLUMN "public"."shadowing_themes"."ai_usage" IS 'AI 使用统计：{prompt_tokens, completion_tokens, total_tokens}';



COMMENT ON COLUMN "public"."shadowing_themes"."title_en" IS '英文标题（用于多语言展示）';



COMMENT ON COLUMN "public"."shadowing_themes"."coverage" IS '主题覆盖的子话题面：["要点1","要点2","要点3"]';



CREATE TABLE IF NOT EXISTS "public"."study_cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "lang" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "article_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."study_cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tts_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "path" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "voice_name" "text",
    "speaking_rate" numeric,
    "pitch" numeric,
    "topic" "text",
    "text_excerpt" "text",
    "text_len" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "tts_assets_lang_check" CHECK (("lang" = ANY (ARRAY['en'::"text", 'ja'::"text"])))
);


ALTER TABLE "public"."tts_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_api_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "daily_calls_limit" integer DEFAULT 0 NOT NULL,
    "daily_tokens_limit" integer DEFAULT 0 NOT NULL,
    "daily_cost_limit" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "monthly_calls_limit" integer DEFAULT 0 NOT NULL,
    "monthly_tokens_limit" integer DEFAULT 0 NOT NULL,
    "monthly_cost_limit" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_api_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_api_limits" IS '用户API使用限制表';



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


COMMENT ON TABLE "public"."user_permissions" IS '用户权限管理表';



COMMENT ON COLUMN "public"."user_permissions"."api_keys" IS '用户API密钥配置';



COMMENT ON COLUMN "public"."user_permissions"."ai_enabled" IS '是否启用AI功能';



COMMENT ON COLUMN "public"."user_permissions"."model_permissions" IS '用户可访问的AI模型权限配置';



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
    CONSTRAINT "vocab_entries_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'starred'::"text", 'archived'::"text"])))
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


ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alignment_packs"
    ADD CONSTRAINT "alignment_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_limits"
    ADD CONSTRAINT "api_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_usage_logs"
    ADD CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_batch_items"
    ADD CONSTRAINT "article_batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_batches"
    ADD CONSTRAINT "article_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_cloze"
    ADD CONSTRAINT "article_cloze_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_drafts"
    ADD CONSTRAINT "article_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_keys"
    ADD CONSTRAINT "article_keys_pkey" PRIMARY KEY ("article_id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_lang_title_checksum_key" UNIQUE ("lang", "title", "checksum");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_drafts"
    ADD CONSTRAINT "cloze_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cloze_items"
    ADD CONSTRAINT "cloze_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."default_user_permissions"
    ADD CONSTRAINT "default_user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."glossary"
    ADD CONSTRAINT "glossary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_code_id_used_by_key" UNIQUE ("code_id", "used_by");



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phrases"
    ADD CONSTRAINT "phrases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registration_config"
    ADD CONSTRAINT "registration_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_attempts"
    ADD CONSTRAINT "shadowing_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_drafts"
    ADD CONSTRAINT "shadowing_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_items"
    ADD CONSTRAINT "shadowing_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_sessions"
    ADD CONSTRAINT "shadowing_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_subtopics"
    ADD CONSTRAINT "shadowing_subtopics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shadowing_themes"
    ADD CONSTRAINT "shadowing_themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."study_cards"
    ADD CONSTRAINT "study_cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tts_assets"
    ADD CONSTRAINT "tts_assets_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."tts_assets"
    ADD CONSTRAINT "tts_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_limits"
    ADD CONSTRAINT "user_api_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_api_limits"
    ADD CONSTRAINT "user_api_limits_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voices"
    ADD CONSTRAINT "voices_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."voices"
    ADD CONSTRAINT "voices_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_alignment_attempts_pack_id" ON "public"."alignment_attempts" USING "btree" ("pack_id");



COMMENT ON INDEX "public"."idx_alignment_attempts_pack_id" IS '优化 alignment_attempts 表 pack_id 外键查询性能';



CREATE INDEX "idx_alignment_attempts_user_pack" ON "public"."alignment_attempts" USING "btree" ("user_id", "pack_id");



CREATE INDEX "idx_alignment_packs_created_by" ON "public"."alignment_packs" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_alignment_packs_created_by" IS '优化 alignment_packs 表 created_by 外键查询性能';



CREATE INDEX "idx_alignment_packs_status_lang" ON "public"."alignment_packs" USING "btree" ("status", "lang");



CREATE UNIQUE INDEX "idx_api_limits_single" ON "public"."api_limits" USING "btree" ((1));



CREATE INDEX "idx_api_usage_logs_created_at" ON "public"."api_usage_logs" USING "btree" ("created_at");



CREATE INDEX "idx_api_usage_logs_stats" ON "public"."api_usage_logs" USING "btree" ("user_id", "provider", "created_at");



CREATE INDEX "idx_article_batch_items_batch_id" ON "public"."article_batch_items" USING "btree" ("batch_id");



COMMENT ON INDEX "public"."idx_article_batch_items_batch_id" IS '优化 article_batch_items 表 batch_id 外键查询性能';



CREATE INDEX "idx_article_batches_created_by" ON "public"."article_batches" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_article_batches_created_by" IS '优化 article_batches 表 created_by 外键查询性能';



CREATE INDEX "idx_article_cloze_article_id" ON "public"."article_cloze" USING "btree" ("article_id");



COMMENT ON INDEX "public"."idx_article_cloze_article_id" IS '优化 article_cloze 表 article_id 外键查询性能';



CREATE INDEX "idx_article_drafts_created_by" ON "public"."article_drafts" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_article_drafts_created_by" IS '优化 article_drafts 表 created_by 外键查询性能';



CREATE INDEX "idx_article_drafts_status_created" ON "public"."article_drafts" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_articles_lang_difficulty" ON "public"."articles" USING "btree" ("lang", "difficulty");



CREATE INDEX "idx_articles_lang_genre_updated" ON "public"."articles" USING "btree" ("lang", "genre", "updated_at" DESC);



CREATE INDEX "idx_cloze_attempts_item_id" ON "public"."cloze_attempts" USING "btree" ("item_id");



CREATE INDEX "idx_cloze_attempts_user_id" ON "public"."cloze_attempts" USING "btree" ("user_id");



CREATE INDEX "idx_cloze_drafts_created_by" ON "public"."cloze_drafts" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_cloze_drafts_created_by" IS '优化 cloze_drafts 表 created_by 外键查询性能';



CREATE INDEX "idx_cloze_drafts_lang_level" ON "public"."cloze_drafts" USING "btree" ("lang", "level");



CREATE INDEX "idx_cloze_drafts_status_lang_level" ON "public"."cloze_drafts" USING "btree" ("status", "lang", "level");



CREATE INDEX "idx_cloze_items_lang_level" ON "public"."cloze_items" USING "btree" ("lang", "level");



CREATE INDEX "idx_cloze_items_lang_level_created" ON "public"."cloze_items" USING "btree" ("lang", "level", "created_at" DESC);



CREATE INDEX "idx_cloze_items_lang_level_title" ON "public"."cloze_items" USING "btree" ("lang", "level", "title");



CREATE INDEX "idx_glossary_lang_updated" ON "public"."glossary" USING "btree" ("lang", "updated_at" DESC);



CREATE INDEX "idx_invitation_codes_code" ON "public"."invitation_codes" USING "btree" ("code");



CREATE INDEX "idx_invitation_codes_created_by" ON "public"."invitation_codes" USING "btree" ("created_by");



CREATE INDEX "idx_invitation_uses_used_by" ON "public"."invitation_uses" USING "btree" ("used_by");



CREATE INDEX "idx_phrases_lang_created" ON "public"."phrases" USING "btree" ("lang", "created_at" DESC);



CREATE INDEX "idx_profiles_invitation_code_id" ON "public"."profiles" USING "btree" ("invitation_code_id");



COMMENT ON INDEX "public"."idx_profiles_invitation_code_id" IS '优化 profiles 表 invitation_code_id 外键查询性能';



CREATE INDEX "idx_profiles_invited_by" ON "public"."profiles" USING "btree" ("invited_by");



COMMENT ON INDEX "public"."idx_profiles_invited_by" IS '优化 profiles 表 invited_by 外键查询性能';



CREATE INDEX "idx_sessions_user_id" ON "public"."sessions" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_sessions_user_id" IS '优化 sessions 表 user_id 外键查询性能';



CREATE INDEX "idx_shadowing_attempts_item_user" ON "public"."shadowing_attempts" USING "btree" ("item_id", "user_id");



CREATE INDEX "idx_shadowing_attempts_stats" ON "public"."shadowing_attempts" USING "btree" ("user_id", "lang", "level", "created_at" DESC);



CREATE INDEX "idx_shadowing_attempts_user_lang_created" ON "public"."shadowing_attempts" USING "btree" ("user_id", "lang", "created_at" DESC);



CREATE INDEX "idx_shadowing_drafts_created_by" ON "public"."shadowing_drafts" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_shadowing_drafts_created_by" IS '优化 shadowing_drafts 表 created_by 外键查询性能';



CREATE INDEX "idx_shadowing_drafts_lang_level" ON "public"."shadowing_drafts" USING "btree" ("lang", "level");



CREATE INDEX "idx_shadowing_drafts_status" ON "public"."shadowing_drafts" USING "btree" ("status");



CREATE INDEX "idx_shadowing_drafts_status_lang_level" ON "public"."shadowing_drafts" USING "btree" ("status", "lang", "level");



CREATE INDEX "idx_shadowing_drafts_subtopic_id" ON "public"."shadowing_drafts" USING "btree" ("subtopic_id");



CREATE INDEX "idx_shadowing_drafts_theme_id" ON "public"."shadowing_drafts" USING "btree" ("theme_id");



CREATE INDEX "idx_shadowing_items_created_by" ON "public"."shadowing_items" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_shadowing_items_created_by" IS '优化 shadowing_items 表 created_by 外键查询性能';



CREATE INDEX "idx_shadowing_items_lang_level_created" ON "public"."shadowing_items" USING "btree" ("lang", "level", "created_at" DESC);



CREATE INDEX "idx_shadowing_items_lang_level_subtopic" ON "public"."shadowing_items" USING "btree" ("lang", "level", "subtopic_id");



CREATE INDEX "idx_shadowing_items_lang_level_theme" ON "public"."shadowing_items" USING "btree" ("lang", "level", "theme_id");



CREATE INDEX "idx_shadowing_items_lang_level_title" ON "public"."shadowing_items" USING "btree" ("lang", "level", "title");



CREATE INDEX "idx_shadowing_items_status_updated" ON "public"."shadowing_items" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_shadowing_items_subtopic_id" ON "public"."shadowing_items" USING "btree" ("subtopic_id");



CREATE INDEX "idx_shadowing_items_theme_id" ON "public"."shadowing_items" USING "btree" ("theme_id");



CREATE INDEX "idx_shadowing_items_theme_subtopic" ON "public"."shadowing_items" USING "btree" ("theme_id", "subtopic_id");



CREATE INDEX "idx_shadowing_sessions_item_id" ON "public"."shadowing_sessions" USING "btree" ("item_id");



COMMENT ON INDEX "public"."idx_shadowing_sessions_item_id" IS '优化 shadowing_sessions 表 item_id 外键查询性能';



CREATE INDEX "idx_shadowing_sessions_user_item" ON "public"."shadowing_sessions" USING "btree" ("user_id", "item_id");



CREATE INDEX "idx_shadowing_subtopics_created_by" ON "public"."shadowing_subtopics" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_shadowing_subtopics_created_by" IS '优化 shadowing_subtopics 表 created_by 外键查询性能';



CREATE INDEX "idx_shadowing_subtopics_filter" ON "public"."shadowing_subtopics" USING "btree" ("lang", "level", "genre", "status");



CREATE INDEX "idx_shadowing_subtopics_theme" ON "public"."shadowing_subtopics" USING "btree" ("theme_id");



CREATE INDEX "idx_shadowing_themes_created_by" ON "public"."shadowing_themes" USING "btree" ("created_by");



COMMENT ON INDEX "public"."idx_shadowing_themes_created_by" IS '优化 shadowing_themes 表 created_by 外键查询性能';



CREATE INDEX "idx_shadowing_themes_lgg" ON "public"."shadowing_themes" USING "btree" ("lang", "level", "genre");



CREATE INDEX "idx_study_cards_user_id" ON "public"."study_cards" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_study_cards_user_id" IS '优化 study_cards 表 user_id 外键查询性能';



CREATE INDEX "idx_tts_assets_user_id" ON "public"."tts_assets" USING "btree" ("user_id");



COMMENT ON INDEX "public"."idx_tts_assets_user_id" IS '优化 tts_assets 表 user_id 外键查询性能';



CREATE INDEX "idx_user_permissions_user_id" ON "public"."user_permissions" USING "btree" ("user_id");



CREATE INDEX "idx_vocab_entries_created_at" ON "public"."vocab_entries" USING "btree" ("created_at");



CREATE INDEX "idx_vocab_entries_lang" ON "public"."vocab_entries" USING "btree" ("lang");



CREATE INDEX "idx_vocab_entries_status" ON "public"."vocab_entries" USING "btree" ("status");



CREATE INDEX "idx_vocab_entries_term" ON "public"."vocab_entries" USING "btree" ("term");



CREATE INDEX "idx_vocab_entries_term_lang" ON "public"."vocab_entries" USING "btree" ("term", "lang");



CREATE INDEX "idx_vocab_entries_user_id" ON "public"."vocab_entries" USING "btree" ("user_id");



CREATE INDEX "idx_vocab_entries_user_lang" ON "public"."vocab_entries" USING "btree" ("user_id", "lang");



CREATE INDEX "idx_voices_category" ON "public"."voices" USING "btree" ("category");



CREATE INDEX "idx_voices_language_code" ON "public"."voices" USING "btree" ("language_code");



CREATE INDEX "idx_voices_name" ON "public"."voices" USING "btree" ("name");



CREATE INDEX "idx_voices_provider" ON "public"."voices" USING "btree" ("provider");



CREATE UNIQUE INDEX "uniq_shadowing_themes_key" ON "public"."shadowing_themes" USING "btree" ("lang", "level", "genre", "title");



CREATE OR REPLACE TRIGGER "trg_articles_updated_at" BEFORE UPDATE ON "public"."articles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_glossary_updated_at" BEFORE UPDATE ON "public"."glossary" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_phrases_updated_at" BEFORE UPDATE ON "public"."phrases" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_shadowing_items_updated_at" BEFORE UPDATE ON "public"."shadowing_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_api_usage_logs_updated_at" BEFORE UPDATE ON "public"."api_usage_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_api_usage_logs_updated_at"();



CREATE OR REPLACE TRIGGER "update_default_user_permissions_updated_at" BEFORE UPDATE ON "public"."default_user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_default_user_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_invitation_codes_updated_at" BEFORE UPDATE ON "public"."invitation_codes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_registration_config_updated_at" BEFORE UPDATE ON "public"."registration_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_api_limits_updated_at" BEFORE UPDATE ON "public"."user_api_limits" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_api_limits_updated_at"();



CREATE OR REPLACE TRIGGER "update_user_permissions_updated_at" BEFORE UPDATE ON "public"."user_permissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_permissions_updated_at"();



CREATE OR REPLACE TRIGGER "update_vocab_entries_updated_at" BEFORE UPDATE ON "public"."vocab_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_voices_updated_at" BEFORE UPDATE ON "public"."voices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "public"."alignment_packs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alignment_attempts"
    ADD CONSTRAINT "alignment_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alignment_packs"
    ADD CONSTRAINT "alignment_packs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."api_usage_logs"
    ADD CONSTRAINT "api_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_batch_items"
    ADD CONSTRAINT "article_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."article_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_batches"
    ADD CONSTRAINT "article_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."article_cloze"
    ADD CONSTRAINT "article_cloze_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_drafts"
    ADD CONSTRAINT "article_drafts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."article_keys"
    ADD CONSTRAINT "article_keys_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."cloze_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_attempts"
    ADD CONSTRAINT "cloze_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cloze_drafts"
    ADD CONSTRAINT "cloze_drafts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invitation_codes"
    ADD CONSTRAINT "invitation_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "public"."invitation_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitation_uses"
    ADD CONSTRAINT "invitation_uses_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invitation_code_id_fkey" FOREIGN KEY ("invitation_code_id") REFERENCES "public"."invitation_codes"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_attempts"
    ADD CONSTRAINT "shadowing_attempts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_attempts"
    ADD CONSTRAINT "shadowing_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_drafts"
    ADD CONSTRAINT "shadowing_drafts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shadowing_drafts"
    ADD CONSTRAINT "shadowing_drafts_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."shadowing_subtopics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shadowing_drafts"
    ADD CONSTRAINT "shadowing_drafts_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."shadowing_themes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shadowing_items"
    ADD CONSTRAINT "shadowing_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shadowing_items"
    ADD CONSTRAINT "shadowing_items_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "public"."shadowing_subtopics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shadowing_items"
    ADD CONSTRAINT "shadowing_items_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."shadowing_themes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shadowing_sessions"
    ADD CONSTRAINT "shadowing_sessions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."shadowing_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_sessions"
    ADD CONSTRAINT "shadowing_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_subtopics"
    ADD CONSTRAINT "shadowing_subtopics_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."shadowing_subtopics"
    ADD CONSTRAINT "shadowing_subtopics_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."shadowing_themes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shadowing_themes"
    ADD CONSTRAINT "shadowing_themes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."study_cards"
    ADD CONSTRAINT "study_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tts_assets"
    ADD CONSTRAINT "tts_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_api_limits"
    ADD CONSTRAINT "user_api_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_permissions"
    ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vocab_entries"
    ADD CONSTRAINT "vocab_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage api limits" ON "public"."api_limits" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Service role can insert api usage logs" ON "public"."api_usage_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can delete own vocab entries" ON "public"."vocab_entries" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own vocab entries" ON "public"."vocab_entries" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own vocab entries" ON "public"."vocab_entries" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view own vocab entries" ON "public"."vocab_entries" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "aa_owner_rw" ON "public"."alignment_attempts" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."alignment_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alignment_packs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alignment_packs_combined" ON "public"."alignment_packs" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."api_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_usage_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "api_usage_logs_combined_select" ON "public"."api_usage_logs" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."article_batch_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_batch_items_combined" ON "public"."article_batch_items" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."article_batches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_batches_combined" ON "public"."article_batches" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."article_cloze" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_cloze_combined" ON "public"."article_cloze" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."article_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_drafts_combined" ON "public"."article_drafts" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."article_keys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "article_keys_combined" ON "public"."article_keys" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."articles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "articles_combined" ON "public"."articles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "ca_owner_rw" ON "public"."cloze_attempts" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "cd_admin" ON "public"."cloze_drafts" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "ci_read" ON "public"."cloze_items" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cloze_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloze_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cloze_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."default_user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "default_user_permissions_admin_all" ON "public"."default_user_permissions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."glossary" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invitation_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitation_codes_admin_delete" ON "public"."invitation_codes" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "invitation_codes_admin_update" ON "public"."invitation_codes" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "invitation_codes_combined_insert" ON "public"."invitation_codes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "invitation_codes_combined_select" ON "public"."invitation_codes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("created_by" = ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."invitation_uses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invitation_uses_combined_select" ON "public"."invitation_uses" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("used_by" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "invitation_uses_insert" ON "public"."invitation_uses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "p_glossary_read" ON "public"."glossary" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_phrases_read" ON "public"."phrases" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "p_shadowing_subtopics_rw" ON "public"."shadowing_subtopics" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "p_shadowing_themes_rw" ON "public"."shadowing_themes" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."phrases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



ALTER TABLE "public"."registration_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "registration_config_combined" ON "public"."registration_config" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "sa_owner_rw" ON "public"."shadowing_attempts" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_all_own" ON "public"."sessions" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."shadowing_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadowing_drafts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shadowing_drafts_combined" ON "public"."shadowing_drafts" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("status" = 'approved'::"text"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("status" = 'approved'::"text")));



ALTER TABLE "public"."shadowing_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadowing_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadowing_subtopics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shadowing_themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "si_delete" ON "public"."shadowing_items" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "si_insert" ON "public"."shadowing_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "si_read" ON "public"."shadowing_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "si_update" ON "public"."shadowing_items" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "ss_owner_del" ON "public"."shadowing_sessions" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ss_owner_ins" ON "public"."shadowing_sessions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ss_owner_select" ON "public"."shadowing_sessions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ss_owner_upd" ON "public"."shadowing_sessions" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."study_cards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "study_cards_combined" ON "public"."study_cards" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."tts_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tts_assets_all_own" ON "public"."tts_assets" TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_api_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_api_limits_combined" ON "public"."user_api_limits" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."user_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_permissions_combined" ON "public"."user_permissions" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id"))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (( SELECT "auth"."uid"() AS "uid") = "user_id")));



ALTER TABLE "public"."vocab_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "voices_select_all" ON "public"."voices" FOR SELECT USING (("is_active" = true));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invitation_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_shadowing_item"("p_lang" "text", "p_level" integer, "p_title" "text", "p_text" "text", "p_audio_url" "text", "p_duration_ms" integer, "p_tokens" integer, "p_cefr" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



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



GRANT ALL ON TABLE "public"."alignment_packs" TO "anon";
GRANT ALL ON TABLE "public"."alignment_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."alignment_packs" TO "service_role";



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
