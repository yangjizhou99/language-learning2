import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const supabaseAdmin = getServiceSupabase();
    // 获取分页参数
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data: drafts, error } = await supabaseAdmin
      .from('cloze_drafts')
      .select('id,lang,level,topic,title,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching cloze drafts:', error);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    // 获取总数用于分页信息
    const { count } = await supabaseAdmin
      .from('cloze_drafts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      data: drafts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in cloze drafts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
