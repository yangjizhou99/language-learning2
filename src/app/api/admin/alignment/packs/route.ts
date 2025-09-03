import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const db = (await requireAdmin(req)).supabase!; // 已校验管理员，使用用户上下文以适配 RLS
    const { data, error } = await db.from('alignment_packs').select('*').order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    return NextResponse.json(data||[]);
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const { lang, topic, tags=[], preferred_style={}, steps, status='draft' } = await req.json();
    if (!lang || !topic || !steps) return NextResponse.json({ error:'Missing fields' }, { status:400 });
    const db = (await requireAdmin(req)).supabase!;
    const { data, error } = await db.from('alignment_packs').insert({ lang, topic, tags, preferred_style, steps, status }).select().single();
    if (error) return NextResponse.json({ error:'Failed to create' }, { status:500 });
    return NextResponse.json({ success:true, data });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const { id, ...rest } = await req.json();
    if (!id) return NextResponse.json({ error:'Missing id' }, { status:400 });
    const db = (await requireAdmin(req)).supabase!;
    const { error } = await db.from('alignment_packs').update(rest).eq('id', id);
    if (error) return NextResponse.json({ error:'Failed to update' }, { status:500 });
    return NextResponse.json({ success:true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const db = (await requireAdmin(req)).supabase!;
    let error = null as any;
    if (id) {
      const res = await db.from('alignment_packs').delete().eq('id', id);
      error = res.error;
    } else {
      let ids: string[] | undefined = undefined;
      try {
        const body = await req.json();
        ids = Array.isArray(body?.ids) ? body.ids : undefined;
      } catch {}
      if (!ids || ids.length===0) return NextResponse.json({ error:'Missing id(s)' }, { status:400 });
      const res = await db.from('alignment_packs').delete().in('id', ids);
      error = res.error;
    }
    if (error) return NextResponse.json({ error:'Failed to delete' }, { status:500 });
    return NextResponse.json({ success:true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


