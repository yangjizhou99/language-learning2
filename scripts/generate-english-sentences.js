/**
 * 生成英语句子的脚本
 * 用于批量生成英语句子并创建sentence_units关联
 */

const fs = require('fs');
const path = require('path');

// 英语句子模板（按难度分级）
const ENGLISH_SENTENCES = {
  level1: [
    "Hello world.",
    "Good morning.",
    "Thank you very much.",
    "How are you today?",
    "Nice to meet you.",
    "What is your name?",
    "Where are you from?",
    "I am fine, thank you.",
    "Have a good day.",
    "See you later.",
    "Good night.",
    "Excuse me, please.",
    "I love you.",
    "Happy birthday to you.",
    "Welcome to our school.",
    "This is my friend.",
    "I like coffee.",
    "The weather is nice.",
    "I am happy today.",
    "Can you help me?"
  ],
  level2: [
    "I go to school every day.",
    "She works in a hospital.",
    "We live in a big city.",
    "The children play in the park.",
    "My father drives a blue car.",
    "The teacher explains the lesson clearly.",
    "Students study hard for their exams.",
    "The restaurant serves delicious food.",
    "I enjoy reading books in the evening.",
    "The movie was very interesting.",
    "She speaks three languages fluently.",
    "The computer helps me with my work.",
    "Children learn new things quickly.",
    "The doctor examines the patient carefully.",
    "We celebrate Christmas with our family.",
    "The library has many interesting books.",
    "Students practice speaking English daily.",
    "The weather forecast predicts rain tomorrow.",
    "I prefer tea over coffee in the morning.",
    "The museum displays ancient artifacts."
  ],
  level3: [
    "The scientific research demonstrates significant improvements in technology.",
    "Environmental protection requires collective effort from all citizens.",
    "Economic development depends on education and innovation.",
    "The international conference discussed global climate change.",
    "Modern medicine has revolutionized healthcare treatment methods.",
    "Educational systems should adapt to technological advancements.",
    "Cultural diversity enriches our understanding of different societies.",
    "The government implements policies to support small businesses.",
    "Research indicates that exercise improves mental health significantly.",
    "Technological innovation transforms traditional industries rapidly.",
    "Global communication networks connect people across continents instantly.",
    "Educational institutions prepare students for future career challenges.",
    "Environmental sustainability requires immediate action from governments.",
    "Scientific discoveries advance our knowledge of the universe.",
    "Economic globalization affects international trade relationships.",
    "Cultural exchange programs promote understanding between nations.",
    "Technological development creates new employment opportunities.",
    "Healthcare systems must adapt to changing population demographics.",
    "Educational technology enhances learning experiences for students.",
    "Environmental awareness influences consumer purchasing decisions."
  ],
  level4: [
    "The comprehensive analysis of demographic trends reveals significant shifts in population distribution across metropolitan areas.",
    "International collaboration in scientific research has accelerated the development of breakthrough technologies.",
    "Environmental sustainability initiatives require coordinated efforts between governments, corporations, and communities.",
    "The implementation of artificial intelligence systems transforms traditional business operations and decision-making processes.",
    "Educational institutions worldwide are adapting their curricula to prepare students for an increasingly digital economy.",
    "Global economic interdependence necessitates international cooperation in addressing financial market volatility.",
    "The integration of renewable energy sources into national power grids represents a critical step toward carbon neutrality.",
    "Cultural preservation efforts balance the maintenance of traditional practices with adaptation to modern societal changes.",
    "Healthcare delivery systems must evolve to meet the challenges posed by aging populations and emerging diseases.",
    "Technological innovation in communication has fundamentally altered the way humans interact and share information globally."
  ],
  level5: [
    "The interdisciplinary approach to addressing climate change encompasses scientific research, economic policy development, and social behavioral modification.",
    "Contemporary educational paradigms emphasize critical thinking skills and collaborative problem-solving capabilities over traditional rote memorization.",
    "The exponential growth of artificial intelligence applications necessitates comprehensive ethical frameworks and regulatory oversight mechanisms.",
    "Global health security requires international cooperation in disease surveillance, vaccine development, and healthcare infrastructure strengthening.",
    "The digital transformation of traditional industries demands substantial investment in workforce retraining and technological infrastructure modernization.",
    "Sustainable development goals require balancing economic growth with environmental protection and social equity considerations.",
    "The evolution of communication technologies has fundamentally reshaped human interaction patterns and information consumption behaviors.",
    "International trade relationships are increasingly influenced by geopolitical considerations and technological competitiveness factors.",
    "The integration of renewable energy systems into existing infrastructure requires sophisticated engineering solutions and policy coordination.",
    "Cultural globalization presents both opportunities for cross-cultural understanding and challenges to local identity preservation."
  ]
};

/**
 * 生成英语句子数据
 */
function generateEnglishSentencesData() {
  const sentences = [];
  let sentenceId = 1;

  // 为每个难度级别生成句子
  Object.entries(ENGLISH_SENTENCES).forEach(([levelKey, levelSentences]) => {
    const level = parseInt(levelKey.replace('level', ''));
    
    levelSentences.forEach(text => {
      sentences.push({
        sentence_id: sentenceId++,
        lang: 'en-US',
        text: text,
        level: level,
        domain_tags: ['script-generated'],
        created_at: new Date().toISOString()
      });
    });
  });

  return sentences;
}

/**
 * 生成音素映射数据（简化版）
 */
function generatePhonemeMapping() {
  // 基于常用英语单词的音素映射
  const wordPhonemeMap = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'world': ['w', 'ɜ', 'r', 'l', 'd'],
    'good': ['g', 'ʊ', 'd'],
    'morning': ['m', 'ɔ', 'r', 'n', 'ɪ', 'ŋ'],
    'thank': ['θ', 'æ', 'ŋ', 'k'],
    'you': ['j', 'u'],
    'very': ['v', 'ɛ', 'r', 'i'],
    'much': ['m', 'ʌ', 'tʃ'],
    'how': ['h', 'aʊ'],
    'are': ['ɑ', 'r'],
    'today': ['t', 'ə', 'd', 'eɪ'],
    'nice': ['n', 'aɪ', 's'],
    'to': ['t', 'u'],
    'meet': ['m', 'i', 't'],
    'what': ['w', 'ʌ', 't'],
    'is': ['ɪ', 'z'],
    'your': ['j', 'ɔ', 'r'],
    'name': ['n', 'eɪ', 'm'],
    'where': ['w', 'ɛ', 'r'],
    'from': ['f', 'r', 'ʌ', 'm'],
    'fine': ['f', 'aɪ', 'n'],
    'have': ['h', 'æ', 'v'],
    'day': ['d', 'eɪ'],
    'see': ['s', 'i'],
    'later': ['l', 'eɪ', 't', 'ə', 'r'],
    'night': ['n', 'aɪ', 't'],
    'excuse': ['ɪ', 'k', 's', 'k', 'j', 'u', 'z'],
    'please': ['p', 'l', 'i', 'z'],
    'love': ['l', 'ʌ', 'v'],
    'happy': ['h', 'æ', 'p', 'i'],
    'birthday': ['b', 'ɜ', 'r', 'θ', 'd', 'eɪ'],
    'welcome': ['w', 'ɛ', 'l', 'k', 'ə', 'm'],
    'our': ['aʊ', 'r'],
    'school': ['s', 'k', 'u', 'l'],
    'this': ['ð', 'ɪ', 's'],
    'my': ['m', 'aɪ'],
    'friend': ['f', 'r', 'ɛ', 'n', 'd'],
    'like': ['l', 'aɪ', 'k'],
    'coffee': ['k', 'ɔ', 'f', 'i'],
    'the': ['ð', 'ə'],
    'weather': ['w', 'ɛ', 'ð', 'ə', 'r'],
    'can': ['k', 'æ', 'n'],
    'help': ['h', 'ɛ', 'l', 'p'],
    'me': ['m', 'i']
  };

  return wordPhonemeMap;
}

/**
 * 为句子生成sentence_units关联
 */
function generateSentenceUnits(sentences, wordPhonemeMap) {
  const sentenceUnits = [];
  
  // 获取英语音素ID映射（这里需要从数据库获取，暂时用模拟数据）
  const phonemeIds = {
    'h': 1, 'ə': 2, 'l': 3, 'oʊ': 4, 'w': 5, 'ɜ': 6, 'r': 7, 'd': 8, 'g': 9, 'ʊ': 10,
    'm': 11, 'ɔ': 12, 'n': 13, 'ɪ': 14, 'ŋ': 15, 'θ': 16, 'æ': 17, 'k': 18, 'j': 19,
    'u': 20, 'v': 21, 'ɛ': 22, 'i': 23, 'ʌ': 24, 'tʃ': 25, 'aʊ': 26, 'ɑ': 27, 'eɪ': 28,
    's': 29, 't': 30, 'f': 31, 'p': 32, 'z': 33, 'ð': 34, 'aɪ': 35, 'b': 36
  };

  sentences.forEach(sentence => {
    const words = sentence.text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    const phonemeCount = {};
    
    words.forEach(word => {
      const phonemes = wordPhonemeMap[word] || [];
      phonemes.forEach(phoneme => {
        phonemeCount[phoneme] = (phonemeCount[phoneme] || 0) + 1;
      });
    });

    Object.entries(phonemeCount).forEach(([phoneme, count]) => {
      const unitId = phonemeIds[phoneme];
      if (unitId) {
        sentenceUnits.push({
          sentence_id: sentence.sentence_id,
          unit_id: unitId,
          count: count
        });
      }
    });
  });

  return sentenceUnits;
}

/**
 * 生成SQL插入语句
 */
function generateSQLInserts(sentences, sentenceUnits) {
  let sql = '-- 英语句子数据插入\n';
  sql += '-- 生成时间: ' + new Date().toISOString() + '\n\n';
  
  // 插入句子
  sql += '-- 插入英语句子\n';
  sql += 'INSERT INTO public.pron_sentences (lang, text, level, domain_tags) VALUES\n';
  
  const sentenceValues = sentences.map(s => 
    `('${s.lang}', '${s.text.replace(/'/g, "''")}', ${s.level}, ARRAY['${s.domain_tags.join("','")}'])`
  );
  sql += sentenceValues.join(',\n') + ';\n\n';
  
  // 插入sentence_units（需要先获取unit_id）
  sql += '-- 插入sentence_units关联（需要先运行英语音素迁移）\n';
  sql += '-- 注意：以下unit_id是示例，实际使用时需要查询unit_catalog表\n\n';
  
  return sql;
}

/**
 * 主函数
 */
function main() {
  console.log('开始生成英语句子数据...');
  
  // 生成句子数据
  const sentences = generateEnglishSentencesData();
  console.log(`生成了 ${sentences.length} 个英语句子`);
  
  // 生成音素映射
  const wordPhonemeMap = generatePhonemeMapping();
  console.log(`生成了 ${Object.keys(wordPhonemeMap).length} 个单词的音素映射`);
  
  // 生成sentence_units
  const sentenceUnits = generateSentenceUnits(sentences, wordPhonemeMap);
  console.log(`生成了 ${sentenceUnits.length} 条sentence_units关联`);
  
  // 生成SQL文件
  const sql = generateSQLInserts(sentences, sentenceUnits);
  
  // 保存到文件
  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const sqlFile = path.join(outputDir, 'english-sentences.sql');
  fs.writeFileSync(sqlFile, sql, 'utf8');
  
  // 保存JSON数据
  const jsonFile = path.join(outputDir, 'english-sentences.json');
  const jsonData = {
    sentences,
    sentenceUnits,
    wordPhonemeMap,
    generated_at: new Date().toISOString(),
    stats: {
      total_sentences: sentences.length,
      total_sentence_units: sentenceUnits.length,
      unique_words: Object.keys(wordPhonemeMap).length
    }
  };
  fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2), 'utf8');
  
  console.log('数据生成完成！');
  console.log(`SQL文件: ${sqlFile}`);
  console.log(`JSON文件: ${jsonFile}`);
  console.log('\n统计信息:');
  console.log(`- 句子总数: ${sentences.length}`);
  console.log(`- sentence_units关联: ${sentenceUnits.length}`);
  console.log(`- 单词音素映射: ${Object.keys(wordPhonemeMap).length}`);
  
  // 按难度统计
  const levelStats = {};
  sentences.forEach(s => {
    levelStats[s.level] = (levelStats[s.level] || 0) + 1;
  });
  console.log('\n按难度分布:');
  Object.entries(levelStats).forEach(([level, count]) => {
    console.log(`- Level ${level}: ${count} 个句子`);
  });
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  generateEnglishSentencesData,
  generatePhonemeMapping,
  generateSentenceUnits,
  ENGLISH_SENTENCES
};
