import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type AggregateScores = {
  overall?: number | null;
  accuracy?: number | null;
  fluency?: number | null;
  completeness?: number | null;
  prosody?: number | null;
};

function scrub<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = scrub(v);
    }
    return out as T;
  }
  return value;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const status =
      auth.reason === 'unauthorized'
        ? 401
        : auth.reason === 'forbidden'
          ? 403
          : 500;
    return NextResponse.json({ success: false, error: auth.reason }, { status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '请求体必须是 JSON' }, { status: 400 });
  }

  const locale = typeof body.locale === 'string' ? body.locale : 'en-US';
  const mode = 'stream';
  const referenceText =
    typeof body.referenceText === 'string' && body.referenceText.trim().length > 0
      ? body.referenceText.trim()
      : null;
  const recognizedText =
    typeof body.recognizedText === 'string' && body.recognizedText.trim().length > 0
      ? body.recognizedText.trim()
      : null;
  const sessionLabel =
    typeof body.sessionLabel === 'string' && body.sessionLabel.trim().length > 0
      ? body.sessionLabel.trim()
      : null;

  const aggregate: AggregateScores = body.aggregate || {};
  const detail = body.detail ?? null;
  const raw = body.raw ?? null;
  const extra = body.extra ?? null;

  const audioDurationMs =
    typeof body.audioDurationMs === 'number' && Number.isFinite(body.audioDurationMs)
      ? Math.round(body.audioDurationMs)
      : null;

  const supabase = getServiceSupabase();

  try {
    const { data, error } = await supabase
      .from('pronunciation_test_runs')
      .insert({
        admin_id: auth.user.id,
        mode,
        locale,
        reference_text: referenceText,
        session_label: sessionLabel,
        recognized_text: recognizedText,
        audio_duration_ms: audioDurationMs,
        audio_storage_path: null,
        overall_score: aggregate.overall ?? null,
        accuracy_score: aggregate.accuracy ?? null,
        fluency_score: aggregate.fluency ?? null,
        completeness_score: aggregate.completeness ?? null,
        prosody_score: aggregate.prosody ?? null,
        azure_detail: detail ? scrub(detail) : null,
        azure_raw: raw ? scrub(raw) : null,
        extra_metrics: scrub({
          aggregate,
          detail,
          raw,
          extra,
        }),
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      runId: data?.id,
    });
  } catch (error) {
    console.error('[pronunciation-test] stream log 保存失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  }
}
