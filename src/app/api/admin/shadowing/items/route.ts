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

export async function PUT(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const supabaseAdmin = getServiceSupabase();
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json({ error: 'missing id' }, { status: 400 });
    }

    const { id, ...rest } = body;
    const { error } = await supabaseAdmin.from('shadowing_items').update(rest).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'update failed' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const supabaseAdmin = getServiceSupabase();
    const body = await req.json();
    const updates: Array<{ id: string; [k: string]: any }> = Array.isArray(body?.updates)
      ? body.updates
      : [];
    if (!updates.length) return NextResponse.json({ error: 'no updates' }, { status: 400 });

    // 逐条更新，确保简单可靠
    for (const u of updates) {
      const { id, ...rest } = u;
      if (!id) continue;
      const { error } = await supabaseAdmin.from('shadowing_items').update(rest).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'patch failed' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const supabaseAdmin = getServiceSupabase();
    const url = new URL(req.url);
    const singleId = url.searchParams.get('id');
    const body = await req.json().catch(() => ({}));
    const idsInput: string[] = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    const ids: string[] = singleId ? [singleId] : idsInput;

    if (!ids.length) {
      return NextResponse.json({ error: 'no ids' }, { status: 400 });
    }

    // 分批处理，避免 PostgREST URL 过长（414）
    const batchSize = 50;
    const total = ids.length;
    const errors: Array<{ step: string; message: string; batchStart: number; batchEnd: number }> = [];
    let deletedCount = 0;

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      // 先尝试清理潜在引用（忽略错误继续）
      try {
        await supabaseAdmin.from('shadowing_attempts').delete().in('item_id', chunk);
      } catch (e) {
        errors.push({ step: 'delete_attempts', message: e instanceof Error ? e.message : String(e), batchStart: i, batchEnd: i + chunk.length - 1 });
      }
      try {
        await supabaseAdmin.from('shadowing_sessions').delete().in('item_id', chunk);
      } catch (e) {
        errors.push({ step: 'delete_sessions', message: e instanceof Error ? e.message : String(e), batchStart: i, batchEnd: i + chunk.length - 1 });
      }

      const { error } = await supabaseAdmin.from('shadowing_items').delete().in('id', chunk);
      if (error) {
        errors.push({ step: 'delete_items', message: error.message, batchStart: i, batchEnd: i + chunk.length - 1 });
      } else {
        deletedCount += chunk.length;
      }
    }

    const ok = errors.length === 0;
    const status = ok ? 200 : 207; // Multi-Status 风格，部分失败
    return NextResponse.json(
      { ok, requested: total, deleted: deletedCount, batches: Math.ceil(total / batchSize), errors },
      { status },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'delete failed' },
      { status: 500 },
    );
  }
}
