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
  const theme_id = searchParams.get('theme_id');
  const q = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  let query = supabase
    .from('shadowing_subtopics')
    .select(`
      *,
      theme:shadowing_themes(title)
    `)
    .eq('status', 'active');
  
  if (lang) query = query.eq('lang', lang);
  if (level) query = query.eq('level', parseInt(level));
  if (genre) query = query.eq('genre', genre);
  if (theme_id) query = query.eq('theme_id', theme_id);
  if (q) query = query.ilike('title_cn', `%${q}%`);
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error, count } = await query
    .range(from, to)
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
  
  return NextResponse.json({ 
    items: data || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit)
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
    if (!item.title_cn?.trim()) {
      return NextResponse.json({ error: '小主题标题不能为空' }, { status: 400 });
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
      .from('shadowing_subtopics')
      .upsert(data, { onConflict: 'id' })
      .select(`
        *,
        theme:shadowing_themes(title)
      `)
      .single();
    
    if (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
    }
    
    return NextResponse.json({ item: result });
  }
  
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
