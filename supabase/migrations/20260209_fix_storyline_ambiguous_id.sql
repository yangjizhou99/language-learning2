-- Fix ambiguous column reference and missing created_at in storyline function
CREATE OR REPLACE FUNCTION get_storyline_complete(
    p_user_id UUID,
    p_lang TEXT DEFAULT NULL,
    p_level INT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    "desc" TEXT,
    lang TEXT,
    level INT,
    genre TEXT,
    subtopics JSONB,
    progress JSONB,
    average_score INT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH 
    -- 1. Filter Themes (Added created_at for sorting)
    target_themes AS (
        SELECT t.id, t.title, t."desc", t.lang, t.level, t.genre, t.created_at
        FROM shadowing_themes t
        WHERE t.status = 'active'
        AND (p_lang IS NULL OR t.lang = p_lang)
        AND (p_level IS NULL OR t.level = p_level)
    ),
    
    -- 2. Get Subtopics for these themes
    theme_subtopics AS (
        SELECT s.id, s.theme_id, s.title, s.one_line, s.created_at
        FROM shadowing_subtopics s
        WHERE s.status = 'active'
        AND s.theme_id IN (SELECT tt.id FROM target_themes tt)
    ),
    
    -- 3. Get Items for these subtopics
    subtopic_items AS (
        SELECT DISTINCT ON (i.subtopic_id) i.subtopic_id, i.id AS item_id
        FROM shadowing_items i
        WHERE i.subtopic_id IN (SELECT ts.id FROM theme_subtopics ts)
        ORDER BY i.subtopic_id, i.created_at DESC
    ),
    
    -- 4. Get User Sessions for these items
    user_sessions AS (
        SELECT ss.item_id, ss.notes, ss.recordings
        FROM shadowing_sessions ss
        WHERE ss.user_id = p_user_id
        AND ss.status = 'completed'
        AND ss.item_id IN (SELECT si.item_id FROM subtopic_items si)
    ),
    
    -- 5. Calculate Scores per Session
    session_scores AS (
        SELECT 
            us.item_id,
            CASE 
                WHEN us.notes->'sentence_scores' IS NOT NULL AND jsonb_typeof(us.notes->'sentence_scores') = 'object' THEN
                    (
                        SELECT COALESCE(AVG(
                            CASE 
                                WHEN (val->>'bestScore')::numeric > 1 THEN (val->>'bestScore')::numeric
                                WHEN (val->>'bestScore')::numeric > 0 THEN (val->>'bestScore')::numeric * 100
                                ELSE 0
                            END
                        )::INT, 0)
                        FROM jsonb_each(us.notes->'sentence_scores') AS x(key, val)
                    )
                WHEN us.recordings IS NOT NULL AND jsonb_typeof(us.recordings) = 'array' THEN
                    (
                        SELECT COALESCE(AVG(
                            CASE 
                                WHEN (elm->>'score')::numeric > 1 THEN (elm->>'score')::numeric
                                WHEN (elm->>'score')::numeric > 0 THEN (elm->>'score')::numeric * 100
                                ELSE 0 
                            END
                        )::INT, 0)
                        FROM jsonb_array_elements(us.recordings) elm
                        WHERE (elm->>'score') IS NOT NULL
                    )
                ELSE 0
            END as score
        FROM user_sessions us
    ),

    -- 6. Scene Vectors (Top 2 per subtopic)
    subtopic_vectors AS (
        SELECT 
            ssv.subtopic_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', st.scene_id,
                    'name', st.name_cn,
                    'weight', ssv.weight
                ) ORDER BY ssv.weight DESC
            ) FILTER (WHERE st.scene_id IS NOT NULL) as top_scenes
        FROM subtopic_scene_vectors ssv
        JOIN scene_tags st ON ssv.scene_id = st.scene_id
        WHERE ssv.subtopic_id IN (SELECT ts.id FROM theme_subtopics ts)
        GROUP BY ssv.subtopic_id
    ),

    -- 7. Aggregate Subtopics Data
    aggregated_subtopics AS (
        SELECT 
            ts.theme_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', ts.id,
                    'title', ts.title,
                    'one_line', ts.one_line,
                    'itemId', si.item_id,
                    'isPracticed', (us.item_id IS NOT NULL),
                    'score', COALESCE(sc.score, 0),
                    'order', 0,
                    'top_scenes', COALESCE(
                        (
                            SELECT jsonb_agg(elem) 
                            FROM (
                                SELECT elem 
                                FROM jsonb_array_elements(sv.top_scenes) elem 
                                LIMIT 2
                            ) sub
                        ), 
                        '[]'::jsonb
                    )
                ) ORDER BY ts.created_at ASC
            ) as subtopics_json,
            COUNT(*) FILTER (WHERE us.item_id IS NOT NULL) as completed_count,
            COUNT(*) as total_count,
            AVG(sc.score) FILTER (WHERE us.item_id IS NOT NULL) as avg_theme_score
        FROM theme_subtopics ts
        LEFT JOIN subtopic_items si ON ts.id = si.subtopic_id
        LEFT JOIN user_sessions us ON si.item_id = us.item_id
        LEFT JOIN session_scores sc ON si.item_id = sc.item_id
        LEFT JOIN subtopic_vectors sv ON ts.id = sv.subtopic_id
        GROUP BY ts.theme_id
    )

    -- 8. Final Select
    SELECT 
        t.id,
        t.title,
        t."desc",
        t.lang,
        t.level,
        t.genre,
        COALESCE(asub.subtopics_json, '[]'::jsonb) as subtopics,
        jsonb_build_object(
            'completed', COALESCE(asub.completed_count, 0),
            'total', COALESCE(asub.total_count, 0)
        ) as progress,
        COALESCE(asub.avg_theme_score::INT, 0) as average_score
    FROM target_themes t
    LEFT JOIN aggregated_subtopics asub ON t.id = asub.theme_id
    ORDER BY t.level ASC, t.created_at ASC;
END;
$$;
