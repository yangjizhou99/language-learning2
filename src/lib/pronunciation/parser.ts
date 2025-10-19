// =====================================================
// AI发音纠正系统 - Azure 结果解析工具
// =====================================================

import type { AzureResult, ParsedAzureResult, AzurePhoneme, AzureWord } from '@/types/pronunciation';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

/**
 * 解析 Azure Speech SDK 返回的 JSON
 * 容错处理多种字段命名（大小写变体）
 * @param json Azure 返回的原始 JSON
 * @returns 解析后的结果
 */
export function parseAzureResult(json: AzureResult): ParsedAzureResult {
  // 获取 NBest[0] 或 nBest[0]
  const nbest0 = json?.NBest?.[0] ?? json?.nBest?.[0];
  
  // 获取句级评测数据
  const pa = 
    nbest0?.PronunciationAssessment || 
    nbest0?.pronunciationAssessment || 
    json?.PronunciationAssessment;

  // 提取句级分数
  const accuracy = Number(pa?.AccuracyScore ?? pa?.accuracyScore ?? 0);
  const fluency = Number(pa?.FluencyScore ?? pa?.fluencyScore ?? 0);
  const completeness = Number(pa?.CompletenessScore ?? pa?.completenessScore ?? 0);
  const prosody = pa?.ProsodyScore ?? pa?.prosodyScore;
  const pronScore = Number(pa?.PronScore ?? pa?.pronScore ?? 0);

  // 提取音素级数据
  const units: Array<{ symbol: string; score: number }> = [];
  const words = nbest0?.Words || nbest0?.words || [];

  for (const word of words) {
    const phonemes = word?.Phonemes || word?.phonemes || [];
    
    if (Array.isArray(phonemes) && phonemes.length > 0) {
      // 有音素级数据
      for (const phoneme of phonemes) {
        const symbol = String(phoneme?.Phoneme || phoneme?.phoneme || '').trim();
        
        // 提取分数（优先从音素级，回退到词级）
        let score = Number(phoneme?.PronunciationAssessment?.AccuracyScore ?? phoneme?.pronunciationAssessment?.accuracyScore);
        
        // 如果音素级分数无效，使用词级分数
        if (!score || isNaN(score)) {
          score = Number(word?.PronunciationAssessment?.AccuracyScore ?? word?.pronunciationAssessment?.accuracyScore ?? 0);
        }
        
        if (symbol && score > 0) {
          units.push({ symbol, score });
        }
      }
    } else {
      // 没有音素级数据，使用词级分数（回退方案）
      // 注意：中文应该总是有 Phonemes，如果到这里说明 Azure 返回异常
      const wordText = (word?.Word || word?.word || '').toString();
      const wordScore = Number(
        word?.PronunciationAssessment?.AccuracyScore ??
        word?.pronunciationAssessment?.accuracyScore ??
        0
      );
      
      // 只有在分数有效时才添加（避免创建 mean=0 的垃圾数据）
      if (wordText && wordScore > 0) {
        units.push({ symbol: wordText, score: wordScore });
      }
    }
  }

  return {
    accuracy,
    fluency,
    completeness,
    prosody: prosody !== undefined ? Number(prosody) : undefined,
    pronScore,
    units,
  };
}

/**
 * 将音素/词聚合到拼音音节 Unit
 * 中文：尝试将词级数据映射到拼音音节（需要 G2P，这里简化处理）
 * @param units 解析出的 units（音素或词）
 * @param lang 语言
 * @returns 聚合后的 Unit 数据（symbol → 平均分）
 */
export function aggregateToUnits(
  units: Array<{ symbol: string; score: number }>,
  lang: string
): Map<string, { sum: number; cnt: number }> {
  const bySymbol = new Map<string, { sum: number; cnt: number }>();

  for (const unit of units) {
    // 中文简化处理：直接使用 symbol（后续可集成 G2P）
    // 英文/日文：使用音素符号
    const symbol = normalizeSymbol(unit.symbol, lang);
    
    if (!symbol) continue;

    const existing = bySymbol.get(symbol) || { sum: 0, cnt: 0 };
    existing.sum += unit.score;
    existing.cnt += 1;
    bySymbol.set(symbol, existing);
  }

  return bySymbol;
}

/**
 * 规范化符号（处理大小写、特殊字符）
 * @param symbol 原始符号
 * @param lang 语言
 * @returns 规范化后的符号
 */
function normalizeSymbol(symbol: string, lang: string): string {
  if (!symbol) return '';
  
  // 移除前后空格，转小写
  let normalized = symbol.trim().toLowerCase();
  
  if (lang === 'zh-CN') {
    // 中文：保留 Azure 原始格式（如 "guo 2"）
    // 统一多个空格为单个空格
    normalized = normalized.replace(/\s+/g, ' ');
    return normalized;
  } else if (lang === 'en-US') {
    // 英语：映射Azure音素到标准IPA
    return mapAzureToIPA(normalized);
  }
  
  // 其他语言：移除非字母字符
  normalized = normalized.replace(/[^a-z]/g, '');
  
  return normalized;
}

/**
 * 将Azure英语音素映射到标准IPA
 */
function mapAzureToIPA(azureSymbol: string): string {
  // Azure直接返回标准IPA符号，不需要映射
  // 根据测试结果，Azure返回的音素格式已经是标准IPA
  return azureSymbol;
}

/**
 * 从数据库获取或创建 Unit ID
 * @param lang 语言
 * @param symbol 符号
 * @returns Unit ID
 */
export async function ensureUnitId(lang: string, symbol: string): Promise<number> {
  const supabase = getServiceSupabase();

  // 首先尝试从 unit_catalog 查找
  const { data: found, error: findError } = await supabase
    .from('unit_catalog')
    .select('unit_id')
    .eq('lang', lang)
    .eq('symbol', symbol)
    .maybeSingle();

  if (findError) {
    throw new Error(`查找 Unit 失败: ${findError.message}`);
  }

  if (found) {
    return found.unit_id as number;
  }

  // 如果不存在，创建新的 Unit
  const unitType = lang === 'zh-CN' ? 'syllable' : 'phoneme';
  
  const { data: inserted, error: insertError } = await supabase
    .from('unit_catalog')
    .insert({ lang, symbol, unit_type: unitType })
    .select('unit_id')
    .single();

  if (insertError) {
    throw new Error(`创建 Unit 失败: ${insertError.message}`);
  }

  return inserted.unit_id as number;
}

/**
 * 尝试通过别名查找 Unit ID
 * @param lang 语言
 * @param alias 别名
 * @returns Unit ID 或 null
 */
export async function findUnitIdByAlias(lang: string, alias: string): Promise<number | null> {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from('unit_alias')
    .select('unit_id')
    .eq('lang', lang)
    .eq('alias', alias)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.unit_id as number;
}

/**
 * 获取 Unit ID（优先查找别名，再查找正式名称，最后创建）
 * @param lang 语言
 * @param symbol 符号
 * @returns Unit ID
 */
export async function getOrCreateUnitId(lang: string, symbol: string): Promise<number> {
  // 1. 尝试通过别名查找
  const aliasId = await findUnitIdByAlias(lang, symbol);
  if (aliasId) return aliasId;

  // 2. 通过正式名称查找或创建
  return ensureUnitId(lang, symbol);
}

/**
 * 批量获取或创建 Unit IDs
 * @param lang 语言
 * @param symbols 符号数组
 * @returns Symbol → Unit ID 的映射
 */
export async function batchGetOrCreateUnitIds(
  lang: string,
  symbols: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  
  // 去重
  const uniqueSymbols = Array.from(new Set(symbols));

  // 批量查询现有的 Units
  const supabase = getServiceSupabase();
  const { data: existing } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', lang)
    .in('symbol', uniqueSymbols);

  if (existing) {
    for (const item of existing) {
      result.set(item.symbol, item.unit_id);
    }
  }

  // 创建不存在的 Units
  const missing = uniqueSymbols.filter(s => !result.has(s));
  if (missing.length > 0) {
    const unitType = lang === 'zh-CN' ? 'syllable' : 'phoneme';
    const toInsert = missing.map(symbol => ({ lang, symbol, unit_type: unitType }));

    const { data: inserted } = await supabase
      .from('unit_catalog')
      .insert(toInsert)
      .select('unit_id, symbol');

    if (inserted) {
      for (const item of inserted) {
        result.set(item.symbol, item.unit_id);
      }
    }
  }

  return result;
}

