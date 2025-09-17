#!/usr/bin/env node

/**
 * 批量更新 Supabase Storage 文件的缓存头
 * 这个脚本会为现有的音频文件添加缓存头，减少重复下载
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

async function updateStorageCacheHeaders() {
  console.log('🚀 开始更新 Storage 文件缓存头...');
  
  const buckets = ['tts', 'recordings', 'audio']; // 你的音频存储桶
  
  for (const bucketName of buckets) {
    console.log(`\n📁 处理桶: ${bucketName}`);
    
    try {
      // 递归获取桶中的所有文件（包括子目录）
      const getAllFiles = async (path = '') => {
        const { data: items, error } = await supabase.storage
          .from(bucketName)
          .list(path, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
        
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
          
          // 如果是文件（有size属性），添加到文件列表
          if (item.metadata && item.metadata.size) {
            files.push({ ...item, fullPath });
          } else {
            // 如果是目录，递归获取子文件
            const subFiles = await getAllFiles(fullPath);
            files.push(...subFiles);
          }
        }
        
        return files;
      };
      
      const files = await getAllFiles();
      
      if (files.length === 0) {
        console.log(`ℹ️  桶 ${bucketName} 为空或没有文件`);
        continue;
      }
      
      console.log(`📊 找到 ${files.length} 个文件`);
      
      // 并发处理文件（重新上传以设置缓存头）
      const CONCURRENT_LIMIT = 10; // 同时处理10个文件
      let successCount = 0;
      let errorCount = 0;
      let processedCount = 0;
      
      // 分批处理文件
      const processBatch = async (batch) => {
        const promises = batch.map(async (file) => {
          try {
            // 下载文件
            const { data: fileData, error: downloadError } = await supabase.storage
              .from(bucketName)
              .download(file.fullPath);
            
            if (downloadError) {
              console.error(`❌ 下载失败 ${file.fullPath}:`, downloadError.message);
              return { success: false, error: downloadError.message };
            }
            
            // 重新上传，添加缓存头
            const { error: uploadError } = await supabase.storage
              .from(bucketName)
              .upload(file.fullPath, fileData, {
                upsert: true, // 覆盖现有文件
                cacheControl: 'public, max-age=2592000, immutable', // 30天缓存
                contentType: file.metadata?.mimetype || 'audio/mpeg'
              });
            
            if (uploadError) {
              console.error(`❌ 上传失败 ${file.fullPath}:`, uploadError.message);
              return { success: false, error: uploadError.message };
            }
            
            return { success: true, file: file.fullPath };
            
          } catch (error) {
            console.error(`❌ 处理文件 ${file.fullPath} 时出错:`, error.message);
            return { success: false, error: error.message };
          }
        });
        
        return Promise.all(promises);
      };
      
      // 分批处理所有文件
      for (let i = 0; i < files.length; i += CONCURRENT_LIMIT) {
        const batch = files.slice(i, i + CONCURRENT_LIMIT);
        console.log(`🔄 处理批次 ${Math.floor(i / CONCURRENT_LIMIT) + 1}/${Math.ceil(files.length / CONCURRENT_LIMIT)} (${batch.length} 个文件)`);
        
        const results = await processBatch(batch);
        
        // 统计结果
        results.forEach(result => {
          if (result.success) {
            successCount++;
            console.log(`✅ 更新成功: ${result.file}`);
          } else {
            errorCount++;
          }
        });
        
        processedCount += batch.length;
        console.log(`📊 进度: ${processedCount}/${files.length} (${Math.round(processedCount / files.length * 100)}%)`);
        
        // 批次间短暂延迟，避免API限制
        if (i + CONCURRENT_LIMIT < files.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`\n📈 桶 ${bucketName} 处理完成:`);
      console.log(`   ✅ 成功: ${successCount}`);
      console.log(`   ❌ 失败: ${errorCount}`);
      
    } catch (error) {
      console.error(`❌ 处理桶 ${bucketName} 时出错:`, error.message);
    }
  }
  
  console.log('\n🎉 批量更新完成！');
  console.log('\n💡 建议:');
  console.log('1. 检查 Supabase Dashboard 中的 Storage 使用情况');
  console.log('2. 监控 Cached Egress 是否下降');
  console.log('3. 考虑将热门文件迁移到私有桶 + 签名URL');
}

// 运行脚本
updateStorageCacheHeaders().catch(console.error);
