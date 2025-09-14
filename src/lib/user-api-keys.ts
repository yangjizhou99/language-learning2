import { createClient } from '@supabase/supabase-js';

// 从用户权限中获取API密钥
export async function getUserAPIKeys(userId: string): Promise<{
  deepseek?: string;
  openrouter?: string;
} | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('api_keys')
      .eq('user_id', userId)
      .single();

    if (error || !permissions) {
      console.warn('无法获取用户API密钥:', error);
      return null;
    }

    return permissions.api_keys || {};
  } catch (error) {
    console.error('获取用户API密钥时出错:', error);
    return null;
  }
}

// 根据提供商获取API密钥
export async function getAPIKeyForProvider(
  userId: string, 
  provider: 'deepseek' | 'openrouter'
): Promise<string | null> {
  const apiKeys = await getUserAPIKeys(userId);
  if (!apiKeys) return null;
  
  return apiKeys[provider] || null;
}

// 获取API调用配置
export async function getAPIConfig(
  userId: string,
  provider: 'deepseek' | 'openrouter',
  model: string
): Promise<{
  url: string;
  headers: Record<string, string>;
  apiKey: string;
} | null> {
  const apiKey = await getAPIKeyForProvider(userId, provider);
  if (!apiKey) {
    throw new Error(`用户 ${userId} 没有配置 ${provider} API密钥`);
  }

  if (provider === 'deepseek') {
    return {
      url: 'https://api.deepseek.com/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      apiKey
    };
  } else if (provider === 'openrouter') {
    return {
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      },
      apiKey
    };
  }

  throw new Error(`不支持的提供商: ${provider}`);
}
