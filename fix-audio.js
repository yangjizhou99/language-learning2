// 音频修复脚本
// 用于修复已生成的有问题的音频文件

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';

if (!supabaseUrl || !supabaseKey) {
  console.error('缺少Supabase配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 检查音频文件是否有问题
async function checkAudioFile(audioUrl) {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      console.log(`❌ 无法访问: ${audioUrl}`);
      return false;
    }
    
    const buffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);
    
    // 检查文件大小（太小的文件可能有问题）
    if (uint8Array.length < 1000) {
      console.log(`❌ 文件太小: ${audioUrl} (${uint8Array.length} bytes)`);
      return false;
    }
    
    // 检查WAV文件头
    if (uint8Array.length >= 44) {
      const header = String.fromCharCode(...uint8Array.slice(0, 4));
      if (header === 'RIFF') {
        console.log(`✅ WAV文件正常: ${audioUrl}`);
        return true;
      }
    }
    
    console.log(`❌ 文件格式异常: ${audioUrl}`);
    return false;
  } catch (error) {
    console.log(`❌ 检查失败: ${audioUrl} - ${error.message}`);
    return false;
  }
}

// 获取需要修复的音频列表
async function getBrokenAudios() {
  console.log('🔍 检查草稿中的音频文件...');
  
  const { data: drafts, error } = await supabase
    .from('shadowing_drafts')
    .select('id, title, text, lang, level, genre, audio_url')
    .not('audio_url', 'is', null);
  
  if (error) {
    console.error('获取草稿失败:', error);
    return [];
  }
  
  console.log(`找到 ${drafts.length} 个有音频的草稿`);
  
  const brokenAudios = [];
  
  for (const draft of drafts) {
    console.log(`检查: ${draft.title}`);
    const isOk = await checkAudioFile(draft.audio_url);
    if (!isOk) {
      brokenAudios.push(draft);
    }
  }
  
  return brokenAudios;
}

// 重新合成音频
async function resynthesizeAudio(draft) {
  try {
    console.log(`🔄 重新合成: ${draft.title}`);
    
    // 这里需要调用你的TTS API
    // 由于需要完整的TTS实现，这里只是示例
    console.log(`需要重新合成: ${draft.text.substring(0, 50)}...`);
    
    // 返回新的音频URL（实际实现中需要调用TTS API）
    return null;
  } catch (error) {
    console.error(`合成失败: ${draft.title} - ${error.message}`);
    return null;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始音频修复检查...');
  
  const brokenAudios = await getBrokenAudios();
  
  if (brokenAudios.length === 0) {
    console.log('✅ 所有音频文件都正常！');
    return;
  }
  
  console.log(`❌ 发现 ${brokenAudios.length} 个有问题的音频文件:`);
  brokenAudios.forEach((draft, index) => {
    console.log(`${index + 1}. ${draft.title} (${draft.lang}, L${draft.level})`);
    console.log(`   URL: ${draft.audio_url}`);
  });
  
  console.log('\n💡 建议操作:');
  console.log('1. 在草稿审核页面，点击"刷新音频"按钮重新生成');
  console.log('2. 或者删除有问题的草稿，重新生成');
  console.log('3. 批量重新生成所有音频');
}

// 运行脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkAudioFile, getBrokenAudios };
