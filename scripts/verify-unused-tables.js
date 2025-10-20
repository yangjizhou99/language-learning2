#!/usr/bin/env node

/**
 * 验证未使用表删除前的安全检查脚本
 * 确保这7个表确实没有被使用
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必要的环境变量: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 要删除的表列表
const tablesToDelete = [
  'article_cloze',
  'article_keys', 
  'articles',
  'cloze_drafts',
  'cloze_items',
  'article_drafts',
  'glossary',
  'phrases',
  'registration_config',
  'sessions',
  'study_cards',
  'tts_assets'
];

async function checkTableExists(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`✅ ${tableName}: 表不存在或无法访问 (${error.message})`);
      return false;
    }
    
    console.log(`⚠️  ${tableName}: 表存在，有 ${data?.length || 0} 条记录`);
    return true;
  } catch (err) {
    console.log(`✅ ${tableName}: 表不存在 (${err.message})`);
    return false;
  }
}

async function checkTableReferences() {
  console.log('\n🔍 检查代码中的表引用...\n');
  
  const searchPaths = [
    'src/app',
    'src/components', 
    'src/lib',
    'scripts'
  ];
  
  const foundReferences = [];
  
  for (const tableName of tablesToDelete) {
    console.log(`检查 ${tableName} 的引用:`);
    
    for (const searchPath of searchPaths) {
      try {
        const { execSync } = await import('child_process');
        const result = execSync(`grep -r "${tableName}" ${searchPath} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" || true`, { 
          encoding: 'utf8',
          cwd: process.cwd()
        });
        
        if (result.trim()) {
          console.log(`  ❌ 在 ${searchPath} 中找到引用:`);
          console.log(`     ${result.trim().split('\n').join('\n     ')}`);
          foundReferences.push({ table: tableName, path: searchPath, content: result.trim() });
        } else {
          console.log(`  ✅ ${searchPath}: 无引用`);
        }
      } catch (err) {
        console.log(`  ⚠️  ${searchPath}: 检查失败 (${err.message})`);
      }
    }
    console.log('');
  }
  
  return foundReferences;
}

async function main() {
  console.log('🔍 验证未使用表删除前的安全检查\n');
  console.log('要删除的表:', tablesToDelete.join(', '));
  console.log('');
  
  // 1. 检查表是否存在
  console.log('📊 检查表是否存在:');
  const existingTables = [];
  
  for (const tableName of tablesToDelete) {
    const exists = await checkTableExists(tableName);
    if (exists) {
      existingTables.push(tableName);
    }
  }
  
  console.log('');
  
  // 2. 检查代码引用
  const references = await checkTableReferences();
  
  // 3. 总结
  console.log('📋 检查结果总结:');
  console.log(`- 存在的表: ${existingTables.length}/${tablesToDelete.length}`);
  console.log(`- 代码引用: ${references.length} 个`);
  
  if (references.length > 0) {
    console.log('\n❌ 发现代码引用，请先移除这些引用再删除表:');
    references.forEach(ref => {
      console.log(`  - ${ref.table} 在 ${ref.path} 中被引用`);
    });
    process.exit(1);
  }
  
  if (existingTables.length === 0) {
    console.log('\n✅ 所有表都不存在，无需删除');
    process.exit(0);
  }
  
  console.log(`\n✅ 安全检查通过，可以安全删除 ${existingTables.length} 个表`);
  console.log('建议执行: npx supabase db push');
}

main().catch(console.error);
