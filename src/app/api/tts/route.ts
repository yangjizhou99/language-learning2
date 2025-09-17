export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { synthesizeTTS } from "@/lib/tts";

export async function POST(req: NextRequest) {
  try {
    const { text, lang, voiceName, speakingRate = 1.0, pitch = 0 } = await req.json();
    const audio = await synthesizeTTS({ text, lang, voiceName, speakingRate, pitch });
    const uint8Array = new Uint8Array(audio);
    const blob = new Blob([uint8Array], { type: "audio/mpeg" });

    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, s-maxage=86400, max-age=3600", // CDN 1天，浏览器1小时
        "ETag": `"${text}-${lang}-${voiceName}-${speakingRate}-${pitch}"`,
      }
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e instanceof Error ? e.message : String(e) : String(e);
    return new Response(message || "google tts failed", { status: 500 });
  }
}
