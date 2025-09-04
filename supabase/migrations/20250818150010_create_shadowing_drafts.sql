-- Shadowing 草稿表（供审核/发布）
create table if not exists public.shadowing_drafts (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en','ja','zh')),
  level int not null check (level between 1 and 5),
  topic text default '',
  genre text default 'monologue',
  register text default 'neutral',
  title text not null,
  text text not null,
  notes jsonb default '{}'::jsonb,
  ai_provider text,
  ai_model text,
  ai_usage jsonb default '{}'::jsonb,
  status text not null default 'draft', -- draft|approved
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.shadowing_drafts enable row level security;
create policy sd_admin on public.shadowing_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_shadowing_drafts_lang_level on public.shadowing_drafts(lang, level);
create index if not exists idx_shadowing_drafts_status on public.shadowing_drafts(status);


