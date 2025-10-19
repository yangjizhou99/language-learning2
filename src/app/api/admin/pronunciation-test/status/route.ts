import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const status =
      auth.reason === 'unauthorized'
        ? 401
        : auth.reason === 'forbidden'
          ? 403
          : 500;
    return NextResponse.json({ ok: false, reason: auth.reason }, { status });
  }

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;

  return NextResponse.json({
    ok: true,
    azureConfigured: Boolean(azureKey && azureRegion),
    hasKey: Boolean(azureKey),
    hasRegion: Boolean(azureRegion),
  });
}
