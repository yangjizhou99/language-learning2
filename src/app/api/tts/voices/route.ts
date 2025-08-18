export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";
import { toLocaleCode } from "@/types/lang";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");
  const credentials = JSON.parse(raw);
  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

async function requireUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op for Route Handler; we don't mutate cookies here
        },
        remove() {
          // no-op for Route Handler; we don't mutate cookies here
        },
      }
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

// 简易进程内限流（按用户+语言 5s 冷却）
const bucket = new Map<string, number>();
function hit(key: string, windowMs = 5000) {
  const now = Date.now();
  const last = bucket.get(key) || 0;
  if (now - last < windowMs) return false;
  bucket.set(key, now);
  return true;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") || "ja";
    const kind = (searchParams.get("kind") || "Neural2").toLowerCase(); // neural2|wavenet|all

    const gateKey = `${user.id}:${lang}`;
    if (!hit(gateKey, 5000)) {
      return new NextResponse(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
        }
      });
    }

    const client = makeClient();

    // 按语言过滤（Google 也支持不带 languageCode 的全量，但我们先缩小）
    // 为兼容中文在部分地区以 cmn-CN/zh-CN 报告，必要时改用更宽松策略
    const locale = toLocaleCode(lang);
    // 如果是中文，直接全量拉取，后续手动过滤，避免 GCP 不按 zh/zh-CN 返回
    const [res] = locale.toLowerCase().startsWith("zh")
      ? await client.listVoices({})
      : await client.listVoices({ languageCode: locale });
    const voices = (res.voices || []).map(v => ({
      name: v.name || "",
      languageCodes: v.languageCodes || [],
      ssmlGender: v.ssmlGender || "SSML_VOICE_GENDER_UNSPECIFIED",
      naturalSampleRateHertz: v.naturalSampleRateHertz || 0,
      type:
        (v.name || "").toLowerCase().includes("neural2") ? "Neural2" :
        (v.name || "").toLowerCase().includes("wavenet") ? "WaveNet" : "Standard"
    }))
    .filter(v => {
      const codes = v.languageCodes || [];
      const target = locale.toLowerCase();
      // 兼容 cmn-CN / zh-CN / zh-HK / zh-TW 等
      return codes.some(c => {
        const lc = (c || "").toLowerCase();
        if (target.startsWith("zh")) {
          return lc.startsWith("zh-") || lc.startsWith("cmn-");
        }
        return lc.startsWith(target);
      });
    })
    .filter(v => kind === "all" ? true : v.type.toLowerCase() === kind)
    .sort((a,b) => a.name.localeCompare(b.name));

    return new NextResponse(JSON.stringify(voices), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 允许边缘缓存一天（可选）
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800"
      }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "list voices failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
