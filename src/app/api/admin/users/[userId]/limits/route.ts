import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { userId } = await params;

    // 获取用户特定的限制设置
    const { data: userLimits, error } = await supabase
      .from('user_api_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user limits:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch user limits',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }

    // 如果没有用户特定限制，返回默认值
    const defaultLimits = {
      user_id: userId,
      enabled: false,
      daily_calls_limit: 0,
      daily_tokens_limit: 0,
      daily_cost_limit: 0,
      monthly_calls_limit: 0,
      monthly_tokens_limit: 0,
      monthly_cost_limit: 0,
    };

    return NextResponse.json({
      success: true,
      limits: userLimits || defaultLimits,
    });
  } catch (error) {
    console.error('User limits error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { userId } = await params;
    const body = await req.json();

    const {
      enabled,
      daily_calls_limit,
      daily_tokens_limit,
      daily_cost_limit,
      monthly_calls_limit,
      monthly_tokens_limit,
      monthly_cost_limit,
    } = body;

    // 验证数据
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }

    const limitsData = {
      user_id: userId,
      enabled: Boolean(enabled),
      daily_calls_limit: Math.max(0, parseInt(daily_calls_limit) || 0),
      daily_tokens_limit: Math.max(0, parseInt(daily_tokens_limit) || 0),
      daily_cost_limit: Math.max(0, parseFloat(daily_cost_limit) || 0),
      monthly_calls_limit: Math.max(0, parseInt(monthly_calls_limit) || 0),
      monthly_tokens_limit: Math.max(0, parseInt(monthly_tokens_limit) || 0),
      monthly_cost_limit: Math.max(0, parseFloat(monthly_cost_limit) || 0),
      updated_at: new Date().toISOString(),
    };

    // 使用 upsert 更新或创建用户限制
    const { data, error } = await supabase
      .from('user_api_limits')
      .upsert(limitsData, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving user limits:', error);
      return NextResponse.json(
        {
          error: 'Failed to save user limits',
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      limits: data,
    });
  } catch (error) {
    console.error('User limits save error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
