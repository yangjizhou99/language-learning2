-- 大主题表
create table if not exists public.shadowing_themes (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en','ja','zh')),
  level int not null check (level between 1 and 6),
  genre text not null,
  title text not null,
  "desc" text,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 小主题表
create table if not exists public.shadowing_subtopics (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.shadowing_themes(id) on delete cascade,
  lang text not null check (lang in ('en','ja','zh')),
  level int not null check (level between 1 and 6),
  genre text not null,
  title_cn text not null,
  seed_en text,
  one_line_cn text,
  tags text[],
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 索引
create unique index if not exists uniq_shadowing_themes_key on public.shadowing_themes(lang, level, genre, title);
create index if not exists idx_shadowing_themes_lgg on public.shadowing_themes(lang, level, genre);
create index if not exists idx_shadowing_subtopics_theme on public.shadowing_subtopics(theme_id);
create index if not exists idx_shadowing_subtopics_filter on public.shadowing_subtopics(lang, level, genre, status);

-- RLS策略
alter table public.shadowing_themes enable row level security;
alter table public.shadowing_subtopics enable row level security;

-- 简化：登录用户均可读写（在API侧做admin检查）
create policy if not exists p_shadowing_themes_rw on public.shadowing_themes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy if not exists p_shadowing_subtopics_rw on public.shadowing_subtopics
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 为shadowing_drafts表添加source字段（如果不存在）
alter table if not exists public.shadowing_drafts
  add column if not exists source jsonb;




