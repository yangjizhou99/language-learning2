type Lang = 'en' | 'ja' | 'zh';

const SENT_SPLIT = {
  en: /(?<=[.!?])\s+/,
  ja: /(?<=[。！？])/,
  zh: /(?<=[。！？；])/,
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
