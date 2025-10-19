/**
 * 英语音素提取器
 * 用于将英语句子转换为IPA音素并映射到unit_catalog
 */

import { getServiceSupabase } from '@/lib/supabaseAdmin';

// Azure Speech Service 直接返回标准IPA符号，无需映射
// 根据实际测试结果，Azure返回的音素格式已经是标准IPA
const AZURE_PHONEME_MAPPING: Record<string, string> = {
  // Azure直接返回标准IPA，这里保留空映射表作为备用
};

/**
 * 从Azure返回的JSON中提取英语音素
 */
export function extractEnglishPhonemesFromAzure(azureResult: any): string[] {
  const phonemes: string[] = [];
  
  try {
    if (azureResult?.NBest?.[0]?.Words) {
      for (const word of azureResult.NBest[0].Words) {
        if (word.Phonemes) {
          for (const phoneme of word.Phonemes) {
            if (phoneme.Phoneme && phoneme.PronunciationAssessment?.AccuracyScore > 0) {
              // Azure直接返回标准IPA符号，直接使用
              const standardSymbol = phoneme.Phoneme;
              phonemes.push(standardSymbol);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('提取英语音素失败:', error);
  }
  
  return phonemes;
}

/**
 * 使用词典映射提取英语音素（备用方案）
 */
export function extractEnglishPhonemesFromDict(word: string): string[] {
  // 简化的词典映射，实际应用中可以使用更完整的词典
  const dict: Record<string, string[]> = {
    'hello': ['h', 'ə', 'l', 'oʊ'],
    'world': ['w', 'ɜ', 'r', 'l', 'd'],
    'good': ['g', 'ʊ', 'd'],
    'morning': ['m', 'ɔ', 'r', 'n', 'ɪ', 'ŋ'],
    'thank': ['θ', 'æ', 'ŋ', 'k'],
    'you': ['j', 'u'],
    'the': ['ð', 'ə'],
    'is': ['ɪ', 'z'],
    'and': ['æ', 'n', 'd'],
    'in': ['ɪ', 'n'],
    'to': ['t', 'u'],
    'of': ['ʌ', 'v'],
    'a': ['ə'],
    'that': ['ð', 'æ', 't'],
    'it': ['ɪ', 't'],
    'with': ['w', 'ɪ', 'ð'],
    'for': ['f', 'ɔ', 'r'],
    'as': ['æ', 'z'],
    'was': ['w', 'ʌ', 'z'],
    'on': ['ɑ', 'n'],
    'are': ['ɑ', 'r'],
    'but': ['b', 'ʌ', 't'],
    'from': ['f', 'r', 'ʌ', 'm'],
    'they': ['ð', 'eɪ'],
    'she': ['ʃ', 'i'],
    'or': ['ɔ', 'r'],
    'an': ['æ', 'n'],
    'will': ['w', 'ɪ', 'l'],
    'my': ['m', 'aɪ'],
    'one': ['w', 'ʌ', 'n'],
    'all': ['ɔ', 'l'],
    'would': ['w', 'ʊ', 'd'],
    'there': ['ð', 'ɛ', 'r'],
    'their': ['ð', 'ɛ', 'r'],
    'what': ['w', 'ʌ', 't'],
    'so': ['s', 'oʊ'],
    'up': ['ʌ', 'p'],
    'out': ['aʊ', 't'],
    'if': ['ɪ', 'f'],
    'about': ['ə', 'b', 'aʊ', 't'],
    'who': ['h', 'u'],
    'get': ['g', 'ɛ', 't'],
    'which': ['w', 'ɪ', 'tʃ'],
    'go': ['g', 'oʊ'],
    'me': ['m', 'i'],
    'when': ['w', 'ɛ', 'n'],
    'make': ['m', 'eɪ', 'k'],
    'can': ['k', 'æ', 'n'],
    'like': ['l', 'aɪ', 'k'],
    'time': ['t', 'aɪ', 'm'],
    'no': ['n', 'oʊ'],
    'just': ['dʒ', 'ʌ', 's', 't'],
    'him': ['h', 'ɪ', 'm'],
    'know': ['n', 'oʊ'],
    'take': ['t', 'eɪ', 'k'],
    'people': ['p', 'i', 'p', 'ə', 'l'],
    'into': ['ɪ', 'n', 't', 'u'],
    'year': ['j', 'ɪ', 'r'],
    'your': ['j', 'ɔ', 'r'],
    'some': ['s', 'ʌ', 'm'],
    'could': ['k', 'ʊ', 'd'],
    'them': ['ð', 'ɛ', 'm'],
    'see': ['s', 'i'],
    'other': ['ʌ', 'ð', 'ə', 'r'],
    'than': ['ð', 'æ', 'n'],
    'then': ['ð', 'ɛ', 'n'],
    'now': ['n', 'aʊ'],
    'look': ['l', 'ʊ', 'k'],
    'only': ['oʊ', 'n', 'l', 'i'],
    'come': ['k', 'ʌ', 'm'],
    'its': ['ɪ', 't', 's'],
    'over': ['oʊ', 'v', 'ə', 'r'],
    'think': ['θ', 'ɪ', 'ŋ', 'k'],
    'also': ['ɔ', 'l', 's', 'oʊ'],
    'back': ['b', 'æ', 'k'],
    'after': ['æ', 'f', 't', 'ə', 'r'],
    'use': ['j', 'u', 'z'],
    'two': ['t', 'u'],
    'how': ['h', 'aʊ'],
    'our': ['aʊ', 'r'],
    'work': ['w', 'ɜ', 'r', 'k'],
    'first': ['f', 'ɜ', 'r', 's', 't'],
    'well': ['w', 'ɛ', 'l'],
    'way': ['w', 'eɪ'],
    'even': ['i', 'v', 'ɛ', 'n'],
    'new': ['n', 'u'],
    'want': ['w', 'ɑ', 'n', 't'],
    'because': ['b', 'ɪ', 'k', 'ɔ', 'z'],
    'any': ['ɛ', 'n', 'i'],
    'these': ['ð', 'i', 'z'],
    'give': ['g', 'ɪ', 'v'],
    'day': ['d', 'eɪ'],
    'most': ['m', 'oʊ', 's', 't'],
    'us': ['ʌ', 's']
  };

  const lowerWord = word.toLowerCase().replace(/[^\w]/g, '');
  return dict[lowerWord] || [];
}

/**
 * 为英语句子生成sentence_units关联
 */
export async function generateEnglishSentenceUnits(sentenceId: number, text: string): Promise<number> {
  try {
    const supabase = getServiceSupabase();
    
    // 获取英语音素映射
    const { data: units } = await supabase
      .from('unit_catalog')
      .select('unit_id, symbol')
      .eq('lang', 'en-US');

    if (!units) {
      throw new Error('未找到英语音素数据');
    }

    const unitIdMap = new Map<string, number>();
    for (const unit of units) {
      unitIdMap.set(unit.symbol, unit.unit_id);
    }

    // 分词并提取音素
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    const phonemeMap = new Map<string, number>();

    for (const word of words) {
      const phonemes = extractEnglishPhonemesFromDict(word);
      for (const phoneme of phonemes) {
        phonemeMap.set(phoneme, (phonemeMap.get(phoneme) || 0) + 1);
      }
    }

    // 插入sentence_units
    const insertUnits = [];
    for (const [symbol, count] of phonemeMap.entries()) {
      const unitId = unitIdMap.get(symbol);
      if (unitId) {
        insertUnits.push({
          sentence_id: sentenceId,
          unit_id: unitId,
          count,
        });
      }
    }

    if (insertUnits.length > 0) {
      const { error } = await supabase
        .from('sentence_units')
        .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
      
      if (error) {
        throw new Error(`插入sentence_units失败: ${error.message}`);
      }
    }

    return insertUnits.length;
  } catch (error) {
    console.error('生成英语sentence_units失败:', error);
    throw error;
  }
}

/**
 * 批量生成英语句子的sentence_units
 */
export async function batchGenerateEnglishSentenceUnits(sentenceIds: number[]): Promise<{ success: number; failed: number; errors: string[] }> {
  const supabase = getServiceSupabase();
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  for (const sentenceId of sentenceIds) {
    try {
      // 获取句子文本
      const { data: sentence, error: fetchError } = await supabase
        .from('pron_sentences')
        .select('text')
        .eq('sentence_id', sentenceId)
        .eq('lang', 'en-US')
        .single();

      if (fetchError || !sentence) {
        errors.push(`句子${sentenceId}: 获取失败`);
        failed++;
        continue;
      }

      await generateEnglishSentenceUnits(sentenceId, sentence.text);
      success++;
    } catch (error) {
      errors.push(`句子${sentenceId}: ${error instanceof Error ? error.message : '未知错误'}`);
      failed++;
    }
  }

  return { success, failed, errors };
}

/**
 * 验证英语音素提取结果
 */
export function validateEnglishPhonemes(phonemes: string[]): { valid: string[]; invalid: string[] } {
  const validPhonemes = [
    // 短元音
    'ɪ', 'ɛ', 'æ', 'ʌ', 'ʊ', 'ə',
    // 长元音
    'i', 'e', 'ɑ', 'ɔ', 'u', 'ɚ',
    // 双元音
    'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'ɪə', 'ɛə', 'ʊə',
    // 组合音素
    'ɪɹ', 'ju',
    // 辅音
    'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z',
    'ʃ', 'ʒ', 'h', 'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'ɹ', 'r', 'w', 'j'
  ];

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const phoneme of phonemes) {
    if (validPhonemes.includes(phoneme)) {
      valid.push(phoneme);
    } else {
      invalid.push(phoneme);
    }
  }

  return { valid, invalid };
}
