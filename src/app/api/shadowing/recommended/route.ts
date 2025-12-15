export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { pickTargetBand, UserAbilityState } from '@/lib/recommendation/difficulty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const cookieHeader = req.headers.get('cookie') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      if (cookieHeader) {
        const cookieMap = new Map<string, string>();
        cookieHeader.split(';').forEach((pair) => {
          const [k, ...rest] = pair.split('=');
          const key = k.trim();
          const value = rest.join('=').trim();
          if (key) cookieMap.set(key, value);
        });
        supabase = (createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieMap.get(name);
            },
            set() { },
            remove() { },
          },
        }) as unknown) as SupabaseClient;
      } else {
        const cookieStore = await cookies();
        supabase = (createServerClient(supabaseUrl, supabaseAnon, {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set() { },
            remove() { },
          },
        }) as unknown) as SupabaseClient;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // 1. Fetch User Profile (Ability Level & Explore Config)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('ability_level, vocab_unknown_rate, explore_config, comprehension_rate')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      // Fallback to Level 2 if profile fetch fails
      return NextResponse.json({
        recommended: 2,
        reason: '无法获取用户配置，默认推荐L2',
      });
    }

    // Default values if profile fields are missing
    const currentLevel = profile.ability_level || 1.0;
    const exploreConfig = profile.explore_config || {
      mainRatio: 0.6,
      downRatio: 0.2,
      upRatio: 0.2,
    };

    const userState: UserAbilityState = {
      userId: user.id,
      level: currentLevel,
      vocabUnknownRate: profile.vocab_unknown_rate || {},
      comprehensionRate: profile.comprehension_rate ?? 0.8,
      exploreConfig: exploreConfig,
    };

    // 2. Pick Target Band (Explore vs Exploit)
    const band = pickTargetBand(userState);

    // 3. Determine Recommended Level based on Band
    let recommendedLevel = Math.round(currentLevel);
    let reason = '';

    switch (band) {
      case 'main':
        recommendedLevel = Math.round(currentLevel);
        reason = `根据当前能力值 L${currentLevel.toFixed(1)}，推荐适合的练习`;
        break;
      case 'down':
        // Recommend slightly easier content for review/confidence
        recommendedLevel = Math.max(1, Math.floor(currentLevel));
        if (recommendedLevel === Math.round(currentLevel) && currentLevel > 1.5) {
          recommendedLevel = Math.floor(currentLevel - 0.5);
        }
        reason = `根据当前能力值 L${currentLevel.toFixed(1)}，推荐稍易内容巩固基础`;
        break;
      case 'up':
        // Recommend slightly harder content for challenge
        recommendedLevel = Math.min(6, Math.ceil(currentLevel));
        if (recommendedLevel === Math.round(currentLevel) && currentLevel < 5.5) {
          recommendedLevel = Math.ceil(currentLevel + 0.5);
        }
        reason = `根据当前能力值 L${currentLevel.toFixed(1)}，推荐稍难内容挑战提升`;
        break;
    }

    // Ensure bounds
    recommendedLevel = Math.max(1, Math.min(6, recommendedLevel));

    return NextResponse.json({
      recommended: recommendedLevel,
      reason,
      band, // Optional: return band for debugging or UI hints
      userLevel: currentLevel
    });

  } catch (error) {
    console.error('获取推荐等级失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
