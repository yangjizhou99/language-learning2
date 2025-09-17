-- 分析 Supabase Storage 使用情况
-- 在 Supabase SQL Editor 中运行这些查询

-- 1. 查看所有存储桶的基本信息
SELECT 
  name as bucket_name,
  public as is_public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY name;

-- 2. 按桶统计文件数量和大小
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(COALESCE((metadata->>'size')::bigint, 0)) as total_bytes,
  ROUND(SUM(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0 / 1024.0, 2) as total_mb,
  ROUND(AVG(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0, 2) as avg_size_kb,
  MAX(COALESCE((metadata->>'size')::bigint, 0)) as max_size_bytes,
  MIN(COALESCE((metadata->>'size')::bigint, 0)) as min_size_bytes
FROM storage.objects
GROUP BY bucket_id
ORDER BY total_bytes DESC;

-- 3. 找出最大的文件（前20个）
SELECT 
  bucket_id,
  name,
  ROUND(COALESCE((metadata->>'size')::bigint, 0) / 1024.0 / 1024.0, 2) as size_mb,
  created_at,
  updated_at
FROM storage.objects
ORDER BY COALESCE((metadata->>'size')::bigint, 0) DESC
LIMIT 20;

-- 4. 按目录统计文件分布（如果有目录结构）
SELECT 
  bucket_id,
  CASE 
    WHEN position('/' in name) > 0 THEN split_part(name, '/', 1)
    ELSE 'root'
  END as top_directory,
  COUNT(*) as file_count,
  ROUND(SUM(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0 / 1024.0, 2) as total_mb,
  ROUND(AVG(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0, 2) as avg_size_kb
FROM storage.objects
GROUP BY bucket_id, top_directory
ORDER BY total_mb DESC;

-- 5. 按文件类型统计
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
  COUNT(*) as file_count,
  ROUND(SUM(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects
GROUP BY bucket_id, file_type
ORDER BY total_mb DESC;

-- 6. 最近上传的文件（可能还在处理中）
SELECT 
  bucket_id,
  name,
  ROUND(COALESCE((metadata->>'size')::bigint, 0) / 1024.0 / 1024.0, 2) as size_mb,
  created_at
FROM storage.objects
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 7. 检查是否有重复文件（相同大小和名称）
SELECT 
  bucket_id,
  name,
  COALESCE((metadata->>'size')::bigint, 0) as size,
  COUNT(*) as duplicate_count,
  array_agg(created_at ORDER BY created_at) as creation_times
FROM storage.objects
GROUP BY bucket_id, name, COALESCE((metadata->>'size')::bigint, 0)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 8. 按月份统计存储增长
SELECT 
  bucket_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as files_uploaded,
  ROUND(SUM(COALESCE((metadata->>'size')::bigint, 0)) / 1024.0 / 1024.0, 2) as mb_uploaded
FROM storage.objects
WHERE created_at > NOW() - INTERVAL '12 months'
GROUP BY bucket_id, month
ORDER BY bucket_id, month DESC;
