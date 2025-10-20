// 生成日语测试句子的脚本
const fetch = require('node-fetch');

async function generateJapaneseSentences() {
  try {
    console.log('开始生成日语测试句子...');
    
    const response = await fetch('http://localhost:3000/api/pronunciation/generate-sentences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        count: 20,
        level: 2,
        lang: 'ja-JP'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ 日语测试句子生成成功！');
      console.log(`• 生成句子：${data.stats.generated_count} 个`);
      console.log(`• 音节关联：${data.stats.sentence_units_count} 条`);
      console.log(`• 难度等级：${data.stats.level}`);
      console.log(`\n💡 ${data.message || '新句子已添加到练习库！'}`);
    } else {
      throw new Error(data.error || '生成失败');
    }
  } catch (error) {
    console.error('❌ 生成日语测试句子失败:', error.message);
  }
}

generateJapaneseSentences();

