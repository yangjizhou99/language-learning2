import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 检查 shadowing_drafts 表
    const { data: drafts, error: draftsError } = await supabase
      .from('shadowing_drafts')
      .select('id, lang, level, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 检查 shadowing_items 表
    const { data: items, error: itemsError } = await supabase
      .from('shadowing_items')
      .select('id, lang, level, title, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    // 检查 shadowing_themes 表
    const { data: themes, error: themesError } = await supabase
      .from('shadowing_themes')
      .select('id, title, lang, level, status')
      .limit(10);
    
    // 检查 shadowing_subtopics 表
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('shadowing_subtopics')
      .select('id, title_cn, theme_id')
      .limit(10);

    return NextResponse.json({
      success: true,
      data: {
        drafts: {
          count: drafts?.length || 0,
          data: drafts,
          error: draftsError?.message
        },
        items: {
          count: items?.length || 0,
          data: items,
          error: itemsError?.message
        },
        themes: {
          count: themes?.length || 0,
          data: themes,
          error: themesError?.message
        },
        subtopics: {
          count: subtopics?.length || 0,
          data: subtopics,
          error: subtopicsError?.message
        }
      }
    });

  } catch (error) {
    console.error('Debug shadowing data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
