import type { AlignmentGenre, AlignmentLang, AlignmentLevel } from './constants';

export function normalizeTitle(input: string) {
  return input
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function assertAlignmentLang(lang: string): AlignmentLang {
  if (lang === 'en' || lang === 'ja' || lang === 'zh') return lang;
  throw new Error(`Unsupported alignment lang: ${lang}`);
}

export function assertAlignmentGenre(genre: string): AlignmentGenre {
  if (genre === 'dialogue' || genre === 'article' || genre === 'task_email' || genre === 'long_writing') {
    return genre;
  }
  throw new Error(`Unsupported alignment genre: ${genre}`);
}

export function assertAlignmentLevel(level: number): AlignmentLevel {
  if (level >= 1 && level <= 6) return level as AlignmentLevel;
  throw new Error(`Unsupported alignment level: ${level}`);
}
