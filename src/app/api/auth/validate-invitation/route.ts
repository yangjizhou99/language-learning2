import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// POST /api/auth/validate-invitation - 验证邀请码
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: '邀请码不能为空' }, { status: 400 });
    }

    // 验证邀请码格式（8位字母数字组合）
    if (!/^[A-Z0-9]{8}$/.test(code)) {
      return NextResponse.json({ error: '邀请码格式不正确' }, { status: 400 });
    }

    // 使用service role客户端验证邀请码
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: validationResult, error: validationError } = await supabaseService.rpc(
      'validate_invitation_code',
      { code_text: code },
    );

    if (validationError) {
      console.error('验证邀请码失败:', validationError);
      return NextResponse.json(
        {
          success: false,
          error: '验证邀请码时发生错误',
        },
        { status: 500 },
      );
    }

    if (!validationResult || validationResult.length === 0 || !validationResult[0].is_valid) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult?.[0]?.error_message || '邀请码无效',
        },
        { status: 400 },
      );
    }

    const result = validationResult[0];
    return NextResponse.json({
      success: true,
      data: {
        code_id: result.code_id,
        max_uses: result.max_uses,
        used_count: result.used_count,
        expires_at: result.expires_at,
        permissions: result.permissions,
      },
      message: '邀请码验证成功',
    });
  } catch (error) {
    console.error('验证邀请码失败:', error);
    return NextResponse.json({ error: '验证邀请码时发生错误' }, { status: 500 });
  }
}
