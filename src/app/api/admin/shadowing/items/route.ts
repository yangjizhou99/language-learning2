import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const db = getServiceSupabase();
    const { data, error } = await db
      .from('shadowing_items')
      .select(`
        *,
        shadowing_themes(title),
        shadowing_subtopics(title_cn)
      `)
      .order('shadowing_themes(title)', { ascending: true, nullsFirst: false })
      .order('shadowing_subtopics(title_cn)', { ascending: true, nullsFirst: false })
      .order('title', { ascending: true });
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
    const { lang, title, text, audio_url } = await req.json();
    if (!lang || !title || !text || !audio_url) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const db = getServiceSupabase();
    const { data, error } = await db.from('shadowing_items').insert({ lang, title, text, audio_url, level:3 }).select().single();
    if (error) return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
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
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const db = getServiceSupabase();
    const { error } = await db.from('shadowing_items').update(rest).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    return NextResponse.json({ success:true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason==='unauthorized'?401:403 });
    const { updates } = await req.json();
    if (!Array.isArray(updates) || updates.length === 0) return NextResponse.json({ error: 'Missing updates array' }, { status: 400 });
    
    const db = getServiceSupabase();
    let successCount = 0;
    
    // 批量更新每个项目
    for (const update of updates) {
      if (!update.id || !update.title) continue;
      
      const { error } = await db
        .from('shadowing_items')
        .update({ title: update.title })
        .eq('id', update.id);
      
      if (!error) {
        successCount++;
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      updated_count: successCount,
      total_requested: updates.length 
    });
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
    const db = getServiceSupabase();
    let error = null as any;
    if (id) {
      const res = await db.from('shadowing_items').delete().eq('id', id);
      error = res.error;
    } else {
      let ids: string[] | undefined = undefined;
      try { const body = await req.json(); ids = Array.isArray(body?.ids) ? body.ids : undefined; } catch {}
      if (!ids || ids.length===0) return NextResponse.json({ error:'Missing id(s)' }, { status:400 });
      const res = await db.from('shadowing_items').delete().in('id', ids);
      error = res.error;
    }
    if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ success:true });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


