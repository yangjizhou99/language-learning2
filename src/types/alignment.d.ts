// 对齐训练包相关类型定义

export interface AlignmentPack {
  id: string;
  lang: 'en' | 'ja' | 'zh';
  topic: string;
  tags: string[];
  level_min: number;
  level_max: number;
  preferred_style: PreferredStyle;
  steps: AlignmentSteps;
  ai_provider?: string;
  ai_model?: string;
  ai_usage?: AIUsage;
  status: 'draft' | 'published' | 'archived';
  created_by: string;
  created_at: string;
}

export interface PreferredStyle {
  formality: 'neutral' | 'formal' | 'casual';
  tone: 'friendly' | 'direct' | 'polite' | 'academic';
  length: 'concise' | 'balanced' | 'detailed';
  voice: 'first' | 'second' | 'third';
  extras: string[];
}

export interface AlignmentSteps {
  version: number;
  order: string[];
  D1: DialogueStep;
  D2: DialogueStep;
  T3: DiscussionStep;
  W4: WritingShortStep;
  T5: TaskEmailStep;
  W6: WritingLongStep;
}

export interface DialogueStep {
  type: 'dialogue_easy' | 'dialogue_rich';
  title: string;
  prompt: string;
  exemplar: string;
  key_phrases: string[];
  patterns: string[];
  rubric: Rubric;
  hints: string[];
}

export interface DiscussionStep {
  type: 'discussion';
  title: string;
  prompt: string;
  exemplar: string;
  key_phrases: string[];
  patterns: string[];
  rubric: Rubric;
  hints: string[];
}

export interface WritingShortStep {
  type: 'writing_short';
  title: string;
  prompt: string;
  exemplar: string;
  checklist: string[];
  rubric: Rubric;
}

export interface TaskEmailStep {
  type: 'task_email';
  title: string;
  prompt: string;
  exemplar: string;
  templates: string[];
  rubric: Rubric;
}

export interface WritingLongStep {
  type: 'writing_long';
  title: string;
  prompt: string;
  exemplar: string;
  outline: string[];
  rubric: Rubric;
}

export interface Rubric {
  fluency: string;
  relevance: string;
  style: string;
  length: string;
}

export interface AIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AlignmentAttempt {
  id: string;
  user_id: string;
  pack_id: string;
  step_key: string;
  submission: string;
  scores?: Scores;
  feedback?: Feedback;
  created_at: string;
}

export interface Scores {
  fluency: number;
  relevance: number;
  style: number;
  overall: number;
}

export interface Feedback {
  key_points: string[];
  suggestions: string[];
  phrases: string[];
}
