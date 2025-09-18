import { supabase } from './supabase';
import { checkUserPermissionsExpiry } from './defaultPermissions';

export interface UserPermissions {
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  ai_enabled: boolean;
  custom_restrictions: Record<string, any>;
}

/**
 * 获取用户权限
 */
export async function getUserPermissions(userId: string): Promise<UserPermissions | null> {
  try {
    // 检查权限是否过期
    const isNotExpired = await checkUserPermissionsExpiry(userId);
    if (!isNotExpired) {
      return null; // 权限已过期
    }

    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('获取用户权限失败:', error);
      return null;
    }

    if (!permissions) {
      return null;
    }

    return {
      can_access_shadowing: permissions.can_access_shadowing,
      can_access_cloze: permissions.can_access_cloze,
      can_access_alignment: permissions.can_access_alignment,
      can_access_articles: permissions.can_access_articles,
      allowed_languages: permissions.allowed_languages || [],
      allowed_levels: permissions.allowed_levels || [],
      max_daily_attempts: permissions.max_daily_attempts || 0,
      ai_enabled: permissions.custom_restrictions?.ai_enabled || false,
      custom_restrictions: permissions.custom_restrictions || {},
    };
  } catch (error) {
    console.error('获取用户权限异常:', error);
    return null;
  }
}

/**
 * 检查用户是否有特定权限
 */
export async function hasPermission(
  userId: string,
  permission: keyof Omit<
    UserPermissions,
    'allowed_languages' | 'allowed_levels' | 'custom_restrictions'
  >,
): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) {
    return false;
  }

  return permissions[permission] === true;
}

/**
 * 检查用户是否可以访问特定语言
 */
export async function canAccessLanguage(userId: string, language: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) {
    return false;
  }

  return permissions.allowed_languages.includes(language);
}

/**
 * 检查用户是否可以访问特定难度等级
 */
export async function canAccessLevel(userId: string, level: number): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) {
    return false;
  }

  return permissions.allowed_levels.includes(level);
}

/**
 * 检查用户是否还有每日尝试次数
 */
export async function hasDailyAttemptsLeft(userId: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  if (!permissions) {
    return false;
  }

  if (permissions.max_daily_attempts <= 0) {
    return true; // 无限制
  }

  // 这里可以添加检查今日已使用次数的逻辑
  // 暂时返回true，实际项目中需要查询今日使用记录
  return true;
}

/**
 * 权限检查中间件
 */
export function createPermissionMiddleware(
  requiredPermission: keyof Omit<
    UserPermissions,
    'allowed_languages' | 'allowed_levels' | 'custom_restrictions'
  >,
) {
  return async (userId: string): Promise<{ allowed: boolean; reason?: string }> => {
    const hasAccess = await hasPermission(userId, requiredPermission);

    if (!hasAccess) {
      return {
        allowed: false,
        reason: `需要 ${requiredPermission} 权限`,
      };
    }

    return { allowed: true };
  };
}
