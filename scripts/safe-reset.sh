#!/bin/bash
# 安全重置脚本 - 保留数据

echo "开始安全重置数据库..."

# 1. 备份当前数据
echo "步骤 1: 备份当前数据..."
./scripts/backup-data.sh

# 2. 重置数据库结构
echo "步骤 2: 重置数据库结构..."
supabase db reset

# 3. 恢复数据
echo "步骤 3: 恢复数据..."
./scripts/restore-data.sh

echo "安全重置完成！数据已保留。"
