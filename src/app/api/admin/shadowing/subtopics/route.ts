import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const supabase = auth.supabase;
  return await handleRequest(supabase, req);
}

async function handleRequest(supabase: any, req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get('lang');
  const level = searchParams.get('level');
  const genre = searchParams.get('genre');
  const theme_id = searchParams.get('theme_id');
  const has_article = searchParams.get('has_article');
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
  
  // 处理文章状态筛选
  if (has_article === 'yes') {
    // 只显示有文章的小主题（在drafts或items中有记录）
    const { data: draftsData } = await supabase
      .from('shadowing_drafts')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const { data: itemsData } = await supabase
      .from('shadowing_items')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const hasArticleIds = new Set([
      ...(draftsData?.map((d: any) => d.subtopic_id) || []),
      ...(itemsData?.map((i: any) => i.subtopic_id) || [])
    ]);
    
    if (hasArticleIds.size > 0) {
      query = query.in('id', Array.from(hasArticleIds));
    } else {
      // 如果没有找到任何有文章的小主题，返回空结果
      query = query.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  } else if (has_article === 'no') {
    // 只显示没有文章的小主题（在drafts和items中都没有记录）
    const { data: draftsData } = await supabase
      .from('shadowing_drafts')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const { data: itemsData } = await supabase
      .from('shadowing_items')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const hasArticleIds = new Set([
      ...(draftsData?.map((d: any) => d.subtopic_id) || []),
      ...(itemsData?.map((i: any) => i.subtopic_id) || [])
    ]);
    
    if (hasArticleIds.size > 0) {
      query = query.not('id', 'in', `(${Array.from(hasArticleIds).join(',')})`);
    }
  }
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  
  const { data, error } = await query
    .range(from, to)
    .order('created_at', { ascending: false });
  
  // 获取总数（不应用分页限制）
  const countQuery = supabase
    .from('shadowing_subtopics')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  
  if (lang) countQuery.eq('lang', lang);
  if (level) countQuery.eq('level', parseInt(level));
  if (genre) countQuery.eq('genre', genre);
  if (theme_id) countQuery.eq('theme_id', theme_id);
  if (q) countQuery.ilike('title_cn', `%${q}%`);
  
  // 处理文章状态筛选 - count查询使用相同的逻辑
  if (has_article === 'yes' || has_article === 'no') {
    const { data: draftsData } = await supabase
      .from('shadowing_drafts')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const { data: itemsData } = await supabase
      .from('shadowing_items')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);
    
    const hasArticleIds = new Set([
      ...(draftsData?.map((d: any) => d.subtopic_id) || []),
      ...(itemsData?.map((i: any) => i.subtopic_id) || [])
    ]);
    
    if (has_article === 'yes') {
      if (hasArticleIds.size > 0) {
        countQuery.in('id', Array.from(hasArticleIds));
      } else {
        countQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    } else if (has_article === 'no') {
      if (hasArticleIds.size > 0) {
        countQuery.not('id', 'in', `(${Array.from(hasArticleIds).join(',')})`);
      }
    }
  }
  
  const { count } = await countQuery;
  
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
