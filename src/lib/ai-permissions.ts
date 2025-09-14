import useUserPermissions from '@/hooks/useUserPermissions';

// AI提供商配置
export const AI_PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
    ]
  },
  openrouter: {
    name: 'OpenRouter (推荐)',
    models: [
      { id: 'openrouter/auto', name: 'OpenRouter Auto (推荐)' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' }
    ]
  }
} as const;

export type AIProvider = keyof typeof AI_PROVIDERS;

// 根据用户权限过滤可用的提供商和模型
export function getFilteredAIProviders(permissions: ReturnType<typeof useUserPermissions>) {
  // 如果AI功能未启用，返回空对象
  if (!permissions || !permissions.permissions.ai_enabled) {
    return {};
  }

  if (!permissions.permissions.model_permissions) {
    // 如果没有权限数据，返回默认配置
    return AI_PROVIDERS;
  }

  const enabledModels = permissions.permissions.model_permissions.filter(m => m.enabled);
  const filteredProviders: Record<string, any> = {};

  // 检查每个提供商是否有启用的模型
  Object.entries(AI_PROVIDERS).forEach(([providerKey, providerConfig]) => {
    const provider = providerKey as AIProvider;
    const enabledProviderModels = enabledModels.filter(model => 
      model.provider === provider || 
      (provider === 'openrouter' && model.provider === 'anthropic') ||
      (provider === 'openrouter' && model.provider === 'openai')
    );

    if (enabledProviderModels.length > 0) {
      // 过滤出用户有权限的模型
      const availableModels = providerConfig.models.filter(model => 
        enabledProviderModels.some(enabled => 
          enabled.model_id === model.id ||
          (provider === 'openrouter' && enabled.model_id.includes(model.id))
        )
      );

      if (availableModels.length > 0) {
        filteredProviders[provider] = {
          ...providerConfig,
          models: availableModels
        };
      }
    }
  });

  return filteredProviders;
}

// 获取用户有权限的默认提供商
export function getDefaultProvider(permissions: ReturnType<typeof useUserPermissions>): AIProvider {
  const filteredProviders = getFilteredAIProviders(permissions);
  
  // 按优先级返回第一个可用的提供商
  if (filteredProviders.openrouter) return 'openrouter';
  if (filteredProviders.deepseek) return 'deepseek';
  
  // 如果没有权限，返回默认值
  return 'openrouter';
}

// 获取用户有权限的默认模型
export function getDefaultModel(permissions: ReturnType<typeof useUserPermissions>, provider: AIProvider): string {
  const filteredProviders = getFilteredAIProviders(permissions);
  const providerConfig = filteredProviders[provider];
  
  if (providerConfig && providerConfig.models.length > 0) {
    return providerConfig.models[0].id;
  }
  
  // 如果没有权限，返回默认值
  switch (provider) {
    case 'deepseek': return 'deepseek-chat';
    case 'openrouter': return 'openrouter/auto';
    default: return 'openrouter/auto';
  }
}

// 检查用户是否有权限使用特定的提供商和模型
export function hasAIPermission(permissions: ReturnType<typeof useUserPermissions>, provider: AIProvider, modelId: string): boolean {
  // 首先检查AI功能是否启用
  if (!permissions || !permissions.permissions.ai_enabled) {
    return false;
  }

  if (!permissions.permissions.model_permissions) {
    return false; // 如果没有权限数据，不允许
  }

  return permissions.permissions.model_permissions.some(model => 
    model.enabled && 
    (model.provider === provider || 
     (provider === 'openrouter' && (model.provider === 'anthropic' || model.provider === 'openai'))) &&
    (model.model_id === modelId || 
     (provider === 'openrouter' && modelId.includes(model.model_id)))
  );
}
