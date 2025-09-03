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
    const { data: items, error } = await supabaseAdmin
      .from('cloze_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cloze items:', error);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    return NextResponse.json(items || []);
  } catch (error) {
    console.error('Error in cloze items API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
