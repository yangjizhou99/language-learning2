-- 修复剩余的安全问题
-- 20250120000101_fix_remaining_security_issues.sql

-- 1. 修复 insert_shadowing_item 函数的搜索路径（如果存在）
-- 注意：这个函数可能不存在，如果不存在会报错，可以忽略
DO $$
BEGIN
  -- 尝试修复 insert_shadowing_item 函数
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

-- 2. 修复 update_shadowing_sessions_updated_at 函数的搜索路径
CREATE OR REPLACE FUNCTION public.update_shadowing_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
