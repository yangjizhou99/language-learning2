import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { themeId: string } }
) {
  try {
    const { themeId } = params;

    if (!themeId) {
      return NextResponse.json({ error: '主题ID不能为空' }, { status: 400 });
    }

    // 获取指定主题下的所有题目
    const { data: topics, error } = await supabase
      .from('shadowing_topics')
      .select('*')
      .eq('theme_id', themeId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取题目失败:', error);
      return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      topics: topics || [],
      count: topics?.length || 0
    });

  } catch (error) {
    console.error('获取题目API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}