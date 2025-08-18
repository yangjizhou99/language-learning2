-- 草稿表：AI 或人工初稿先入这里，审核通过后再"发布"到正式库
create table if not exists public.article_drafts (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'ai' | 'manual' | 'url'
  lang text not null,                    -- 'en'|'ja'|'zh'
  genre text not null,                   -- news/science/essay/dialogue/literature
  difficulty int not null check (difficulty between 1 and 5),
  title text not null,
  text text not null,
  license text default null,             -- AI-Generated / User-Provided / CC BY-SA 4.0 等
  ai_provider text default null,         -- 'openrouter'|'deepseek'|'openai'
  ai_model text default null,            -- e.g. openai/gpt-4o-mini or deepseek-chat
  ai_params jsonb default '{}'::jsonb,   -- {temperature:0.6, words:300, topic:'...'}
  ai_usage jsonb default '{}'::jsonb,    -- {prompt_tokens:..., completion_tokens:...}
  keys jsonb default '{}'::jsonb,        -- {pass1:[], pass2:[], pass3:[]}
  cloze_short jsonb default '[]'::jsonb,
  cloze_long  jsonb default '[]'::jsonb,
  validator_report jsonb default '{}'::jsonb,
  status text not null default 'pending',-- pending|needs_fix|approved|published|rejected
  meta jsonb default '{}'::jsonb,        -- 额外字段如 source_url 等
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  published_article_id uuid default null -- 发布后回填 articles.id
);

alter table public.article_drafts enable row level security;

-- 读：管理员 & 登录用户可读；写：仅管理员
drop policy if exists draft_select on public.article_drafts;
create policy draft_select on public.article_drafts for select to authenticated using (true);

drop policy if exists draft_write on public.article_drafts;
create policy draft_write on public.article_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
