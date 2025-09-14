import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 1. 分析最慢的查询
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
        WHERE mean_time > 50
        ORDER BY mean_time DESC
        LIMIT 10;
      `
    });

    // 2. 检查索引使用情况
    const indexUsage = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          CASE 
            WHEN idx_scan = 0 THEN 'UNUSED'
            WHEN idx_scan < 10 THEN 'LOW_USAGE'
            ELSE 'ACTIVE'
          END as usage_status
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
        ORDER BY idx_scan DESC;
      `
    });

    // 3. 检查表统计信息
    const tableStats = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
      `
    });

    // 4. 检查查询计划缓存
    const queryPlanCache = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          count(*) as total_plans,
          sum(usecount) as total_uses,
          avg(usecount) as avg_uses
        FROM pg_prepared_statements;
      `
    });

    return NextResponse.json({
      success: true,
      optimization: {
        slowQueries: slowQueries.data || [],
        indexUsage: indexUsage.data || [],
        tableStats: tableStats.data || [],
        queryPlanCache: queryPlanCache.data || [],
        recommendations: generateRecommendations(slowQueries.data, indexUsage.data, tableStats.data),
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

function generateRecommendations(slowQueries: any[], indexUsage: any[], tableStats: any[]): string[] {
  const recommendations: string[] = [];

  // 基于慢查询的建议
  if (slowQueries && slowQueries.length > 0) {
    const avgTime = slowQueries.reduce((sum, q) => sum + q.mean_time, 0) / slowQueries.length;
    if (avgTime > 100) {
      recommendations.push(`平均查询时间 ${avgTime.toFixed(1)}ms 较高，建议优化查询语句`);
    }
    
    const highCallQueries = slowQueries.filter(q => q.calls > 100);
    if (highCallQueries.length > 0) {
      recommendations.push(`发现 ${highCallQueries.length} 个高频慢查询，优先优化这些查询`);
    }
  }

  // 基于索引使用的建议
  if (indexUsage && indexUsage.length > 0) {
    const unusedIndexes = indexUsage.filter(idx => idx.usage_status === 'UNUSED');
    if (unusedIndexes.length > 0) {
      recommendations.push(`发现 ${unusedIndexes.length} 个未使用的索引，考虑删除以节省空间`);
    }
    
    const lowUsageIndexes = indexUsage.filter(idx => idx.usage_status === 'LOW_USAGE');
    if (lowUsageIndexes.length > 0) {
      recommendations.push(`${lowUsageIndexes.length} 个索引使用率较低，检查是否必要`);
    }
  }

  // 基于表统计的建议
  if (tableStats && tableStats.length > 0) {
    const tablesNeedingVacuum = tableStats.filter(t => 
      t.dead_tuples > t.live_tuples * 0.1 && 
      (!t.last_autovacuum || new Date(t.last_autovacuum) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    );
    if (tablesNeedingVacuum.length > 0) {
      recommendations.push(`${tablesNeedingVacuum.length} 个表需要清理，死元组比例较高`);
    }
  }

  // 通用建议
  recommendations.push('建议定期运行 ANALYZE 更新统计信息');
  recommendations.push('考虑调整 autovacuum 参数以更频繁地清理');
  recommendations.push('监控查询计划变化，确保索引被正确使用');

  return recommendations;
}

export async function POST(req: NextRequest) {
  try {
    const { action, query } = await req.json();
    const supabase = getServiceSupabase();

    switch (action) {
      case 'explain':
        if (!query) {
          return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }
        
        const explainResult = await supabase.rpc('exec_sql', {
          sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
        });
        
        return NextResponse.json({
          success: true,
          explain: explainResult.data,
          timestamp: new Date().toISOString()
        });

      case 'vacuum':
        await supabase.rpc('exec_sql', {
          sql: 'VACUUM ANALYZE;'
        });
        return NextResponse.json({ success: true, message: 'Database vacuumed and analyzed' });

      case 'reset_stats':
        await supabase.rpc('exec_sql', {
          sql: 'SELECT pg_stat_statements_reset();'
        });
        return NextResponse.json({ success: true, message: 'Query statistics reset' });

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
