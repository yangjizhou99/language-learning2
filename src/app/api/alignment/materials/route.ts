import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = getServiceSupabase();
    const { searchParams } = new URL(req.url);

    const lang = searchParams.get('lang');
    const level = searchParams.get('level');
    const genre = searchParams.get('genre');
    const taskType = searchParams.get('task_type');
    const themeId = searchParams.get('theme_id');
    const subtopicId = searchParams.get('subtopic_id');

    let query = supabaseAdmin
      .from('alignment_materials')
      .select(
        `
        id,
        subtopic_id,
        lang,
        task_type,
        status,
        updated_at,
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
            genre
          )
        )
      `,
      )
      .eq('status', 'active')
      .eq('is_current', true)
      .eq('review_status', 'approved')
      .order('updated_at', { ascending: false });

    if (lang && lang !== 'all') query = query.eq('lang', lang);
    if (taskType && taskType !== 'all') query = query.eq('task_type', taskType);
    if (subtopicId) query = query.eq('subtopic_id', subtopicId);

    // handle theme filter by fetching subtopics ids
    if (themeId && themeId !== 'all') {
      const { data: subtopicRows, error: subtopicError } = await supabaseAdmin
        .from('alignment_subtopics')
        .select('id, level, lang, theme_id')
        .eq('theme_id', themeId);
      if (subtopicError) {
        console.error('Failed to fetch subtopics for theme filter', subtopicError);
        return NextResponse.json({ error: 'failed to load subtopics' }, { status: 400 });
      }
      const ids = (subtopicRows || []).map((row) => row.id);
      if (ids.length === 0) {
        return NextResponse.json({ items: [] });
      }
      query = query.in('subtopic_id', ids);
    }

    if (level && level !== 'all') {
      const lvl = parseInt(level, 10);
      if (!Number.isNaN(lvl)) {
        query = query.eq('subtopic.level', lvl);
      }
    }

    if (genre && genre !== 'all') {
      query = query.eq('subtopic.theme.genre', genre);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load alignment materials catalog', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    }

    const items =
      (data || []).map((row) => {
        const rawSubtopic: any = Array.isArray(row.subtopic)
          ? row.subtopic[0]
          : row.subtopic;
        const rawTheme: any = rawSubtopic
          ? Array.isArray(rawSubtopic.theme)
            ? rawSubtopic.theme[0]
            : rawSubtopic.theme
          : null;

        return {
          id: row.id,
          lang: row.lang,
          task_type: row.task_type,
          updated_at: row.updated_at,
          subtopic: rawSubtopic
            ? {
                id: rawSubtopic.id,
                title: rawSubtopic.title,
                one_line: rawSubtopic.one_line,
                level: rawSubtopic.level,
                lang: rawSubtopic.lang,
                objectives: rawSubtopic.objectives || [],
                theme: rawTheme
                  ? {
                      id: rawTheme.id,
                      title: rawTheme.title,
                      level: rawTheme.level,
                      lang: rawTheme.lang,
                      genre: rawTheme.genre,
                    }
                  : null,
              }
            : null,
        };
      }) || [];

    return NextResponse.json({ items });
  } catch (error) {
    console.error('alignment materials catalog failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'internal error' },
      { status: 500 },
    );
  }
}
