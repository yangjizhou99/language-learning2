import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

export async function requireUser(req?: NextRequest) {
  try {
    console.log("🔍 [AUTH DEBUG] Starting requireUser check");
    
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log("🔍 [AUTH DEBUG] Available cookies:", allCookies.map(c => c.name));
    
    // 检查关键的环境变量
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("❌ [AUTH DEBUG] Missing environment variables:", { 
        supabaseUrl: !!supabaseUrl, 
        supabaseAnonKey: !!supabaseAnonKey 
      });
      return null;
    }
    
    console.log("🔍 [AUTH DEBUG] Environment variables OK");

    // 支持从 Authorization: Bearer <token> 读取 access_token（解决本地存储 session 无法被服务端读取的问题）
    const authHeader = req?.headers.get("authorization") || req?.headers.get("Authorization");
    const accessToken = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.split(" ")[1] : undefined;
    if (accessToken) {
      console.log("🔍 [AUTH DEBUG] Found Authorization bearer token in headers");
    }
    
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name);
            console.log(`🔍 [AUTH DEBUG] Getting cookie '${name}':`, cookie ? "found" : "not found");
            return cookie?.value;
          },
          set() {
            // no-op for Route Handler; we don't mutate cookies here
          },
          remove() {
            // no-op for Route Handler; we don't mutate cookies here
          },
        },
        global: {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        }
      }
    );
    
    console.log("🔍 [AUTH DEBUG] Calling supabase.auth.getUser()");
    const { data, error } = accessToken
      ? await supabase.auth.getUser(accessToken)
      : await supabase.auth.getUser();
    
    if (error) {
      console.error("❌ [AUTH DEBUG] Supabase auth error:", error);
      return null;
    }
    
    console.log("🔍 [AUTH DEBUG] Auth response:", { 
      hasUser: !!data.user, 
      userId: data.user?.id,
      email: data.user?.email 
    });
    
    if (!data.user) {
      console.log("❌ [AUTH DEBUG] No user found in auth response");
      return null;
    }
    
    console.log("✅ [AUTH DEBUG] User authenticated successfully:", data.user.id);
    return { supabase, user: data.user };
  } catch (error) {
    console.error("❌ [AUTH DEBUG] Unexpected error in requireUser:", error);
    return null;
  }
}
