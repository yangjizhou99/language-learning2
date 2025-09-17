#!/usr/bin/env node

/**
 * GitHub Actions 设置验证脚本
 * 用于验证 Supabase CLI 和 GitHub Actions 配置是否正确
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 验证 GitHub Actions 设置...\n');

// 检查必要文件是否存在
const requiredFiles = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-staging.yml',
  'supabase/config.toml'
];

console.log('📁 检查必要文件:');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - 文件不存在`);
  }
});

// 检查 Supabase CLI 是否安装
console.log('\n🔧 检查 Supabase CLI:');
try {
  const version = execSync('supabase --version', { encoding: 'utf8' });
  console.log(`  ✅ Supabase CLI 已安装: ${version.trim()}`);
} catch (error) {
  console.log('  ❌ Supabase CLI 未安装');
  console.log('     请运行: npm install -g supabase');
}

// 检查 Supabase 项目配置
console.log('\n⚙️ 检查 Supabase 配置:');
try {
  const configPath = path.join(__dirname, '..', 'supabase', 'config.toml');
  const config = fs.readFileSync(configPath, 'utf8');
  
  if (config.includes('project_id = "language-learning2"')) {
    console.log('  ✅ 项目 ID 配置正确');
  } else {
    console.log('  ⚠️ 项目 ID 配置可能不正确');
  }
  
  if (config.includes('enabled = true')) {
    console.log('  ✅ 数据库迁移已启用');
  } else {
    console.log('  ⚠️ 数据库迁移可能未启用');
  }
} catch (error) {
  console.log('  ❌ 无法读取 Supabase 配置文件');
}

// 检查迁移文件
console.log('\n📦 检查迁移文件:');
try {
  const migrationsPath = path.join(__dirname, '..', 'supabase', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsPath);
  
  if (migrationFiles.length > 0) {
    console.log(`  ✅ 找到 ${migrationFiles.length} 个迁移文件`);
    migrationFiles.forEach(file => {
      console.log(`    - ${file}`);
    });
  } else {
    console.log('  ⚠️ 没有找到迁移文件');
  }
} catch (error) {
  console.log('  ❌ 无法读取迁移目录');
}

// 提供下一步指导
console.log('\n📋 下一步操作:');
console.log('1. 在 GitHub 仓库中设置以下 Secrets（安全默认策略）:');
console.log('   - SUPABASE_ACCESS_TOKEN');
console.log('   - STAGING_PROJECT_ID');
console.log('   - STAGING_DB_PASSWORD');
console.log('\n🔒 安全策略: 仅自动部署到 Staging，Production 手动部署');
console.log('\n2. 测试本地 Supabase 环境:');
console.log('   supabase db start');
console.log('   supabase db reset');
console.log('\n3. 创建测试分支并推送以触发 CI:');
console.log('   git checkout -b test-github-actions');
console.log('   git push origin test-github-actions');
console.log('   # 然后创建 PR 到 develop 分支');

console.log('\n✨ 验证完成！');
