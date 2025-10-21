import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface UserPermissions {
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  model_permissions: Array<{
    provider: 'openai' | 'openrouter' | 'deepseek' | string;
    model: string;
    allowed?: boolean;
    max_tokens_per_request?: number;
  }>;
  api_keys?: {
    deepseek?: string;
    openrouter?: string;
  };
  ai_enabled: boolean;
  custom_restrictions: Record<string, unknown>;
}

const defaultPermissions: UserPermissions = {
  can_access_shadowing: true,
  can_access_cloze: true,
  can_access_alignment: true,
  can_access_articles: true,
  allowed_languages: ['en', 'ja', 'zh', 'ko'],
  allowed_levels: [1, 2, 3, 4, 5],
  max_daily_attempts: 50,
  model_permissions: [],
  api_keys: {
    deepseek: '',
    openrouter: '',
  },
  ai_enabled: false,
  custom_restrictions: {},
};

export async function getUserPermissions(userId: string): Promise<UserPermissions> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userPermissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('获取用户权限失败，使用默认权限:', error);
      return defaultPermissions;
    }

    if (userPermissions) {
      // 规范化权限字段，避免类型不一致导致过滤全空
      const normalizedAllowedLanguages = Array.isArray(userPermissions.allowed_languages)
        ? (userPermissions.allowed_languages as unknown[])
            .map((l) => String(l))
            .filter((v) => Boolean(v))
        : ['en', 'ja', 'zh'];
      const normalizedAllowedLevels = Array.isArray(userPermissions.allowed_levels)
        ? (userPermissions.allowed_levels as unknown[])
            .map((lv) => (typeof lv === 'number' ? lv : parseInt(String(lv), 10)))
            .filter((n) => Number.isFinite(n as number))
        : [1, 2, 3, 4, 5];

      return {
        can_access_shadowing: userPermissions.can_access_shadowing ?? true,
        can_access_cloze: userPermissions.can_access_cloze ?? true,
        can_access_alignment: userPermissions.can_access_alignment ?? true,
        can_access_articles: userPermissions.can_access_articles ?? true,
        allowed_languages: normalizedAllowedLanguages,
        allowed_levels: normalizedAllowedLevels,
        max_daily_attempts: userPermissions.max_daily_attempts ?? 50,
        model_permissions: userPermissions.model_permissions ?? [],
        api_keys: userPermissions.api_keys ?? defaultPermissions.api_keys,
        ai_enabled: userPermissions.ai_enabled ?? false,
        custom_restrictions: userPermissions.custom_restrictions ?? {},
      };
    }

    return defaultPermissions;
  } catch (error) {
    console.error('获取用户权限时出错:', error);
    return defaultPermissions;
  }
}

export function checkLevelPermission(permissions: UserPermissions, level: number): boolean {
  return permissions.allowed_levels.includes(level);
}

export function checkLanguagePermission(permissions: UserPermissions, language: string): boolean {
  return permissions.allowed_languages.includes(language);
}

export function checkAccessPermission(
  permissions: UserPermissions,
  feature: keyof Pick<
    UserPermissions,
    'can_access_shadowing' | 'can_access_cloze' | 'can_access_alignment' | 'can_access_articles'
  >,
): boolean {
  return permissions[feature];
}
