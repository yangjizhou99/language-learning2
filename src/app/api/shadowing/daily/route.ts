import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getDailyShadowingItem } from '@/lib/practice/daily-service';

export async function GET(req: NextRequest) {
  try {
    // 鉴权逻辑：Bearer 优先，其次 Cookie
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else if (cookieHeader) {
      const cookieMap = new Map<string, string>();
      cookieHeader.split(';').forEach((pair) => {
        const [k, ...rest] = pair.split('=');
        const key = k.trim();
        const value = rest.join('=').trim();
        if (key) cookieMap.set(key, value);
      });
      supabase = (createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() { },
            remove() { },
          },
        },
      ) as unknown) as SupabaseClient;
    } else {
      const cookieStore = await cookies();
      supabase = (createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() { },
            remove() { },
          },
        },
      ) as unknown) as SupabaseClient;
    }

    const url = new URL(req.url);
    const lang = (url.searchParams.get('lang') || 'en').toLowerCase();

    // 验证用户身份
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    // 使用 Service 获取数据 (Service 内部使用了 Service Key 或传递 Admin Client? 
    // 原代码使用了 getServiceSupabase() 来绕过 RLS 获取所有题目。
    // 我们应该继续使用 Admin Client 来获取 pool，但是 sessions 状态是基于 user 的。
    // getDailyShadowingItem 需要传入 Supabase Client。
    // 如果我们传 user client, check RLS. shadowing_items RLS usually allows 'authenticated' read approved.
    // 原代码 explicit referencing 'supabaseAdmin'.
    // 让我们确保 getDailyShadowingItem 足够灵活。
    // 如果我们传入 admin client，user_id 必须显式传。
    // 如果我们传入 user client，一切正常且安全。
    // 原代码用 admin 可能是为了避免 RLS 复杂性或者性能？
    // shadowing_items 一般是 public read for approved. sessions is private.
    // 且看 getDailyShadowingItem 签名: (supabase, userId, lang).
    // 如果传 admin client, 它可以读所有 sessions 吗？是的。
    // 如果传 user client, 它可以读 items 吗？只有 approved. 
    // 我们的 service logic 中用了 .eq('status', 'approved')，所以 user client 也应该可以。
    // 但是原代码 Line 69: `const supabaseAdmin = getServiceSupabase();`
    // 为了保持一致性和最大权限（防止 future RLS change broken），我们可以传 admin client。

    const supabaseAdmin = getServiceSupabase();
    const result = await getDailyShadowingItem(supabaseAdmin, user.id, lang);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (e) {
    console.error('daily api failed', e);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}


