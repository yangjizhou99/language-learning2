import { supabase } from './supabase';

export interface DefaultPermissions {
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  ai_enabled: boolean;
  api_keys: {
    deepseek?: string;
    openrouter?: string;
  };
  model_permissions: Array<{
    model_id: string;
    model_name: string;
    provider: string;
    daily_limit: number;
    token_limit: number;
    enabled: boolean;
  }>;
  custom_restrictions: Record<string, any>;
}

/**
 * 获取默认权限设置
 */
export async function getDefaultPermissions(): Promise<DefaultPermissions> {
  try {
    const { data: defaultPerms, error } = await supabase
      .from('default_user_permissions')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('获取默认权限设置失败:', error);
      throw error;
    }

    if (defaultPerms) {
      return {
        can_access_shadowing: defaultPerms.can_access_shadowing ?? true,
        can_access_cloze: defaultPerms.can_access_cloze ?? true,
        can_access_alignment: defaultPerms.can_access_alignment ?? true,
        can_access_articles: defaultPerms.can_access_articles ?? true,
        allowed_languages: defaultPerms.allowed_languages || ['en', 'ja', 'zh'],
        allowed_levels: defaultPerms.allowed_levels || [1, 2, 3, 4, 5],
        max_daily_attempts: defaultPerms.max_daily_attempts || 50,
        ai_enabled: defaultPerms.ai_enabled || false,
        api_keys: defaultPerms.api_keys || { deepseek: '', openrouter: '' },
        model_permissions: defaultPerms.model_permissions || [
          {
            model_id: 'deepseek-chat',
            model_name: 'DeepSeek Chat',
            provider: 'deepseek',
            daily_limit: 50,
            token_limit: 100000,
            enabled: true,
          },
          {
            model_id: 'openrouter/auto',
            model_name: 'OpenRouter Auto (推荐)',
            provider: 'openrouter',
            daily_limit: 30,
            token_limit: 80000,
            enabled: true,
          },
        ],
        custom_restrictions: defaultPerms.custom_restrictions || {},
      };
    }

    // 如果没有默认权限记录，返回系统默认值
    return {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 50,
      ai_enabled: false,
      api_keys: { deepseek: '', openrouter: '' },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 50,
          token_limit: 100000,
          enabled: true,
        },
        {
          model_id: 'openrouter/auto',
          model_name: 'OpenRouter Auto (推荐)',
          provider: 'openrouter',
          daily_limit: 30,
          token_limit: 80000,
          enabled: true,
        },
      ],
      custom_restrictions: {},
    };
  } catch (error) {
    console.error('获取默认权限设置失败:', error);
    // 返回系统默认值
    return {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 50,
      ai_enabled: false,
      api_keys: { deepseek: '', openrouter: '' },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 50,
          token_limit: 100000,
          enabled: true,
        },
        {
          model_id: 'openrouter/auto',
          model_name: 'OpenRouter Auto (推荐)',
          provider: 'openrouter',
          daily_limit: 30,
          token_limit: 80000,
          enabled: true,
        },
      ],
      custom_restrictions: {},
    };
  }
}

/**
 * 为新用户应用默认权限
 */
export async function applyDefaultPermissionsToUser(userId: string): Promise<boolean> {
  try {
    // 检查用户是否已有权限记录
    const { data: existingPermissions } = await supabase
      .from('user_permissions')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle?.();

    // 如果已有权限记录，不覆盖
    if (existingPermissions) {
      console.log(`用户 ${userId} 已有权限记录，跳过默认权限应用`);
      return true;
    }

    // 获取默认权限设置
    const defaultPermissions = await getDefaultPermissions();

    // 构建权限数据
    const permissionsData = {
      user_id: userId,
      can_access_shadowing: defaultPermissions.can_access_shadowing,
      can_access_cloze: defaultPermissions.can_access_cloze,
      can_access_alignment: defaultPermissions.can_access_alignment,
      can_access_articles: defaultPermissions.can_access_articles,
      allowed_languages: defaultPermissions.allowed_languages,
      allowed_levels: defaultPermissions.allowed_levels,
      max_daily_attempts: defaultPermissions.max_daily_attempts,
      custom_restrictions: {
        ...defaultPermissions.custom_restrictions,
        model_permissions: defaultPermissions.model_permissions,
        ai_enabled: defaultPermissions.ai_enabled,
        api_keys: defaultPermissions.api_keys,
      },
    };

    // 创建用户权限记录
    const { error } = await supabase.from('user_permissions').insert({
      id: (globalThis as any)?.crypto?.randomUUID?.() || undefined,
      ...permissionsData,
    });

    if (error) {
      console.error(`为用户 ${userId} 应用默认权限失败:`, error);
      return false;
    }

    console.log(`成功为用户 ${userId} 应用默认权限`);
    return true;
  } catch (error) {
    console.error(`为用户 ${userId} 应用默认权限失败:`, error);
    return false;
  }
}

/**
 * 检查用户权限是否过期
 */
export async function checkUserPermissionsExpiry(userId: string): Promise<boolean> {
  try {
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('custom_restrictions')
      .eq('user_id', userId)
      .single();

    if (!permissions?.custom_restrictions?.expires_at) {
      return true; // 没有过期时间，权限有效
    }

    const expiresAt = new Date(permissions.custom_restrictions.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      // 权限已过期，禁用用户
      await supabase
        .from('user_permissions')
        .update({
          can_access_shadowing: false,
          can_access_cloze: false,
          can_access_alignment: false,
          can_access_articles: false,
          max_daily_attempts: 0,
        })
        .eq('user_id', userId);

      return false;
    }

    return true;
  } catch (error) {
    console.error(`检查用户权限过期失败:`, error);
    return true; // 出错时保持权限有效
  }
}
