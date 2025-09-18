import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok)
      return NextResponse.json(
        { error: auth.reason },
        { status: auth.reason === 'unauthorized' ? 401 : 403 },
      );
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('articles')
      .select('id,lang,genre,difficulty,title,created_at')
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok)
      return NextResponse.json(
        { error: auth.reason },
        { status: auth.reason === 'unauthorized' ? 401 : 403 },
      );
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const db = getServiceSupabase();
    let error = null as any;
    if (id) {
      const res = await db.from('articles').delete().eq('id', id);
      error = res.error;
    } else {
      let ids: string[] | undefined = undefined;
      try {
        const body = await req.json();
        ids = Array.isArray(body?.ids) ? body.ids : undefined;
      } catch {}
      if (!ids || ids.length === 0)
        return NextResponse.json({ error: 'Missing id(s)' }, { status: 400 });
      const res = await db.from('articles').delete().in('id', ids);
      error = res.error;
    }
    if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok)
      return NextResponse.json(
        { error: auth.reason },
        { status: auth.reason === 'unauthorized' ? 401 : 403 },
      );
    const body = await req.json();
    const { id, title, genre, difficulty } = body || {};
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getServiceSupabase();
    const { error } = await db.from('articles').update({ title, genre, difficulty }).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
