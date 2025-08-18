type Msg = { role:"system"|"user"|"assistant"; content:string };
type Provider = "openrouter" | "deepseek" | "openai";

export type ChatJSONArgs = {
  provider: Provider;
  model: string;
  messages: Msg[];
  temperature?: number;
  response_json?: boolean;   // 要求模型用 JSON 返回
  timeoutMs?: number;        // 超时时间（毫秒）
};

export async function chatJSON({ provider, model, messages, temperature=0.6, response_json=true, timeoutMs }: ChatJSONArgs) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const signal = controller?.signal as any;
  let timer: any = null;
  if (controller && timeoutMs && timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }
  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY!;
    const headers: Record<string,string> = {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      // OpenRouter 推荐附带站点信息（可选）
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "",
      "X-Title": process.env.OPENROUTER_SITE_NAME || ""
    };
    const body:any = { model, temperature, messages };
    if (response_json) body.response_format = { type: "json_object" };
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {  // 官方端点
      method: "POST", headers, body: JSON.stringify(body), signal
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "";
    const usage = j?.usage || {};
    return { content, usage };
  }

  if (provider === "deepseek") {
    const key = process.env.DEEPSEEK_API_KEY!;
    const body:any = { model, temperature, messages };
    if (response_json) body.response_format = { type: "json_object" };
    const r = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body), signal
    });
    if (timer) clearTimeout(timer);
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "";
    const usage = j?.usage || {};
    return { content, usage };
  }

  // openai
  const key = process.env.OPENAI_API_KEY!;
  const body:any = { model, temperature, messages };
  if (response_json) body.response_format = { type: "json_object" };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal
  });
  if (timer) clearTimeout(timer);
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const content = j?.choices?.[0]?.message?.content || "";
  const usage = j?.usage || {};
  return { content, usage };
}
