// 邀请码相关类型定义

export interface InvitationCode {
  id: string;
  code: string;
  created_by: string;
  max_uses: number;
  used_count: number;
  expires_at?: string;
  permissions: InvitationPermissions;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvitationUse {
  id: string;
  code_id: string;
  used_by: string;
  used_at: string;
}

export interface InvitationPermissions {
  can_access_shadowing?: boolean;
  can_access_cloze?: boolean;
  can_access_alignment?: boolean;
  can_access_articles?: boolean;
  allowed_languages?: string[];
  allowed_levels?: number[];
  max_daily_attempts?: number;
  ai_enabled?: boolean;
  expires_at?: string; // 权限过期时间
  custom_restrictions?: Record<string, any>;
  // API使用限制
  api_limits?: {
    enabled?: boolean;
    daily_calls_limit?: number;
    daily_tokens_limit?: number;
    daily_cost_limit?: number;
    monthly_calls_limit?: number;
    monthly_tokens_limit?: number;
    monthly_cost_limit?: number;
  };
  // API密钥配置
  api_keys?: {
    deepseek?: string;
    openrouter?: string;
  };
  // 模型权限配置
  model_permissions?: Array<{
    model_id: string;
    model_name: string;
    provider: string;
    daily_limit: number;
    token_limit: number;
    enabled: boolean;
  }>;
}

export interface CreateInvitationRequest {
  max_uses?: number;
  expires_at?: string;
  permissions?: InvitationPermissions;
  description?: string;
}

export interface UpdateInvitationRequest {
  max_uses?: number;
  expires_at?: string;
  permissions?: InvitationPermissions;
  description?: string;
  is_active?: boolean;
}

export interface InvitationValidationResult {
  is_valid: boolean;
  code_id?: string;
  max_uses?: number;
  used_count?: number;
  expires_at?: string;
  permissions?: InvitationPermissions;
  error_message?: string;
}

export interface RegisterWithInvitationRequest {
  email: string;
  password: string;
  invitation_code: string;
  username?: string;
  native_lang?: string;
  target_langs?: string[];
}
