#!/bin/bash
# 数据恢复脚本

echo "开始恢复本地数据库数据..."

# 检查备份文件是否存在
if [ ! -f "supabase/local-data-backup.sql" ]; then
    echo "错误: 找不到备份文件 supabase/local-data-backup.sql"
    echo "请先运行备份脚本: ./scripts/backup-data.sh"
    exit 1
fi

# 恢复数据
psql postgresql://postgres:postgres@127.0.0.1:54340/postgres -f supabase/local-data-backup.sql

echo "数据恢复完成"
