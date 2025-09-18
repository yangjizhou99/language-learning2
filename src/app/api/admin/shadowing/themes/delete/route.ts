import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const supabase = auth.supabase;
    const body = await req.json();
    const { theme_id } = body;

    if (!theme_id) {
      return NextResponse.json({ error: 'Missing theme_id' }, { status: 400 });
    }

    // 首先获取该主题下的小主题数量（用于统计）
    const { data: subtopics, error: subtopicsError } = await supabase
      .from('shadowing_subtopics')
      .select('id')
      .eq('theme_id', theme_id);

    if (subtopicsError) {
      throw new Error(`Failed to fetch subtopics: ${subtopicsError.message}`);
    }

    const subtopicCount = subtopics?.length || 0;

    // 删除主题（由于外键约束设置为 CASCADE，会自动删除相关小主题）
    const { error: deleteThemeError } = await supabase
      .from('shadowing_themes')
      .delete()
      .eq('id', theme_id);

    if (deleteThemeError) {
      throw new Error(`Failed to delete theme: ${deleteThemeError.message}`);
    }

    return NextResponse.json({
      success: true,
      deleted_subtopics: subtopicCount,
      message: `Successfully deleted theme and ${subtopicCount} subtopics`,
    });
  } catch (error) {
    console.error('Theme deletion error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : 'Deletion failed',
      },
      { status: 500 },
    );
  }
}
