import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    // 添加api_keys字段
    const { error: apiKeysError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE user_permissions 
        ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{
          "deepseek": "",
          "openrouter": ""
        }'::jsonb;
      `,
    });

    if (apiKeysError) {
      console.error('Error adding api_keys column:', apiKeysError);
    }

    // 添加ai_enabled字段
    const { error: aiEnabledError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE user_permissions 
        ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;
      `,
    });

    if (aiEnabledError) {
      console.error('Error adding ai_enabled column:', aiEnabledError);
    }

    // 为现有用户设置默认值
    const { error: updateApiKeysError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE user_permissions 
        SET api_keys = '{
          "deepseek": "",
          "openrouter": ""
        }'::jsonb
        WHERE api_keys IS NULL;
      `,
    });

    if (updateApiKeysError) {
      console.error('Error updating api_keys defaults:', updateApiKeysError);
    }

    const { error: updateAiEnabledError } = await supabase.rpc('exec_sql', {
      sql: `
        UPDATE user_permissions 
        SET ai_enabled = false
        WHERE ai_enabled IS NULL;
      `,
    });

    if (updateAiEnabledError) {
      console.error('Error updating ai_enabled defaults:', updateAiEnabledError);
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
