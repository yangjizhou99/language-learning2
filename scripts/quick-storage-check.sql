-- 快速存储使用情况检查
-- 在 Supabase SQL Editor 中运行

-- 1. 查看所有存储桶
SELECT 
  name as bucket_name,
  public as is_public,
  file_size_limit,
  created_at
FROM storage.buckets
ORDER BY name;

-- 2. 按桶统计文件数量（不依赖size字段）
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  MIN(created_at) as oldest_file,
  MAX(created_at) as newest_file
FROM storage.objects
GROUP BY bucket_id
ORDER BY file_count DESC;

-- 3. 最近上传的文件
SELECT 
  bucket_id,
  name,
  created_at,
  updated_at
FROM storage.objects
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- 4. 按文件扩展名统计
SELECT 
  bucket_id,
  CASE 
    WHEN name LIKE '%.mp3' THEN 'mp3'
    WHEN name LIKE '%.wav' THEN 'wav'
    WHEN name LIKE '%.webm' THEN 'webm'
    WHEN name LIKE '%.ogg' THEN 'ogg'
    WHEN name LIKE '%.jpg' OR name LIKE '%.jpeg' THEN 'jpeg'
    WHEN name LIKE '%.png' THEN 'png'
    WHEN name LIKE '%.webp' THEN 'webp'
    WHEN name LIKE '%.svg' THEN 'svg'
    ELSE 'other'
  END as file_type,
  COUNT(*) as file_count
FROM storage.objects
GROUP BY bucket_id, file_type
ORDER BY file_count DESC;

-- 5. 检查是否有重复文件名
SELECT 
  bucket_id,
  name,
  COUNT(*) as duplicate_count
FROM storage.objects
GROUP BY bucket_id, name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
