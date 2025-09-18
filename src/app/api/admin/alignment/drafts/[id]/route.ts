export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await auth.supabase
    .from('alignment_packs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data)
    return NextResponse.json({ error: error?.message || 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, pack: data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const patch: any = {};
  for (const k of ['topic', 'tags', 'preferred_style', 'steps']) if (k in body) patch[k] = body[k];
  const { id } = await params;
  const { error } = await auth.supabase.from('alignment_packs').update(patch).eq('id', id);
  if (error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action } = await req.json();
  const { id } = await params;
  if (action === 'publish') {
    const { error } = await auth.supabase
      .from('alignment_packs')
      .update({ status: 'published' })
      .eq('id', id);
    if (error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    return NextResponse.json({ ok: true });
  }
  if (action === 'archive') {
    const { error } = await auth.supabase
      .from('alignment_packs')
      .update({ status: 'archived' })
      .eq('id', id);
    if (error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 400 },
      );
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
