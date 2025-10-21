export type Lang = 'en' | 'ja' | 'zh' | 'ko';
export type Genre = 'dialogue' | 'monologue' | 'news' | 'lecture';

export function shadowingLevelPresets(lang: Lang, level: 1 | 2 | 3 | 4 | 5 | 6, genre: Genre) {
  const sentMin = Math.max(6, Math.min(13, 5 + level));
  const sentMax = sentMin + 2;
  const register =
    genre === 'dialogue' ? (level <= 2 ? 'casual' : 'neutral') : level >= 5 ? 'formal' : 'neutral';

  const maxSentenceLenEn = [0, 12, 16, 20, 24, 28, 32][level];
  const maxSentenceLenCJK = [0, 35, 45, 55, 65, 75, 90][level];

  const lenMap: any = {
    en: [0, [60, 90], [90, 120], [120, 160], [160, 200], [200, 260], [260, 320]],
    ja: [0, [180, 260], [260, 360], [360, 480], [480, 620], [620, 780], [780, 980]],
    zh: [0, [160, 240], [240, 320], [320, 420], [420, 560], [560, 720], [720, 900]],
    ko: [0, [170, 250], [250, 340], [340, 450], [450, 590], [590, 750], [750, 940]],
  };

  const lengthTarget = lenMap[lang][level];

  return {
    sentRange: [sentMin, sentMax] as [number, number],
    register,
    maxSentenceLenEn,
    maxSentenceLenCJK,
    lengthTarget,
  };
}

export function buildShadowPrompt({
  lang,
  level,
  genre,
  title,
  seed,
  one_line,
}: {
  lang: Lang;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  genre: Genre;
  title: string;
  seed?: string;
  one_line?: string;
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : lang === 'ko' ? '한국어' : '简体中文';
  const p = shadowingLevelPresets(lang, level, genre);

  const lenLine =
    lang === 'en'
      ? `WORDS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} words`
      : `CHARS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} characters`;

  const maxSent = lang === 'en' ? `${p.maxSentenceLenEn} words` : `${p.maxSentenceLenCJK} chars`;

  const genreRules =
    genre === 'dialogue'
      ? `TURNS=${p.sentRange[0]}–${p.sentRange[1]}, alternate speakers "A:"/"B:", avoid long monologues.`
      : genre === 'news'
        ? `Headline-style title; explanatory flow; minimal quotations.`
        : genre === 'lecture'
          ? `Academic tone; clear structure; examples and explanations.`
          : `Narrative flow; engaging content; varied sentence structures.`;

  const seedHint = seed ? `\nSEED_KEYWORDS=${seed}` : '';
  const summaryHint = one_line ? `\nINTENT_HINT=${one_line}` : '';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
TOPIC=${title}${seedHint}${summaryHint}

SENTENCES=${p.sentRange[0]}–${p.sentRange[1]}
REGISTER=${p.register}
${lenLine}
MAX_SENTENCE_LEN=${maxSent}

${genreRules}

OUTPUT JSON:
{ "title":"...", "passage":"...", "notes":{ "key_phrases":[...], "pacing":"...", "tips":"..." }, "meta":{"lang":"${lang}","level":"L${level}","genre":"${genre}"}, "violations":[] }

If length is outside ±10% or sentences out of range, self-repair before returning.`;
}
