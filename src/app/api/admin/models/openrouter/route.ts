export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
    };
    if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
    if (process.env.OPENROUTER_SITE_NAME) headers['X-Title'] = process.env.OPENROUTER_SITE_NAME;

    const r = await fetch('https://openrouter.ai/api/v1/models', { headers, cache: 'no-store' });
    if (!r.ok) {
      const t = await r.text();
      return NextResponse.json({ error: t || `Upstream ${r.status}` }, { status: 502 });
    }
    const j = await r.json();
    const list = Array.isArray(j.data) ? j.data : [];
    const models = list
      .map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        context_length: m.context_length,
        pricing: m.pricing || null,
        top_provider: m.top_provider || null,
      }))
      .filter((m: any) => typeof m.id === 'string')
      .sort((a: any, b: any) => a.id.localeCompare(b.id));
    return NextResponse.json({ ok: true, models });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
