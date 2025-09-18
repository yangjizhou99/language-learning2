export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CacheManager } from '@/lib/cache';
import textToSpeech from '@google-cloud/text-to-speech';
import { toLocaleCode } from '@/types/lang';

function makeClient() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_TTS_CREDENTIALS missing');

  let credentials;
  try {
    // 尝试解析为 JSON 字符串
    credentials = JSON.parse(raw);
  } catch {
    // 如果不是 JSON，尝试作为文件路径读取（本地开发环境）
    try {
      // 检查是否在云端环境（如 Vercel）
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw new Error(
          'File path not supported in production. Use JSON string in GOOGLE_TTS_CREDENTIALS',
        );
      }
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

// 注：此前的认证与限流逻辑暂不使用，已移除以避免未使用警告

interface VoiceInfo {
  name: string;
  languageCodes: string[];
  ssmlGender: string;
  naturalSampleRateHertz: number;
  type: 'Neural2' | 'WaveNet' | 'Standard';
}

export async function GET(req: NextRequest) {
  try {
    // 暂时移除用户认证要求
    // const user = await requireUser();
    // if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') || 'ja';
    const kind = (searchParams.get('kind') || 'Neural2').toLowerCase(); // neural2|wavenet|all

    // 暂时移除限流检查
    // const gateKey = `${user.id}:${lang}`;
    // if (!hit(gateKey, 5000)) {
    //   return new NextResponse(JSON.stringify([]), {
    //     status: 200,
    //     headers: {
    //       "Content-Type": "application/json",
    //       "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
    //     }
    //   });
    // }

    const cacheKey = `tts:voices:${lang}:${kind}`;
    const cached = await CacheManager.get(cacheKey);
    if (cached) {
      const body = JSON.stringify(cached);
      const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
      const inm = req.headers.get('if-none-match');
      if (inm && inm === etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ETag: etag,
            'Cache-Control': 'public, s-maxage=3600, max-age=1800',
          },
        });
      }
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: etag,
          'Cache-Control': 'public, s-maxage=3600, max-age=1800',
        },
      });
    }

    const client = makeClient();

    // 按语言过滤（Google 也支持不带 languageCode 的全量，但我们先缩小）
    // 为兼容中文在部分地区以 cmn-CN/zh-CN 报告，必要时改用更宽松策略
    const locale = toLocaleCode(lang);
    // 如果是中文，直接全量拉取，后续手动过滤，避免 GCP 不按 zh/zh-CN 返回
    const [res] = locale.toLowerCase().startsWith('zh')
      ? await client.listVoices({})
      : await client.listVoices({ languageCode: locale });
    const voices: VoiceInfo[] = (res.voices || [])
      .map(
        (v): VoiceInfo => ({
          name: v.name ?? '',
          languageCodes: (v.languageCodes as string[] | undefined) ?? [],
          ssmlGender: (v.ssmlGender as string | undefined) ?? 'SSML_VOICE_GENDER_UNSPECIFIED',
          naturalSampleRateHertz: (v.naturalSampleRateHertz as number | undefined) ?? 0,
          type: (v.name || '').toLowerCase().includes('neural2')
            ? 'Neural2'
            : (v.name || '').toLowerCase().includes('wavenet')
              ? 'WaveNet'
              : 'Standard',
        }),
      )
      .filter((v: VoiceInfo) => {
        const codes = v.languageCodes || [];
        const target = locale.toLowerCase();
        // 兼容 cmn-CN / zh-CN / zh-HK / zh-TW 等
        return codes.some((c: string) => {
          const lc = (c || '').toLowerCase();
          if (target.startsWith('zh')) {
            return lc.startsWith('zh-') || lc.startsWith('cmn-');
          }
          return lc.startsWith(target);
        });
      })
      .filter((v: VoiceInfo) => (kind === 'all' ? true : v.type.toLowerCase() === kind))
      .sort((a: VoiceInfo, b: VoiceInfo) => a.name.localeCompare(b.name));

    await CacheManager.set(cacheKey, voices, 3600);

    const body = JSON.stringify(voices);
    const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
    const inm = req.headers.get('if-none-match');
    if (inm && inm === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, s-maxage=3600, max-age=1800',
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: etag,
        'Cache-Control': 'public, s-maxage=3600, max-age=1800',
      },
    });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? (e instanceof Error ? e.message : String(e)) : 'list voices failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
