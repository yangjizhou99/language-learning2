import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  
  const supabase = auth.supabase;
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang');
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  
  let query = supabase
    .from('shadowing_themes')
    .select(`
      *,
      subtopics:shadowing_subtopics(count)
    `)
    .eq('status', 'active');
  
  if (lang) query = query.eq('lang', lang);
  if (level) query = query.eq('level', parseInt(level));
  if (genre) query = query.eq('genre', genre);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ 
    items: data?.map(item => ({
      ...item,
      subtopic_count: item.subtopics?.[0]?.count || 0
    })) || []
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  
  const supabase = auth.supabase;
  const body = await req.json();
  const { action, item } = body;
  
  if (action === 'upsert') {
    if (!item.title?.trim()) {
      return NextResponse.json({ error: '主题标题不能为空' }, { status: 400 });
    }
    
    const user = (await supabase.auth.getUser()).data.user;
    const now = new Date().toISOString();
    
    const data = {
      ...item,
      updated_at: now,
      created_by: item.created_by || user?.id
    };
    
    if (!item.id) {
      data.created_at = now;
    }
    
    const { data: result, error } = await supabase
      .from('shadowing_themes')
      .upsert(data, { onConflict: 'id' })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ item: result });
  }
  
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
