-- Restore missing tables based on dump-data.sql content

-- 1. invitation_uses
CREATE TABLE IF NOT EXISTS public.invitation_uses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code_id uuid REFERENCES public.invitation_codes(id),
    used_by uuid REFERENCES auth.users(id),
    used_at timestamptz DEFAULT now()
);

-- 2. shadowing_drafts
CREATE TABLE IF NOT EXISTS public.shadowing_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lang text,
    level int,
    topic text,
    genre text,
    register text,
    title text,
    text text,
    notes text,
    ai_provider text,
    ai_model text,
    ai_usage jsonb,
    status text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    translations jsonb,
    trans_updated_at timestamptz,
    source text,
    theme_id uuid REFERENCES public.shadowing_themes(id),
    subtopic_id uuid REFERENCES public.shadowing_subtopics(id),
    dialogue_type public.dialogue_type_enum DEFAULT 'casual'
);

-- 3. article_drafts
CREATE TABLE IF NOT EXISTS public.article_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source text,
    lang text,
    genre text,
    difficulty int,
    title text,
    text text,
    license text,
    ai_provider text,
    ai_model text,
    ai_params jsonb,
    ai_usage jsonb,
    keys jsonb,
    cloze_short jsonb,
    cloze_long jsonb,
    validator_report jsonb,
    status text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    published_article_id uuid, -- REFERENCES public.articles(id)?
    ai_answer_provider text,
    ai_answer_model text,
    ai_answer_usage jsonb,
    ai_text_provider text,
    ai_text_model text,
    ai_text_usage jsonb,
    ai_text_suggestion text
);

-- 4. cloze_drafts
CREATE TABLE IF NOT EXISTS public.cloze_drafts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lang text,
    level int,
    topic text,
    title text,
    passage text,
    blanks jsonb,
    ai_provider text,
    ai_model text,
    ai_usage jsonb,
    status text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- 5. cloze_items
CREATE TABLE IF NOT EXISTS public.cloze_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lang text,
    level int,
    topic text,
    title text,
    passage text,
    blanks jsonb,
    meta jsonb,
    created_at timestamptz DEFAULT now()
);

-- 6. voices
CREATE TABLE IF NOT EXISTS public.voices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    language_code text,
    ssml_gender text,
    natural_sample_rate_hertz int,
    pricing jsonb,
    characteristics jsonb,
    display_name text,
    category text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    provider text CHECK (provider IN ('google', 'gemini', 'xunfei')),
    usecase text,
    is_news_voice boolean DEFAULT false,
    use_case text
);

-- 7. article_batches
CREATE TABLE IF NOT EXISTS public.article_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    provider text,
    model text,
    lang text,
    genre text,
    words int,
    temperature float,
    status text,
    totals jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 8. article_batch_items
CREATE TABLE IF NOT EXISTS public.article_batch_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_id uuid REFERENCES public.article_batches(id),
    topic text,
    difficulty int,
    status text,
    result_draft_id uuid REFERENCES public.article_drafts(id),
    error text,
    usage jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 9. api_limits
CREATE TABLE IF NOT EXISTS public.api_limits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    enabled boolean DEFAULT true,
    daily_calls_limit int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- 10. cloze_attempts
CREATE TABLE IF NOT EXISTS public.cloze_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    item_id uuid REFERENCES public.cloze_items(id),
    lang text,
    level int,
    score int,
    answers jsonb,
    created_at timestamptz DEFAULT now()
);

-- 11. registration_config
CREATE TABLE IF NOT EXISTS public.registration_config (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    allow_direct_registration boolean DEFAULT true,
    allow_invitation_registration boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 12. sessions
CREATE TABLE IF NOT EXISTS public.sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    task_type text,
    topic text,
    status text,
    meta jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 13. shadowing_attempts
CREATE TABLE IF NOT EXISTS public.shadowing_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    item_id uuid REFERENCES public.shadowing_items(id),
    lang text,
    level int,
    score int,
    recording_url text,
    created_at timestamptz DEFAULT now()
);

-- 14. study_cards
CREATE TABLE IF NOT EXISTS public.study_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    lang text,
    type text,
    front text,
    back text,
    meta jsonb,
    created_at timestamptz DEFAULT now()
);

-- Add missing columns (using ALTER TABLE to handle existing tables)
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS provider text;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS tokens_used int;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS cost float;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS request_data jsonb;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS response_data jsonb;
ALTER TABLE public.api_usage_logs ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.api_usage_logs ALTER COLUMN endpoint DROP NOT NULL;
ALTER TABLE public.api_usage_logs ALTER COLUMN method DROP NOT NULL;
ALTER TABLE public.api_usage_logs ALTER COLUMN status_code DROP NOT NULL;

ALTER TABLE public.shadowing_themes ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.shadowing_subtopics ADD COLUMN IF NOT EXISTS title_cn text;
ALTER TABLE public.shadowing_subtopics ADD COLUMN IF NOT EXISTS seed_en text;
ALTER TABLE public.shadowing_subtopics ADD COLUMN IF NOT EXISTS one_line_cn text;
ALTER TABLE public.shadowing_subtopics ADD COLUMN IF NOT EXISTS tags jsonb;
ALTER TABLE public.shadowing_subtopics ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.shadowing_subtopics ALTER COLUMN title DROP NOT NULL;

ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS tokens jsonb;
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS cefr text;
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS meta jsonb;
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS translations jsonb;
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS trans_updated_at timestamptz;
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.shadowing_themes(id);
ALTER TABLE public.shadowing_items ADD COLUMN IF NOT EXISTS subtopic_id uuid REFERENCES public.shadowing_subtopics(id);

ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS daily_calls_limit int;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS daily_tokens_limit int;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS daily_cost_limit float;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS monthly_calls_limit int;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS monthly_tokens_limit int;
ALTER TABLE public.user_api_limits ADD COLUMN IF NOT EXISTS monthly_cost_limit float;
ALTER TABLE public.user_api_limits ALTER COLUMN limit_type DROP NOT NULL;

ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS daily_calls_limit int DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS daily_tokens_limit int DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS daily_cost_limit float DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS monthly_calls_limit int DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS monthly_tokens_limit int DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS monthly_cost_limit float DEFAULT 0;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS alert_threshold float;
ALTER TABLE public.api_limits ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.cloze_attempts ADD COLUMN IF NOT EXISTS lang text;
ALTER TABLE public.cloze_attempts ADD COLUMN IF NOT EXISTS level int;
ALTER TABLE public.cloze_attempts ADD COLUMN IF NOT EXISTS ai_result jsonb;

ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS allow_invitation_registration boolean DEFAULT true;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS require_email_verification boolean DEFAULT true;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS allow_google_oauth boolean DEFAULT true;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS allow_anonymous_login boolean DEFAULT true;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS maintenance_mode boolean DEFAULT false;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS maintenance_message text;
ALTER TABLE public.registration_config ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.registration_config ALTER COLUMN id TYPE text;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS input jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS output jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS ai_feedback jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS score int;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS duration_sec int;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS difficulty text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS lang text;

ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS lang text;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS level int;
ALTER TABLE public.shadowing_attempts ADD COLUMN IF NOT EXISTS metrics jsonb;

ALTER TABLE public.study_cards ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.study_cards ADD COLUMN IF NOT EXISTS value text;
ALTER TABLE public.study_cards ADD COLUMN IF NOT EXISTS article_id uuid;

-- Enable RLS on restored tables (basic)
ALTER TABLE public.invitation_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_cards ENABLE ROW LEVEL SECURITY;
