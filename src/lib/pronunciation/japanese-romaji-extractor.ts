/**
 * 日语G2P工具 - 训令式罗马字
 * 将假名转换为训令式罗马字音节
 */

// 平假名到训令式罗马字的映射表
const HIRAGANA_TO_ROMAJI: Record<string, string> = {
  // 基本元音
  'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
  
  // 清音 (k行)
  'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
  
  // 浊音 (g行)
  'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
  
  // 清音 (s行)
  'さ': 'sa', 'し': 'si', 'す': 'su', 'せ': 'se', 'そ': 'so',
  
  // 浊音 (z行)
  'ざ': 'za', 'じ': 'zi', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
  
  // 清音 (t行)
  'た': 'ta', 'ち': 'ti', 'つ': 'tu', 'て': 'te', 'と': 'to',
  
  // 浊音 (d行)
  'だ': 'da', 'ぢ': 'di', 'づ': 'du', 'で': 'de', 'ど': 'do',
  
  // 鼻音 (n行)
  'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
  
  // 清音 (h行)
  'は': 'ha', 'ひ': 'hi', 'ふ': 'hu', 'へ': 'he', 'ほ': 'ho',
  
  // 浊音 (b行)
  'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
  
  // 半浊音 (p行)
  'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
  
  // 鼻音 (m行)
  'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
  
  // 近音 (y行)
  'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
  
  // 近音 (r行)
  'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
  
  // 近音 (w行)
  'わ': 'wa', 'を': 'wo', 'ん': 'n',
};

// 片假名到训令式罗马字的映射表
const KATAKANA_TO_ROMAJI: Record<string, string> = {
  // 基本元音
  'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
  
  // 清音 (k行)
  'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
  
  // 浊音 (g行)
  'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
  
  // 清音 (s行)
  'サ': 'sa', 'シ': 'si', 'ス': 'su', 'セ': 'se', 'ソ': 'so',
  
  // 浊音 (z行)
  'ザ': 'za', 'ジ': 'zi', 'ズ': 'zu', 'ゼ': 'ze', 'ゾ': 'zo',
  
  // 清音 (t行)
  'タ': 'ta', 'チ': 'ti', 'ツ': 'tu', 'テ': 'te', 'ト': 'to',
  
  // 浊音 (d行)
  'ダ': 'da', 'ヂ': 'di', 'ヅ': 'du', 'デ': 'de', 'ド': 'do',
  
  // 鼻音 (n行)
  'ナ': 'na', 'ニ': 'ni', 'ヌ': 'nu', 'ネ': 'ne', 'ノ': 'no',
  
  // 清音 (h行)
  'ハ': 'ha', 'ヒ': 'hi', 'フ': 'hu', 'ヘ': 'he', 'ホ': 'ho',
  
  // 浊音 (b行)
  'バ': 'ba', 'ビ': 'bi', 'ブ': 'bu', 'ベ': 'be', 'ボ': 'bo',
  
  // 半浊音 (p行)
  'パ': 'pa', 'ピ': 'pi', 'プ': 'pu', 'ペ': 'pe', 'ポ': 'po',
  
  // 鼻音 (m行)
  'マ': 'ma', 'ミ': 'mi', 'ム': 'mu', 'メ': 'me', 'モ': 'mo',
  
  // 近音 (y行)
  'ヤ': 'ya', 'ユ': 'yu', 'ヨ': 'yo',
  
  // 近音 (r行)
  'ラ': 'ra', 'リ': 'ri', 'ル': 'ru', 'レ': 're', 'ロ': 'ro',
  
  // 近音 (w行)
  'ワ': 'wa', 'ヲ': 'wo', 'ン': 'n',
};

// 拗音映射表
const YOON_MAPPING: Record<string, string> = {
  // きゃ行
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  
  // しゃ行
  'しゃ': 'sya', 'しゅ': 'syu', 'しょ': 'syo',
  'じゃ': 'zya', 'じゅ': 'zyu', 'じょ': 'zyo',
  
  // ちゃ行
  'ちゃ': 'tya', 'ちゅ': 'tyu', 'ちょ': 'tyo',
  
  // にゃ行
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  
  // ひゃ行
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
  
  // みゃ行
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  
  // りゃ行
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
};

// 片假名拗音映射表
const KATAKANA_YOON_MAPPING: Record<string, string> = {
  // キャ行
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  
  // シャ行
  'シャ': 'sya', 'シュ': 'syu', 'ショ': 'syo',
  'ジャ': 'zya', 'ジュ': 'zyu', 'ジョ': 'zyo',
  
  // チャ行
  'チャ': 'tya', 'チュ': 'tyu', 'チョ': 'tyo',
  
  // ニャ行
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  
  // ヒャ行
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',
  
  // ミャ行
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  
  // リャ行
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
};

/**
 * 将日语文本转换为训令式罗马字音节序列
 * @param text 日语文本（平假名、片假名、汉字混合）
 * @returns 罗马字音节序列
 */
export function japaneseToRomaji(text: string): string[] {
  const romajiSyllables: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    
    // 处理促音（小っ）
    if (char === 'っ' || char === 'ッ') {
      // 促音在训令式中通常不单独表示，跳过或标记
      i++;
      continue;
    }
    
    // 处理长音符号
    if (char === 'ー') {
      // 长音在训令式中通常不单独表示，跳过
      i++;
      continue;
    }
    
    // 处理拗音（2-3字符）
    if (i + 1 < text.length) {
      const twoChar = text.slice(i, i + 2);
      if (YOON_MAPPING[twoChar] || KATAKANA_YOON_MAPPING[twoChar]) {
        romajiSyllables.push(YOON_MAPPING[twoChar] || KATAKANA_YOON_MAPPING[twoChar]);
        i += 2;
        continue;
      }
    }
    
    // 处理拗音（3字符）
    if (i + 2 < text.length) {
      const threeChar = text.slice(i, i + 3);
      if (YOON_MAPPING[threeChar] || KATAKANA_YOON_MAPPING[threeChar]) {
        romajiSyllables.push(YOON_MAPPING[threeChar] || KATAKANA_YOON_MAPPING[threeChar]);
        i += 3;
        continue;
      }
    }
    
    // 处理单个假名
    const hiraganaRomaji = HIRAGANA_TO_ROMAJI[char];
    const katakanaRomaji = KATAKANA_TO_ROMAJI[char];
    
    if (hiraganaRomaji) {
      romajiSyllables.push(hiraganaRomaji);
    } else if (katakanaRomaji) {
      romajiSyllables.push(katakanaRomaji);
    } else {
      // 对于汉字或其他字符，跳过或标记为未知
      console.warn(`未知字符: ${char}`);
    }
    
    i++;
  }
  
  return romajiSyllables;
}

/**
 * 获取罗马字音节分类信息
 * @param syllable 罗马字音节
 * @returns 分类信息
 */
export function getSyllableCategory(syllable: string): { category: string; subcategory: string } {
  const categoryMap: Record<string, { category: string; subcategory: string }> = {
    // 元音
    'a': { category: 'vowel', subcategory: 'basic' },
    'i': { category: 'vowel', subcategory: 'basic' },
    'u': { category: 'vowel', subcategory: 'basic' },
    'e': { category: 'vowel', subcategory: 'basic' },
    'o': { category: 'vowel', subcategory: 'basic' },
    
    // 清音
    'ka': { category: 'consonant', subcategory: 'k_line' },
    'ki': { category: 'consonant', subcategory: 'k_line' },
    'ku': { category: 'consonant', subcategory: 'k_line' },
    'ke': { category: 'consonant', subcategory: 'k_line' },
    'ko': { category: 'consonant', subcategory: 'k_line' },
    
    'sa': { category: 'consonant', subcategory: 's_line' },
    'si': { category: 'consonant', subcategory: 's_line' },
    'su': { category: 'consonant', subcategory: 's_line' },
    'se': { category: 'consonant', subcategory: 's_line' },
    'so': { category: 'consonant', subcategory: 's_line' },
    
    'ta': { category: 'consonant', subcategory: 't_line' },
    'ti': { category: 'consonant', subcategory: 't_line' },
    'tu': { category: 'consonant', subcategory: 't_line' },
    'te': { category: 'consonant', subcategory: 't_line' },
    'to': { category: 'consonant', subcategory: 't_line' },
    
    'na': { category: 'consonant', subcategory: 'n_line' },
    'ni': { category: 'consonant', subcategory: 'n_line' },
    'nu': { category: 'consonant', subcategory: 'n_line' },
    'ne': { category: 'consonant', subcategory: 'n_line' },
    'no': { category: 'consonant', subcategory: 'n_line' },
    
    'ha': { category: 'consonant', subcategory: 'h_line' },
    'hi': { category: 'consonant', subcategory: 'h_line' },
    'hu': { category: 'consonant', subcategory: 'h_line' },
    'he': { category: 'consonant', subcategory: 'h_line' },
    'ho': { category: 'consonant', subcategory: 'h_line' },
    
    'ma': { category: 'consonant', subcategory: 'm_line' },
    'mi': { category: 'consonant', subcategory: 'm_line' },
    'mu': { category: 'consonant', subcategory: 'm_line' },
    'me': { category: 'consonant', subcategory: 'm_line' },
    'mo': { category: 'consonant', subcategory: 'm_line' },
    
    'ya': { category: 'consonant', subcategory: 'y_line' },
    'yu': { category: 'consonant', subcategory: 'y_line' },
    'yo': { category: 'consonant', subcategory: 'y_line' },
    
    'ra': { category: 'consonant', subcategory: 'r_line' },
    'ri': { category: 'consonant', subcategory: 'r_line' },
    'ru': { category: 'consonant', subcategory: 'r_line' },
    're': { category: 'consonant', subcategory: 'r_line' },
    'ro': { category: 'consonant', subcategory: 'r_line' },
    
    'wa': { category: 'consonant', subcategory: 'w_line' },
    'wo': { category: 'consonant', subcategory: 'w_line' },
    'n': { category: 'consonant', subcategory: 'n_syllable' },
    
    // 浊音
    'ga': { category: 'voiced', subcategory: 'g_line' },
    'gi': { category: 'voiced', subcategory: 'g_line' },
    'gu': { category: 'voiced', subcategory: 'g_line' },
    'ge': { category: 'voiced', subcategory: 'g_line' },
    'go': { category: 'voiced', subcategory: 'g_line' },
    
    'za': { category: 'voiced', subcategory: 'z_line' },
    'zi': { category: 'voiced', subcategory: 'z_line' },
    'zu': { category: 'voiced', subcategory: 'z_line' },
    'ze': { category: 'voiced', subcategory: 'z_line' },
    'zo': { category: 'voiced', subcategory: 'z_line' },
    
    'da': { category: 'voiced', subcategory: 'd_line' },
    'di': { category: 'voiced', subcategory: 'd_line' },
    'du': { category: 'voiced', subcategory: 'd_line' },
    'de': { category: 'voiced', subcategory: 'd_line' },
    'do': { category: 'voiced', subcategory: 'd_line' },
    
    'ba': { category: 'voiced', subcategory: 'b_line' },
    'bi': { category: 'voiced', subcategory: 'b_line' },
    'bu': { category: 'voiced', subcategory: 'b_line' },
    'be': { category: 'voiced', subcategory: 'b_line' },
    'bo': { category: 'voiced', subcategory: 'b_line' },
    
    // 半浊音
    'pa': { category: 'semi_voiced', subcategory: 'p_line' },
    'pi': { category: 'semi_voiced', subcategory: 'p_line' },
    'pu': { category: 'semi_voiced', subcategory: 'p_line' },
    'pe': { category: 'semi_voiced', subcategory: 'p_line' },
    'po': { category: 'semi_voiced', subcategory: 'p_line' },
    
    // 拗音
    'kya': { category: 'yoon', subcategory: 'k_line' },
    'kyu': { category: 'yoon', subcategory: 'k_line' },
    'kyo': { category: 'yoon', subcategory: 'k_line' },
    'gya': { category: 'yoon', subcategory: 'g_line' },
    'gyu': { category: 'yoon', subcategory: 'g_line' },
    'gyo': { category: 'yoon', subcategory: 'g_line' },
    
    'sya': { category: 'yoon', subcategory: 's_line' },
    'syu': { category: 'yoon', subcategory: 's_line' },
    'syo': { category: 'yoon', subcategory: 's_line' },
    'zya': { category: 'yoon', subcategory: 'z_line' },
    'zyu': { category: 'yoon', subcategory: 'z_line' },
    'zyo': { category: 'yoon', subcategory: 'z_line' },
    
    'tya': { category: 'yoon', subcategory: 't_line' },
    'tyu': { category: 'yoon', subcategory: 't_line' },
    'tyo': { category: 'yoon', subcategory: 't_line' },
    
    'nya': { category: 'yoon', subcategory: 'n_line' },
    'nyu': { category: 'yoon', subcategory: 'n_line' },
    'nyo': { category: 'yoon', subcategory: 'n_line' },
    
    'hya': { category: 'yoon', subcategory: 'h_line' },
    'hyu': { category: 'yoon', subcategory: 'h_line' },
    'hyo': { category: 'yoon', subcategory: 'h_line' },
    'bya': { category: 'yoon', subcategory: 'b_line' },
    'byu': { category: 'yoon', subcategory: 'b_line' },
    'byo': { category: 'yoon', subcategory: 'b_line' },
    'pya': { category: 'yoon', subcategory: 'p_line' },
    'pyu': { category: 'yoon', subcategory: 'p_line' },
    'pyo': { category: 'yoon', subcategory: 'p_line' },
    
    'mya': { category: 'yoon', subcategory: 'm_line' },
    'myu': { category: 'yoon', subcategory: 'm_line' },
    'myo': { category: 'yoon', subcategory: 'm_line' },
    
    'rya': { category: 'yoon', subcategory: 'r_line' },
    'ryu': { category: 'yoon', subcategory: 'r_line' },
    'ryo': { category: 'yoon', subcategory: 'r_line' },
  };
  
  return categoryMap[syllable] || { category: 'unknown', subcategory: 'unknown' };
}

/**
 * 统计罗马字音节频率
 * @param syllables 罗马字音节序列
 * @returns 音节频率统计
 */
export function countSyllableFrequency(syllables: string[]): Record<string, number> {
  const frequency: Record<string, number> = {};
  
  syllables.forEach(syllable => {
    frequency[syllable] = (frequency[syllable] || 0) + 1;
  });
  
  return frequency;
}

/**
 * 验证罗马字音节是否有效
 * @param syllable 罗马字音节
 * @returns 是否有效
 */
export function isValidJapaneseSyllable(syllable: string): boolean {
  const validSyllables = new Set([
    // 基本音节
    'a', 'i', 'u', 'e', 'o',
    'ka', 'ki', 'ku', 'ke', 'ko',
    'sa', 'si', 'su', 'se', 'so',
    'ta', 'ti', 'tu', 'te', 'to',
    'na', 'ni', 'nu', 'ne', 'no',
    'ha', 'hi', 'hu', 'he', 'ho',
    'ma', 'mi', 'mu', 'me', 'mo',
    'ya', 'yu', 'yo',
    'ra', 'ri', 'ru', 're', 'ro',
    'wa', 'wo', 'n',
    
    // 浊音
    'ga', 'gi', 'gu', 'ge', 'go',
    'za', 'zi', 'zu', 'ze', 'zo',
    'da', 'di', 'du', 'de', 'do',
    'ba', 'bi', 'bu', 'be', 'bo',
    
    // 半浊音
    'pa', 'pi', 'pu', 'pe', 'po',
    
    // 拗音
    'kya', 'kyu', 'kyo',
    'sya', 'syu', 'syo',
    'tya', 'tyu', 'tyo',
    'nya', 'nyu', 'nyo',
    'hya', 'hyu', 'hyo',
    'mya', 'myu', 'myo',
    'rya', 'ryu', 'ryo',
    'gya', 'gyu', 'gyo',
    'zya', 'zyu', 'zyo',
    'bya', 'byu', 'byo',
    'pya', 'pyu', 'pyo'
  ]);
  
  return validSyllables.has(syllable);
}

/**
 * 获取所有支持的日文罗马字音节
 * @returns 音节列表
 */
export function getAllJapaneseSyllables(): string[] {
  return [
    // 基本音节
    'a', 'i', 'u', 'e', 'o',
    'ka', 'ki', 'ku', 'ke', 'ko',
    'sa', 'si', 'su', 'se', 'so',
    'ta', 'ti', 'tu', 'te', 'to',
    'na', 'ni', 'nu', 'ne', 'no',
    'ha', 'hi', 'hu', 'he', 'ho',
    'ma', 'mi', 'mu', 'me', 'mo',
    'ya', 'yu', 'yo',
    'ra', 'ri', 'ru', 're', 'ro',
    'wa', 'wo', 'n',
    
    // 浊音
    'ga', 'gi', 'gu', 'ge', 'go',
    'za', 'zi', 'zu', 'ze', 'zo',
    'da', 'di', 'du', 'de', 'do',
    'ba', 'bi', 'bu', 'be', 'bo',
    
    // 半浊音
    'pa', 'pi', 'pu', 'pe', 'po',
    
    // 拗音
    'kya', 'kyu', 'kyo',
    'sya', 'syu', 'syo',
    'tya', 'tyu', 'tyo',
    'nya', 'nyu', 'nyo',
    'hya', 'hyu', 'hyo',
    'mya', 'myu', 'myo',
    'rya', 'ryu', 'ryo',
    'gya', 'gyu', 'gyo',
    'zya', 'zyu', 'zyo',
    'bya', 'byu', 'byo',
    'pya', 'pyu', 'pyo'
  ];
}

// 导出类型
export interface JapaneseRomajiResult {
  syllables: string[];
  frequency: Record<string, number>;
  categories: Record<string, { category: string; subcategory: string }>;
  isValid: boolean;
}

/**
 * 完整的日语罗马字分析
 * @param text 日语文本
 * @returns 完整的分析结果
 */
export function analyzeJapaneseText(text: string): JapaneseRomajiResult {
  const syllables = japaneseToRomaji(text);
  const frequency = countSyllableFrequency(syllables);
  const categories: Record<string, { category: string; subcategory: string }> = {};
  
  syllables.forEach(syllable => {
    categories[syllable] = getSyllableCategory(syllable);
  });
  
  const isValid = syllables.every(syllable => isValidJapaneseSyllable(syllable));
  
  return {
    syllables,
    frequency,
    categories,
    isValid,
  };
}
