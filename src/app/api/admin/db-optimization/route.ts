import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 1. 检查索引使用情况
    const indexStats = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          idx_blks_read,
          idx_blks_hit
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
        ORDER BY idx_scan DESC
        LIMIT 20;
      `
    });

    // 2. 检查慢查询
    const slowQueries = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows,
          100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
        FROM pg_stat_statements 
        WHERE mean_time > 100
        ORDER BY mean_time DESC
        LIMIT 10;
      `
    });

    // 3. 检查表大小
    const tableSizes = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `
    });

    // 4. 检查连接数
    const connections = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database();
      `
    });

    return NextResponse.json({
      success: true,
      optimization: {
        indexStats: indexStats.data || [],
        slowQueries: slowQueries.data || [],
        tableSizes: tableSizes.data || [],
        connections: connections.data || [],
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();
    const supabase = getServiceSupabase();

    switch (action) {
      case 'analyze':
        // 更新表统计信息
        await supabase.rpc('exec_sql', {
          sql: 'ANALYZE;'
        });
        return NextResponse.json({ success: true, message: 'Database statistics updated' });
      
      case 'vacuum':
        // 清理数据库
        await supabase.rpc('exec_sql', {
          sql: 'VACUUM ANALYZE;'
        });
        return NextResponse.json({ success: true, message: 'Database vacuumed' });
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error'
    }, { status: 500 });
  }
}
