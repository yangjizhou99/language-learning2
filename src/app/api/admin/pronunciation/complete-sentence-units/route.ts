// =====================================================
// 管理页面补全句节关联 API
// POST /api/admin/pronunciation/complete-sentence-units
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/admin/pronunciation/complete-sentence-units
 * 补全句节关联
 */
export async function POST(req: NextRequest) {
  try {
    // 1. 验证用户身份
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      }) as unknown as SupabaseClient;
    } else {
      if (cookieHeader) {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(';').forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k.trim();
          const value = rest.join('=').trim();
          if (key) cookieMap.set(key, value);
        });
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      } else {
        const cookieStore = await cookies();
        supabase = createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        }) as unknown as SupabaseClient;
      }
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 2. 解析参数
    const body = await req.json();
    const lang = body.lang || 'zh-CN';
    const batchSize = body.batch_size || 50;
    
    // 验证语言参数
    if (!['zh-CN', 'en-US', 'ja-JP'].includes(lang)) {
      return NextResponse.json(
        { success: false, error: '不支持的语言，仅支持 zh-CN、en-US 和 ja-JP' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getServiceSupabase();
    
    // 3. 获取需要处理的句子
    const { data: sentences, error: sentencesError } = await supabaseAdmin
      .from('pron_sentences')
      .select('sentence_id, text, lang')
      .eq('lang', lang)
      .order('sentence_id', { ascending: true });

    if (sentencesError) {
      throw new Error(`获取句子失败: ${sentencesError.message}`);
    }

    if (!sentences || sentences.length === 0) {
      return NextResponse.json({
        success: true,
        message: `没有需要处理的${lang}句子`,
        stats: {
          total_sentences: 0,
          processed: 0,
          success: 0,
          failed: 0,
          errors: []
        }
      });
    }

    // 4. 分批处理
    const results = {
      total_sentences: sentences.length,
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);
      
      try {
        const batchResult = await processBatch(supabaseAdmin, batch, lang);
        results.processed += batch.length;
        results.success += batchResult.success;
        results.failed += batchResult.failed;
        results.errors.push(...batchResult.errors);
        
        // 批次间延迟
        if (i + batchSize < sentences.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`批次处理失败:`, error);
        results.processed += batch.length;
        results.failed += batch.length;
        results.errors.push(`批次 ${Math.floor(i / batchSize) + 1}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return NextResponse.json({
      success: true,
      stats: results,
      message: `补全完成！处理 ${results.processed} 个句子，成功 ${results.success} 个，失败 ${results.failed} 个`,
    });
  } catch (error) {
    console.error('[admin/pronunciation/complete-sentence-units] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 处理单个批次
 */
async function processBatch(supabaseAdmin: any, sentences: any[], lang: string) {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const sentence of sentences) {
    try {
      let generatedUnits = 0;

      if (lang === 'zh-CN') {
        // 中文：使用 pinyin 库
        const pinyinLib = (await import('pinyin')).default;
        const { data: units } = await supabaseAdmin
          .from('unit_catalog')
          .select('unit_id, symbol')
          .eq('lang', 'zh-CN');

        const unitIdMap = new Map<string, number>();
        for (const unit of units || []) {
          unitIdMap.set(unit.symbol, unit.unit_id);
        }

        const pinyinResult = pinyinLib(sentence.text, {
          style: pinyinLib.STYLE_TONE2,
          heteronym: false,
          segment: true,
        });

        const pinyinMap = new Map<string, number>();
        pinyinResult.forEach((item: any) => {
          if (item && item[0]) {
            const normalized = item[0].toLowerCase().replace(/^([a-z]+)([1-5])$/, '$1 $2');
            pinyinMap.set(normalized, (pinyinMap.get(normalized) || 0) + 1);
          }
        });

        const insertUnits = [];
        for (const [symbol, count] of pinyinMap.entries()) {
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
          await supabaseAdmin
            .from('sentence_units')
            .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
          generatedUnits = insertUnits.length;
        }
      } else if (lang === 'en-US') {
        // 英语：使用英语音素提取工具
        const { extractEnglishPhonemesFromDict } = await import('@/lib/pronunciation/english-phoneme-extractor');
        const { data: units } = await supabaseAdmin
          .from('unit_catalog')
          .select('unit_id, symbol')
          .eq('lang', 'en-US');

        const unitIdMap = new Map<string, number>();
        for (const unit of units || []) {
          unitIdMap.set(unit.symbol, unit.unit_id);
        }

        // 将句子按单词分割，然后提取每个单词的音素
        const words = sentence.text
          .toLowerCase()
          .split(/\s+/)
          .filter((word: string) => word.length > 0);
        const allPhonemes: string[] = [];
        
        for (const word of words) {
          const wordPhonemes = extractEnglishPhonemesFromDict(word);
          allPhonemes.push(...wordPhonemes);
        }
        
        const phonemeMap = new Map<string, number>();
        allPhonemes.forEach(phoneme => {
          phonemeMap.set(phoneme, (phonemeMap.get(phoneme) || 0) + 1);
        });

        const insertUnits = [];
        for (const [symbol, count] of phonemeMap.entries()) {
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
          await supabaseAdmin
            .from('sentence_units')
            .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
          generatedUnits = insertUnits.length;
        }
      } else if (lang === 'ja-JP') {
        // 日语：使用新的罗马音G2P工具
        const { japaneseToRomaji } = await import('@/lib/pronunciation/japanese-romaji-extractor');
        const { data: units } = await supabaseAdmin
          .from('unit_catalog')
          .select('unit_id, symbol')
          .eq('lang', 'ja-JP');

        const unitIdMap = new Map<string, number>();
        for (const unit of units || []) {
          unitIdMap.set(unit.symbol, unit.unit_id);
        }

        const romajiSyllables = japaneseToRomaji(sentence.text);
        
        const syllableMap = new Map<string, number>();
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
          await supabaseAdmin
            .from('sentence_units')
            .upsert(insertUnits, { onConflict: 'sentence_id,unit_id' });
          generatedUnits = insertUnits.length;
        }
      }

      if (generatedUnits > 0) {
        result.success++;
      } else {
        result.failed++;
        result.errors.push(`句子 ${sentence.sentence_id}: 未找到匹配的音节`);
      }
    } catch (error) {
      result.failed++;
      result.errors.push(`句子 ${sentence.sentence_id}: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  return result;
}
