import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') || 'all';
    const category = searchParams.get('category') || 'all';
    
    const supabase = getServiceSupabase();
    
    // 构建查询条件
    let query = supabase
      .from('voices')
      .select('*')
      .eq('is_active', true)
      .order('language_code', { ascending: true })
      .order('name', { ascending: true });
    
    // 语言筛选
    if (lang !== 'all') {
      if (lang === 'cmn-CN') {
        // 中文音色包含简体和繁体
        query = query.in('language_code', ['cmn-CN', 'cmn-TW']);
      } else if (lang === 'en-US') {
        query = query.eq('language_code', 'en-US');
      } else if (lang === 'ja-JP') {
        query = query.eq('language_code', 'ja-JP');
      } else {
        query = query.eq('language_code', lang);
      }
    }
    
    // 分类筛选
    if (category !== 'all') {
      query = query.eq('category', category);
    }
    
    const { data: voices, error } = await query;
    
    if (error) {
      console.error('获取音色数据失败:', error);
      return NextResponse.json({ 
        success: false, 
        error: '获取音色数据失败', 
        details: error.message 
      }, { status: 500 });
    }
    
    if (!voices || voices.length === 0) {
      return NextResponse.json({
        success: true,
        voices: [],
        totalVoices: 0,
        message: '没有找到音色数据，请先同步音色'
      });
    }
    
    // 按分类分组
    const categorizedVoices = voices.reduce((acc: any, voice: any) => {
      const category = voice.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(voice);
      return acc;
    }, {});
    
    // 按语言分组统计
    const groupedByLanguage = voices.reduce((acc: any, voice: any) => {
      const lang = voice.language_code;
      if (!acc[lang]) {
        acc[lang] = 0;
      }
      acc[lang]++;
      return acc;
    }, {});
    
    console.log(`从数据库获取到 ${voices.length} 个音色`);
    console.log('语言分布:', groupedByLanguage);
    console.log('分类分布:', Object.keys(categorizedVoices).reduce((acc: any, key: any) => {
      acc[key] = categorizedVoices[key].length;
      return acc;
    }, {}));
    
    return NextResponse.json({
      success: true,
      voices,
      totalVoices: voices.length,
      categorizedVoices,
      groupedByLanguage,
      filters: {
        language: lang,
        category: category
      }
    });
    
  } catch (error) {
    console.error('获取音色数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: '获取音色数据失败', 
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
