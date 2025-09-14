import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    const results = [];
    
    // 执行迁移SQL
    const migrationSQL = `
      -- 添加API密钥字段
      ALTER TABLE user_permissions 
      ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '{
        "deepseek": "",
        "openrouter": ""
      }'::jsonb;

      -- 添加AI功能开关字段
      ALTER TABLE user_permissions 
      ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT false;

      -- 为现有用户设置默认值
      UPDATE user_permissions 
      SET api_keys = '{
        "deepseek": "",
        "openrouter": ""
      }'::jsonb
      WHERE api_keys IS NULL;

      UPDATE user_permissions 
      SET ai_enabled = false
      WHERE ai_enabled IS NULL;

      -- 创建索引以提高查询性能
      CREATE INDEX IF NOT EXISTS idx_user_permissions_api_keys 
      ON user_permissions USING GIN (api_keys);

      CREATE INDEX IF NOT EXISTS idx_user_permissions_ai_enabled 
      ON user_permissions (ai_enabled);
    `;

    // 分割SQL语句并逐个执行
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        const { error } = await supabase.rpc('exec', { sql: statement });
        if (error) {
          results.push({ statement: statement.substring(0, 50) + '...', error: error.message });
        } else {
          results.push({ statement: statement.substring(0, 50) + '...', success: true });
        }
      } catch (e) {
        results.push({ statement: statement.substring(0, 50) + '...', error: e.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migration applied successfully',
      results
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}
