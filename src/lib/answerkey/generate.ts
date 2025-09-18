import lexEn from '../../../data/lexicon/en.json';
import lexJa from '../../../data/lexicon/ja.json';
import lexZh from '../../../data/lexicon/zh.json';
import type {
  Lexicon,
  SpanItem,
  PronounResolution,
  SVOTriple,
  ClozeItem,
} from '../../types/lexicon';

type Lang = 'en' | 'ja' | 'zh';
const LEX: Record<Lang, Lexicon> = { en: lexEn, ja: lexJa, zh: lexZh };

const SENT_SPLIT = {
  en: /(?<=[.!?])\s+/,
  ja: /(?<=[。！？])/,
  zh: /(?<=[。！？；])/,
};

export function normalize(s: string) {
  return s.normalize('NFKC');
}

export function pass1(text: string, lang: Lang): SpanItem[] {
  const t = normalize(text);
  const items: SpanItem[] = [];
  // Connectives: match against lexicon
  const cons: string[] = LEX[lang].connectives || [];
  for (const w of cons) {
    const re = new RegExp(
      `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      lang === 'en' ? 'gi' : 'g',
    );
    let m;
    while ((m = re.exec(t)))
      items.push({ span: [m.index, m.index + m[0].length], tag: 'connective', surface: m[0] });
  }
  // Time expressions: support regex patterns
  const times: string[] = LEX[lang].time || [];
  for (const p of times) {
    const re = new RegExp(p, 'g');
    let m;
    while ((m = re.exec(t)))
      items.push({ span: [m.index, m.index + m[0].length], tag: 'time', surface: m[0] });
  }
  return items;
}

export function pass2(text: string, lang: Lang): PronounResolution[] {
  const t = normalize(text);
  const sentences = t
    .split(SENT_SPLIT[lang])
    .map((s) => s.trim())
    .filter(Boolean);
  const pronList: string[] = LEX[lang].pronouns || [];
  const out: PronounResolution[] = [];
  let offset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    for (const p of pronList) {
      const re = new RegExp(lang === 'en' ? `\\b${p}\\b` : p, 'gi');
      let m;
      while ((m = re.exec(s))) {
        const start = offset + m.index,
          end = start + m[0].length;
        // Find antecedents in previous 2 sentences
        const window = sentences.slice(Math.max(0, i - 2), i + 1).join(' ');
        const candidates: [number, number][] = [];
        const reNoun =
          lang === 'en'
            ? /\b[A-Z][a-z]+|\b[a-z]{3,}\b/g
            : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu;
        let mm;
        while ((mm = reNoun.exec(window))) {
          const abs = offset - (i > 2 ? sentences.slice(0, i - 2).join(' ').length : 0) + mm.index;
          candidates.push([abs, abs + mm[0].length]);
        }
        const antecedents = candidates.slice(-3); // Take last 3 candidates
        out.push({ pron: [start, end], antecedents });
      }
    }
    offset += s.length + (t.match(SENT_SPLIT[lang]) ? 1 : 0);
  }
  return out;
}

export function pass3(text: string, lang: Lang): SVOTriple[] {
  const t = normalize(text);
  const sents = t
    .split(SENT_SPLIT[lang])
    .map((s) => s.trim())
    .filter(Boolean);
  const triples: SVOTriple[] = [];
  let base = 0;

  for (const s of sents) {
    if (lang === 'en') {
      // Simple SVO pattern for English
      const re =
        /\b([A-Za-z][A-Za-z\-']{1,})\b[^.!?]{0,40}?\b(is|are|was|were|be|become|makes|made|has|have|do|does|did|[a-z]+s|[a-z]+ed|[a-z]+ing)\b[^.!?]{0,40}?\b([A-Za-z][A-Za-z\-']{1,})\b/;
      const m = re.exec(s);
      if (m) triples.push(spanTriple(s, m, base));
    } else {
      // Subject-Verb-Object for Japanese/Chinese
      const re =
        /([\p{Letter}\p{Number}]{2,})[^。！？；]{0,12}?([是为成为属于包含导致表示决定促进提供采用包含])[^。！？；]{0,12}?([\p{Letter}\p{Number}]{2,})/u;
      const m = re.exec(s);
      if (m) triples.push(spanTriple(s, m, base));
    }
    base += s.length + 1;
  }
  return triples;
}

function spanTriple(s: string, m: RegExpExecArray, base: number): SVOTriple {
  const idxS = s.indexOf(m[1]);
  const idxV = s.indexOf(m[2], idxS + m[1].length);
  const idxO = s.indexOf(m[3], idxV + m[2].length);
  return {
    s: [base + idxS, base + idxS + m[1].length] as [number, number],
    v: [base + idxV, base + idxV + m[2].length] as [number, number],
    o: [base + idxO, base + idxO + m[3].length] as [number, number],
  };
}

export function makeCloze(text: string, lang: Lang, version: 'short' | 'long'): ClozeItem[] {
  const t = normalize(text);
  const targetRatio = version === 'short' ? 0.06 : 0.12;
  const candidates: ClozeItem[] = [];

  // First priority: connectives and time expressions
  const p1 = pass1(t, lang);
  for (const it of p1)
    candidates.push({
      start: it.span[0],
      end: it.span[1],
      answer: t.slice(it.span[0], it.span[1]),
      hint: it.tag,
      type: it.tag,
    });

  // Second priority: collocations (2-3 words for EN, 2-4 chars for JA/ZH)
  if (lang === 'en') {
    const re = /\b([A-Za-z]+(?:\s+[A-Za-z]+){1,2})\b/g;
    let m;
    while ((m = re.exec(t))) {
      if (m[0].length >= 6)
        candidates.push({
          start: m.index,
          end: m.index + m[0].length,
          answer: m[0],
          hint: 'collocation',
          type: 'collocation',
        });
    }
  } else {
    const re = /([\p{Script=Han}]{2,4})/gu;
    let m;
    while ((m = re.exec(t))) {
      candidates.push({
        start: m.index,
        end: m.index + m[0].length,
        answer: m[0],
        hint: 'phrase',
        type: 'collocation',
      });
    }
  }

  // Select non-overlapping blanks to reach target ratio
  candidates.sort((a, b) => a.start - b.start);
  const chosen: ClozeItem[] = [];
  const maxBlanks = Math.max(3, Math.floor((t.length * targetRatio) / 4));

  for (const c of candidates) {
    if (chosen.length >= maxBlanks) break;
    if (chosen.some((x) => !(c.end <= x.start || c.start >= x.end))) continue;
    if (t.slice(c.start, c.end) !== c.answer) continue;
    chosen.push(c);
  }
  return chosen;
}
