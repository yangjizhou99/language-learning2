import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { randomUUID } from 'crypto';

export interface APIUsageLog {
  user_id: string;
  provider: 'deepseek' | 'openrouter' | 'openai' | 'anthropic';
  model: string;
  tokens_used: number;
  cost: number;
  request_data?: unknown;
  response_data?: unknown;
}

// API定价配置（每1000 tokens的价格，单位：美元）
const PRICING_CONFIG = {
  deepseek: {
    'deepseek-chat': 0.00014, // $0.14 per 1M tokens
    'deepseek-coder': 0.00014,
  },
  openrouter: {
    'gpt-4o': 0.005, // $5 per 1M tokens
    'gpt-4o-mini': 0.00015, // $0.15 per 1M tokens
    'claude-3.5-sonnet': 0.003, // $3 per 1M tokens
    'claude-3-haiku': 0.00025, // $0.25 per 1M tokens
    'llama-3.1-70b': 0.0008, // $0.8 per 1M tokens
  },
  openai: {
    'gpt-4o': 0.005,
    'gpt-4o-mini': 0.00015,
    'gpt-3.5-turbo': 0.0005,
  },
  anthropic: {
    'claude-3.5-sonnet': 0.003,
    'claude-3-haiku': 0.00025,
    'claude-3-opus': 0.015,
  },
};

// 计算API调用费用
export function calculateAPICost(provider: string, model: string, tokensUsed: number): number {
  const pricing = PRICING_CONFIG[provider as keyof typeof PRICING_CONFIG];
  if (!pricing) return 0;

  const pricePer1K = pricing[model as keyof typeof pricing];
  if (!pricePer1K) return 0;

  return (tokensUsed / 1000) * pricePer1K;
}

// 记录API使用情况
export async function logAPIUsage(log: APIUsageLog): Promise<void> {
  try {
    const supabase = getServiceSupabase();

    const { error } = await supabase.from('api_usage_logs').insert({
      id: randomUUID(),
      user_id: log.user_id,
      provider: log.provider,
      model: log.model,
      tokens_used: log.tokens_used,
      cost: log.cost,
      request_data: log.request_data,
      response_data: log.response_data,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log API usage:', error);
    }
  } catch (error) {
    console.error('Error logging API usage:', error);
  }
}

// 从响应中提取Token使用情况
type UsageShape = {
  usage?: {
    total_tokens?: number;
    completion_tokens?: number;
    prompt_tokens?: number;
    tokens?: number;
  };
  choices?: Array<{ message?: { content?: string } }>;
};

export function extractTokenUsage(response: UsageShape | null | undefined): number {
  if (!response) return 0;

  // 尝试从不同字段提取token使用量
  if (response.usage?.total_tokens) {
    return response.usage.total_tokens;
  }

  if (response.usage?.completion_tokens && response.usage?.prompt_tokens) {
    return response.usage.completion_tokens + response.usage.prompt_tokens;
  }

  if (response.usage?.tokens) {
    return response.usage.tokens;
  }

  // 如果没有找到token信息，尝试估算
  if (response.choices?.[0]?.message?.content) {
    const content = response.choices[0].message.content;
    // 粗略估算：1个中文字符约等于1.5个token，1个英文单词约等于1.3个token
    const chineseChars = (content.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = (content.match(/\b[a-zA-Z]+\b/g) || []).length;
    return Math.ceil(chineseChars * 1.5 + englishWords * 1.3);
  }

  return 0;
}

// 包装API调用函数，自动记录使用情况
export function withUsageTracking<T extends any[], R extends UsageShape | null | undefined>(
  fn: (...args: T) => Promise<R>,
  provider: string,
  model: string,
  userId?: string,
) {
  return async (...args: T): Promise<R> => {
    if (!userId) {
      return fn(...args);
    }

    const startTime = Date.now();
    let tokensUsed = 0;
    let cost = 0;

    try {
      const result = await fn(...args);

      // 尝试从结果中提取token使用情况
      tokensUsed = extractTokenUsage(result as UsageShape | null | undefined);
      cost = calculateAPICost(provider, model, tokensUsed);

      // 记录使用情况
      await logAPIUsage({
        user_id: userId,
        provider: provider as 'deepseek' | 'openrouter' | 'openai' | 'anthropic',
        model,
        tokens_used: tokensUsed,
        cost,
        request_data: args[0], // 假设第一个参数是请求数据
        response_data: result,
      });

      return result;
    } catch (error) {
      // 即使出错也记录使用情况（如果有部分token使用）
      if (tokensUsed > 0) {
        await logAPIUsage({
          user_id: userId,
          provider: provider as 'deepseek' | 'openrouter' | 'openai' | 'anthropic',
          model,
          tokens_used: tokensUsed,
          cost,
          request_data: args[0],
          response_data: { error: error instanceof Error ? error.message : String(error) },
        });
      }

      throw error;
    }
  };
}
