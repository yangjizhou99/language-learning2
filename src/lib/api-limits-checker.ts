import { getServiceSupabase } from '@/lib/supabaseAdmin';

export interface ModelPermission {
  model_id: string;
  model_name: string;
  provider: string;
  daily_limit: number;
  token_limit: number;
  enabled: boolean;
}

export interface UserPermissions {
  ai_enabled: boolean;
  api_keys?: {
    deepseek?: string;
    openrouter?: string;
  };
  model_permissions: ModelPermission[];
}

export interface APILimits {
  enabled: boolean;
  daily_calls_limit: number;
  daily_tokens_limit: number;
  daily_cost_limit: number;
  monthly_calls_limit: number;
  monthly_tokens_limit: number;
  monthly_cost_limit: number;
  alert_threshold: number;
}

export interface UsageStats {
  daily_calls: number;
  daily_tokens: number;
  daily_cost: number;
  monthly_calls: number;
  monthly_tokens: number;
  monthly_cost: number;
}

/**
 * 检查API使用是否超过限制
 */
export async function checkAPILimits(
  userId: string,
  provider: string,
  model: string,
  estimatedTokens: number = 0,
  estimatedCost: number = 0
): Promise<{ allowed: boolean; reason?: string; limits?: APILimits; usage?: UsageStats }> {
  try {
    const supabase = getServiceSupabase();
    
    // 首先检查用户特定限制
    const { data: userLimits, error: userLimitsError } = await supabase
      .from('user_api_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    let limits: APILimits | null = null;

    if (!userLimitsError && userLimits && userLimits.enabled) {
      // 使用用户特定限制
      limits = {
        enabled: userLimits.enabled,
        daily_calls_limit: userLimits.daily_calls_limit,
        daily_tokens_limit: userLimits.daily_tokens_limit,
        daily_cost_limit: userLimits.daily_cost_limit,
        monthly_calls_limit: userLimits.monthly_calls_limit,
        monthly_tokens_limit: userLimits.monthly_tokens_limit,
        monthly_cost_limit: userLimits.monthly_cost_limit,
        alert_threshold: 80 // 用户限制暂时使用默认警告阈值
      };
    } else {
      // 使用全局限制设置
      const { data: globalLimits, error: globalLimitsError } = await supabase
        .from('api_limits')
        .select('*')
        .single();

      if (globalLimitsError || !globalLimits) {
        console.warn('No API limits configured, allowing request');
        return { allowed: true };
      }

      limits = globalLimits;
    }

    // 如果限制未启用，允许请求
    if (!limits.enabled) {
      return { allowed: true, limits };
    }

    // 获取用户今日和本月的使用情况
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const { data: usageData, error: usageError } = await supabase
      .from('api_usage_logs')
      .select('tokens_used, cost, created_at')
      .eq('user_id', userId)
      .eq('provider', provider);

    if (usageError) {
      console.error('Error fetching usage data:', usageError);
      return { allowed: true }; // 如果无法获取使用数据，允许请求
    }

    // 计算使用统计
    const usage: UsageStats = {
      daily_calls: 0,
      daily_tokens: 0,
      daily_cost: 0,
      monthly_calls: 0,
      monthly_tokens: 0,
      monthly_cost: 0
    };

    usageData?.forEach(record => {
      const recordDate = new Date(record.created_at);
      const recordMonth = recordDate.toISOString().substring(0, 7);
      
      // 今日统计
      if (recordDate.toISOString().split('T')[0] === today) {
        usage.daily_calls++;
        usage.daily_tokens += record.tokens_used || 0;
        usage.daily_cost += record.cost || 0;
      }
      
      // 本月统计
      if (recordMonth === thisMonth) {
        usage.monthly_calls++;
        usage.monthly_tokens += record.tokens_used || 0;
        usage.monthly_cost += record.cost || 0;
      }
    });

    // 检查日限制
    if (limits.daily_calls_limit > 0 && usage.daily_calls >= limits.daily_calls_limit) {
      return {
        allowed: false,
        reason: `今日API调用次数已达上限 (${usage.daily_calls}/${limits.daily_calls_limit})`,
        limits,
        usage
      };
    }

    if (limits.daily_tokens_limit > 0 && usage.daily_tokens >= limits.daily_tokens_limit) {
      return {
        allowed: false,
        reason: `今日Token使用量已达上限 (${usage.daily_tokens}/${limits.daily_tokens_limit})`,
        limits,
        usage
      };
    }

    if (limits.daily_cost_limit > 0 && usage.daily_cost >= limits.daily_cost_limit) {
      return {
        allowed: false,
        reason: `今日API费用已达上限 ($${usage.daily_cost.toFixed(2)}/$${limits.daily_cost_limit})`,
        limits,
        usage
      };
    }

    // 检查月限制
    if (limits.monthly_calls_limit > 0 && usage.monthly_calls >= limits.monthly_calls_limit) {
      return {
        allowed: false,
        reason: `本月API调用次数已达上限 (${usage.monthly_calls}/${limits.monthly_calls_limit})`,
        limits,
        usage
      };
    }

    if (limits.monthly_tokens_limit > 0 && usage.monthly_tokens >= limits.monthly_tokens_limit) {
      return {
        allowed: false,
        reason: `本月Token使用量已达上限 (${usage.monthly_tokens}/${limits.monthly_tokens_limit})`,
        limits,
        usage
      };
    }

    if (limits.monthly_cost_limit > 0 && usage.monthly_cost >= limits.monthly_cost_limit) {
      return {
        allowed: false,
        reason: `本月API费用已达上限 ($${usage.monthly_cost.toFixed(2)}/$${limits.monthly_cost_limit})`,
        limits,
        usage
      };
    }

    // 检查预估使用量是否会超过限制
    const projectedDailyTokens = usage.daily_tokens + estimatedTokens;
    const projectedDailyCost = usage.daily_cost + estimatedCost;
    const projectedMonthlyTokens = usage.monthly_tokens + estimatedTokens;
    const projectedMonthlyCost = usage.monthly_cost + estimatedCost;

    if (limits.daily_tokens_limit > 0 && projectedDailyTokens > limits.daily_tokens_limit) {
      return {
        allowed: false,
        reason: `预估Token使用量将超过今日上限 (${projectedDailyTokens}/${limits.daily_tokens_limit})`,
        limits,
        usage
      };
    }

    if (limits.daily_cost_limit > 0 && projectedDailyCost > limits.daily_cost_limit) {
      return {
        allowed: false,
        reason: `预估费用将超过今日上限 ($${projectedDailyCost.toFixed(2)}/$${limits.daily_cost_limit})`,
        limits,
        usage
      };
    }

    if (limits.monthly_tokens_limit > 0 && projectedMonthlyTokens > limits.monthly_tokens_limit) {
      return {
        allowed: false,
        reason: `预估Token使用量将超过本月上限 (${projectedMonthlyTokens}/${limits.monthly_tokens_limit})`,
        limits,
        usage
      };
    }

    if (limits.monthly_cost_limit > 0 && projectedMonthlyCost > limits.monthly_cost_limit) {
      return {
        allowed: false,
        reason: `预估费用将超过本月上限 ($${projectedMonthlyCost.toFixed(2)}/$${limits.monthly_cost_limit})`,
        limits,
        usage
      };
    }

    // 检查警告阈值
    const dailyUsagePercent = limits.daily_calls_limit > 0 ? (usage.daily_calls / limits.daily_calls_limit) * 100 : 0;
    const monthlyUsagePercent = limits.monthly_calls_limit > 0 ? (usage.monthly_calls / limits.monthly_calls_limit) * 100 : 0;

    if (dailyUsagePercent >= limits.alert_threshold || monthlyUsagePercent >= limits.alert_threshold) {
      console.warn(`API usage approaching limit: Daily ${dailyUsagePercent.toFixed(1)}%, Monthly ${monthlyUsagePercent.toFixed(1)}%`);
    }

    return { allowed: true, limits, usage };

  } catch (error) {
    console.error('Error checking API limits:', error);
    return { allowed: true }; // 出错时允许请求，避免影响正常使用
  }
}

/**
 * 获取用户API使用统计
 */
export async function getUserAPIUsageStats(userId: string, provider?: string): Promise<UsageStats | null> {
  try {
    const supabase = getServiceSupabase();
    
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7);

    let query = supabase
      .from('api_usage_logs')
      .select('tokens_used, cost, created_at')
      .eq('user_id', userId);

    if (provider) {
      query = query.eq('provider', provider);
    }

    const { data: usageData, error } = await query;

    if (error || !usageData) {
      return null;
    }

    const usage: UsageStats = {
      daily_calls: 0,
      daily_tokens: 0,
      daily_cost: 0,
      monthly_calls: 0,
      monthly_tokens: 0,
      monthly_cost: 0
    };

    usageData.forEach(record => {
      const recordDate = new Date(record.created_at);
      const recordMonth = recordDate.toISOString().substring(0, 7);
      
      if (recordDate.toISOString().split('T')[0] === today) {
        usage.daily_calls++;
        usage.daily_tokens += record.tokens_used || 0;
        usage.daily_cost += record.cost || 0;
      }
      
      if (recordMonth === thisMonth) {
        usage.monthly_calls++;
        usage.monthly_tokens += record.tokens_used || 0;
        usage.monthly_cost += record.cost || 0;
      }
    });

    return usage;

  } catch (error) {
    console.error('Error fetching user API usage stats:', error);
    return null;
  }
}

/**
 * 检查用户AI权限和模型权限
 */
export async function checkUserAIPermissions(
  userId: string,
  provider: string,
  model: string
): Promise<{ allowed: boolean; reason?: string; permissions?: UserPermissions }> {
  try {
    const supabase = getServiceSupabase();
    
    // 获取用户权限设置
    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user permissions:', error);
      return { allowed: false, reason: '无法获取用户权限设置' };
    }

    if (!permissions) {
      return { allowed: false, reason: '用户未配置AI权限' };
    }

    // 检查AI功能是否启用 - 只有明确设置为true才允许
    if (permissions.ai_enabled !== true) {
      return { 
        allowed: false, 
        reason: 'AI功能未启用，请联系管理员开启',
        permissions 
      };
    }

    // 检查API密钥配置（如果字段存在）
    const apiKeys = permissions.api_keys || {};
    if (provider === 'openrouter' && !apiKeys.openrouter && !process.env.OPENROUTER_API_KEY) {
      return { 
        allowed: false, 
        reason: '未配置OpenRouter API密钥，请联系管理员配置',
        permissions 
      };
    }

    if (provider === 'deepseek' && !apiKeys.deepseek && !process.env.DEEPSEEK_API_KEY) {
      return { 
        allowed: false, 
        reason: '未配置DeepSeek API密钥，请联系管理员配置',
        permissions 
      };
    }

    // 检查模型权限（如果字段存在）
    const modelPermissions = permissions.model_permissions || [];
    if (modelPermissions.length > 0) {
      const modelPermission = modelPermissions.find(mp => 
        mp.model_id === model && 
        mp.provider === provider && 
        mp.enabled
      );

      if (!modelPermission) {
        return { 
          allowed: false, 
          reason: `没有权限使用模型 ${model}，请联系管理员配置模型权限`,
          permissions 
        };
      }
    } else {
      // 如果没有配置模型权限，检查是否有环境变量API密钥
      if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
        return { 
          allowed: false, 
          reason: '未配置OpenRouter API密钥，请联系管理员配置',
          permissions 
        };
      }
      if (provider === 'deepseek' && !process.env.DEEPSEEK_API_KEY) {
        return { 
          allowed: false, 
          reason: '未配置DeepSeek API密钥，请联系管理员配置',
          permissions 
        };
      }
    }

    // 检查模型使用限制（如果有模型权限配置）
    if (modelPermissions.length > 0) {
      const modelPermission = modelPermissions.find(mp => 
        mp.model_id === model && 
        mp.provider === provider && 
        mp.enabled
      );

      if (modelPermission) {
        const today = new Date().toISOString().split('T')[0];
        const { data: usageData, error: usageError } = await supabase
          .from('api_usage_logs')
          .select('tokens_used, created_at')
          .eq('user_id', userId)
          .eq('provider', provider)
          .eq('model', model)
          .gte('created_at', today);

        if (usageError) {
          console.error('Error fetching model usage:', usageError);
          // 如果无法获取使用数据，允许请求但记录警告
          console.warn('Could not fetch model usage data, allowing request');
        } else {
          // 检查每日调用次数限制
          const dailyCalls = usageData?.length || 0;
          if (modelPermission.daily_limit > 0 && dailyCalls >= modelPermission.daily_limit) {
            return { 
              allowed: false, 
              reason: `模型 ${model} 今日调用次数已达上限 (${dailyCalls}/${modelPermission.daily_limit})`,
              permissions 
            };
          }

          // 检查Token限制
          const dailyTokens = usageData?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;
          if (modelPermission.token_limit > 0 && dailyTokens >= modelPermission.token_limit) {
            return { 
              allowed: false, 
              reason: `模型 ${model} 今日Token使用量已达上限 (${dailyTokens}/${modelPermission.token_limit})`,
              permissions 
            };
          }
        }
      }
    }

    return { allowed: true, permissions };

  } catch (error) {
    console.error('Error checking user AI permissions:', error);
    return { allowed: false, reason: '权限检查失败，请联系管理员' };
  }
}
