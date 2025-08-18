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
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      })
    : createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "unauthorized" };
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (error || !data || data.role !== "admin")
    return { ok: false as const, reason: "forbidden" };
  return { ok: true as const, supabase, user };
}
