import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    const url = new URL(req.url);
    const timeRange = url.searchParams.get('timeRange') || '30d';
    const sortBy = url.searchParams.get('sortBy') || 'calls';
    const search = url.searchParams.get('search') || '';

    // 计算时间范围
    const now = new Date();
    let startDate: Date;
    
    switch (timeRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date('2024-01-01'); // 全部时间
    }

    // 获取用户API使用统计
    const { data: usageStats, error: usageError } = await supabase
      .from('api_usage_logs')
      .select(`
        user_id,
        provider,
        model,
        tokens_used,
        cost,
        created_at
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (usageError) {
      console.error('Error fetching usage stats:', usageError);
      
      // 如果表不存在，返回模拟数据
      if (usageError.code === 'PGRST116' || usageError.message.includes('Could not find the table')) {
        console.log('Table does not exist, returning mock data...');
        
        const mockStats = [
          {
            user_id: '00000000-0000-0000-0000-000000000001',
            user_email: 'test@example.com',
            user_name: 'Test User',
            total_calls: 15,
            total_tokens: 2500,
            total_cost: 0.00035,
            deepseek_calls: 10,
            deepseek_tokens: 1500,
            deepseek_cost: 0.00021,
            openrouter_calls: 5,
            openrouter_tokens: 1000,
            openrouter_cost: 0.00014,
            last_used: new Date().toISOString(),
            created_at: new Date().toISOString()
          },
          {
            user_id: '00000000-0000-0000-0000-000000000002',
            user_email: 'admin@example.com',
            user_name: 'Admin User',
            total_calls: 8,
            total_tokens: 1200,
            total_cost: 0.00018,
            deepseek_calls: 6,
            deepseek_tokens: 800,
            deepseek_cost: 0.000112,
            openrouter_calls: 2,
            openrouter_tokens: 400,
            openrouter_cost: 0.000068,
            last_used: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ];

        const mockTimeSeries = [
          { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], calls: 5, tokens: 800, cost: 0.00012 },
          { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], calls: 8, tokens: 1200, cost: 0.00018 },
          { date: new Date().toISOString().split('T')[0], calls: 10, tokens: 1500, cost: 0.00023 }
        ];

        return NextResponse.json({
          success: true,
          stats: mockStats,
          timeSeries: mockTimeSeries,
          total: mockStats.length,
          mockData: true
        });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch usage stats', 
        details: usageError.message 
      }, { status: 500 });
    }

    // 获取所有用户信息
    const userIds = [...new Set(usageStats?.map(log => log.user_id) || [])];
    
    let userMap = new Map();
    if (userIds.length > 0) {
      // 从 auth.users 获取邮箱信息
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      
      // 从 profiles 表获取用户详细信息
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, bio')
        .in('id', userIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
      } else {
        users?.users?.forEach(user => {
          if (userIds.includes(user.id)) {
            const profile = profiles?.find(p => p.id === user.id);
            userMap.set(user.id, {
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.user_metadata?.display_name || 
                        profile?.username || 
                        null
            });
          }
        });
      }
    }

    // 处理统计数据
    const userStatsMap = new Map<string, {
      user_id: string;
      user_email: string;
      user_name: string;
      total_calls: number;
      total_tokens: number;
      total_cost: number;
      deepseek_calls: number;
      deepseek_tokens: number;
      deepseek_cost: number;
      openrouter_calls: number;
      openrouter_tokens: number;
      openrouter_cost: number;
      last_used: string;
      created_at: string;
    }>();

    // 聚合用户数据
    usageStats?.forEach((log: any) => {
      const userId = log.user_id;
      const user = userMap.get(userId);
      
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          user_id: userId,
          user_email: user?.email || 'Unknown',
          user_name: user?.full_name || null,
          total_calls: 0,
          total_tokens: 0,
          total_cost: 0,
          deepseek_calls: 0,
          deepseek_tokens: 0,
          deepseek_cost: 0,
          openrouter_calls: 0,
          openrouter_tokens: 0,
          openrouter_cost: 0,
          last_used: log.created_at,
          created_at: log.created_at
        });
      }

      const userStat = userStatsMap.get(userId)!;
      
      // 更新总计
      userStat.total_calls += 1;
      userStat.total_tokens += log.tokens_used || 0;
      userStat.total_cost += log.cost || 0;
      
      // 更新提供商统计
      if (log.provider === 'deepseek') {
        userStat.deepseek_calls += 1;
        userStat.deepseek_tokens += log.tokens_used || 0;
        userStat.deepseek_cost += log.cost || 0;
      } else if (log.provider === 'openrouter') {
        userStat.openrouter_calls += 1;
        userStat.openrouter_tokens += log.tokens_used || 0;
        userStat.openrouter_cost += log.cost || 0;
      }
      
      // 更新最后使用时间
      if (new Date(log.created_at) > new Date(userStat.last_used)) {
        userStat.last_used = log.created_at;
      }
    });

    // 转换为数组并排序
    let stats = Array.from(userStatsMap.values());

    // 应用搜索过滤
    if (search) {
      stats = stats.filter(stat => 
        stat.user_email.toLowerCase().includes(search.toLowerCase()) ||
        (stat.user_name && stat.user_name.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // 应用排序
    switch (sortBy) {
      case 'tokens':
        stats.sort((a, b) => b.total_tokens - a.total_tokens);
        break;
      case 'cost':
        stats.sort((a, b) => b.total_cost - a.total_cost);
        break;
      default: // 'calls'
        stats.sort((a, b) => b.total_calls - a.total_calls);
    }

    // 生成时间序列数据（按天聚合）
    const timeSeriesMap = new Map<string, { calls: number; tokens: number; cost: number }>();
    
    usageStats?.forEach((log: any) => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, { calls: 0, tokens: 0, cost: 0 });
      }
      
      const dayStat = timeSeriesMap.get(date)!;
      dayStat.calls += 1;
      dayStat.tokens += log.tokens_used || 0;
      dayStat.cost += log.cost || 0;
    });

    const timeSeries = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      stats,
      timeSeries,
      total: stats.length
    });

  } catch (error) {
    console.error('API usage stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error) },
      { status: 500 }
    );
  }
}
