export type Lang = 'en'|'ja'|'zh';
export type Genre = 'dialogue'|'monologue'|'news'|'lecture';

export function shadowingLevelPresets(lang: Lang, level: 1|2|3|4|5|6, genre: Genre) {
  const sentMin = Math.max(6, Math.min(13, 5 + level));
  const sentMax = sentMin + 2;
  const register = genre === 'dialogue' 
    ? (level <= 2 ? 'casual' : 'neutral') 
    : (level >= 5 ? 'formal' : 'neutral');
  
  const maxSentenceLenEn = [0, 12, 16, 20, 24, 28, 32][level];
  const maxSentenceLenCJK = [0, 35, 45, 55, 65, 75, 90][level];
  
  const lenMap: any = {
    en: [0, [60, 90], [90, 120], [120, 160], [160, 200], [200, 260], [260, 320]],
    ja: [0, [180, 260], [260, 360], [360, 480], [480, 620], [620, 780], [780, 980]],
    zh: [0, [160, 240], [240, 320], [320, 420], [420, 560], [560, 720], [720, 900]],
  };
  
  const lengthTarget = lenMap[lang][level];
  
  return { 
    sentRange: [sentMin, sentMax] as [number, number], 
    register, 
    maxSentenceLenEn, 
    maxSentenceLenCJK, 
    lengthTarget 
  };
}

export function buildShadowPrompt({ 
  lang, 
  level, 
  genre, 
  title_cn, 
  seed_en, 
  one_line_cn 
}: { 
  lang: Lang; 
  level: 1|2|3|4|5|6; 
  genre: Genre; 
  title_cn: string; 
  seed_en?: string; 
  one_line_cn?: string; 
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : '简体中文';
  const p = shadowingLevelPresets(lang, level, genre);
  
  const lenLine = lang === 'en' 
    ? `WORDS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} words`
    : `CHARS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} characters`;
  
  const maxSent = lang === 'en' 
    ? `${p.maxSentenceLenEn} words` 
    : `${p.maxSentenceLenCJK} chars`;
  
  const genreRules = genre === 'dialogue'
    ? `TURNS=${p.sentRange[0]}–${p.sentRange[1]}, alternate speakers "A:"/"B:", avoid long monologues.`
    : genre === 'news'
    ? `Headline-style title; explanatory flow; minimal quotations.`
    : genre === 'lecture'
    ? `Academic tone; clear structure; examples and explanations.`
    : `Narrative flow; engaging content; varied sentence structures.`;

  const seedHint = seed_en ? `\nSEED_KEYWORDS=${seed_en}` : '';
  const summaryHint = one_line_cn ? `\nINTENT_HINT=${one_line_cn}` : '';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
TOPIC=${title_cn}${seedHint}${summaryHint}

SENTENCES=${p.sentRange[0]}–${p.sentRange[1]}
REGISTER=${p.register}
${lenLine}
MAX_SENTENCE_LEN=${maxSent}

${genreRules}

OUTPUT JSON:
{ "title":"...", "passage":"...", "notes":{ "key_phrases":[...], "pacing":"...", "tips":"..." }, "meta":{"lang":"${lang}","level":"L${level}","genre":"${genre}"}, "violations":[] }

If length is outside ±10% or sentences out of range, self-repair before returning.`;
}



