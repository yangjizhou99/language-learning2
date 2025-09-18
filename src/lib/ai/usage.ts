export type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

export function normUsage(u: any): Usage {
  if (!u) return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const pt = Number(u.prompt_tokens ?? u.promptTokens ?? 0) || 0;
  const ct = Number(u.completion_tokens ?? u.completionTokens ?? 0) || 0;
  const tt = Number(u.total_tokens ?? u.totalTokens ?? pt + ct) || pt + ct;
  return { prompt_tokens: pt, completion_tokens: ct, total_tokens: tt };
}

export function sumUsage(a: Usage, b: Usage): Usage {
  return {
    prompt_tokens: (a.prompt_tokens || 0) + (b.prompt_tokens || 0),
    completion_tokens: (a.completion_tokens || 0) + (b.completion_tokens || 0),
    total_tokens: (a.total_tokens || 0) + (b.total_tokens || 0),
  };
}
