export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { synthesizeTTS } from '@/lib/tts';
import { uploadAudioFile } from '@/lib/storage-upload';

type TimelineItem = {
  index: number;
  text: string;
  start: number; // seconds
  end: number;   // seconds
  speaker?: string;
};

function splitIntoSegments(text: string, lang: string): Array<{ text: string; speaker?: string }> {
  const src = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!src) return [];

  // 对话体：A:/B: 开头行作为一个句段
  const isDialogue = /(?:^|\n)\s*[ABＡＢ]\s*[：:]/.test(src);
  if (isDialogue) {
    const lines = src.split('\n').map((l) => l.trim()).filter(Boolean);
    const out: Array<{ text: string; speaker?: string }> = [];
    for (const line of lines) {
      const m = line.match(/^\s*([A-ZＡ-Ｚ])\s*[：:]\s*(.+)$/);
      if (m) {
        const speaker = m[1];
        const content = m[2];
        out.push({ text: content, speaker });
      }
    }
    if (out.length) return out;
    // 兜底：无匹配则当作非对话处理
  }

  // 非对话体：按标点切分
  const zhJa = /^(zh|ja)/i.test(lang);
  const parts = zhJa
    ? src.split(/[。！？!?…]+/)
    : src.split(/(?<=[.!?])\s+/);
  return parts.map((s) => s.trim()).filter(Boolean).map((s) => ({ text: s }));
}

async function estimateMp3DurationSeconds(buffer: Buffer): Promise<number> {
  // 轻量近似：按比特率无法可靠估算，这里使用浏览器端更准。
  // 服务器端尽量不引入 ffprobe 依赖；回退使用片段平均长度比例。
  // 实际时间轴将基于每句合成后片段的 Buffer 大小进行比例估计。
  // 此函数保留以便未来接入更准确的时长提取工具。
  return Math.max(0.1, buffer.length / (16_000));
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const { id, text, lang, voice, speakingRate = 1.0, pitch = 0 } = body as {
      id?: string;
      text: string;
      lang: string;
      voice?: string; // 非对话体使用；对话体仍按 A/B 仅做句段，但单声道音色
      speakingRate?: number;
      pitch?: number;
    };

    if (!text || !lang) return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });

    // 1) 切分句段
    const segments = splitIntoSegments(text, lang);
    if (segments.length === 0) return NextResponse.json({ error: '无法切分句段' }, { status: 400 });

    // 2) 逐句合成（单声道：不区分 A/B 音色，以避免多份音频）
    const buffers: Buffer[] = [];
    const sentenceDurations: number[] = [];

    for (const seg of segments) {
      const buf = await synthesizeTTS({
        text: seg.text,
        lang,
        voiceName: voice,
        speakingRate,
        pitch,
      });
      buffers.push(buf);
      try {
        const { getMp3DurationSeconds } = await import('@/lib/media-probe');
        const secs = await getMp3DurationSeconds(buf);
        sentenceDurations.push(Number.isFinite(secs) && secs > 0 ? secs : await estimateMp3DurationSeconds(buf));
      } catch {
        const secs = await estimateMp3DurationSeconds(buf);
        sentenceDurations.push(secs);
      }
    }

    // 3) 合并整段
    // 复用 tts.ts 的合并逻辑以避免重复；为避免循环依赖，这里动态导入
    const { default: path } = await import('path');
    const { mergeAudioBuffers } = await import('@/lib/tts-merge-helper');
    const merged = await mergeAudioBuffers(buffers);

    // 4) 生成时间轴（累加法）
    const timeline: TimelineItem[] = [];
    let cursor = 0;
    for (let i = 0; i < segments.length; i++) {
      const start = cursor;
      const end = start + sentenceDurations[i];
      timeline.push({ index: i, text: segments[i].text, start, end, speaker: segments[i].speaker });
      cursor = end;
    }

    // 5) 上传整段音频
    const bucket = process.env.NEXT_PUBLIC_SHADOWING_AUDIO_BUCKET || 'tts';
    const timestamp = Date.now();
    const safeLang = String(lang).toLowerCase();
    const filePath = `${safeLang}/sent-${timestamp}-${Math.random().toString(36).slice(2)}.mp3`;
    const uploadResult = await uploadAudioFile(bucket, filePath, merged);
    if (!uploadResult.success) {
      return NextResponse.json({ error: `上传失败: ${uploadResult.error}` }, { status: 500 });
    }

    // 6) 写回 DB（可选）
    if (id) {
      const db = getServiceSupabase();
      const { error } = await db
        .from('shadowing_items')
        .update({
          audio_bucket: bucket,
          audio_path: filePath,
          sentence_timeline: timeline,
          duration_ms: Math.round(cursor * 1000),
        })
        .eq('id', id);
      if (error) {
        return NextResponse.json({ error: `写回DB失败: ${error.message}` }, { status: 500 });
      }
    }

    const audioUrl = uploadResult.proxyUrl || uploadResult.url || `/api/storage-proxy?path=${encodeURIComponent(filePath)}&bucket=${encodeURIComponent(bucket)}`;

    return NextResponse.json({
      ok: true,
      audio_url: audioUrl,
      audio_bucket: bucket,
      audio_path: filePath,
      sentence_timeline: timeline,
      duration_ms: Math.round(cursor * 1000),
      count: segments.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


