#!/usr/bin/env node

/**
 * 简化的优化测试脚本
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testOptimization() {
  console.log('🧪 测试优化功能...\n');
  
  try {
    // 1. 测试文件上传
    console.log('📁 测试文件上传:');
    
    const testAudioBuffer = Buffer.from('test audio data');
    const timestamp = Date.now();
    const testPath = `test/${timestamp}-test.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from('tts')
      .upload(testPath, testAudioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });
    
    if (uploadError) {
      console.log(`   ❌ 上传失败: ${uploadError.message}`);
      return;
    }
    
    console.log('   ✅ 文件上传成功');
    
    // 2. 生成代理路由 URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const proxyUrl = `${appUrl}/api/storage-proxy?path=${testPath}&bucket=tts`;
    const { data: { publicUrl } } = supabase.storage.from('tts').getPublicUrl(testPath);
    
    console.log(`   🔗 原始URL: ${publicUrl}`);
    console.log(`   🚀 代理URL: ${proxyUrl}`);
    
    // 3. 测试代理路由
    console.log('\n🔍 测试代理路由:');
    try {
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const cacheControl = response.headers.get('cache-control');
        const etag = response.headers.get('etag');
        const contentType = response.headers.get('content-type');
        
        console.log(`   ✅ 代理路由响应正常`);
        console.log(`   🏷️  Cache-Control: ${cacheControl || '未设置'}`);
        console.log(`   🏷️  ETag: ${etag || '未设置'}`);
        console.log(`   🏷️  Content-Type: ${contentType || '未设置'}`);
        
        if (cacheControl && cacheControl.includes('max-age=2592000')) {
          console.log('   ✅ 缓存头设置正确！');
        } else {
          console.log('   ⚠️  缓存头需要调整');
        }
      } else {
        console.log(`   ❌ 代理路由返回错误: ${response.status}`);
        if (response.status === 404) {
          console.log('   💡 文件不存在，可能是路径问题');
        } else {
          console.log('   💡 请确保 Next.js 开发服务器正在运行');
        }
      }
    } catch (error) {
      console.log(`   ⚠️  代理路由测试失败: ${error.message}`);
      console.log('   💡 请确保 Next.js 开发服务器正在运行');
    }
    
    // 4. 清理测试文件
    console.log('\n🧹 清理测试文件...');
    const { error: deleteError } = await supabase.storage
      .from('tts')
      .remove([testPath]);
    
    if (deleteError) {
      console.log(`   ❌ 删除失败: ${deleteError.message}`);
    } else {
      console.log('   ✅ 测试文件已清理');
    }
    
    // 5. 总结
    console.log('\n📋 测试总结:');
    console.log('   ✅ 文件上传功能正常');
    console.log('   ✅ 代理路由 URL 生成正常');
    console.log('   ⚠️  代理路由缓存头需要 Next.js 服务器运行');
    
    console.log('\n💡 下一步:');
    console.log('1. 启动 Next.js 开发服务器: npm run dev');
    console.log('2. 重新运行此测试验证代理路由');
    console.log('3. 在生产环境中部署并监控效果');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testOptimization().catch(console.error);
