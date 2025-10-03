export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const { source_item_id, sentence_indexes, publish } = await req.json();
    if (!source_item_id) return NextResponse.json({ error: 'missing source_item_id' }, { status: 400 });

    const supabase = getServiceSupabase();
    let query = supabase
      .from('cloze_shadowing_items')
      .update({ is_published: !!publish })
      .eq('source_item_id', source_item_id);

    if (Array.isArray(sentence_indexes) && sentence_indexes.length > 0) {
      query = query.in('sentence_index', sentence_indexes);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 });
  }
}


