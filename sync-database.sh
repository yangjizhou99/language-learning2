#!/bin/bash

# 数据库同步工具
# 将本地数据库数据覆盖到云端数据库

echo "🚀 数据库同步工具"
echo "================================="
echo

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo "❌ 错误: 未找到 .env.local 文件"
    echo "请创建 .env.local 文件并设置以下变量:"
    echo "LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres"
    echo "PROD_DB_URL=postgres://postgres:<密码>@<主机>:5432/postgres"
    echo
    exit 1
fi

# 运行同步脚本
echo "🔄 开始同步数据库..."
echo
node scripts/db-sync.js

echo
echo "同步完成！"

