#!/bin/bash

# 快速性能测试脚本
# 用于快速验证数据库索引优化效果

echo "🚀 开始快速性能测试..."
echo ""

# 检查环境变量
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 请设置环境变量:"
    echo "export NEXT_PUBLIC_SUPABASE_URL='your-supabase-url'"
    echo "export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    exit 1
fi

echo "✅ 环境变量已设置"
echo ""

# 运行简单数据库测试
echo "📊 运行数据库性能测试..."
node simple-db-test.js

echo ""
echo "✅ 快速测试完成！"
echo ""
echo "💡 下一步:"
echo "1. 查看上面的测试结果"
echo "2. 如果性能良好，可以运行完整测试: npm run test:all"
echo "3. 如果性能需要优化，检查索引使用情况"
echo ""
echo "📚 更多信息请查看: scripts/PERFORMANCE_TESTING_GUIDE.md"
