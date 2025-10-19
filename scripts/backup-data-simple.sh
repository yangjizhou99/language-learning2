#!/bin/bash
# 简化的数据备份脚本

echo "开始备份本地数据库数据..."

# 使用更简单的备份方式
pg_dump postgresql://postgres:postgres@127.0.0.1:54340/postgres \
  --data-only \
  --inserts \
  --no-owner \
  --no-privileges \
  --exclude-table-data=migrations \
  --exclude-table-data=supabase_migrations \
  --exclude-table-data=api_usage_logs \
  > supabase/local-data-backup-simple.sql

echo "数据备份完成: supabase/local-data-backup-simple.sql"
