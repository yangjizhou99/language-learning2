export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }
    
    const { id, lang, level, topic = '', title, passage, blanks, status = 'draft', ai_provider, ai_model, ai_usage } = await req.json();
    
    if (!title || !passage || !Array.isArray(blanks)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 验证 blanks 结构
    for (const blank of blanks) {
      if (!blank.id || !blank.answer || !Array.isArray(blank.acceptable)) {
        return NextResponse.json({ error: 'Invalid blanks structure' }, { status: 400 });
      }
    }

    const supabaseAdmin = getServiceSupabase();
    const { data, error } = await supabaseAdmin
      .from('cloze_drafts')
      .upsert({
        id: id || undefined,
        lang,
        level,
        topic,
        title,
        passage,
        blanks,
        ai_provider,
        ai_model,
        ai_usage,
        status,
        created_by: adminResult.user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Save cloze draft error:', error);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('Save cloze draft error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Internal server error' 
    }, { status: 500 });
  }
}
