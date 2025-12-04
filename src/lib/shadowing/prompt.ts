export type Lang = 'en' | 'ja' | 'zh' | 'ko';
export type Genre = 'dialogue' | 'monologue' | 'news' | 'lecture';
export type DialogueType =
  | 'casual'
  | 'task'
  | 'emotion'
  | 'opinion'
  | 'request'
  | 'roleplay'
  | 'pattern';

export const DIALOGUE_TYPE_LABELS: Record<DialogueType, string> = {
  casual: '日常闲聊 (Casual Chat)',
  task: '任务场景 (Task-based)',
  emotion: '情绪互动 (Emotional Interaction)',
  opinion: '意见交流 (Opinion Exchange)',
  request: '请求/拒绝/协商 (Request/Negotiation)',
  roleplay: '角色扮演 (Roleplay)',
  pattern: '句型模式 (Pattern Practice)',
};

export function shadowingLevelPresets(
  lang: Lang,
  level: 1 | 2 | 3 | 4 | 5 | 6,
  genre: Genre,
  dialogueType?: DialogueType,
) {
  const sentMin = Math.max(6, Math.min(13, 5 + level));
  const sentMax = sentMin + 2;

  let register = 'neutral';
  if (genre === 'dialogue') {
    if (dialogueType === 'casual' || dialogueType === 'emotion') {
      register = 'casual';
    } else if (dialogueType === 'task' || dialogueType === 'request') {
      register = 'polite/neutral';
    } else if (level <= 2) {
      register = 'casual';
    } else {
      register = 'neutral';
    }
  } else {
    register = level >= 5 ? 'formal' : 'neutral';
  }

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
  dialogueType,
  title,
  seed,
  one_line,
}: {
  lang: Lang;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  genre: Genre;
  dialogueType?: DialogueType;
  title: string;
  seed?: string;
  one_line?: string;
}) {
  const L = lang === 'en' ? 'English' : lang === 'ja' ? '日本語' : lang === 'ko' ? '한국어' : '简体中文';
  const p = shadowingLevelPresets(lang, level, genre, dialogueType);

  const lenLine =
    lang === 'en'
      ? `WORDS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} words`
      : `CHARS_TARGET=${p.lengthTarget[0]}–${p.lengthTarget[1]} characters`;

  const maxSent = lang === 'en' ? `${p.maxSentenceLenEn} words` : `${p.maxSentenceLenCJK} chars`;

  let genreRules = '';
  if (genre === 'dialogue') {
    let typeDesc = 'General conversation';
    if (dialogueType) {
      switch (dialogueType) {
        case 'casual':
          typeDesc = 'Casual chat between friends/family. Natural, informal tone.';
          break;
        case 'task':
          typeDesc = 'Task-oriented (ordering food, asking directions, shopping). Clear, polite but functional.';
          break;
        case 'emotion':
          typeDesc = 'Emotional interaction (comforting, apologizing, complaining). Expressive tone.';
          break;
        case 'opinion':
          typeDesc = 'Exchanging opinions/small discussion. Stating preferences, agreeing/disagreeing.';
          break;
        case 'request':
          typeDesc = 'Making requests, refusing, negotiating. Polite strategies.';
          break;
        case 'roleplay':
          typeDesc = 'Roleplay scenario (Teacher-Student, Clerk-Customer). Appropriate role-based register.';
          break;
        case 'pattern':
          typeDesc = 'Pattern practice. Focus on specific sentence structures in a dialogue context.';
          break;
      }
    }
    genreRules = `TYPE=${typeDesc}\nTURNS=${p.sentRange[0]}–${p.sentRange[1]}, alternate speakers "A:"/"B:", avoid long monologues.`;
  } else if (genre === 'news') {
    genreRules = `Headline-style title; explanatory flow; minimal quotations.`;
  } else if (genre === 'lecture') {
    genreRules = `Academic tone; clear structure; examples and explanations.`;
  } else {
    genreRules = `Narrative flow; engaging content; varied sentence structures.`;
  }

  const seedHint = seed ? `\nSEED_KEYWORDS=${seed}` : '';
  const summaryHint = one_line ? `\nINTENT_HINT=${one_line}` : '';

  return `LANG=${L}
LEVEL=L${level}
GENRE=${genre}
${dialogueType ? `DIALOGUE_TYPE=${dialogueType}` : ''}
TOPIC=${title}${seedHint}${summaryHint}

SENTENCES=${p.sentRange[0]}–${p.sentRange[1]}
REGISTER=${p.register}
${lenLine}
MAX_SENTENCE_LEN=${maxSent}

${genreRules}

OUTPUT JSON:
{ "title":"...", "passage":"...", "notes":{}, "meta":{"lang":"${lang}","level":"L${level}","genre":"${genre}","dialogue_type":"${dialogueType || ''}"}, "violations":[] }

If length is outside ±10% or sentences out of range, self-repair before returning.`;
}
