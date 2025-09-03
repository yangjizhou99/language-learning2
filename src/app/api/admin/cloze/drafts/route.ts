import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const supabaseAdmin = getServiceSupabase();
    const { data: drafts, error } = await supabaseAdmin
      .from('cloze_drafts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cloze drafts:', error);
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }

    return NextResponse.json(drafts || []);
  } catch (error) {
    console.error('Error in cloze drafts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
