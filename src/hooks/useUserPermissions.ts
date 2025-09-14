import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ModelPermission {
  model_id: string;
  model_name: string;
  provider: string;
  daily_limit: number;
  token_limit: number;
  enabled: boolean;
}

interface UserPermissions {
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number; // 保留向后兼容
  model_permissions: ModelPermission[];
  api_keys?: {
    deepseek?: string;
    openrouter?: string;
  };
  ai_enabled: boolean;
  custom_restrictions: Record<string, any>;
}

const defaultPermissions: UserPermissions = {
  can_access_shadowing: true,
  can_access_cloze: true,
  can_access_alignment: true,
  can_access_articles: true,
  allowed_languages: ['en', 'ja', 'zh'],
  allowed_levels: [1, 2, 3, 4, 5],
  max_daily_attempts: 50,
  model_permissions: [
    {
      model_id: 'deepseek-chat',
      model_name: 'DeepSeek Chat',
      provider: 'deepseek',
      daily_limit: 50,
      token_limit: 100000,
      enabled: true
    },
    {
      model_id: 'openrouter/auto',
      model_name: 'OpenRouter Auto (推荐)',
      provider: 'openrouter',
      daily_limit: 30,
      token_limit: 80000,
      enabled: true
    }
  ],
  api_keys: {
    deepseek: '',
    openrouter: ''
  },
  ai_enabled: false,
  custom_restrictions: {}
};

export default function useUserPermissions() {
  const [permissions, setPermissions] = useState<UserPermissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user?.id) {
          setPermissions(defaultPermissions);
          setLoading(false);
          return;
        }

        // 尝试获取用户权限
        const { data: userPermissions, error } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('获取用户权限失败，使用默认权限:', error);
        }

        if (userPermissions) {
          setPermissions({
            can_access_shadowing: userPermissions.can_access_shadowing ?? true,
            can_access_cloze: userPermissions.can_access_cloze ?? true,
            can_access_alignment: userPermissions.can_access_alignment ?? true,
            can_access_articles: userPermissions.can_access_articles ?? true,
            allowed_languages: userPermissions.allowed_languages ?? ['en', 'ja', 'zh'],
            allowed_levels: userPermissions.allowed_levels ?? [1, 2, 3, 4, 5],
            max_daily_attempts: userPermissions.max_daily_attempts ?? 50,
            model_permissions: userPermissions.model_permissions ?? defaultPermissions.model_permissions,
            api_keys: userPermissions.api_keys ?? defaultPermissions.api_keys,
            custom_restrictions: userPermissions.custom_restrictions ?? {}
          });
        } else {
          // 使用默认权限
          setPermissions(defaultPermissions);
        }
      } catch (error) {
        console.error('获取用户权限时出错:', error);
        setPermissions(defaultPermissions);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchPermissions();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { permissions, loading };
}
