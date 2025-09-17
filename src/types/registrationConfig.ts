export interface RegistrationConfig {
  id: string;
  allow_direct_registration: boolean;
  allow_invitation_registration: boolean;
  require_email_verification: boolean;
  allow_google_oauth: boolean;
  allow_anonymous_login: boolean;
  maintenance_mode: boolean;
  maintenance_message?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateRegistrationConfigRequest {
  allow_direct_registration?: boolean;
  allow_invitation_registration?: boolean;
  require_email_verification?: boolean;
  allow_google_oauth?: boolean;
  allow_anonymous_login?: boolean;
  maintenance_mode?: boolean;
  maintenance_message?: string;
}
