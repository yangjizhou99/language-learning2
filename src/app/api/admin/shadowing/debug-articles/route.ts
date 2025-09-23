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

  try {
    // 获取小主题总数
    const { count: totalSubtopics } = await supabase
      .from('shadowing_subtopics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // 获取有drafts的小主题
    const { data: draftsData } = await supabase
      .from('shadowing_drafts')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);

    const draftsSubtopics = new Set(draftsData?.map((d) => d.subtopic_id) || []);

    // 获取有items的小主题
    const { data: itemsData } = await supabase
      .from('shadowing_items')
      .select('subtopic_id')
      .not('subtopic_id', 'is', null);

    const itemsSubtopics = new Set(itemsData?.map((i) => i.subtopic_id) || []);

    // 合并有文章的小主题
    const hasArticleSubtopics = new Set([...draftsSubtopics, ...itemsSubtopics]);

    // 获取没有文章的小主题
    const { data: noArticleData } = await supabase
      .from('shadowing_subtopics')
      .select('id, title')
      .eq('status', 'active')
      .not('id', 'in', `(${Array.from(hasArticleSubtopics).join(',')})`);

    return NextResponse.json({
      totalSubtopics,
      draftsCount: draftsData?.length || 0,
      itemsCount: itemsData?.length || 0,
      hasArticleCount: hasArticleSubtopics.size,
      noArticleCount: noArticleData?.length || 0,
      sampleDrafts: draftsData?.slice(0, 3) || [],
      sampleItems: itemsData?.slice(0, 3) || [],
      sampleNoArticle: noArticleData?.slice(0, 3) || [],
    });
  } catch (error) {
    console.error('Debug articles error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
