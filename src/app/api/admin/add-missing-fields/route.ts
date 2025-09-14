import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    const results = [];
    
    // 添加 model_permissions 字段
    try {
      const { error: modelPermsError } = await supabase
        .from('user_permissions')
        .select('id')
        .limit(1);
      
      if (!modelPermsError) {
        // 使用 raw SQL 添加字段
        const { error: addModelPermsError } = await supabase
          .rpc('exec', {
            sql: `ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS model_permissions JSONB DEFAULT '[]'::jsonb;`
          });
        
        if (addModelPermsError) {
          results.push({ field: 'model_permissions', error: addModelPermsError.message });
        } else {
          results.push({ field: 'model_permissions', success: true });
        }
      }
    } catch (e) {
      results.push({ field: 'model_permissions', error: e.message });
    }

    // 添加 api_keys 字段
    try {
      const { error: addApiKeysError } = await supabase
        .rpc('exec', {
          sql: `ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{"deepseek":"","openrouter":""}'::jsonb;`
        });
      
      if (addApiKeysError) {
        results.push({ field: 'api_keys', error: addApiKeysError.message });
      } else {
        results.push({ field: 'api_keys', success: true });
      }
    } catch (e) {
      results.push({ field: 'api_keys', error: e.message });
    }

    // 添加 ai_enabled 字段
    try {
      const { error: addAiEnabledError } = await supabase
        .rpc('exec', {
          sql: `ALTER TABLE user_permissions ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;`
        });
      
      if (addAiEnabledError) {
        results.push({ field: 'ai_enabled', error: addAiEnabledError.message });
      } else {
        results.push({ field: 'ai_enabled', success: true });
      }
    } catch (e) {
      results.push({ field: 'ai_enabled', error: e.message });
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Add fields error:', error);
    return NextResponse.json(
      { error: 'Add fields failed', details: error.message },
      { status: 500 }
    );
  }
}
