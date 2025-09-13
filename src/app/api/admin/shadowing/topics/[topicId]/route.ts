import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { topicId: string } }
) {
  try {
    const { topicId } = params;

    if (!topicId) {
      return NextResponse.json({ error: '题目ID不能为空' }, { status: 400 });
    }

    // 删除指定的题目
    const { error } = await supabase
      .from('shadowing_topics')
      .delete()
      .eq('id', topicId);

    if (error) {
      console.error('删除题目失败:', error);
      return NextResponse.json({ error: '删除题目失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '题目删除成功'
    });

  } catch (error) {
    console.error('删除题目API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
