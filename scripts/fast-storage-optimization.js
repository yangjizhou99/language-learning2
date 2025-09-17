#!/usr/bin/env node

/**
 * 快速并发更新 Supabase Storage 文件的缓存头
 * 支持高并发处理，大幅提升处理速度
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ 缺少环境变量: NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// 可配置的并发参数
const CONFIG = {
  CONCURRENT_LIMIT: 20,        // 同时处理文件数
  BATCH_DELAY: 100,            // 批次间延迟(ms)
  MAX_RETRIES: 3,              // 最大重试次数
  RETRY_DELAY: 1000,           // 重试延迟(ms)
};

async function updateStorageCacheHeaders() {
  console.log('🚀 开始快速并发更新 Storage 文件缓存头...');
  console.log(`⚡ 并发设置: ${CONFIG.CONCURRENT_LIMIT} 个文件/批次`);
  
  const buckets = ['tts', 'recordings', 'audio'];
  const startTime = Date.now();
  
  for (const bucketName of buckets) {
    console.log(`\n📁 处理桶: ${bucketName}`);
    
    try {
      // 递归获取所有文件
      const files = await getAllFilesRecursive(bucketName);
      
      if (files.length === 0) {
        console.log(`ℹ️  桶 ${bucketName} 为空或没有文件`);
        continue;
      }
      
      console.log(`📊 找到 ${files.length} 个文件`);
      
      // 快速并发处理
      const { successCount, errorCount } = await processFilesConcurrently(bucketName, files);
      
      console.log(`\n📈 桶 ${bucketName} 处理完成:`);
      console.log(`   ✅ 成功: ${successCount}`);
      console.log(`   ❌ 失败: ${errorCount}`);
      console.log(`   📊 成功率: ${Math.round(successCount / (successCount + errorCount) * 100)}%`);
      
    } catch (error) {
      console.error(`❌ 处理桶 ${bucketName} 时出错:`, error.message);
    }
  }
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🎉 批量更新完成！总耗时: ${totalTime}秒`);
  console.log('\n💡 建议:');
  console.log('1. 检查 Supabase Dashboard 中的 Storage 使用情况');
  console.log('2. 监控 Cached Egress 是否下降');
  console.log('3. 考虑将热门文件迁移到私有桶 + 签名URL');
}

// 递归获取所有文件
async function getAllFilesRecursive(bucketName, path = '') {
  const { data: items, error } = await supabase.storage
    .from(bucketName)
    .list(path, { limit: 1000 });
  
  if (error) {
    console.error(`❌ 列出路径 ${path} 失败:`, error.message);
    return [];
  }
  
  if (!items || items.length === 0) {
    return [];
  }
  
  const files = [];
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    
    if (item.metadata && item.metadata.size) {
      files.push({ ...item, fullPath });
    } else {
      const subFiles = await getAllFilesRecursive(bucketName, fullPath);
      files.push(...subFiles);
    }
  }
  
  return files;
}

// 并发处理文件
async function processFilesConcurrently(bucketName, files) {
  let successCount = 0;
  let errorCount = 0;
  let processedCount = 0;
  
  // 分批处理
  for (let i = 0; i < files.length; i += CONFIG.CONCURRENT_LIMIT) {
    const batch = files.slice(i, i + CONFIG.CONCURRENT_LIMIT);
    const batchNum = Math.floor(i / CONFIG.CONCURRENT_LIMIT) + 1;
    const totalBatches = Math.ceil(files.length / CONFIG.CONCURRENT_LIMIT);
    
    console.log(`🔄 处理批次 ${batchNum}/${totalBatches} (${batch.length} 个文件)`);
    
    // 并发处理当前批次
    const results = await Promise.allSettled(
      batch.map(file => processFile(bucketName, file))
    );
    
    // 统计结果
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        console.log(`✅ ${result.value.file}`);
      } else {
        errorCount++;
        const error = result.status === 'rejected' ? result.reason : result.value.error;
        console.error(`❌ ${batch[index].fullPath}: ${error}`);
      }
    });
    
    processedCount += batch.length;
    const progress = Math.round(processedCount / files.length * 100);
    console.log(`📊 进度: ${processedCount}/${files.length} (${progress}%)`);
    
    // 批次间延迟
    if (i + CONFIG.CONCURRENT_LIMIT < files.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
    }
  }
  
  return { successCount, errorCount };
}

// 处理单个文件
async function processFile(bucketName, file, retryCount = 0) {
  try {
    // 下载文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucketName)
      .download(file.fullPath);
    
    if (downloadError) {
      throw new Error(`下载失败: ${downloadError.message}`);
    }
    
    // 重新上传，添加缓存头
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(file.fullPath, fileData, {
        upsert: true,
        cacheControl: 'public, max-age=2592000, immutable',
        contentType: file.metadata?.mimetype || 'audio/mpeg'
      });
    
    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`);
    }
    
    return { success: true, file: file.fullPath };
    
  } catch (error) {
    // 重试逻辑
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`🔄 重试 ${file.fullPath} (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return processFile(bucketName, file, retryCount + 1);
    }
    
    return { success: false, error: error.message };
  }
}

// 运行脚本
updateStorageCacheHeaders().catch(console.error);
