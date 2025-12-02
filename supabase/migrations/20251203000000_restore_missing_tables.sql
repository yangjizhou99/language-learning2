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

-- Enable RLS on restored tables (basic)
ALTER TABLE public.invitation_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shadowing_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloze_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_batch_items ENABLE ROW LEVEL SECURITY;
