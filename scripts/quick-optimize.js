#!/usr/bin/env node

/**
 * 快速优化脚本 - 只处理TTS桶的音频文件
 * 使用高并发，快速添加缓存头
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

async function quickOptimize() {
  console.log('⚡ 快速优化 TTS 桶...');

  try {
    // 只处理 tts 桶
    const bucketName = 'tts';

    // 获取所有文件
    const files = await getAllFiles(bucketName);
    console.log(`📊 找到 ${files.length} 个文件`);

    if (files.length === 0) {
      console.log('ℹ️  没有文件需要处理');
      return;
    }

    // 高并发处理 (30个并发)
    const CONCURRENT = 30;
    let success = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i += CONCURRENT) {
      const batch = files.slice(i, i + CONCURRENT);
      console.log(`🔄 处理 ${i + 1}-${Math.min(i + CONCURRENT, files.length)}/${files.length}`);

      const promises = batch.map(async (file) => {
        try {
          // 下载
          const { data, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(file.fullPath);

          if (downloadError) throw downloadError;

          // 重新上传带缓存头
          const { error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload(file.fullPath, data, {
              upsert: true,
              cacheControl: 'public, max-age=2592000, immutable',
              contentType: 'audio/mpeg',
            });

          if (uploadError) throw uploadError;

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      const results = await Promise.all(promises);

      results.forEach((result) => {
        if (result.success) {
          success++;
        } else {
          failed++;
        }
      });

      console.log(`✅ 成功: ${success}, ❌ 失败: ${failed}`);

      // 短暂延迟
      if (i + CONCURRENT < files.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    console.log(`\n🎉 完成! 成功: ${success}, 失败: ${failed}`);
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

async function getAllFiles(bucketName, path = '') {
  const { data: items, error } = await supabase.storage
    .from(bucketName)
    .list(path, { limit: 1000 });

  if (error || !items) return [];

  const files = [];
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (item.metadata?.size) {
      files.push({ ...item, fullPath });
    } else {
      const subFiles = await getAllFiles(bucketName, fullPath);
      files.push(...subFiles);
    }
  }

  return files;
}

quickOptimize().catch(console.error);
