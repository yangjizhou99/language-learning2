#!/bin/bash

echo "=== Git分支清理脚本 ==="
echo "开始清理Git仓库..."

# 要保留的分支
KEEP_BRANCHES=("main" "数据库分开处理")

# 获取所有本地分支
ALL_BRANCHES=$(git branch | sed 's/^\*//' | sed 's/^[[:space:]]*//')

echo "当前所有本地分支："
git branch

echo ""
echo "保留的分支: ${KEEP_BRANCHES[@]}"
echo ""

# 统计要删除的分支数量
delete_count=0
for branch in $ALL_BRANCHES; do
    keep=false
    for keep_branch in "${KEEP_BRANCHES[@]}"; do
        if [ "$branch" = "$keep_branch" ]; then
            keep=true
            break
        fi
    done
    
    if [ "$keep" = false ]; then
        delete_count=$((delete_count + 1))
    fi
done

echo "将删除 $delete_count 个分支"
echo ""

# 确认删除
read -p "确认删除这些分支吗？(y/N): " confirm
if [[ $confirm != [yY] ]]; then
    echo "取消删除操作"
    exit 0
fi

echo ""
echo "开始删除分支..."

# 删除分支
deleted_count=0
for branch in $ALL_BRANCHES; do
    # 检查是否在保留列表中
    keep=false
    for keep_branch in "${KEEP_BRANCHES[@]}"; do
        if [ "$branch" = "$keep_branch" ]; then
            keep=true
            break
        fi
    done
    
    if [ "$keep" = false ]; then
        echo "删除分支: $branch"
        if git branch -D "$branch" 2>/dev/null; then
            echo "  ✓ 成功删除 $branch"
            deleted_count=$((deleted_count + 1))
        else
            echo "  ✗ 删除失败 $branch"
        fi
    else
        echo "保留分支: $branch"
    fi
done

echo ""
echo "=== 清理完成 ==="
echo "删除了 $deleted_count 个分支"
echo ""

# 清理远程跟踪分支
echo "清理远程跟踪分支..."
git remote prune origin

echo ""
echo "当前剩余分支："
git branch

echo ""
echo "Git仓库清理完成！"
