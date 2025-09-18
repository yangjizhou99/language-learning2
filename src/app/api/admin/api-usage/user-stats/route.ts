import { NextRequest, NextResponse } from 'next/server';
import { getUserAPIUsageStats } from '@/lib/api-limits-checker';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider');

    if (!userId) {
      return NextResponse.json(
        {
          error: 'User ID is required',
        },
        { status: 400 },
      );
    }

    // 获取用户使用统计
    const usageStats = await getUserAPIUsageStats(userId, provider || undefined);

    if (!usageStats) {
      return NextResponse.json({
        success: true,
        usage: {
          daily_calls: 0,
          daily_tokens: 0,
          daily_cost: 0,
          monthly_calls: 0,
          monthly_tokens: 0,
          monthly_cost: 0,
        },
      });
    }

    // 获取全局限制设置
    const supabase = getServiceSupabase();
    const { data: limits, error: limitsError } = await supabase
      .from('api_limits')
      .select('*')
      .single();

    return NextResponse.json({
      success: true,
      usage: usageStats,
      limits: limits || null,
    });
  } catch (error) {
    console.error('Error fetching user API usage stats:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : String(error),
      },
      { status: 500 },
    );
  }
}
