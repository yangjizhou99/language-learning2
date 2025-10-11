import type {
  AlignmentGenre,
  AlignmentLang,
  AlignmentLevel,
  AlignmentTaskType,
} from './constants';

export type AlignmentThemeStatus = 'draft' | 'active' | 'archived';
export type AlignmentSubtopicStatus = 'draft' | 'needs_review' | 'active' | 'archived';
export type AlignmentMaterialStatus = 'draft' | 'pending_review' | 'active' | 'archived';
export type AlignmentMaterialReviewStatus = 'pending' | 'approved' | 'rejected';
export type AlignmentAttemptStatus = 'draft' | 'completed' | 'cancelled';

export interface AlignmentTheme {
  id: string;
  lang: AlignmentLang;
  level: AlignmentLevel;
  genre: AlignmentGenre;
  title: string;
  title_translations: Record<string, string>;
  title_normalized: string;
  summary: string | null;
  summary_translations: Record<string, string>;
  status: AlignmentThemeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  subtopic_count?: number;
}

export interface AlignmentSubtopic {
  id: string;
  theme_id: string;
  lang: AlignmentLang;
  level: AlignmentLevel;
  genre: AlignmentGenre;
  title: string;
  title_translations: Record<string, string>;
  title_normalized: string;
  one_line: string | null;
  one_line_translations: Record<string, string>;
  objectives: Array<{ title: string; translations?: Record<string, string> }>;
  status: AlignmentSubtopicStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  material?: AlignmentMaterial | null;
}

export interface AlignmentKnowledgeWord {
  term: string;
  translations: Record<string, string>;
}

export interface AlignmentKnowledgeSentence {
  sentence: string;
  translations: Record<string, string>;
}

export interface AlignmentKnowledgePoints {
  words: AlignmentKnowledgeWord[];
  sentences: AlignmentKnowledgeSentence[];
}

export interface AlignmentRequirement {
  label: string;
  translations?: Record<string, string>;
  category?: 'content' | 'language' | 'strategy' | string;
}

export interface AlignmentRubricDimension {
  label: string;
  description: string;
  translations?: Record<string, string>;
  weight?: number;
}

export type AlignmentDialogueSpeaker = 'user' | 'ai';

export interface AlignmentPracticeScenarioRole {
  name: string;
  description: string;
  translations?: Record<string, string>;
}

export interface AlignmentPracticeScenario {
  summary: string;
  summary_translations: Record<string, string>;
  user_role: AlignmentPracticeScenarioRole;
  ai_role: AlignmentPracticeScenarioRole;
  kickoff_speaker: AlignmentDialogueSpeaker;
  objectives: Array<{ label: string; translations?: Record<string, string> }>;
  context_notes?: string;
  context_notes_translations?: Record<string, string>;
}

export interface AlignmentStandardDialogueTurn {
  speaker: AlignmentDialogueSpeaker;
  text: string;
  translations?: Record<string, string>;
  objective_refs?: Array<number>;
}

export interface AlignmentStandardDialogue {
  summary?: string;
  summary_translations?: Record<string, string>;
  turns: AlignmentStandardDialogueTurn[];
}

export interface AlignmentMaterial {
  id: string;
  subtopic_id: string;
  lang: AlignmentLang;
  task_type: AlignmentTaskType;
  status: AlignmentMaterialStatus;
  version: number;
  is_current: boolean;
  task_prompt: string;
  task_prompt_translations: Record<string, string>;
  exemplar: string;
  exemplar_translations: Record<string, string>;
  knowledge_points: AlignmentKnowledgePoints;
  requirements: AlignmentRequirement[];
  standard_answer: string;
  standard_answer_translations: Record<string, string>;
  core_sentences: string[];
  rubric: Record<string, AlignmentRubricDimension>;
  dialogue_meta: {
    roles?: Array<{ name: string; description?: string; translations?: Record<string, string> }>;
    expected_turns?: number;
    max_turns?: number;
    notes?: string;
    [key: string]: unknown;
  };
  writing_meta: {
    word_range?: [number, number];
    style?: string;
    tone?: string;
    [key: string]: unknown;
  };
  ai_metadata: Record<string, unknown>;
  practice_scenario?: AlignmentPracticeScenario | null;
  standard_dialogue?: AlignmentStandardDialogue | null;
  review_status: AlignmentMaterialReviewStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlignmentAttempt {
  id: string;
  user_id: string;
  subtopic_id: string;
  material_id: string | null;
  task_type: AlignmentTaskType;
  attempt_number: number;
  submission: Record<string, unknown>;
  submission_text: string | null;
  word_count: number | null;
  turn_count: number | null;
  duration_seconds: number | null;
  score_total: number | null;
  scores: Record<string, unknown> | null;
  feedback: string | null;
  feedback_json: Record<string, unknown> | null;
  ai_model: string | null;
  ai_response: Record<string, unknown> | null;
  prev_attempt_id: string | null;
  status: AlignmentAttemptStatus;
  created_at: string;
  updated_at: string;
}
