export type SafeResp<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  text: string;
  contentType: string;
  error?: string;
};

export async function safeJsonFetch<T = any>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<SafeResp<T>> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      text: '',
      contentType: '',
      error: err?.message || 'network_error',
    };
  }
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (contentType.includes('application/json')) {
    try {
      const data = JSON.parse(text);
      return {
        ok: res.ok,
        status: res.status,
        data,
        text,
        contentType,
        error: res.ok ? undefined : data?.error || data?.message,
      };
    } catch (e: any) {
      return {
        ok: false,
        status: res.status,
        data: null,
        text,
        contentType,
        error: 'json_parse_error',
      };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    data: null,
    text,
    contentType,
    error: res.ok ? undefined : 'non_json_response',
  };
}
