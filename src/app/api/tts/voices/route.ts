export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");
  const credentials = JSON.parse(raw);
  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

function codeOf(lang: string) {
  if (lang === "ja") return "ja-JP";
  if (lang === "en") return "en-US";
  return lang; // 兼容直接传语言代码
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") || "ja";
    const kind = (searchParams.get("kind") || "Neural2").toLowerCase(); // neural2|wavenet|all
    const client = makeClient();

    // 按语言过滤（Google 也支持不带 languageCode 的全量，但我们先缩小）
    const [res] = await client.listVoices({ languageCode: codeOf(lang) });
    const voices = (res.voices || []).map(v => ({
      name: v.name || "",
      languageCodes: v.languageCodes || [],
      ssmlGender: v.ssmlGender || "SSML_VOICE_GENDER_UNSPECIFIED",
      naturalSampleRateHertz: v.naturalSampleRateHertz || 0,
      type:
        (v.name || "").toLowerCase().includes("neural2") ? "Neural2" :
        (v.name || "").toLowerCase().includes("wavenet") ? "WaveNet" : "Standard"
    }))
    .filter(v => v.languageCodes?.some(c => c.startsWith(codeOf(lang))))
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
