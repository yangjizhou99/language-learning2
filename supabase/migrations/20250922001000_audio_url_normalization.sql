BEGIN;

-- 1) 规范化字段：为音频存储增加 bucket 与 path
ALTER TABLE public.shadowing_items
  ADD COLUMN IF NOT EXISTS audio_bucket text,
  ADD COLUMN IF NOT EXISTS audio_path text;

-- 3) 从本地代理 URL 回填（/api/storage-proxy?path=...&bucket=...）
UPDATE public.shadowing_items
SET
  audio_bucket = COALESCE(
    audio_bucket,
    NULLIF(substring(COALESCE(audio_url, notes->>'audio_url') from 'bucket=([^&]+)'), '')
  ),
  audio_path = COALESCE(
    audio_path,
    replace(
      NULLIF(substring(COALESCE(audio_url, notes->>'audio_url') from 'path=([^&]+)'), ''),
      '%2F',
      '/'
    )
  )
WHERE (
  (audio_url IS NOT NULL AND audio_url LIKE '%/api/storage-proxy?%') OR
  (notes ? 'audio_url' AND (notes->>'audio_url') LIKE '%/api/storage-proxy?%')
);

-- 4) 从 Supabase 直链/签名链回填（/storage/v1/object/(sign|public)/{bucket}/{path}）
UPDATE public.shadowing_items
SET
  audio_bucket = COALESCE(
    audio_bucket,
    substring(
      COALESCE(audio_url, notes->>'audio_url')
      from '/storage/v1/object/(?:sign|public)/([^/]+)/'
    )
  ),
  audio_path = COALESCE(
    audio_path,
    substring(
      COALESCE(audio_url, notes->>'audio_url')
      from '/storage/v1/object/(?:sign|public)/[^/]+/([^?]+)'
    )
  )
WHERE (
  (audio_url IS NOT NULL AND audio_url LIKE '%/storage/v1/object/%') OR
  (notes ? 'audio_url' AND (notes->>'audio_url') LIKE '%/storage/v1/object/%')
);

-- 5) 兜底默认 bucket
UPDATE public.shadowing_items
SET audio_bucket = COALESCE(audio_bucket, 'tts')
WHERE audio_bucket IS NULL OR audio_bucket = '';

-- 6) 生成列：统一相对代理链接（跨环境无需替换域名/签名）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='shadowing_items' AND column_name='audio_url_proxy'
  ) THEN
    ALTER TABLE public.shadowing_items
      ADD COLUMN audio_url_proxy text GENERATED ALWAYS AS (
        '/api/storage-proxy?path=' || COALESCE(audio_path, '') || '&bucket=' || COALESCE(audio_bucket, 'tts')
      ) STORED;
  END IF;
END$$;

-- 7) 不再依赖旧的 audio_url，不创建触发器；读写直接使用 audio_bucket/audio_path

COMMIT;


