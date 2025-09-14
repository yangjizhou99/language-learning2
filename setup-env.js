#!/usr/bin/env node

/**
 * 环境变量快速设置脚本
 * 使用方法: node setup-env.js
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 语言学习应用环境变量设置向导\n');

// 检查是否已存在 .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('⚠️  发现已存在的 .env.local 文件');
  console.log('   建议先备份现有文件，然后重新运行此脚本\n');
}

// 创建基础环境变量配置
const basicEnvConfig = `# ===========================================
# 语言学习应用环境变量配置
# 生成时间: ${new Date().toISOString()}
# ===========================================

# ===========================================
# Supabase 数据库配置 (必需)
# ===========================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ===========================================
# AI 提供商 API Keys (至少需要配置一个)
# ===========================================

# OpenRouter (推荐 - 支持多种模型)
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
OPENROUTER_SITE_URL=https://your-domain.com
OPENROUTER_SITE_NAME=Language Learning App

# DeepSeek 直连
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com

# OpenAI 直连
OPENAI_API_KEY=sk-your-openai-key

# ===========================================
# 应用配置
# ===========================================
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
NEXT_PUBLIC_SITE_NAME=Language Learning App
NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET=tts
NEXT_PUBLIC_SHOW_DEBUG=0
ENABLE_PERFORMANCE_MONITORING=false

# ===========================================
# 默认 AI 配置
# ===========================================
AI_PROVIDER=openrouter
AI_DEFAULT_MODEL=openai/gpt-4o-mini

# ===========================================
# 环境标识
# ===========================================
NODE_ENV=development
VERCEL=0
`;

try {
  fs.writeFileSync(envLocalPath, basicEnvConfig);
  console.log('✅ 已创建 .env.local 文件');
  console.log('📝 请编辑 .env.local 文件，填入你的实际环境变量值');
  console.log('📖 详细配置说明请查看 ENVIRONMENT_SETUP_GUIDE.md');
  console.log('\n🔧 下一步：');
  console.log('   1. 编辑 .env.local 文件');
  console.log('   2. 配置 Supabase 数据库信息');
  console.log('   3. 配置至少一个 AI 提供商 API Key');
  console.log('   4. 运行 npm run dev 启动开发服务器');
} catch (error) {
  console.error('❌ 创建 .env.local 文件失败:', error.message);
  process.exit(1);
}
