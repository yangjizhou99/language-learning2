-- 修复最终的安全问题
-- 20250120000104_fix_final_security_issues.sql

-- 1. 修复 insert_shadowing_item 函数的搜索路径问题
-- 这个函数可能不存在，所以使用条件创建
DO $$
BEGIN
  -- 检查函数是否存在
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'insert_shadowing_item'
  ) THEN
    -- 如果函数存在，重新创建它并设置搜索路径
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.insert_shadowing_item(
      p_lang text,
      p_level integer,
      p_title text,
      p_text text,
      p_audio_url text,
      p_duration_ms integer DEFAULT NULL,
      p_tokens integer DEFAULT NULL,
      p_cefr text DEFAULT NULL,
      p_meta jsonb DEFAULT ''{}''::jsonb
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
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
    $func$';
  END IF;
END $$;

-- 2. 检查并修复其他可能存在搜索路径问题的函数
-- 修复 update_updated_at_column 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$';
  END IF;
END $$;

-- 3. 修复 generate_invitation_code 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'generate_invitation_code'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.generate_invitation_code()
    RETURNS text
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    DECLARE
      chars text := ''ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'';
      result text := '''';
      i integer;
    BEGIN
      FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
      END LOOP;
      RETURN result;
    END;
    $func$';
  END IF;
END $$;

-- 4. 修复 validate_invitation_code 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'validate_invitation_code'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.validate_invitation_code(code_text text)
    RETURNS TABLE(
      is_valid boolean,
      code_id uuid,
      max_uses integer,
      used_count integer,
      expires_at timestamptz,
      permissions jsonb,
      error_message text
    )
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    DECLARE
      invitation_record record;
    BEGIN
      -- 查找邀请码
      SELECT * INTO invitation_record
      FROM public.invitation_codes
      WHERE code = code_text AND is_active = true;

      IF NOT FOUND THEN
        RETURN QUERY SELECT false, null::uuid, 0, 0, null::timestamptz, null::jsonb, ''邀请码不存在或已失效''::text;
        RETURN;
      END IF;

      -- 检查是否过期
      IF invitation_record.expires_at IS NOT NULL AND invitation_record.expires_at < NOW() THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, ''邀请码已过期''::text;
        RETURN;
      END IF;

      -- 检查使用次数
      IF invitation_record.used_count >= invitation_record.max_uses THEN
        RETURN QUERY SELECT false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                           invitation_record.expires_at, invitation_record.permissions, ''邀请码使用次数已达上限''::text;
        RETURN;
      END IF;

      -- 邀请码有效
      RETURN QUERY SELECT true, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                         invitation_record.expires_at, invitation_record.permissions, null::text;
    END;
    $func$';
  END IF;
END $$;

-- 5. 修复 update_api_usage_logs_updated_at 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_api_usage_logs_updated_at'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.update_api_usage_logs_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$';
  END IF;
END $$;

-- 6. 修复 update_user_api_limits_updated_at 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_user_api_limits_updated_at'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.update_user_api_limits_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$';
  END IF;
END $$;

-- 7. 修复 update_shadowing_sessions_updated_at 函数（如果存在）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_shadowing_sessions_updated_at'
  ) THEN
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.update_shadowing_sessions_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SET search_path = public
    AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$';
  END IF;
END $$;
