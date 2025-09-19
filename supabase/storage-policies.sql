-- Storage bucket for shadowing practice recordings
-- This should be executed in Supabase Dashboard > Storage > Create Bucket

-- First, create the 'recordings' bucket in Supabase Dashboard with these settings:
-- Bucket name: recordings
-- Public: false (private bucket for security)
-- File size limit: 50MB
-- Allowed MIME types: audio/webm, audio/wav, audio/mp3, audio/ogg

-- Then apply these policies:

-- Policy 1: Users can upload recordings to their own folder
CREATE POLICY "Users can upload their own recordings" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 2: Users can view their own recordings
CREATE POLICY "Users can view their own recordings" ON storage.objects
FOR SELECT USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 3: Users can delete their own recordings
CREATE POLICY "Users can delete their own recordings" ON storage.objects
FOR DELETE USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Users can update their own recordings
CREATE POLICY "Users can update their own recordings" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- If you prefer private bucket (more secure), you can create signed URLs instead:
-- In that case, change the upload API to use createSignedUrl instead of getPublicUrl