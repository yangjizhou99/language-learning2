export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

type Body = {
  text: string;
  lang: "ja" | "en" | string;   // 支持直接传 ja-JP / en-US
  voiceName?: string;           // 例如 "ja-JP-Neural2-B"
  speakingRate?: number;        // 0.25~4.0，默认 1.0
  pitch?: number;               // -20.0~20.0 半音，默认 0
};

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");
  const credentials = JSON.parse(raw);
  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

const DEFAULTS = {
  ja: "ja-JP-Neural2-B",
  en: "en-US-Neural2-C",
};

function langCode(lang: string) {
  if (lang === "ja") return "ja-JP";
  if (lang === "en") return "en-US";
  return lang;
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang, voiceName, speakingRate = 1.0, pitch = 0 }: Body = await req.json();
    const clean = (text || "").trim().slice(0, 4000);
    if (!clean || !lang) return new Response("missing text/lang", { status: 400 });

    const client = makeClient();
    const languageCode = langCode(lang);
    const name = voiceName || DEFAULTS[lang as "ja"|"en"] || undefined;

    const [resp] = await client.synthesizeSpeech({
      input: { text: clean },
      voice: { languageCode, name }, // 如果不给 name，GCP 会选默认
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
        pitch: Number.isFinite(pitch) ? pitch : 0,
      }
    });

    const audio = resp.audioContent ? Buffer.from(resp.audioContent as Uint8Array) : undefined;
    if (!audio) return new Response("no audio", { status: 502 });

    return new Response(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (e:any) {
    return new Response(e?.message || "google tts failed", { status: 500 });
  }
}
