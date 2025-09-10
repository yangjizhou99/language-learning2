export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import textToSpeech from "@google-cloud/text-to-speech";

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") || "all";

    const client = makeClient();
    
    let voices;
    if (lang === "all") {
      const [res] = await client.listVoices({});
      voices = res.voices || [];
    } else {
      const [res] = await client.listVoices({ languageCode: lang });
      voices = res.voices || [];
    }

    // 按语言分组
    const groupedVoices = voices.reduce((acc: any, voice: any) => {
      const langCode = voice.languageCodes?.[0] || 'unknown';
      if (!acc[langCode]) acc[langCode] = [];
      
      acc[langCode].push({
        name: voice.name,
        languageCode: langCode,
        ssmlGender: voice.ssmlGender,
        naturalSampleRateHertz: voice.naturalSampleRateHertz,
        supportedEngines: voice.supportedEngines,
        supportedModels: voice.supportedModels
      });
      
      return acc;
    }, {});

    return NextResponse.json({ 
      success: true,
      voices: groupedVoices,
      totalVoices: voices.length
    });

  } catch (error: unknown) {
    console.error("获取音色列表失败:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ 
      success: false, 
      error: message
    }, { status: 500 });
  }
}
