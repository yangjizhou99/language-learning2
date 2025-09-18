import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    const results = [];

    // 先测试字段是否存在
    try {
      const { data: testData, error: testError } = await supabase
        .from('user_permissions')
        .select('model_permissions')
        .limit(1);

      if (testError) {
        results.push({
          action: 'test_model_permissions',
          error: testError.message,
          code: testError.code,
        });

        // 如果字段不存在，需要添加
        if (testError.code === '42703') {
          results.push({
            action: 'model_permissions_missing',
            message: 'model_permissions field is missing',
          });
        }
      } else {
        results.push({
          action: 'test_model_permissions',
          success: true,
          message: 'model_permissions field exists',
          sampleData: testData?.[0],
        });
      }
    } catch (e) {
      results.push({
        action: 'test_model_permissions',
        error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e),
      });
    }

    // 尝试添加字段（通过直接操作）
    try {
      // 由于无法直接执行ALTER TABLE，我们通过插入数据来测试
      const { data: existingData } = await supabase
        .from('user_permissions')
        .select('id, user_id')
        .limit(1);

      if (existingData && existingData.length > 0) {
        const { error: updateError } = await supabase
          .from('user_permissions')
          .update({
            model_permissions: [
              {
                model_id: 'deepseek-chat',
                model_name: 'DeepSeek Chat',
                provider: 'deepseek',
                daily_limit: 50,
                token_limit: 100000,
                enabled: true,
              },
            ],
          })
          .eq('id', existingData[0].id);

        if (updateError) {
          results.push({
            action: 'test_update_model_permissions',
            error: updateError.message,
            code: updateError.code,
          });
        } else {
          results.push({
            action: 'test_update_model_permissions',
            success: true,
            message: 'model_permissions field can be updated',
          });
        }
      }
    } catch (e) {
      results.push({
        action: 'test_update_model_permissions',
        error: e instanceof Error ? (e instanceof Error ? e.message : String(e)) : String(e),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Model permissions check completed',
      results,
    });
  } catch (error) {
    console.error('Model permissions check error:', error);
    return NextResponse.json(
      {
        error: 'Model permissions check failed',
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
