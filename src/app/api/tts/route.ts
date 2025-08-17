export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";
import { toLocaleCode } from "@/types/lang";

type Body = {
  text: string;
  lang: "ja" | "en" | "zh" | string;   // 支持直接传 ja-JP / en-US / zh-CN
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
  // 中文普通话：Neural2 在部分地区/项目不可用，优先使用稳定可用的 Standard
  zh: "cmn-CN-Standard-A",
  "zh-CN": "cmn-CN-Standard-A",
};

function extractLanguageCodeFromVoiceName(name?: string): string | undefined {
  if (!name) return undefined;
  // 形如 "ja-JP-Neural2-B" / "zh-CN-Neural2-C" / "cmn-CN-Standard-A"
  const parts = name.split("-");
  if (parts.length >= 2) {
    const lang = parts[0];
    const region = parts[1];
    if (lang && region) {
      // 规范化区位部分为大写（Google 不敏感，但保持一致）
      return `${lang}-${region.toUpperCase()}`;
    }
  }
  return undefined;
}

// 将文本拆成不超过 900 字节/句（留余量，使用 800）
function splitTextIntoSentences(text: string): string[] {
  const hardDelimiters = new Set(["。", "！", "？", "!", "?", ".", "；", ";", "．"]);
  const out: string[] = [];
  let buf = "";
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n") {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
    if (hardDelimiters.has(ch)) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function chunkByBytes(text: string, maxBytes = 800): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, "utf8");
    if (currentBytes + chBytes > maxBytes) {
      if (current) chunks.push(current);
      current = ch;
      currentBytes = chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function escapeForSsml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function POST(req: NextRequest) {
  try {
    const { text, lang, voiceName, speakingRate = 1.0, pitch = 0 }: Body = await req.json();
    const clean = (text || "").trim().slice(0, 4000);
    if (!clean || !lang) return new Response("missing text/lang", { status: 400 });

    const client = makeClient();
    const selectedName = voiceName || DEFAULTS[lang as keyof typeof DEFAULTS];
    let languageCode = selectedName
      ? (extractLanguageCodeFromVoiceName(selectedName) || toLocaleCode(lang))
      : toLocaleCode(lang);

    // 如果所选 voiceName 的语言与 UI 语言不一致，则强制回退到该语言默认声音
    const uiLocale = toLocaleCode(lang).toLowerCase();
    const selectedLocale = (extractLanguageCodeFromVoiceName(selectedName) || "").toLowerCase();
    const isZhUi = uiLocale.startsWith("zh");
    const isZhVoice = selectedLocale.startsWith("zh-") || selectedLocale.startsWith("cmn-");
    const localeMismatch = selectedName && (
      isZhUi ? !isZhVoice : !selectedLocale.startsWith(uiLocale)
    );

    const name = localeMismatch ? (DEFAULTS[lang as keyof typeof DEFAULTS]) : selectedName;
    if (localeMismatch) {
      languageCode = toLocaleCode(lang);
    }

    // 构建 SSML，保证单句 <= 800 字节
    const sentences = splitTextIntoSentences(clean).flatMap(s => chunkByBytes(s, 800));
    const ssml = `<speak>${sentences.map(s => `<s>${escapeForSsml(s)}</s>`).join("")}</speak>`;

    const [resp] = await client.synthesizeSpeech({
      input: { ssml },
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
