import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 获取API限制设置
    const { data: limits, error } = await supabase
      .from('api_limits')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching API limits:', error);
      return NextResponse.json({ 
        error: 'Failed to fetch API limits', 
        details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) 
      }, { status: 500 });
    }

    // 如果没有设置，返回默认值
    const defaultLimits = {
      enabled: false,
      daily_calls_limit: 1000,
      daily_tokens_limit: 1000000,
      daily_cost_limit: 10,
      monthly_calls_limit: 30000,
      monthly_tokens_limit: 30000000,
      monthly_cost_limit: 300,
      alert_threshold: 80
    };

    return NextResponse.json({
      success: true,
      limits: limits || defaultLimits
    });

  } catch (error) {
    console.error('API limits error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    const body = await req.json();

    const {
      enabled,
      daily_calls_limit,
      daily_tokens_limit,
      daily_cost_limit,
      monthly_calls_limit,
      monthly_tokens_limit,
      monthly_cost_limit,
      alert_threshold
    } = body;

    // 验证数据
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }

    const limitsData = {
      id: '00000000-0000-0000-0000-000000000001', // 使用固定的ID
      enabled: Boolean(enabled),
      daily_calls_limit: Math.max(0, parseInt(daily_calls_limit) || 0),
      daily_tokens_limit: Math.max(0, parseInt(daily_tokens_limit) || 0),
      daily_cost_limit: Math.max(0, parseFloat(daily_cost_limit) || 0),
      monthly_calls_limit: Math.max(0, parseInt(monthly_calls_limit) || 0),
      monthly_tokens_limit: Math.max(0, parseInt(monthly_tokens_limit) || 0),
      monthly_cost_limit: Math.max(0, parseFloat(monthly_cost_limit) || 0),
      alert_threshold: Math.max(0, Math.min(100, parseInt(alert_threshold) || 80)),
      updated_at: new Date().toISOString()
    };

    // 使用 upsert 更新或创建限制设置
    const { data, error } = await supabase
      .from('api_limits')
      .upsert(limitsData, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving API limits:', error);
      return NextResponse.json({ 
        error: 'Failed to save API limits', 
        details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      limits: data
    });

  } catch (error) {
    console.error('API limits save error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) },
      { status: 500 }
    );
  }
}
