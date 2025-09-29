import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  validateInvitationCode,
  useInvitationCode,
  applyInvitationPermissions,
  applyInvitationApiLimits,
} from '@/lib/invitation';
import type { RegisterWithInvitationRequest } from '@/types/invitation';

// POST /api/auth/register-with-invitation - 使用邀请码注册
export async function POST(req: NextRequest) {
  try {
    const body: RegisterWithInvitationRequest = await req.json();
    const { email, password, invitation_code, username, native_lang, target_langs } = body;

    // 验证必填字段
    if (!email || !password || !invitation_code) {
      return NextResponse.json({ error: '邮箱、密码和邀请码都是必填项' }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: '邮箱格式不正确' }, { status: 400 });
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({ error: '密码长度至少6位' }, { status: 400 });
    }

    // 验证邀请码
    const validationResult = await validateInvitationCode(invitation_code);
    if (!validationResult.is_valid) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error_message || '邀请码无效',
        },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseServiceRole) {
      return NextResponse.json({ error: '服务器配置错误' }, { status: 500 });
    }

    // 使用service role创建用户
    const supabase = createClient(supabaseUrl, supabaseServiceRole);

    // 先检查用户是否已存在
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers.users.find((user) => user.email === email);

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: '该邮箱已被注册，请直接登录或使用其他邮箱',
        },
        { status: 400 },
      );
    }

    // 创建用户
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 自动确认邮箱
    });

    if (authError) {
      console.error('创建用户失败:', authError);
      return NextResponse.json(
        {
          success: false,
          error: authError.message,
        },
        { status: 400 },
      );
    }

    if (!authData.user) {
      return NextResponse.json({ error: '用户创建失败' }, { status: 500 });
    }

    const userId = authData.user.id;

    try {
      // 创建用户资料
      const { error: profileError } = await supabase.from('profiles').insert({
        id: userId,
        username: username || email.split('@')[0],
        native_lang: native_lang || 'zh',
        target_langs: target_langs || ['en'],
        invited_by: null, // 这里可以设置邀请者，需要从邀请码中获取
        invitation_code_id: validationResult.code_id,
        invitation_used_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('创建用户资料失败:', profileError);
        // 如果资料创建失败，删除已创建的用户
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: '创建用户资料失败' }, { status: 500 });
      }

      // 记录邀请码使用（服务端兜底获取并校验 codeId，确保写入和计数更新）
      let codeId = validationResult.code_id;
      if (!codeId) {
        const { data: codeRow, error: codeFetchErr } = await supabase
          .from('invitation_codes')
          .select('id, used_count, max_uses, is_active, expires_at')
          .eq('code', invitation_code)
          .single();

        if (codeFetchErr || !codeRow) {
          console.error('获取邀请码信息失败:', codeFetchErr);
          return NextResponse.json(
            {
              success: false,
              error: '无法获取邀请码信息',
            },
            { status: 500 },
          );
        }

        if (codeRow.is_active === false) {
          return NextResponse.json(
            { success: false, error: '邀请码已被禁用' },
            { status: 400 },
          );
        }

        if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
          return NextResponse.json(
            { success: false, error: '邀请码已过期' },
            { status: 400 },
          );
        }

        if ((codeRow.used_count || 0) >= (codeRow.max_uses || 1)) {
          return NextResponse.json(
            { success: false, error: '邀请码已被使用完' },
            { status: 400 },
          );
        }

        codeId = codeRow.id;
      }

      const useResult = await useInvitationCode(codeId!, userId, supabase);
      if (!useResult.success) {
        console.error('记录邀请码使用失败:', useResult.error);
        return NextResponse.json(
          {
            success: false,
            error: `记录邀请码使用失败: ${useResult.error}`,
          },
          { status: 500 },
        );
      }

      // 应用邀请码权限（直接使用邀请码权限，不检测冲突）
      if (validationResult.permissions) {
        console.log(`应用邀请码权限，用户: ${userId}, 邀请码: ${invitation_code}`);

        // 应用邀请码权限
        const permissionResult = await applyInvitationPermissions(
          userId,
          validationResult.permissions,
          supabase,
        );
        if (!permissionResult.success) {
          console.error('应用邀请码权限失败:', permissionResult.error);
          return NextResponse.json(
            {
              success: false,
              error: '应用邀请码权限失败',
            },
            { status: 500 },
          );
        }

        // 应用API使用限制：即使未提供也写入默认禁用配置，保证产生记录
        const defaultApiLimits = {
          enabled: false,
          daily_calls_limit: 0,
          daily_tokens_limit: 0,
          daily_cost_limit: 0,
          monthly_calls_limit: 0,
          monthly_tokens_limit: 0,
          monthly_cost_limit: 0,
        } as const;

        const apiLimitsPayload = {
          ...defaultApiLimits,
          ...(validationResult.permissions.api_limits || {}),
        };

        const apiLimitsResult = await applyInvitationApiLimits(
          userId,
          apiLimitsPayload,
          supabase,
        );
        if (!apiLimitsResult.success) {
          console.error('应用邀请码API限制失败:', apiLimitsResult.error);
          // 不阻止注册流程，只记录错误
        }
      } else {
        console.error('邀请码没有权限设置');
        return NextResponse.json(
          {
            success: false,
            error: '邀请码没有权限设置',
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: userId,
            email: authData.user.email,
            username: username || email.split('@')[0],
          },
        },
        message: '注册成功',
      });
    } catch (error) {
      console.error('注册流程异常:', error);
      // 如果出现异常，尝试删除已创建的用户
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('清理用户失败:', deleteError);
      }
      return NextResponse.json({ error: '注册过程中发生错误' }, { status: 500 });
    }
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json({ error: '注册时发生错误' }, { status: 500 });
  }
}
