#!/bin/bash
# 数据备份脚本

echo "开始备份本地数据库数据..."

# 备份数据到文件
pg_dump postgresql://postgres:postgres@127.0.0.1:54340/postgres \
  --data-only \
  --inserts \
  --column-inserts \
  --exclude-table-data=migrations \
  --exclude-table-data=supabase_migrations \
  > supabase/local-data-backup.sql

echo "数据备份完成: supabase/local-data-backup.sql"
