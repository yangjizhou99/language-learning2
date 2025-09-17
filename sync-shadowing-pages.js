#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 同步脚本：将中文页面的修改同步到日语和英语页面
function syncShadowingPages() {
  console.log('🔄 开始同步跟读练习页面...');
  
  const chineseFile = 'src/components/shadowing/ChineseShadowingPage.tsx';
  const japaneseFile = 'src/components/shadowing/JapaneseShadowingPage.tsx';
  const englishFile = 'src/components/shadowing/EnglishShadowingPage.tsx';
  
  try {
    // 读取中文页面内容
    const chineseContent = fs.readFileSync(chineseFile, 'utf8');
    
    // 生成日语页面内容
    let japaneseContent = chineseContent
      .replace(/export default function ShadowingPage\(\)/g, 'export default function JapaneseShadowingPage()')
      .replace(/useState<"ja" \| "en" \| "zh">\("ja"\)/g, 'useState<"ja" | "en" | "zh">("ja")')
      .replace(/录音完成！/g, '録音完了！')
      .replace(/评分中\.\.\./g, '採点中...')
      .replace(/开始评分/g, '採点開始')
      .replace(/还没有录音/g, 'まだ録音していません')
      .replace(/重新评分/g, '再採点')
      .replace(/整体评分/g, '総合採点')
      .replace(/发音准确性/g, '発音精度')
      .replace(/改进建议/g, '改善提案')
      .replace(/练习对比/g, '練習比較')
      .replace(/你的发音/g, 'あなたの発音')
      .replace(/详细分析/g, '詳細分析')
      .replace(/句子/g, '文')
      .replace(/问题/g, '問題')
      .replace(/暂无解释/g, '翻訳なし')
      .replace(/刷新解释/g, '翻訳を更新')
      .replace(/解释/g, '翻訳')
      .replace(/词性/g, '品詞')
      .replace(/例句/g, '例文')
      .replace(/已选择的生词/g, '選択された単語')
      .replace(/所有题目都已练习过！/g, 'すべての問題を練習済みです！')
      .replace(/请先完成录音，然后点击下方按钮进行评分/g, 'まず録音を完了してから、下のボタンをクリックして採点してください')
      .replace(/您已完成录音，点击下方按钮进行评分/g, '録音が完了しました。下のボタンをクリックして採点してください');
    
    // 生成英语页面内容
    let englishContent = chineseContent
      .replace(/export default function ShadowingPage\(\)/g, 'export default function EnglishShadowingPage()')
      .replace(/useState<"ja" \| "en" \| "zh">\("ja"\)/g, 'useState<"ja" | "en" | "zh">("en")')
      .replace(/录音完成！/g, 'Recording completed!')
      .replace(/评分中\.\.\./g, 'Scoring...')
      .replace(/开始评分/g, 'Start scoring')
      .replace(/还没有录音/g, 'No recording yet')
      .replace(/重新评分/g, 'Re-score')
      .replace(/整体评分/g, 'Overall Score')
      .replace(/发音准确性/g, 'Pronunciation Accuracy')
      .replace(/改进建议/g, 'Improvement Suggestions')
      .replace(/练习对比/g, 'Practice Comparison')
      .replace(/你的发音/g, 'Your Pronunciation')
      .replace(/详细分析/g, 'Detailed Analysis')
      .replace(/句子/g, 'Sentence')
      .replace(/问题/g, 'Issues')
      .replace(/暂无解释/g, 'No explanation')
      .replace(/刷新解释/g, 'Refresh explanation')
      .replace(/解释/g, 'Explanation')
      .replace(/词性/g, 'Part of speech')
      .replace(/例句/g, 'Example sentence')
      .replace(/已选择的生词/g, 'Selected vocabulary')
      .replace(/所有题目都已练习过！/g, 'All questions have been practiced!')
      .replace(/请先完成录音，然后点击下方按钮进行评分/g, 'Please complete the recording first, then click the button below to score')
      .replace(/您已完成录音，点击下方按钮进行评分/g, 'You have completed the recording, click the button below to score');
    
    // 写入文件
    fs.writeFileSync(japaneseFile, japaneseContent);
    fs.writeFileSync(englishFile, englishContent);
    
    console.log('✅ 同步完成！');
    console.log('📝 中文页面 → 日语页面');
    console.log('📝 中文页面 → 英语页面');
    console.log('');
    console.log('💡 使用方法：');
    console.log('1. 修改 src/components/shadowing/ChineseShadowingPage.tsx');
    console.log('2. 运行 node sync-shadowing-pages.js');
    console.log('3. 日语和英语页面会自动同步更新');
    
  } catch (error) {
    console.error('❌ 同步失败:', error.message);
    process.exit(1);
  }
}

// 运行同步
syncShadowingPages();
