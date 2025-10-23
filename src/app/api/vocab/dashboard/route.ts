export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // 检查是否有 Authorization header
    const authHeader = request.headers.get('authorization');
    const hasBearer = /^Bearer\s+/.test(authHeader || '');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let supabase: any;

    if (hasBearer) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader! } },
        },
      );
    } else {
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() {},
            remove() {},
          },
        },
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang');
    const status = searchParams.get('status');
    const explanation = searchParams.get('explanation');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    console.log('API分页参数:', { page, limit, offset, lang, status, explanation, search });

    const now = new Date();
    const nowIso = now.toISOString();
    // 以 UTC 计算“明天”的区间 [明天00:00, 后天00:00)
    const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const dayAfterStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0, 0));
    const tomorrowStartIso = tomorrowStart.toISOString();
    const dayAfterStartIso = dayAfterStart.toISOString();

    type VocabEntryBase = {
      id: string;
      term: string;
      lang: string;
      native_lang: string | null;
      source: string | null;
      context: string | null;
      tags: string[] | null;
      status: string;
      explanation: string | null;
      created_at: string;
      updated_at: string;
    };

    type VocabEntrySrs = VocabEntryBase & {
      srs_due: string | null;
      srs_interval: number | null;
      srs_ease: number | null;
      srs_reps: number | null;
      srs_lapses: number | null;
      srs_last: string | null;
      srs_state: string | null;
    };

    type QueryError = { code?: string; message?: string } | null;
    type EntriesResult<T> = { data: T[] | null; error: QueryError; count: number | null };
    type DueCountResult = { count: number | null; error: QueryError };
    type TomorrowCountResult = { count: number | null; error: QueryError };
    type StatsRpcResult = { 
      data: {
        byLanguage: Record<string, number>;
        byStatus: Record<string, number>;
        withExplanation: number;
        withoutExplanation: number;
      } | null;
      error: QueryError;
    };

    // 抽取查询逻辑，支持在缺少 SRS 列时降级
    const runQueries = async (
      includeSrs: boolean,
    ): Promise<[
      EntriesResult<VocabEntryBase | VocabEntrySrs>,
      DueCountResult,
      StatsRpcResult,
      TomorrowCountResult,
    ]> => {
      const selectFields = includeSrs
        ? 'id,term,lang,native_lang,source,context,tags,status,explanation,created_at,updated_at,srs_due,srs_interval,srs_ease,srs_reps,srs_lapses,srs_last,srs_state'
        : 'id,term,lang,native_lang,source,context,tags,status,explanation,created_at,updated_at';

      const entriesPromise = ((): Promise<EntriesResult<VocabEntryBase | VocabEntrySrs>> => {
        let query = supabase
          .from('vocab_entries')
          .select(selectFields, { count: 'exact' })
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (lang) query = query.eq('lang', lang);
        if (status) query = query.eq('status', status);
        if (explanation) {
          if (explanation === 'has') {
            query = query.not('explanation', 'is', null);
          } else if (explanation === 'missing') {
            query = query.is('explanation', null);
          }
        }
        if (search) {
          query = query.or(`term.ilike.%${search}%,context.ilike.%${search}%`);
        }
        query = query.range(offset, offset + limit - 1);
        return query;
      })();

      // 统计到期：
      // - 若存在 SRS 列：到期 = srs_due <= now 或 srs_due is null（从未安排复习）
      // - 若缺少 SRS 列：退化为统计当前筛选下的所有未归档条目数量
      const dueCountPromise = includeSrs
        ? supabase
            .from('vocab_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .or('status.neq.archived,status.is.null')
            .or(`srs_due.lte.${nowIso},srs_due.is.null`)
        : (async () => {
            let q = supabase
              .from('vocab_entries')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .or('status.neq.archived,status.is.null');
            if (lang) q = q.eq('lang', lang);
            if (status) q = q.eq('status', status);
            if (explanation) {
              if (explanation === 'has') q = q.not('explanation', 'is', null);
              else if (explanation === 'missing') q = q.is('explanation', null);
            }
            if (search) q = q.or(`term.ilike.%${search}%,context.ilike.%${search}%`);
            const { count, error } = await q;
            return { count: count ?? 0, error: error as QueryError };
          })();

      // 统计明天到期数量（UTC）：[明天00:00, 后天00:00)
      const tomorrowCountPromise = includeSrs
        ? supabase
            .from('vocab_entries')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .or('status.neq.archived,status.is.null')
            .gte('srs_due', tomorrowStartIso)
            .lt('srs_due', dayAfterStartIso)
        : Promise.resolve({ count: 0, error: null });

      // 使用RPC调用数据库函数获取统计信息（高效）
      // 如果函数不存在，会降级到旧的查询方式
      const statsPromise = supabase
        .rpc('get_vocab_stats', { p_user_id: user.id })
        .then((result: { data: StatsRpcResult['data']; error: QueryError }) => {
          if (result.error) {
            // 如果RPC函数不存在（code 42883），返回null以使用降级逻辑
            console.warn('RPC函数调用失败，可能需要运行迁移:', result.error);
            return { data: null, error: result.error as QueryError };
          }
          return { data: result.data, error: null };
        });

      return Promise.all([
        entriesPromise,
        dueCountPromise,
        statsPromise as Promise<StatsRpcResult>,
        tomorrowCountPromise as Promise<TomorrowCountResult>,
      ]);
    };

    // 先尝试包含 SRS 列的查询
    let [
      { data: entries, error: entriesError, count: entriesCount },
      { count: dueCount, error: dueCountError },
      { data: stats, error: statsError },
      { count: tomorrowCount, error: tomorrowCountError },
    ] = await runQueries(true);

    // 如果因缺少列报错，则降级重试（去掉 SRS 列）
    const isUndefinedColumn = (err: unknown) => !!(err && typeof err === 'object' && (err as { code?: string }).code === '42703');
    if (isUndefinedColumn(entriesError) || isUndefinedColumn(dueCountError) || isUndefinedColumn(tomorrowCountError)) {
      console.warn('检测到缺少 SRS 列，降级为无 SRS 查询');
      [
        { data: entries, error: entriesError, count: entriesCount },
        { count: dueCount, error: dueCountError },
        { data: stats, error: statsError },
        { count: tomorrowCount, error: tomorrowCountError },
      ] = await runQueries(false);
    }

    if (entriesError) {
      console.error('查询生词列表失败:', entriesError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (dueCountError) {
      console.error('查询到期数量失败:', dueCountError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    if (statsError) {
      console.error('查询统计信息失败:', statsError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }
    if (tomorrowCountError) {
      console.error('查询明天到期数量失败:', tomorrowCountError);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    // 使用数据库函数返回的统计信息（已聚合）
    const statsData = {
      total: entriesCount || 0,
      byLanguage: stats?.byLanguage || {},
      byStatus: stats?.byStatus || {},
      withExplanation: stats?.withExplanation || 0,
      withoutExplanation: stats?.withoutExplanation || 0,
      dueCount: dueCount || 0,
      tomorrowCount: tomorrowCount || 0,
    };

    const responseData = {
      entries: entries || [],
      pagination: {
        page,
        limit,
        total: entriesCount || 0,
        totalPages: Math.ceil((entriesCount || 0) / limit),
      },
      stats: statsData,
      now: nowIso,
    };

    const entriesArray = (entries ?? []) as Array<{ term?: string }>;
    console.log('API返回数据:', {
      entriesCount: entriesArray.length || 0,
      totalCount: entriesCount || 0,
      pagination: responseData.pagination,
      tomorrowCount,
      firstEntry: entriesArray[0]?.term || 'none',
      lastEntry: entriesArray[entriesArray.length - 1]?.term || 'none',
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('查询词汇仪表板API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
