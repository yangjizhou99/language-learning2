// =====================================================
// 生产环境日语罗马音系统部署脚本
// 在数据库迁移后重新生成句节关联和用户统计数据
// =====================================================

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 缺少必要的环境变量');
  console.error('需要: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

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

async function deployJapaneseRomajiSystem() {
  console.log('🚀 开始生产环境日语罗马音系统部署...\n');
  
  try {
    // 1. 验证数据库迁移是否成功
    console.log('🔍 验证数据库迁移状态...');
    const { data: romajiUnits, error: unitsError } = await supabaseAdmin
      .from('unit_catalog')
      .select('symbol')
      .eq('lang', 'ja-JP');
    
    if (unitsError) {
      throw new Error(`验证失败: ${unitsError.message}`);
    }
    
    if (!romajiUnits || romajiUnits.length !== 104) {
      throw new Error(`迁移不完整：期望104个罗马字音节，实际${romajiUnits?.length || 0}个`);
    }
    
    console.log(`✅ 数据库迁移验证成功：${romajiUnits.length}个罗马字音节`);
    
    // 2. 重新生成日文句节关联
    console.log('\n📝 重新生成日文句节关联...');
    const { data: sentences, error: sentencesError } = await supabaseAdmin
      .from('pron_sentences')
      .select('sentence_id, text')
      .eq('lang', 'ja-JP');
    
    if (sentencesError) {
      throw new Error(`获取日文句子失败: ${sentencesError.message}`);
    }
    
    console.log(`📊 找到 ${sentences.length} 个日文句子`);
    
    // 获取罗马字音节映射
    const { data: units, error: unitsMapError } = await supabaseAdmin
      .from('unit_catalog')
      .select('unit_id, symbol')
      .eq('lang', 'ja-JP');
    
    if (unitsMapError) {
      throw new Error(`获取罗马字音节映射失败: ${unitsMapError.message}`);
    }
    
    const unitIdMap = new Map();
    units.forEach(unit => {
      unitIdMap.set(unit.symbol, unit.unit_id);
    });
    
    // 处理每个句子
    let processedSentences = 0;
    let totalAssociations = 0;
    
    for (const sentence of sentences) {
      const romajiSyllables = japaneseToRomaji(sentence.text);
      const syllableMap = new Map();
      
      romajiSyllables.forEach(syllable => {
        syllableMap.set(syllable, (syllableMap.get(syllable) || 0) + 1);
      });
      
      const insertUnits = [];
      for (const [symbol, count] of syllableMap.entries()) {
        const unitId = unitIdMap.get(symbol);
        if (unitId) {
          insertUnits.push({
            sentence_id: sentence.sentence_id,
            unit_id: unitId,
            count,
          });
        }
      }
      
      if (insertUnits.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('sentence_units')
          .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
        
        if (insertError) {
          console.warn(`⚠️  句子 ${sentence.sentence_id} 关联失败: ${insertError.message}`);
        } else {
          processedSentences++;
          totalAssociations += insertUnits.length;
        }
      }
    }
    
    console.log(`✅ 句节关联生成完成：${processedSentences}/${sentences.length} 个句子，${totalAssociations} 个关联`);
    
    // 3. 重新处理用户统计数据
    console.log('\n📊 重新处理用户统计数据...');
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from('user_pron_attempts')
      .select('*')
      .eq('lang', 'ja-JP')
      .eq('valid_flag', true)
      .not('azure_raw_json', 'is', null);
    
    if (attemptsError) {
      console.warn(`⚠️  获取用户发音记录失败: ${attemptsError.message}`);
    } else if (attempts && attempts.length > 0) {
      console.log(`📊 找到 ${attempts.length} 条日文发音记录`);
      
      const userStatsMap = new Map();
      
      for (const attempt of attempts) {
        const displayText = attempt.azure_raw_json?.DisplayText || attempt.azure_raw_json?.NBest?.[0]?.Display || '';
        const romajiSyllables = japaneseToRomaji(displayText);
        const azureScores = extractAllAzureScores(attempt.azure_raw_json);
        
        if (romajiSyllables.length === 0 || azureScores.length === 0) {
          continue;
        }
        
        const matchedSyllables = allocateScoresToRomaji(romajiSyllables, azureScores);
        
        for (const match of matchedSyllables) {
          const unitId = unitIdMap.get(match.syllable);
          if (!unitId) continue;
          
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
      
      // 批量插入用户统计
      if (userStatsMap.size > 0) {
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
        
        const { error: insertError } = await supabaseAdmin
          .from('user_unit_stats')
          .upsert(insertData, { 
            onConflict: 'user_id,lang,unit_id',
            ignoreDuplicates: false 
          });
        
        if (insertError) {
          console.warn(`⚠️  用户统计更新失败: ${insertError.message}`);
        } else {
          console.log(`✅ 用户统计更新完成：${insertData.length} 条记录`);
        }
      }
    } else {
      console.log('ℹ️  没有找到日文发音记录，跳过用户统计处理');
    }
    
    // 4. 验证部署结果
    console.log('\n🔍 验证部署结果...');
    const { data: finalStats, error: finalError } = await supabaseAdmin
      .from('unit_catalog')
      .select('symbol')
      .eq('lang', 'ja-JP');
    
    if (finalError) {
      throw new Error(`验证失败: ${finalError.message}`);
    }
    
    console.log('\n🎉 生产环境日语罗马音系统部署完成！');
    console.log(`📊 最终统计:`);
    console.log(`  - 罗马字音节: ${finalStats.length} 个`);
    console.log(`  - 句节关联: ${totalAssociations} 个`);
    console.log(`  - 处理句子: ${processedSentences} 个`);
    
  } catch (error) {
    console.error('❌ 部署过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行部署
deployJapaneseRomajiSystem();
