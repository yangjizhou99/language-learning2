export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Metrics = { 
  wer?: number; 
  cer?: number; 
  complete?: boolean;
  accuracy?: number;
};

function calculateAccuracy(metrics: Metrics): number {
  // 优先使用wer或cer，如果没有则使用accuracy
  if (metrics.wer !== undefined) {
    return Math.max(0, Math.min(1, 1 - metrics.wer));
  }
  if (metrics.cer !== undefined) {
    return Math.max(0, Math.min(1, 1 - metrics.cer));
  }
  if (metrics.accuracy !== undefined) {
    return Math.max(0, Math.min(1, metrics.accuracy));
  }
  return 0.75; // 无数据时保守估计
}

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }
    const searchParams = new URL(req.url).searchParams;
    const lang = (searchParams.get("lang") || "en").toLowerCase();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    
    const uid = user.id;

    // 获取最近8次该语言的练习记录
    const { data: attempts } = await supabase
      .from("shadowing_attempts")
      .select("level, metrics")
      .eq("lang", lang)
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(8);

    // 无记录：默认推荐L2
    if (!attempts || attempts.length === 0) {
      return NextResponse.json({ 
        recommended: 2, 
        reason: "初次练习，默认推荐L2" 
      });
    }

    const lastLevel = attempts[0].level;
    const recentSameLevel = attempts.filter(a => a.level === lastLevel).slice(0, 3);
    const lastAttempt = attempts[0];

    const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

    // 升级条件：同级最近3次，平均准确率≥92%
    if (recentSameLevel.length === 3) {
      const accuracies = recentSameLevel.map(r => calculateAccuracy(r.metrics as Metrics));
      const avgAccuracy = avg(accuracies);
      
      if (avgAccuracy >= 0.92) {
        return NextResponse.json({ 
          recommended: Math.min(5, lastLevel + 1), 
          reason: `同级近3次平均准确率 ${(avgAccuracy * 100).toFixed(1)}% ≥ 92%，建议升级` 
        });
      }
    }

    // 降级条件：最近一次失败/中断 或 准确率 < 75%
    const lastAccuracy = calculateAccuracy(lastAttempt.metrics as Metrics);
    const incomplete = (lastAttempt.metrics as Metrics)?.complete === false;
    
    if (incomplete || lastAccuracy < 0.75) {
      const reason = incomplete 
        ? "最近一次未完成，建议降级" 
        : `最近一次准确率 ${(lastAccuracy * 100).toFixed(1)}% < 75%，建议降级`;
      
      return NextResponse.json({ 
        recommended: Math.max(1, lastLevel - 1), 
        reason 
      });
    }

    // 否则保持当前等级
    return NextResponse.json({ 
      recommended: lastLevel, 
      reason: `维持L${lastLevel}（最近一次准确率 ${(lastAccuracy * 100).toFixed(1)}%）` 
    });

  } catch (error) {
    console.error("获取推荐等级失败:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
