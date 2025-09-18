#!/usr/bin/env node

/**
 * 监控 Supabase 带宽使用情况
 * 这个脚本会检查 Storage 和 Edge Functions 的使用情况
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

async function monitorBandwidth() {
  console.log('📊 开始监控带宽使用情况...\n');

  try {
    // 1. 检查 Storage 使用情况
    console.log('🗄️  Storage 使用情况:');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

    if (bucketsError) {
      console.error('❌ 获取桶列表失败:', bucketsError.message);
    } else {
      for (const bucket of buckets) {
        const { data: files, error: filesError } = await supabase.storage
          .from(bucket.name)
          .list('', { limit: 1000 });

        if (filesError) {
          console.error(`❌ 获取桶 ${bucket.name} 文件失败:`, filesError.message);
          continue;
        }

        const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0);
        const totalMB = Math.round((totalSize / 1024 / 1024) * 100) / 100;

        console.log(`   📁 ${bucket.name}:`);
        console.log(`      - 文件数量: ${files.length}`);
        console.log(`      - 总大小: ${totalMB} MB`);
        console.log(`      - 公开访问: ${bucket.public ? '是' : '否'}`);
      }
    }

    // 2. 检查文件类型分布
    console.log('\n📊 文件类型分布:');
    const typeStats = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const bucket of buckets) {
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 1000 });

      if (filesError) {
        console.error(`❌ 获取桶 ${bucket.name} 文件失败:`, filesError.message);
        continue;
      }

      files.forEach((file) => {
        if (file.metadata && file.metadata.size) {
          const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
          if (!typeStats[extension]) {
            typeStats[extension] = { count: 0, size: 0 };
          }
          typeStats[extension].count++;
          typeStats[extension].size += file.metadata.size;
          totalFiles++;
          totalSize += file.metadata.size;
        }
      });
    }

    Object.entries(typeStats)
      .sort(([, a], [, b]) => b.size - a.size)
      .forEach(([type, stats]) => {
        const sizeMB = Math.round((stats.size / 1024 / 1024) * 100) / 100;
        console.log(`   .${type}: ${stats.count} 个文件, ${sizeMB} MB`);
      });

    console.log(
      `\n📈 总计: ${totalFiles} 个文件, ${Math.round((totalSize / 1024 / 1024) * 100) / 100} MB`,
    );

    // 3. 检查最近的大文件
    console.log('\n📈 最近的大文件 (前10个):');
    const allFiles = [];

    for (const bucket of buckets) {
      const { data: files, error: filesError } = await supabase.storage
        .from(bucket.name)
        .list('', { limit: 1000 });

      if (filesError) {
        console.error(`❌ 获取桶 ${bucket.name} 文件失败:`, filesError.message);
        continue;
      }

      files.forEach((file) => {
        if (file.metadata && file.metadata.size) {
          allFiles.push({
            bucket: bucket.name,
            name: file.name,
            size: file.metadata.size,
            created_at: file.created_at,
          });
        }
      });
    }

    allFiles
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .forEach((file, index) => {
        const sizeMB = Math.round((file.size / 1024 / 1024) * 100) / 100;
        const createdDate = new Date(file.created_at).toLocaleDateString();
        console.log(`   ${index + 1}. ${file.bucket}/${file.name}`);
        console.log(`      - 大小: ${sizeMB} MB`);
        console.log(`      - 创建时间: ${createdDate}`);
      });

    // 4. 检查最近24小时的上传活动
    console.log('\n⏰ 最近24小时上传活动:');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentFiles = allFiles.filter((file) => new Date(file.created_at) >= yesterday);

    const recentSize = recentFiles.reduce((sum, file) => sum + file.size, 0);
    const recentSizeMB = Math.round((recentSize / 1024 / 1024) * 100) / 100;

    console.log(`   - 上传文件数: ${recentFiles.length}`);
    console.log(`   - 上传大小: ${recentSizeMB} MB`);

    if (recentFiles.length > 0) {
      console.log('   - 最近上传的文件:');
      recentFiles
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5)
        .forEach((file) => {
          const sizeMB = Math.round((file.size / 1024 / 1024) * 100) / 100;
          const time = new Date(file.created_at).toLocaleTimeString();
          console.log(`     ${file.bucket}/${file.name} (${sizeMB} MB) - ${time}`);
        });
    }

    console.log('\n💡 优化建议:');
    console.log('1. 检查是否有重复的大文件可以删除');
    console.log('2. 考虑将不常用的文件迁移到冷存储');
    console.log('3. 为音频文件启用压缩和格式优化');
    console.log('4. 使用 CDN 缓存减少重复下载');
    console.log('5. 定期清理临时文件和过期内容');
  } catch (error) {
    console.error('❌ 监控过程中出错:', error.message);
  }
}

// 运行监控
monitorBandwidth().catch(console.error);
