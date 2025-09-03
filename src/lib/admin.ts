import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function requireAdmin(req?: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // 优先使用前端传来的 Authorization 头（Bearer token）
  const authHeader = req?.headers.get("authorization") || "";
  const hasBearer = /^Bearer\s+/.test(authHeader);

  const cookieStore = await cookies();

  const supabase = hasBearer
    ? createClient(supabaseUrl, supabaseAnon, {
        auth: { 
          persistSession: false,
          autoRefreshToken: false
        },
        global: { 
          headers: { 
            Authorization: authHeader 
          } 
        }
      })
    : createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });

  // 调试日志
  console.log('Admin check - hasBearer:', hasBearer);
  console.log('Admin check - authHeader:', authHeader ? 'present' : 'missing');

  const { data: { user } } = await supabase.auth.getUser();
  console.log('Admin check - user:', user ? `${user.email} (${user.id})` : 'null');
  if (!user) return { ok: false as const, reason: "unauthorized" };
  
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  
  console.log('Admin check - profile query result:', { data, error });
  if (error || !data || data.role !== "admin") {
    console.log('Admin check - access denied:', { error: error?.message, role: data?.role });
    return { ok: false as const, reason: "forbidden" };
  }
  
  console.log('Admin check - access granted');
  return { ok: true as const, supabase, user };
}
