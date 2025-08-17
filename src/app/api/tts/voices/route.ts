export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";
import { toLocaleCode } from "@/types/lang";

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");
  const credentials = JSON.parse(raw);
  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") || "ja";
    const kind = (searchParams.get("kind") || "Neural2").toLowerCase(); // neural2|wavenet|all
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
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || "list voices failed" }, { status: 500 });
  }
}
