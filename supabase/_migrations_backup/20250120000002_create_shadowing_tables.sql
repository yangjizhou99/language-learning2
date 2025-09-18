-- 创建 shadowing 练习相关的表
-- 20250120000002_create_shadowing_tables.sql

-- Shadowing 素材表（题库）
create table if not exists public.shadowing_items (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en', 'ja', 'zh')),
  level int not null check (level between 1 and 5),
  title text not null,
  text text not null,
  audio_url text not null,
  duration_ms int,
  tokens int,
  cefr text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 用户练习记录表
create table if not exists public.shadowing_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.shadowing_items(id) on delete cascade,
  lang text not null check (lang in ('en', 'ja', 'zh')),
  level int not null check (level between 1 and 5),
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 启用行级安全
alter table public.shadowing_items enable row level security;
alter table public.shadowing_attempts enable row level security;

-- 创建策略
create policy si_read on public.shadowing_items for select to authenticated using (true);
create policy sa_owner_rw on public.shadowing_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 创建索引
create index if not exists idx_shadowing_items_lang_level on public.shadowing_items(lang, level);
create index if not exists idx_shadowing_attempts_user_lang on public.shadowing_attempts(user_id, lang);
create index if not exists idx_shadowing_attempts_created_at on public.shadowing_attempts(created_at desc);
