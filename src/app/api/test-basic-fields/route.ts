import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    // 只查询基本字段
    const { data, error } = await supabase
      .from('user_permissions')
      .select(
        `
        id,
        user_id,
        can_access_shadowing,
        can_access_cloze,
        can_access_alignment,
        can_access_articles,
        allowed_languages,
        allowed_levels,
        max_daily_attempts,
        custom_restrictions,
        created_at,
        updated_at
      `,
      )
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          error: 'Database query failed',
          details: error instanceof Error ? error.message : String(error),
          code: error.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      hasData: data && data.length > 0,
      sampleRecord: data?.[0] || null,
      message: 'Basic fields are working',
    });
  } catch (error) {
    console.error('Table check error:', error);
    return NextResponse.json(
      {
        error: 'Table check failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
