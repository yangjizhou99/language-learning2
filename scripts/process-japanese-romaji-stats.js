// 处理日文罗马音用户统计 - 使用按比例分配算法
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// 日语到罗马音的G2P工具
function japaneseToRomaji(text) {
  // 移除标点符号，只保留假名和汉字
  const cleanText = text.replace(/[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '');
  
  // 假名到训令式罗马字的映射
  const kanaToRomaji = {
    // 基本元音
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    
    // 清音 (k行)
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
    
    // 清音 (s行)
    'さ': 'sa', 'し': 'si', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'ざ': 'za', 'じ': 'zi', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'サ': 'sa', 'シ': 'si', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
    'ザ': 'za', 'ジ': 'zi', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
    
    // 清音 (t行)
    'た': 'ta', 'ち': 'ti', 'つ': 'tu', 'て': 'te', 'と': 'to',
    'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
    'タ': 'ta', 'チ': 'ti', 'ツ': 'tu', 'テ': 'te', 'ト': 'to',
    'ダ': 'da', 'ヂ': 'di', 'ヅ': 'du', 'デ': 'de', 'ド': 'do',
    
    // 鼻音 (n行)
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
    
    // 清音 (h行)
    'は': 'ha', 'ひ': 'hi', 'ふ': 'hu', 'へ': 'he', 'ほ': 'ho',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ハ': 'ha', 'ヒ': 'hi', 'フ': 'hu', 'ヘ': 'he', 'ホ': 'ho',
    'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
    'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
    
    // 鼻音 (m行)
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
    
    // 近音 (y行)
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
    
    // 近音 (r行)
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
    
    // 近音 (w行)
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
    
    // 拗音
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'しゃ': 'sya', 'しゅ': 'syu', 'しょ': 'syo',
    'じゃ': 'zya', 'じゅ': 'zyu', 'じょ': 'zyo',
    'ちゃ': 'tya', 'ちゅ': 'tyu', 'ちょ': 'tyo',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    
    // 片假名拗音
    'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
    'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
    'シャ': 'sya', 'シュ': 'syu', 'ショ': 'syo',
    'ジャ': 'zya', 'ジュ': 'zyu', 'ジョ': 'zyo',
    'チャ': 'tya', 'チュ': 'tyu', 'チョ': 'tyo',
    'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
    'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
    'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
    'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
    'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
    'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo'
  };
  
  const syllables = [];
  let i = 0;
  
  while (i < cleanText.length) {
    const char = cleanText[i];
    
    // 处理促音（小っ）
    if (char === 'っ' || char === 'ッ') {
      i++;
      continue;
    }
    
    // 处理长音符号
    if (char === 'ー') {
      i++;
      continue;
    }
    
    // 处理拗音（2-3字符）
    if (i + 1 < cleanText.length) {
      const twoChar = cleanText.slice(i, i + 2);
      if (kanaToRomaji[twoChar]) {
        syllables.push(kanaToRomaji[twoChar]);
        i += 2;
        continue;
      }
    }
    
    // 处理拗音（3字符）
    if (i + 2 < cleanText.length) {
      const threeChar = cleanText.slice(i, i + 3);
      if (kanaToRomaji[threeChar]) {
        syllables.push(kanaToRomaji[threeChar]);
        i += 3;
        continue;
      }
    }
    
    // 处理单个假名
    if (kanaToRomaji[char]) {
      syllables.push(kanaToRomaji[char]);
    } else {
      // 对于汉字或其他字符，跳过或标记为未知
      console.warn(`未知字符: ${char}`);
    }
    
    i++;
  }
  
  return syllables;
}

// 从Azure数据中提取所有音素评分
function extractAllAzureScores(azureRawJson) {
  const allScores = [];
  
  if (azureRawJson?.NBest?.[0]?.Words) {
    for (const word of azureRawJson.NBest[0].Words) {
      if (word.Phonemes) {
        for (const phoneme of word.Phonemes) {
          const score = phoneme.PronunciationAssessment?.AccuracyScore;
          if (score !== undefined) {
            allScores.push(score);
          }
        }
      }
    }
  }
  
  return allScores;
}

// 按比例分配算法
function allocateScoresToRomaji(romajiSyllables, azureScores) {
  if (romajiSyllables.length === 0 || azureScores.length === 0) {
    return [];
  }
  
  const ratio = azureScores.length / romajiSyllables.length;
  const matchedSyllables = [];
  
  for (let i = 0; i < romajiSyllables.length; i++) {
    const startIdx = Math.floor(i * ratio);
    const endIdx = Math.floor((i + 1) * ratio);
    const scoresForSyllable = azureScores.slice(startIdx, endIdx);
    
    if (scoresForSyllable.length > 0) {
      const avgScore = scoresForSyllable.reduce((sum, score) => sum + score, 0) / scoresForSyllable.length;
      matchedSyllables.push({
        syllable: romajiSyllables[i],
        avgScore: parseFloat(avgScore.toFixed(1)),
        sourceCount: scoresForSyllable.length
      });
    }
  }
  
  return matchedSyllables;
}

async function processJapaneseRomajiStats() {
  console.log('🎯 开始处理日文罗马音用户统计...\n');
  
  try {
    // 1. 获取所有日文发音尝试记录
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('user_pron_attempts')
      .select('*')
      .eq('lang', 'ja-JP')
      .eq('valid_flag', true)
      .not('azure_raw_json', 'is', null);
    
    if (attemptsError) {
      console.error('❌ 获取日文发音记录失败:', attemptsError);
      return;
    }
    
    console.log(`📊 找到 ${attempts.length} 条日文发音记录`);
    
    // 2. 获取日文罗马字音节单元
    const { data: jaSyllables, error: syllablesError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id, symbol')
      .eq('lang', 'ja-JP');
    
    if (syllablesError) {
      console.error('❌ 获取日文罗马字音节单元失败:', syllablesError);
      return;
    }
    
    console.log(`🔤 找到 ${jaSyllables.length} 个日文罗马字音节单元`);
    
    // 3. 创建音节符号到unit_id的映射
    const syllableToUnitId = {};
    jaSyllables.forEach(unit => {
      syllableToUnitId[unit.symbol] = unit.unit_id;
    });
    
    // 4. 处理每条发音记录
    const userStatsMap = new Map(); // user_id -> unit_id -> stats
    
    for (const attempt of attempts) {
      const displayText = attempt.azure_raw_json?.DisplayText || attempt.azure_raw_json?.NBest?.[0]?.Display || '';
      console.log(`\n🔄 处理记录: ${displayText.substring(0, 20)}...`);
      
      // 提取罗马字音节
      const romajiSyllables = japaneseToRomaji(displayText);
      console.log(`   罗马字音节: [${romajiSyllables.slice(0, 5).join(', ')}...] (${romajiSyllables.length}个)`);
      
      // 提取Azure评分
      const azureScores = extractAllAzureScores(attempt.azure_raw_json);
      console.log(`   Azure评分: ${azureScores.length}个`);
      
      if (romajiSyllables.length === 0 || azureScores.length === 0) {
        console.log('   ⚠️  跳过：无音节或评分数据');
        continue;
      }
      
      // 按比例分配
      const matchedSyllables = allocateScoresToRomaji(romajiSyllables, azureScores);
      console.log(`   匹配结果: ${matchedSyllables.length}个音节`);
      
      // 更新用户统计
      for (const match of matchedSyllables) {
        const unitId = syllableToUnitId[match.syllable];
        if (!unitId) {
          console.log(`   ⚠️  跳过：音节 "${match.syllable}" 未找到对应unit_id`);
          continue;
        }
        
        const key = `${attempt.user_id}-${unitId}`;
        if (!userStatsMap.has(key)) {
          userStatsMap.set(key, {
            user_id: attempt.user_id,
            lang: 'ja-JP',
            unit_id: unitId,
            n: 0,
            mean: 0,
            m2: 0,
            scores: []
          });
        }
        
        const stats = userStatsMap.get(key);
        stats.n += 1;
        stats.scores.push(match.avgScore);
        
        // 使用Welford算法更新统计
        const delta = match.avgScore - stats.mean;
        stats.mean += delta / stats.n;
        stats.m2 += delta * (match.avgScore - stats.mean);
      }
    }
    
    console.log(`\n📈 生成统计: ${userStatsMap.size} 个用户-音节组合`);
    
    // 5. 计算置信区间并插入数据库
    const insertData = [];
    for (const [key, stats] of userStatsMap) {
      const variance = stats.m2 / (stats.n - 1);
      const stdDev = Math.sqrt(variance);
      const ciLow = stats.mean - 1.96 * stdDev / Math.sqrt(stats.n);
      const ciHigh = stats.mean + 1.96 * stdDev / Math.sqrt(stats.n);
      
      insertData.push({
        user_id: stats.user_id,
        lang: stats.lang,
        unit_id: stats.unit_id,
        n: stats.n,
        mean: parseFloat(stats.mean.toFixed(2)),
        m2: parseFloat(stats.m2.toFixed(2)),
        ci_low: parseFloat(ciLow.toFixed(2)),
        ci_high: parseFloat(ciHigh.toFixed(2)),
        difficulty: parseFloat((100 - stats.mean).toFixed(2)),
        last_updated: new Date().toISOString()
      });
    }
    
    // 6. 批量插入用户统计（使用upsert覆盖现有数据）
    if (insertData.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('user_unit_stats')
        .upsert(insertData, { 
          onConflict: 'user_id,lang,unit_id',
          ignoreDuplicates: false 
        });
      
      if (insertError) {
        console.error('❌ 插入用户统计失败:', insertError);
        return;
      }
      
      console.log(`✅ 成功更新 ${insertData.length} 条用户统计记录`);
    }
    
    console.log('\n🎉 日文罗马音用户统计处理完成！');
    
    // 7. 显示结果预览
    console.log('\n📊 处理结果预览:');
    for (const [key, stats] of userStatsMap) {
      const unit = jaSyllables.find(u => u.unit_id === stats.unit_id);
      console.log(`   ${unit?.symbol || '未知'}: 平均分 ${stats.mean.toFixed(1)}, 样本数 ${stats.n}`);
    }
    
  } catch (error) {
    console.error('❌ 处理过程中发生错误:', error);
  }
}

// 运行处理
processJapaneseRomajiStats();

