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
    const limit = parseInt(searchParams.get('limit') || '1000'); // 默认获取更多数据用于导出
    const offset = (page - 1) * limit;
    const lang = searchParams.get('lang');
    const level = searchParams.get('level');

    // 构建查询
    let query = supabaseAdmin
      .from('alignment_packs')
      .select('*')
      .order('created_at', { ascending: false });

    // 添加筛选条件
    if (lang && lang !== 'all') {
      query = query.eq('lang', lang);
    }
    if (level && level !== 'all') {
      query = query.eq('level', parseInt(level));
    }

    const { data: items, error } = await query
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching alignment packs:', error);
      return NextResponse.json({ error: 'Failed to fetch packs' }, { status: 500 });
    }

    // 转换alignment_packs字段以匹配前端期望的格式
    const itemsWithMappedFields = (items || []).map(item => ({
      ...item,
      level: item.level_min || 1, // 使用level_min作为level
      text: item.steps ? JSON.stringify(item.steps) : '', // 将steps转换为text字段
      passage: item.steps ? JSON.stringify(item.steps) : '', // 同样映射到passage
      status: item.status || 'draft'
    }));

    // 获取总数用于分页信息
    let countQuery = supabaseAdmin
      .from('alignment_packs')
      .select('*', { count: 'exact', head: true });

    if (lang && lang !== 'all') {
      countQuery = countQuery.eq('lang', lang);
    }
    if (level && level !== 'all') {
      countQuery = countQuery.eq('level', parseInt(level));
    }

    const { count } = await countQuery;

    return NextResponse.json({
      items: itemsWithMappedFields,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Error in alignment packs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}