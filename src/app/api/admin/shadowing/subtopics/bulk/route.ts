import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  
  const supabase = auth.supabase;
  const body = await req.json();
  const { action, items } = body;
  
  if (!Array.isArray(items) || !items.length) {
    return NextResponse.json({ error: 'no items' }, { status: 400 });
  }
  
  const user = (await supabase.auth.getUser()).data.user;
  const now = new Date().toISOString();
  
  if (action === 'upsert') {
    const rows = items.map(item => ({
      ...item,
      updated_at: now,
      created_by: item.created_by || user?.id
    }));
    
    const { error } = await supabase
      .from('shadowing_subtopics')
      .upsert(rows, { onConflict: 'id' });
    
    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
    
    return NextResponse.json({ ok: true, count: rows.length });
  }
  
  if (action === 'archive') {
    const ids = items.map(x => x.id).filter(Boolean);
    const { error } = await supabase
      .from('shadowing_subtopics')
      .update({ 
        status: 'archived', 
        updated_at: now 
      })
      .in('id', ids);
    
    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
    
    return NextResponse.json({ ok: true, count: ids.length });
  }
  
  if (action === 'delete') {
    const ids = items.map(x => x.id).filter(Boolean);
    const { error } = await supabase
      .from('shadowing_subtopics')
      .delete()
      .in('id', ids);
    
    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
    
    return NextResponse.json({ ok: true, count: ids.length });
  }
  
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
