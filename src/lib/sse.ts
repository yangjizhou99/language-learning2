export async function readSSE(
  res: Response,
  onToken: (t: string) => void,
  onDone?: () => void
) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const payload = s.slice(5).trim();
      if (payload === "[DONE]") { onDone?.(); return; }
      try {
        const json = JSON.parse(payload);
        const t = json?.choices?.[0]?.delta?.content;
        if (typeof t === "string" && t.length) onToken(t);
      } catch {
        // 非 JSON 行，忽略
      }
    }
  }
}
