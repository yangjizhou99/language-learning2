import { supabase } from './supabase';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID as nodeRandomUUID } from 'crypto';
import type {
  InvitationCode,
  InvitationUse,
  InvitationPermissions,
  InvitationValidationResult,
  CreateInvitationRequest,
  UpdateInvitationRequest,
} from '@/types/invitation';

/**
 * 生成安全的邀请码
 */
export function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 验证邀请码是否有效
 */
export async function validateInvitationCode(code: string): Promise<InvitationValidationResult> {
  try {
    // 在客户端环境中，通过API调用验证邀请码
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/auth/validate-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          is_valid: false,
          error_message: errorData.error || '验证邀请码失败',
        };
      }

      const data = await response.json();
      return {
        is_valid: data.success,
        code_id: data.data?.code_id,
        max_uses: data.data?.max_uses,
        used_count: data.data?.used_count,
        expires_at: data.data?.expires_at,
        permissions: data.data?.permissions,
        error_message: data.success ? null : data.error || '邀请码无效',
      };
    }

    // 在服务器端环境中，使用service role客户端
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabaseService.rpc('validate_invitation_code', {
      code_text: code,
    });

    if (error) {
      console.error('验证邀请码失败:', error);
      return {
        is_valid: false,
        error_message: '验证邀请码时发生错误',
      };
    }

    if (!data || data.length === 0) {
      return {
        is_valid: false,
        error_message: '邀请码不存在',
      };
    }

    const result = data[0];
    return {
      is_valid: result.is_valid,
      code_id: result.code_id,
      max_uses: result.max_uses,
      used_count: result.used_count,
      expires_at: result.expires_at,
      permissions: result.permissions,
      error_message: result.error_message,
    };
  } catch (error) {
    console.error('验证邀请码异常:', error);
    return {
      is_valid: false,
      error_message: '验证邀请码时发生异常',
    };
  }
}

/**
 * 创建邀请码
 */
export async function createInvitationCode(
  request: CreateInvitationRequest,
  createdBy: string,
  supabaseClient?: SupabaseClient,
): Promise<{ success: boolean; data?: InvitationCode; error?: string }> {
  try {
    const client = supabaseClient || supabase;

    // 生成唯一邀请码
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateInvitationCode();
      const { data: existing } = await client
        .from('invitation_codes')
        .select('id')
        .eq('code', code)
        .single();

      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return { success: false, error: '无法生成唯一邀请码' };
    }

    // 兜底：显式生成UUID，避免目标库缺少默认值时 id 为 NULL
    const { data, error } = await client
      .from('invitation_codes')
      .insert({
        // 使用数据库默认值时可省略 id；但若目标库未设置默认值，则需要显式提供
        id:
          typeof globalThis !== 'undefined' && (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
            ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto!.randomUUID!()
            : nodeRandomUUID(),
        code,
        created_by: createdBy,
        max_uses: request.max_uses || 1,
        used_count: 0,
        is_active: true,
        expires_at: request.expires_at,
        permissions: request.permissions || {},
        description: request.description,
      })
      .select()
      .single();

    if (error) {
      console.error('创建邀请码失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('创建邀请码异常:', error);
    return { success: false, error: '创建邀请码时发生异常' };
  }
}

/**
 * 获取邀请码列表
 */
export async function getInvitationCodes(
  page: number = 1,
  limit: number = 20,
  createdBy?: string,
  supabaseClient?: SupabaseClient,
): Promise<{ data: InvitationCode[]; total: number; error?: string }> {
  try {
    const client = supabaseClient || supabase;

    let query = client
      .from('invitation_codes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (createdBy) {
      query = query.eq('created_by', createdBy);
    }

    const { data, error, count } = await query.range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('获取邀请码列表失败:', error);
      return { data: [], total: 0, error: error.message };
    }

    return { data: data || [], total: count || 0 };
  } catch (error) {
    console.error('获取邀请码列表异常:', error);
    return { data: [], total: 0, error: '获取邀请码列表时发生异常' };
  }
}

/**
 * 更新邀请码
 */
export async function updateInvitationCode(
  id: string,
  request: UpdateInvitationRequest,
): Promise<{ success: boolean; data?: InvitationCode; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('invitation_codes')
      .update(request)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新邀请码失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('更新邀请码异常:', error);
    return { success: false, error: '更新邀请码时发生异常' };
  }
}

/**
 * 删除邀请码
 */
export async function deleteInvitationCode(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('invitation_codes').delete().eq('id', id);

    if (error) {
      console.error('删除邀请码失败:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('删除邀请码异常:', error);
    return { success: false, error: '删除邀请码时发生异常' };
  }
}

/**
 * 使用邀请码
 */
export async function useInvitationCode(
  codeId: string,
  userId: string,
  supabaseClient?: SupabaseClient,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = supabaseClient || supabase;

    // 检查是否已经使用过
    const { data: existingUse } = await client
      .from('invitation_uses')
      .select('id')
      .eq('code_id', codeId)
      .eq('used_by', userId)
      .single();

    if (existingUse) {
      return { success: false, error: '您已经使用过此邀请码' };
    }

    // 创建使用记录
    const { error: useError } = await client.from('invitation_uses').insert({
      // 兜底提供主键，避免目标库未设置默认值时 id 为空
      id:
        typeof globalThis !== 'undefined' && (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
          ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto!.randomUUID!()
          : nodeRandomUUID(),
      code_id: codeId,
      used_by: userId,
    });

    if (useError) {
      console.error('记录邀请码使用失败:', useError);
      return { success: false, error: useError.message };
    }

    // 更新使用计数 - 先获取当前值，然后更新
    const { data: currentCode, error: fetchError } = await client
      .from('invitation_codes')
      .select('used_count')
      .eq('id', codeId)
      .single();

    if (fetchError) {
      console.error('获取邀请码当前使用计数失败:', fetchError);
      return { success: false, error: '获取邀请码信息失败' };
    }

    const { error: updateError } = await client
      .from('invitation_codes')
      .update({ used_count: (currentCode.used_count || 0) + 1 })
      .eq('id', codeId);

    if (updateError) {
      console.error('更新邀请码使用计数失败:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('使用邀请码异常:', error);
    return { success: false, error: '使用邀请码时发生异常' };
  }
}

/**
 * 获取邀请码使用记录
 */
export async function getInvitationUses(
  codeId: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ data: InvitationUse[]; total: number; error?: string }> {
  try {
    const { data, error, count } = await supabase
      .from('invitation_uses')
      .select('*', { count: 'exact' })
      .eq('code_id', codeId)
      .order('used_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error('获取邀请码使用记录失败:', error);
      return { data: [], total: 0, error: error.message };
    }

    return { data: data || [], total: count || 0 };
  } catch (error) {
    console.error('获取邀请码使用记录异常:', error);
    return { data: [], total: 0, error: '获取邀请码使用记录时发生异常' };
  }
}

/**
 * 应用邀请码权限到用户
 */
export async function applyInvitationPermissions(
  userId: string,
  permissions: InvitationPermissions,
  supabaseClient?: SupabaseClient,
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = supabaseClient || supabase;

    // 检查用户是否已有权限记录
    const { data: existingPermissions } = await client
      .from('user_permissions')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingPermissions) {
      // 更新现有权限（邀请码注册总是覆盖现有权限）
      const { error } = await client
        .from('user_permissions')
        .update({
          can_access_shadowing: permissions.can_access_shadowing,
          can_access_cloze: permissions.can_access_cloze,
          can_access_alignment: permissions.can_access_alignment,
          can_access_articles: permissions.can_access_articles,
          allowed_languages: permissions.allowed_languages,
          allowed_levels: permissions.allowed_levels,
          max_daily_attempts: permissions.max_daily_attempts,
          ai_enabled: permissions.ai_enabled ?? false,
          api_keys: permissions.api_keys || { deepseek: '', openrouter: '' },
          model_permissions: permissions.model_permissions || [],
          custom_restrictions: permissions.custom_restrictions || {},
        })
        .eq('user_id', userId);

      if (error) {
        console.error('更新用户权限失败:', error);
        return { success: false, error: error.message };
      }
    } else {
      // 创建新权限记录
      const { error } = await client.from('user_permissions').insert({
        user_id: userId,
        can_access_shadowing: permissions.can_access_shadowing ?? true,
        can_access_cloze: permissions.can_access_cloze ?? true,
        can_access_alignment: permissions.can_access_alignment ?? true,
        can_access_articles: permissions.can_access_articles ?? true,
        allowed_languages: permissions.allowed_languages || ['en', 'ja', 'zh'],
        allowed_levels: permissions.allowed_levels || [1, 2, 3, 4, 5],
        max_daily_attempts: permissions.max_daily_attempts || 50,
        ai_enabled: permissions.ai_enabled ?? false,
        api_keys: permissions.api_keys || { deepseek: '', openrouter: '' },
        model_permissions: permissions.model_permissions || [],
        custom_restrictions: permissions.custom_restrictions || {},
      });

      if (error) {
        console.error('创建用户权限失败:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('应用邀请码权限异常:', error);
    return { success: false, error: '应用邀请码权限时发生异常' };
  }
}

/**
 * 应用邀请码API限制到用户
 */
export async function applyInvitationApiLimits(
  userId: string,
  apiLimits: InvitationPermissions['api_limits'],
  supabaseClient?: SupabaseClient,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!apiLimits) {
      return { success: true };
    }

    const client = supabaseClient || supabase;

    // 统一数值类型，避免字符串导致写入失败
    const toInt = (value: unknown): number => {
      const n = typeof value === 'string' ? parseInt(value, 10) : (value as number);
      return Number.isFinite(n as number) ? Math.max(0, Number(n)) : 0;
    };

    const toFloat = (value: unknown): number => {
      const n = typeof value === 'string' ? parseFloat(value) : (value as number);
      return Number.isFinite(n as number) ? Math.max(0, Number(n)) : 0;
    };

    const limitsData = {
      user_id: userId,
      enabled: Boolean(apiLimits.enabled ?? false),
      daily_calls_limit: toInt(apiLimits.daily_calls_limit ?? 0),
      daily_tokens_limit: toInt(apiLimits.daily_tokens_limit ?? 0),
      daily_cost_limit: toFloat(apiLimits.daily_cost_limit ?? 0),
      monthly_calls_limit: toInt(apiLimits.monthly_calls_limit ?? 0),
      monthly_tokens_limit: toInt(apiLimits.monthly_tokens_limit ?? 0),
      monthly_cost_limit: toFloat(apiLimits.monthly_cost_limit ?? 0),
    };

    // 优先尝试 upsert（期望存在 UNIQUE(user_id)）
    const { error } = await client.from('user_api_limits').upsert(limitsData, {
      onConflict: 'user_id',
    });

    if (error) {
      // 兼容性回退：若库里缺少 UNIQUE(user_id) 导致 42P10，则改为先查后插/改
      const pgCode = (error as { code?: string; message?: string }).code;
      if (pgCode === '42P10' || /no unique|ON CONFLICT/i.test(String((error as { message?: string }).message || ''))) {
        // 先查是否存在
        const { data: existing, error: qErr } = await client
          .from('user_api_limits')
          .select('id')
          .eq('user_id', userId)
          .single();

        if (qErr && qErr.code !== 'PGRST116') {
          console.error('查询 user_api_limits 失败:', qErr);
          return { success: false, error: qErr.message };
        }

        if (existing) {
          const { error: updErr } = await client
            .from('user_api_limits')
            .update({
              enabled: limitsData.enabled,
              daily_calls_limit: limitsData.daily_calls_limit,
              daily_tokens_limit: limitsData.daily_tokens_limit,
              daily_cost_limit: limitsData.daily_cost_limit,
              monthly_calls_limit: limitsData.monthly_calls_limit,
              monthly_tokens_limit: limitsData.monthly_tokens_limit,
              monthly_cost_limit: limitsData.monthly_cost_limit,
            })
            .eq('user_id', userId);

          if (updErr) {
            console.error('更新 user_api_limits 失败:', updErr);
            return { success: false, error: updErr.message };
          }
        } else {
          const withId = {
            id:
              typeof globalThis !== 'undefined' && (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID
                ? (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto!.randomUUID!()
                : nodeRandomUUID(),
            ...limitsData,
          };
          const { error: insErr } = await client.from('user_api_limits').insert(withId);
          if (insErr) {
            console.error('插入 user_api_limits 失败:', insErr);
            return { success: false, error: insErr.message };
          }
        }
      } else {
        console.error('应用邀请码API限制失败:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('应用邀请码API限制异常:', error);
    return { success: false, error: '应用邀请码API限制时发生异常' };
  }
}
