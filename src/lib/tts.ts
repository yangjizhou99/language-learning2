import textToSpeech from "@google-cloud/text-to-speech";
import { toLocaleCode } from "@/types/lang";

type SynthesizeParams = {
  text: string;
  lang: "ja" | "en" | "zh" | string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
};

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error("GOOGLE_TTS_CREDENTIALS missing");

  let credentials: any;
  try {
    credentials = JSON.parse(raw);
  } catch {
    try {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error("File path not supported in production. Use JSON string in GOOGLE_TTS_CREDENTIALS");
      }
      const fs = require('fs');
      const path = require('path');
      const filePath = path.resolve(process.cwd(), raw);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      credentials = JSON.parse(fileContent);
    } catch (fileError: unknown) {
      const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
      throw new Error(`Failed to parse GOOGLE_TTS_CREDENTIALS: ${raw}. Error: ${errorMessage}`);
    }
  }

  const projectId = process.env.GOOGLE_TTS_PROJECT_ID || credentials.project_id;
  return new textToSpeech.TextToSpeechClient({ credentials, projectId });
}

const DEFAULTS: Record<string, string> = {
  ja: "ja-JP-Neural2-B",
  en: "en-US-Neural2-C",
  zh: "cmn-CN-Standard-A",
  "zh-CN": "cmn-CN-Standard-A",
};

function extractLanguageCodeFromVoiceName(name?: string): string | undefined {
  if (!name) return undefined;
  const parts = name.split("-");
  if (parts.length >= 2) {
    const lang = parts[0];
    const region = parts[1];
    if (lang && region) return `${lang}-${region.toUpperCase()}`;
  }
  return undefined;
}

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

export async function synthesizeTTS({ text, lang, voiceName, speakingRate = 1.0, pitch = 0 }: SynthesizeParams): Promise<Buffer> {
  const clean = (text || "").trim().slice(0, 4000);
  if (!clean || !lang) throw new Error("missing text/lang");

  const client = makeClient();
  const selectedName = voiceName || DEFAULTS[lang as keyof typeof DEFAULTS];
  let languageCode = selectedName
    ? (extractLanguageCodeFromVoiceName(selectedName) || toLocaleCode(lang))
    : toLocaleCode(lang);

  const uiLocale = toLocaleCode(lang).toLowerCase();
  const selectedLocale = (extractLanguageCodeFromVoiceName(selectedName) || "").toLowerCase();
  const isZhUi = uiLocale.startsWith("zh");
  const isZhVoice = selectedLocale.startsWith("zh-") || selectedLocale.startsWith("cmn-");
  const localeMismatch = selectedName && (isZhUi ? !isZhVoice : !selectedLocale.startsWith(uiLocale));

  const name = localeMismatch ? (DEFAULTS[lang as keyof typeof DEFAULTS]) : selectedName;
  if (localeMismatch) languageCode = toLocaleCode(lang);

  const sentences = splitTextIntoSentences(clean).flatMap(s => chunkByBytes(s, 800));
  const ssml = `<speak>${sentences.map(s => `<s>${escapeForSsml(s)}</s>`).join("")}</speak>`;

  const [resp] = await client.synthesizeSpeech({
    input: { ssml },
    voice: { languageCode, name },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: Number.isFinite(speakingRate) ? speakingRate : 1.0,
      pitch: Number.isFinite(pitch) ? pitch : 0,
    }
  });

  const audio = resp.audioContent ? Buffer.from(resp.audioContent as Uint8Array) : undefined;
  if (!audio) throw new Error("no audio");
  return audio;
}


