// 用户管理相关类型定义

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'user';
  bio?: string;
  goals?: string;
  preferred_tone?: string;
  domains?: string[];
  native_lang?: string;
  target_langs?: string[];
  created_at: string;
  last_sign_in_at?: string;
}

export interface UserPracticeStats {
  user_id: string;
  total_shadowing_attempts: number;
  total_cloze_attempts: number;
  total_alignment_attempts: number;
  total_vocab_entries: number;
  last_activity: string;
  shadowing_by_lang: Record<string, number>;
  cloze_by_lang: Record<string, number>;
  alignment_by_lang: Record<string, number>;
  average_scores: {
    shadowing: number;
    cloze: number;
    alignment: number;
  };
}

export interface UserPermissions {
  user_id: string;
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  custom_restrictions?: Record<string, any>;
}

export interface UserActivity {
  id: string;
  user_id: string;
  activity_type: 'shadowing' | 'cloze' | 'alignment' | 'vocab';
  item_id: string;
  item_title: string;
  lang: string;
  level: number;
  score?: number;
  created_at: string;
}

export interface UserAnalytics {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_7d: number;
  new_users_30d: number;
  practice_completion_rate: number;
  average_session_duration: number;
  most_popular_languages: Array<{ lang: string; count: number }>;
  most_popular_levels: Array<{ level: number; count: number }>;
  user_retention_rate: number;
  daily_active_users: Array<{ date: string; count: number }>;
  practice_type_distribution: Record<string, number>;
  level_distribution: Record<number, number>;
  language_distribution: Record<string, number>;
}
