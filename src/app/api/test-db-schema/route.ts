import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 检查user_permissions表结构
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .limit(1);

    if (error) {
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: error instanceof Error ? error.message : String(error) 
      }, { status: 500 });
    }

    // 检查表结构
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'user_permissions' });

    return NextResponse.json({
      success: true,
      sampleData: data?.[0] || null,
      columns: columns || 'Could not fetch columns',
      hasApiKeys: data?.[0]?.api_keys !== undefined,
      hasAiEnabled: data?.[0]?.ai_enabled !== undefined,
      hasModelPermissions: data?.[0]?.model_permissions !== undefined
    });

  } catch (error) {
    console.error('Schema check error:', error);
    return NextResponse.json(
      { error: 'Schema check failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
