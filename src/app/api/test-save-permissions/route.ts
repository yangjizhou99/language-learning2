import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 测试保存权限数据
    const testPermissions = {
      user_id: '02c3f65f-5b06-433a-a8e0-ad7e245a3748', // 使用现有的用户ID
      can_access_shadowing: true,
      can_access_cloze: false,
      can_access_alignment: false,
      can_access_articles: false,
      allowed_languages: ['zh'],
      allowed_levels: [1, 2],
      max_daily_attempts: 30,
      api_keys: {
        deepseek: 'test-key-123',
        openrouter: 'test-or-key-456'
      },
      ai_enabled: true,
      custom_restrictions: {}
    };

    const { data, error } = await supabase
      .from('user_permissions')
      .upsert(testPermissions, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });

    if (error) {
      return NextResponse.json({ 
        error: 'Save test failed', 
        details: error instanceof Error ? error.message : String(error),
        code: error.code
      }, { status: 500 });
    }

    // 验证保存的数据
    const { data: savedData, error: fetchError } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', testPermissions.user_id)
      .single();

    if (fetchError) {
      return NextResponse.json({ 
        error: 'Fetch test failed', 
        details: fetchError.message 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Save test completed successfully',
      savedData: {
        allowed_levels: savedData.allowed_levels,
        can_access_cloze: savedData.can_access_cloze,
        api_keys: savedData.api_keys,
        ai_enabled: savedData.ai_enabled
      }
    });

  } catch (error) {
    console.error('Save test error:', error);
    return NextResponse.json(
      { error: 'Save test failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
