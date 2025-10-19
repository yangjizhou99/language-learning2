// =====================================================
// AI发音纠正系统 - 类型定义
// =====================================================

/**
 * Welford 统计数据
 */
export interface Stat {
  n: number; // 样本数量
  mean: number; // 均值
  m2: number; // Welford M2值（用于计算方差）
}

/**
 * 置信区间
 */
export interface ConfidenceInterval {
  low?: number; // 下限
  high?: number; // 上限
  width?: number; // 宽度
}

/**
 * 评分等级
 */
export type Grade = 'A' | 'B' | 'C';

/**
 * 用户 Unit 统计
 */
export interface UnitStats {
  unit_id: number;
  symbol: string;
  n: number;
  mean: number;
  ci_low?: number;
  ci_high?: number;
  grade: Grade;
  unit_type?: string;
}

/**
 * 评测记录
 */
export interface Attempt {
  attempt_id: number;
  user_id: string;
  lang: string;
  sentence_id?: number;
  azure_raw_json: any;
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody?: number;
  pron_score: number;
  valid_flag: boolean;
  audio_path?: string;
  created_at: string;
}

/**
 * 句子
 */
export interface Sentence {
  sentence_id: number;
  lang: string;
  text: string;
  level: number;
  domain_tags: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Azure 音素级数据
 */
export interface AzurePhoneme {
  Phoneme?: string;
  phoneme?: string;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    accuracyScore?: number;
  };
  pronunciationAssessment?: {
    AccuracyScore?: number;
    accuracyScore?: number;
  };
}

/**
 * Azure 词级数据
 */
export interface AzureWord {
  Word?: string;
  word?: string;
  Phonemes?: AzurePhoneme[];
  phonemes?: AzurePhoneme[];
  PronunciationAssessment?: {
    AccuracyScore?: number;
    accuracyScore?: number;
  };
  pronunciationAssessment?: {
    AccuracyScore?: number;
    accuracyScore?: number;
  };
}

/**
 * Azure 评测结果
 */
export interface AzureResult {
  NBest?: Array<{
    Words?: AzureWord[];
    words?: AzureWord[];
    PronunciationAssessment?: {
      AccuracyScore?: number;
      accuracyScore?: number;
      FluencyScore?: number;
      fluencyScore?: number;
      CompletenessScore?: number;
      completenessScore?: number;
      ProsodyScore?: number;
      prosodyScore?: number;
      PronScore?: number;
      pronScore?: number;
    };
    pronunciationAssessment?: {
      AccuracyScore?: number;
      accuracyScore?: number;
      FluencyScore?: number;
      fluencyScore?: number;
      CompletenessScore?: number;
      completenessScore?: number;
      ProsodyScore?: number;
      prosodyScore?: number;
      PronScore?: number;
      pronScore?: number;
    };
  }>;
  nBest?: Array<{
    Words?: AzureWord[];
    words?: AzureWord[];
    PronunciationAssessment?: {
      AccuracyScore?: number;
      accuracyScore?: number;
      FluencyScore?: number;
      fluencyScore?: number;
      CompletenessScore?: number;
      completenessScore?: number;
      ProsodyScore?: number;
      prosodyScore?: number;
      PronScore?: number;
      pronScore?: number;
    };
    pronunciationAssessment?: {
      AccuracyScore?: number;
      accuracyScore?: number;
      FluencyScore?: number;
      fluencyScore?: number;
      CompletenessScore?: number;
      completenessScore?: number;
      ProsodyScore?: number;
      prosodyScore?: number;
      PronScore?: number;
      pronScore?: number;
    };
  }>;
  PronunciationAssessment?: {
    AccuracyScore?: number;
    accuracyScore?: number;
    FluencyScore?: number;
    fluencyScore?: number;
    CompletenessScore?: number;
    completenessScore?: number;
    ProsodyScore?: number;
    prosodyScore?: number;
    PronScore?: number;
    pronScore?: number;
  };
}

/**
 * 解析后的 Azure 结果
 */
export interface ParsedAzureResult {
  accuracy: number;
  fluency: number;
  completeness: number;
  prosody?: number;
  pronScore: number;
  units: Array<{
    symbol: string;
    score: number;
  }>;
}

/**
 * Unit 数据
 */
export interface Unit {
  unit_id: number;
  lang: string;
  symbol: string;
  unit_type: 'phoneme' | 'syllable' | 'custom';
}

/**
 * 句子与 Unit 关联
 */
export interface SentenceUnit {
  sentence_id: number;
  unit_id: number;
  count: number;
}

/**
 * 用户句子进度
 */
export interface UserSentenceProgress {
  user_id: string;
  sentence_id: number;
  status: 'pending' | 'in_progress' | 'completed';
  attempts_cnt: number;
  last_score?: number;
  last_ts?: string;
}

/**
 * Token 响应
 */
export interface TokenResponse {
  token: string;
  region: string;
  expiresAt: number;
}

/**
 * 评测上报请求
 */
export interface AttemptRequest {
  sentence_id?: number;
  lang: string;
  azure_json: any;
  audio_path?: string;
}

/**
 * 评测上报响应
 */
export interface AttemptResponse {
  attempt_id: number;
  valid: boolean;
  updated_units: Array<{
    unit_id: number;
    n: number;
    mean: number;
    ci_low?: number;
    ci_high?: number;
  }>;
}

/**
 * 下一组句子请求参数
 */
export interface NextSentencesQuery {
  lang: string;
  k?: number;
}

/**
 * 下一组句子响应
 */
export interface NextSentencesResponse {
  items: Array<{
    sentence_id: number;
    text: string;
    gain?: number;
  }>;
}

