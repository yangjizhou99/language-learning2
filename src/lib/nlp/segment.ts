type Lang = 'en' | 'ja' | 'zh' | 'ko';

const SENT_SPLIT = {
  en: /(?<=[.!?])\s+/,
  ja: /(?<=[。！？])/,
  zh: /(?<=[。！？；])/,
  ko: /(?<=[.!?])\s+/, // 韩语使用英文标点切分规则
};

export function splitSentencesWithIndex(text: string, lang: Lang) {
  const sentences = text.split(SENT_SPLIT[lang]);
  const result = [];
  let start = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed) {
      const sentStart = text.indexOf(trimmed, start);
      const sentEnd = sentStart + trimmed.length;
      result.push({
        text: trimmed,
        start: sentStart,
        end: sentEnd,
      });
      start = sentEnd;
    }
  }

  return result;
}
