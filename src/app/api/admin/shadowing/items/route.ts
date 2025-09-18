import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const supabaseAdmin = getServiceSupabase();

    // 获取分页参数
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '1000'); // 默认获取更多数据用于导出
    const offset = (page - 1) * limit;
    const lang = searchParams.get('lang');
    const level = searchParams.get('level');

    // 构建查询
    let query = supabaseAdmin
      .from('shadowing_items')
      .select('*')
      .order('created_at', { ascending: false });

    // 添加筛选条件
    if (lang && lang !== 'all') {
      query = query.eq('lang', lang);
    }
    if (level && level !== 'all') {
      query = query.eq('level', parseInt(level));
    }

    const { data: items, error } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching shadowing items:', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // 添加状态字段（shadowing_items没有status字段，我们添加一个默认值）
    const itemsWithStatus = (items || []).map((item) => ({
      ...item,
      status: 'approved', // shadowing_items默认为已审核状态
    }));

    // 获取总数用于分页信息
    let countQuery = supabaseAdmin
      .from('shadowing_items')
      .select('*', { count: 'exact', head: true });

    if (lang && lang !== 'all') {
      countQuery = countQuery.eq('lang', lang);
    }
    if (level && level !== 'all') {
      countQuery = countQuery.eq('level', parseInt(level));
    }

    const { count } = await countQuery;

    return NextResponse.json({
      items: itemsWithStatus,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Error in shadowing items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
