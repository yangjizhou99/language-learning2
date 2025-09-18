import { logAPIUsage, extractTokenUsage, calculateAPICost } from '../api-usage-tracker';
import { checkAPILimits, checkUserAIPermissions } from '../api-limits-checker';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type Provider = 'openrouter' | 'deepseek' | 'openai';

export type ChatJSONArgs = {
  provider: Provider;
  model: string;
  messages: Msg[];
  temperature?: number;
  response_json?: boolean; // 要求模型用 JSON 返回
  timeoutMs?: number; // 超时时间（毫秒）
  userId?: string; // 用户ID，用于获取用户特定的API密钥
};

export async function chatJSON({
  provider,
  model,
  messages,
  temperature = 0.6,
  response_json = true,
  timeoutMs,
  userId,
}: ChatJSONArgs) {
  // 检查用户AI权限和模型权限
  if (userId) {
    const permissionCheck = await checkUserAIPermissions(userId, provider, model);
    if (!permissionCheck.allowed) {
      throw new Error(`AI权限限制: ${permissionCheck.reason}`);
    }
  }

  // 检查API使用限制
  if (userId) {
    const limitCheck = await checkAPILimits(userId, provider, model);
    if (!limitCheck.allowed) {
      throw new Error(`API使用限制: ${limitCheck.reason}`);
    }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = controller?.signal as any;
  let timer: any = null;
  if (controller && timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  if (provider === 'openrouter') {
    let key: string;
    if (userId) {
      // 使用用户特定的API密钥
      const { getUserAPIKeys } = await import('../user-api-keys');
      const userKeys = await getUserAPIKeys(userId);
      key = userKeys?.openrouter || process.env.OPENROUTER_API_KEY!;
    } else {
      // 回退到环境变量
      key = process.env.OPENROUTER_API_KEY!;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      // OpenRouter 推荐附带站点信息（可选）
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || '',
      'X-Title': process.env.NEXT_PUBLIC_SITE_NAME || '',
    };
    const body: any = { model, temperature, messages };
    if (response_json) body.response_format = { type: 'json_object' };
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      // 官方端点
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || '';
    const usage = j?.usage || {};

    // 记录API使用情况
    if (userId) {
      const tokensUsed = extractTokenUsage(j);
      const cost = calculateAPICost('openrouter', model, tokensUsed);
      await logAPIUsage({
        user_id: userId,
        provider: 'openrouter',
        model,
        tokens_used: tokensUsed,
        cost,
        request_data: body,
        response_data: j,
      });
    }

    return { content, usage };
  }

  if (provider === 'deepseek') {
    let key: string;
    if (userId) {
      // 使用用户特定的API密钥
      const { getUserAPIKeys } = await import('../user-api-keys');
      const userKeys = await getUserAPIKeys(userId);
      key = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY!;
    } else {
      // 回退到环境变量
      key = process.env.DEEPSEEK_API_KEY!;
    }

    const body: any = { model, temperature, messages };
    if (response_json) body.response_format = { type: 'json_object' };
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || '';
    const usage = j?.usage || {};

    // 记录API使用情况
    if (userId) {
      const tokensUsed = extractTokenUsage(j);
      const cost = calculateAPICost('deepseek', model, tokensUsed);
      await logAPIUsage({
        user_id: userId,
        provider: 'deepseek',
        model,
        tokens_used: tokensUsed,
        cost,
        request_data: body,
        response_data: j,
      });
    }

    return { content, usage };
  }

  // openai
  const key = process.env.OPENAI_API_KEY!;
  const body: any = { model, temperature, messages };
  if (response_json) body.response_format = { type: 'json_object' };
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (timer) clearTimeout(timer);
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content || '';
  const usage = j?.usage || {};

  // 记录API使用情况
  if (userId) {
    const tokensUsed = extractTokenUsage(j);
    const cost = calculateAPICost('openai', model, tokensUsed);
    await logAPIUsage({
      user_id: userId,
      provider: 'openai',
      model,
      tokens_used: tokensUsed,
      cost,
      request_data: body,
      response_data: j,
    });
  }

  return { content, usage };
}
