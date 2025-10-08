import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabaseAdmin = getServiceSupabase();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'missing id' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('alignment_materials')
      .select(
        `
        *,
        subtopic:alignment_subtopics!alignment_materials_subtopic_fkey (
          id,
          title,
          one_line,
          level,
          lang,
          objectives,
          theme:alignment_themes (
            id,
            title,
            level,
            lang,
            genre,
            summary
          )
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }

    if (data.status !== 'active' || data.review_status !== 'approved') {
      return NextResponse.json({ error: 'material not available' }, { status: 403 });
    }

    const rawSubtopic: any = Array.isArray(data.subtopic) ? data.subtopic[0] : data.subtopic;
    const rawTheme: any = rawSubtopic
      ? Array.isArray(rawSubtopic.theme)
        ? rawSubtopic.theme[0]
        : rawSubtopic.theme
      : null;

    return NextResponse.json({
      item: {
        ...data,
        subtopic: rawSubtopic
          ? {
              ...rawSubtopic,
              theme: rawTheme || null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('alignment material detail failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 500 },
    );
  }
}
