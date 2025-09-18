export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json(
        { error: adminResult.reason },
        { status: adminResult.reason === 'unauthorized' ? 401 : 403 },
      );
    }

    const { id } = await params;
    const { data: draft, error } = await adminResult.supabase
      .from('cloze_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
