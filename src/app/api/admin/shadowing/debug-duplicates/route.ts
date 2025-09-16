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
    // 检查shadowing_drafts表中的重复
    const { data: draftsData } = await supabase
      .from('shadowing_drafts')
      .select('id, subtopic_id, title, created_at')
      .not('subtopic_id', 'is', null)
      .order('created_at', { ascending: false });
    
    // 检查shadowing_items表中的重复
    const { data: itemsData } = await supabase
      .from('shadowing_items')
      .select('id, subtopic_id, title, created_at')
      .not('subtopic_id', 'is', null)
      .order('created_at', { ascending: false });
    
    // 统计重复情况
    const subtopicCounts: Record<string, number> = {};
    const duplicates: any[] = [];
    
    [...(draftsData || []), ...(itemsData || [])].forEach(item => {
      const subtopicId = item.subtopic_id;
      if (!subtopicCounts[subtopicId]) {
        subtopicCounts[subtopicId] = 0;
      }
      subtopicCounts[subtopicId]++;
      
      if (subtopicCounts[subtopicId] > 1) {
        duplicates.push({
          subtopic_id: subtopicId,
          title: item.title,
          table: draftsData?.includes(item) ? 'drafts' : 'items',
          created_at: item.created_at
        });
      }
    });
    
    const duplicateSubtopicIds = Object.keys(subtopicCounts).filter(id => subtopicCounts[id] > 1);
    
    return NextResponse.json({
      totalDrafts: draftsData?.length || 0,
      totalItems: itemsData?.length || 0,
      totalArticles: (draftsData?.length || 0) + (itemsData?.length || 0),
      uniqueSubtopics: Object.keys(subtopicCounts).length,
      duplicateSubtopicIds: duplicateSubtopicIds.length,
      duplicateDetails: duplicates.slice(0, 20), // 只返回前20个重复项
      subtopicCounts: Object.fromEntries(
        Object.entries(subtopicCounts)
          .filter(([_, count]) => count > 1)
          .slice(0, 10)
      )
    });
    
  } catch (error) {
    console.error('Debug duplicates error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
