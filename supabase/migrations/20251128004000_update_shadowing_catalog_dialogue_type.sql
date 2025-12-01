-- Update get_shadowing_catalog to support dialogue_type filtering and enforce dialogue-only items
DROP FUNCTION IF EXISTS get_shadowing_catalog(
  uuid,
  text,
  integer,
  text,
  integer,
  integer,
  timestamptz,
  text[],
  int[]
);

CREATE OR REPLACE FUNCTION get_shadowing_catalog(
  p_user_id uuid,
  p_lang text DEFAULT NULL,
  p_level int DEFAULT NULL,
  p_practiced text DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0,
  p_since timestamptz DEFAULT NULL,
  p_allowed_languages text[] DEFAULT NULL,
  p_allowed_levels int[] DEFAULT NULL,
  p_dialogue_type text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  lang text,
  level int,
  title text,
  text text,
  audio_url text,
  audio_bucket text,
  audio_path text,
  sentence_timeline jsonb,
  topic text,
  genre text,
  dialogue_type text,
  register text,
  notes jsonb,
  translations jsonb,
  trans_updated_at timestamptz,
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  status text,
  theme_id uuid,
  subtopic_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  theme_title text,
  theme_desc text,
  subtopic_title text,
  subtopic_one_line text,
  session_status text,
  last_practiced timestamptz,
  recording_count int,
  vocab_count int,
  practice_time_seconds int,
  is_practiced boolean,
  total_count bigint
) AS $$
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
      AND i.genre = 'dialogue'
      AND (
        p_dialogue_type IS NULL
        OR p_dialogue_type = 'all'
        OR i.dialogue_type = p_dialogue_type
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
    f.dialogue_type,
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
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_shadowing_catalog IS '
Shadowing catalog optimized query with dialogue_type filtering support.
';
