#!/usr/bin/env node

/**
 * 调试代理路由问题
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

async function debugProxy() {
  console.log('🔍 调试代理路由问题...\n');

  try {
    // 1. 上传一个测试文件
    console.log('📁 上传测试文件:');
    const testAudioBuffer = Buffer.from('test audio data for debug');
    const timestamp = Date.now();
    const testPath = `test/${timestamp}-debug-test.mp3`;

    const { error: uploadError } = await supabase.storage
      .from('tts')
      .upload(testPath, testAudioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.log(`   ❌ 上传失败: ${uploadError.message}`);
      return;
    }

    console.log(`   ✅ 文件上传成功: ${testPath}`);

    // 2. 测试不同的 URL 格式
    const baseUrl = 'http://localhost:3000';
    const testUrls = [
      `${baseUrl}/api/storage-proxy?path=${testPath}&bucket=tts`,
      `${baseUrl}/api/storage-proxy?path=tts/${testPath}`,
      `${baseUrl}/api/storage-proxy?path=${encodeURIComponent(testPath)}&bucket=tts`,
    ];

    for (let i = 0; i < testUrls.length; i++) {
      const url = testUrls[i];
      console.log(`\n🔗 测试 URL ${i + 1}: ${url}`);

      try {
        const response = await fetch(url);
        console.log(`   状态码: ${response.status}`);
        console.log(`   状态文本: ${response.statusText}`);

        if (response.status === 200) {
          const cacheControl = response.headers.get('cache-control');
          const etag = response.headers.get('etag');
          const contentType = response.headers.get('content-type');

          console.log(`   ✅ 成功！`);
          console.log(`   🏷️  Cache-Control: ${cacheControl || '未设置'}`);
          console.log(`   🏷️  ETag: ${etag || '未设置'}`);
          console.log(`   🏷️  Content-Type: ${contentType || '未设置'}`);
          break;
        } else {
          const text = await response.text();
          console.log(`   ❌ 错误: ${text}`);
        }
      } catch (error) {
        console.log(`   ⚠️  请求失败: ${error.message}`);
      }
    }

    // 3. 测试现有文件
    console.log('\n📊 测试现有文件:');
    const existingFiles = ['zh/1756964049640-11ekozy5nnoh.mp3', 'en/1756976615388-b6x2cdisulo.mp3'];

    for (const filePath of existingFiles) {
      console.log(`\n   📁 测试文件: ${filePath}`);

      const testUrl = `${baseUrl}/api/storage-proxy?path=${filePath}&bucket=tts`;
      console.log(`   🔗 URL: ${testUrl}`);

      try {
        const response = await fetch(testUrl);
        console.log(`   状态码: ${response.status}`);

        if (response.status === 200) {
          const cacheControl = response.headers.get('cache-control');
          console.log(`   ✅ 成功！Cache-Control: ${cacheControl || '未设置'}`);
        } else {
          const text = await response.text();
          console.log(`   ❌ 错误: ${text}`);
        }
      } catch (error) {
        console.log(`   ⚠️  请求失败: ${error.message}`);
      }
    }

    // 4. 清理测试文件
    console.log('\n🧹 清理测试文件...');
    const { error: deleteError } = await supabase.storage.from('tts').remove([testPath]);

    if (deleteError) {
      console.log(`   ❌ 删除失败: ${deleteError.message}`);
    } else {
      console.log('   ✅ 测试文件已清理');
    }
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

debugProxy().catch(console.error);
