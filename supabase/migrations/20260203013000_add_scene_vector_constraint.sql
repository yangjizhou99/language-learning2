-- Add UNIQUE constraint to subtopic_scene_vectors to support UPSERT (ON CONFLICT)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subtopic_scene_vectors_subtopic_id_scene_id_key') THEN
        ALTER TABLE subtopic_scene_vectors
        ADD CONSTRAINT subtopic_scene_vectors_subtopic_id_scene_id_key UNIQUE (subtopic_id, scene_id);
    END IF;
END $$;
