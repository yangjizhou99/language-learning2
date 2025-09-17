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

    const { data: items, error } = await supabaseAdmin
      .from('cloze_items')
      .select('id,lang,level,topic,title,created_at,updated_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching cloze items:', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // 获取总数用于分页信息
    const { count } = await supabaseAdmin
      .from('cloze_items')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      data: items || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error in cloze items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const supabaseAdmin = getServiceSupabase();

    let error = null as any;
    if (id) {
      const res = await supabaseAdmin.from('cloze_items').delete().eq('id', id);
      error = res.error;
    } else {
      // 批量删除: 接收 { ids: string[] }
      let ids: string[] | undefined = undefined;
      try {
        const body = await req.json();
        ids = Array.isArray(body?.ids) ? body.ids : undefined;
      } catch {}
      if (!ids || ids.length === 0) {
        return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });
      }
      const res = await supabaseAdmin.from('cloze_items').delete().in('id', ids);
      error = res.error;
    }

    if (error) {
      console.error('Error deleting cloze item:', error);
      return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in cloze items DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const body = await req.json();
    const { id, title, passage, blanks, topic } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabaseAdmin = getServiceSupabase();
    const { error } = await supabaseAdmin
      .from('cloze_items')
      .update({ title, passage, blanks, topic })
      .eq('id', id);

    if (error) {
      console.error('Error updating cloze item:', error);
      return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in cloze items PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const body = await req.json();
    const { lang, level, topic = '', title, passage, blanks } = body || {};
    if (!lang || !level || !title || !passage || !Array.isArray(blanks) || blanks.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
    }

    const supabaseAdmin = getServiceSupabase();
    const { data, error } = await supabaseAdmin
      .from('cloze_items')
      .insert({ lang, level, topic, title, passage, blanks })
      .select()
      .single();

    if (error) {
      console.error('Error creating cloze item:', error);
      return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in cloze items POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}