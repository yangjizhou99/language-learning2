#!/usr/bin/env node

/**
 * 检查优化状态脚本
 * 验证所有优化措施是否正确实施
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 检查带宽优化状态...\n');

// 检查关键文件是否存在
const keyFiles = [
  'src/lib/storage-upload.ts',
  'src/app/api/storage-proxy/route.ts',
  'src/components/OptimizedImage.tsx',
  'src/components/OptimizedAudio.tsx',
  'next.config.ts'
];

console.log('📁 检查关键文件:');
keyFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 文件不存在`);
  }
});

// 检查next.config.ts是否包含缓存配置
console.log('\n⚙️  检查Next.js配置:');
try {
  const nextConfig = fs.readFileSync('next.config.ts', 'utf8');
  if (nextConfig.includes('images:') && nextConfig.includes('remotePatterns')) {
    console.log('✅ 图片优化配置已添加');
  } else {
    console.log('❌ 图片优化配置缺失');
  }
  
  if (nextConfig.includes('Cache-Control')) {
    console.log('✅ 缓存头配置已添加');
  } else {
    console.log('❌ 缓存头配置缺失');
  }
} catch (error) {
  console.log('❌ 无法读取next.config.ts');
}

// 检查API路由是否使用新的上传函数
console.log('\n🔧 检查API路由优化:');
const apiFiles = [
  'src/app/api/admin/shadowing/synthesize/route.ts',
  'src/app/api/admin/shadowing/synthesize-unified/route.ts',
  'src/app/api/admin/shadowing/synthesize-gemini/route.ts',
  'src/app/api/admin/shadowing/synthesize-gemini-dialogue/route.ts',
  'src/app/api/admin/shadowing/synthesize-dialogue/route.ts'
];

apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('uploadAudioFile')) {
      console.log(`✅ ${file} - 已使用新上传函数`);
    } else {
      console.log(`❌ ${file} - 未使用新上传函数`);
    }
  } else {
    console.log(`❌ ${file} - 文件不存在`);
  }
});

// 检查监控脚本
console.log('\n📊 检查监控工具:');
const monitorFiles = [
  'scripts/monitor-bandwidth.js',
  'scripts/analyze-storage-usage.sql',
  'scripts/quick-storage-check.sql'
];

monitorFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 文件不存在`);
  }
});

// 检查文档
console.log('\n📚 检查文档:');
const docFiles = [
  'BANDWIDTH_OPTIMIZATION_COMPLETE_REPORT.md',
  'NEW_FILE_CACHE_GUIDE.md',
  'BANDWIDTH_OPTIMIZATION_GUIDE.md',
  'FINAL_OPTIMIZATION_SUMMARY.md'
];

docFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - 文件不存在`);
  }
});

console.log('\n🎉 优化状态检查完成！');
console.log('\n💡 建议:');
console.log('1. 确保所有文件都已正确部署');
console.log('2. 运行 node scripts/monitor-bandwidth.js 检查存储状态');
console.log('3. 测试新文件生成是否自动获得缓存头');
console.log('4. 监控Supabase Dashboard中的Cached Egress变化');
