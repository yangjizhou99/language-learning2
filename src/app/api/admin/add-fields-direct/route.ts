import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    const results = [];

    // 方法1：尝试直接添加字段
    try {
      // 先测试现有字段
      const { data: testData, error: testError } = await supabase
        .from('user_permissions')
        .select('api_keys, ai_enabled')
        .limit(1);

      if (testError) {
        results.push({
          action: 'test_fields',
          error: testError.message,
          code: testError.code,
        });

        // 如果字段不存在，尝试添加
        if (testError.code === '42703') {
          // column does not exist
          results.push({
            action: 'fields_missing',
            message: 'Fields are missing, need to add them manually',
          });
        }
      } else {
        results.push({
          action: 'test_fields',
          success: true,
          message: 'Fields already exist',
          sampleData: testData?.[0],
        });
      }
    } catch (e) {
      results.push({
        action: 'test_fields',
        error:
          e instanceof Error
            ? e instanceof Error
              ? e instanceof Error
                ? e.message
                : String(e)
              : String(e)
            : String(e),
      });
    }

    // 方法2：尝试通过SQL函数添加字段
    try {
      const { error: addApiKeysError } = await supabase.rpc('add_column_if_not_exists', {
        table_name: 'user_permissions',
        column_name: 'api_keys',
        column_type: 'JSONB',
        default_value: '{"deepseek":"","openrouter":""}',
      });

      if (addApiKeysError) {
        results.push({ action: 'add_api_keys', error: addApiKeysError.message });
      } else {
        results.push({ action: 'add_api_keys', success: true });
      }
    } catch (e) {
      results.push({
        action: 'add_api_keys',
        error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e),
      });
    }

    try {
      const { error: addAiEnabledError } = await supabase.rpc('add_column_if_not_exists', {
        table_name: 'user_permissions',
        column_name: 'ai_enabled',
        column_type: 'BOOLEAN',
        default_value: 'false',
      });

      if (addAiEnabledError) {
        results.push({ action: 'add_ai_enabled', error: addAiEnabledError.message });
      } else {
        results.push({ action: 'add_ai_enabled', success: true });
      }
    } catch (e) {
      results.push({
        action: 'add_ai_enabled',
        error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Field addition attempted',
      results,
    });
  } catch (error) {
    console.error('Add fields error:', error);
    return NextResponse.json(
      {
        error: 'Add fields failed',
        details:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : String(error),
      },
      { status: 500 },
    );
  }
}
