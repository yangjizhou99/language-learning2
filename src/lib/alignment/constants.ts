export const ALIGNMENT_LANGS = ['en', 'ja', 'zh'] as const;
export type AlignmentLang = (typeof ALIGNMENT_LANGS)[number];

export const ALIGNMENT_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type AlignmentLevel = (typeof ALIGNMENT_LEVELS)[number];

export const ALIGNMENT_GENRES = ['dialogue', 'article', 'task_email', 'long_writing'] as const;
export type AlignmentGenre = (typeof ALIGNMENT_GENRES)[number];

export const ALIGNMENT_TASK_TYPES = ['dialogue', 'article', 'task_email', 'long_writing'] as const;
export type AlignmentTaskType = (typeof ALIGNMENT_TASK_TYPES)[number];

export const ALIGNMENT_LEVEL_REQUIREMENT_COUNTS: Record<AlignmentLevel, [number, number]> = {
  1: [2, 2],
  2: [3, 3],
  3: [4, 4],
  4: [5, 5],
  5: [6, 6],
  6: [6, 8],
};

export const ALIGNMENT_WRITING_WORD_RANGES: Record<
  AlignmentLevel,
  { article: [number, number]; task_email: [number, number]; long_writing: [number, number] }
> = {
  1: {
    article: [80, 120],
    task_email: [60, 100],
    long_writing: [120, 160],
  },
  2: {
    article: [120, 160],
    task_email: [90, 140],
    long_writing: [160, 220],
  },
  3: {
    article: [160, 220],
    task_email: [120, 180],
    long_writing: [220, 320],
  },
  4: {
    article: [220, 320],
    task_email: [160, 220],
    long_writing: [320, 420],
  },
  5: {
    article: [280, 380],
    task_email: [200, 260],
    long_writing: [420, 520],
  },
  6: {
    article: [360, 460],
    task_email: [240, 320],
    long_writing: [520, 680],
  },
};

export const ALIGNMENT_DIALOGUE_TURN_RATIOS: Record<AlignmentLevel, number> = {
  1: 1.5,
  2: 1.5,
  3: 1.5,
  4: 1.5,
  5: 1.5,
  6: 1.5,
};
