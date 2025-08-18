import { htmlToText } from "html-to-text";
import crypto from "crypto";

export type FetchResult = {
  lang: "en"|"ja"|"zh";
  title: string;
  text: string;
  license: string;
  source_url: string;
  attribution: string;
};

export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function fetchFromWikipedia(url: string, lang: FetchResult["lang"]): Promise<FetchResult> {
  // 例如 https://en.wikipedia.org/wiki/Neural_machine_translation
  const m = url.match(/^https?:\/\/([a-z\-]+)\.wikipedia\.org\/wiki\/(.+)$/i);
  if (!m) throw new Error("not a wikipedia url");
  const title = decodeURIComponent(m[2]);
  const plain = await fetch(`https://${m[1]}.wikipedia.org/api/rest_v1/page/plain/${encodeURIComponent(title)}`).then(r=>r.text());
  return {
    lang, title,
    text: plain.trim(),
    license: "CC BY-SA 4.0",
    source_url: url,
    attribution: `Wikipedia contributors, "${title}" (retrieved), CC BY-SA 4.0`
  };
}

export async function fetchFromWikinews(url: string, lang: FetchResult["lang"]): Promise<FetchResult> {
  // 简化：抓 HTML → 去格式
  const html = await fetch(url).then(r=>r.text());
  const text = htmlToText(html, { wordwrap: false }).replace(/\n{3,}/g, "\n\n").trim();
  return {
    lang,
    title: (html.match(/<title>(.*?)<\/title>/i)?.[1] || "Wikinews"),
    text,
    license: "CC BY 4.0 / CC BY 2.5（取决于发布时间）",
    source_url: url,
    attribution: "Wikinews (see page footer for license)"
  };
}

export async function fetchFromGutenberg(url: string, lang: FetchResult["lang"]): Promise<FetchResult> {
  // 支持 https://www.gutenberg.org/ebooks/1342
  const id = Number(url.match(/gutenberg\.org\/(?:ebooks|files)\/(\d+)/)?.[1]);
  if (!id) throw new Error("cannot parse gutenberg id");
  // 常见纯文本路径两种
  const tryUrls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`
  ];
  let raw = "";
  for (const u of tryUrls) {
    const r = await fetch(u);
    if (r.ok) { raw = await r.text(); break; }
  }
  if (!raw) throw new Error("no plain text found");
  // 去掉 Gutenberg header/footer（简单启发）
  const body = raw.replace(/[\s\S]*\*\*\* START OF.*\*\*\*/i, "").replace(/\*\*\* END OF[\s\S]*/i, "").trim();
  const title = body.split("\n")[0].slice(0,120) || `Gutenberg #${id}`;
  return {
    lang, title,
    text: body,
    license: "Public Domain (US) — see ebook header",
    source_url: url,
    attribution: `Project Gutenberg #${id}`
  };
}

export async function fetchFromTatoeba(url: string, lang: FetchResult["lang"]): Promise<FetchResult> {
  // 用于“对话/短段落”的拼接：简单拉取页面文本并提取主要句子（MVP）
  const html = await fetch(url).then(r=>r.text());
  const text = htmlToText(html, { wordwrap: false }).trim();
  const title = (html.match(/<title>(.*?)<\/title>/i)?.[1] || "Tatoeba Sentences").slice(0,120);
  return {
    lang, title,
    text,
    license: "CC BY 2.0 FR",
    source_url: url,
    attribution: "Tatoeba (see terms)"
  };
}
