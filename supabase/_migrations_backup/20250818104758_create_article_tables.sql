-- 1. 题库主表
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  lang text not null,            -- 'en'|'ja'|'zh'
  genre text not null,           -- 'news'|'science'|'essay'|'dialogue'|'literature'
  difficulty int not null check (difficulty between 1 and 5),
  title text not null,
  source_url text,
  license text,
  text text not null,
  checksum text not null,        -- sha256 去重
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (lang, title, checksum)
);

-- 2. 答案键（与文章 1:1）
create table if not exists public.article_keys (
  article_id uuid primary key references public.articles(id) on delete cascade,
  pass1 jsonb,   -- 连接词/时间：[{span:[s,e], tag:"connective"|"time", surface:"因此"}]
  pass2 jsonb,   -- 指代解析：[{pron:[s,e], antecedents:[[s,e],...]}]
  pass3 jsonb    -- 三元组：[{s:[s,e], v:[s,e], o:[s,e]}]
);

-- 3. Cloze 题面（同一文章可有多套版本）
create table if not exists public.article_cloze (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id) on delete cascade,
  version text not null,         -- 'short'|'long'
  items jsonb not null           -- [{start,end,answer,hint,type}]
);

-- 4. 学习卡片（也可直接用你已有 phrases/glossary）
create table if not exists public.study_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  lang text not null,
  type text not null,            -- 'connective'|'collocation'|'triple'
  value jsonb not null,
  article_id uuid,
  created_at timestamptz default now()
);

-- RLS：登录用户可读；只有管理员可写
alter table public.articles enable row level security;
alter table public.article_keys enable row level security;
alter table public.article_cloze enable row level security;

-- 我们用 profiles.role='admin' 判定管理员
alter table public.profiles add column if not exists role text default 'user';

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;

-- SELECT：所有已登录用户可读
drop policy if exists art_select on public.articles;
create policy art_select on public.articles for select to authenticated using (true);

drop policy if exists keys_select on public.article_keys;
create policy keys_select on public.article_keys for select to authenticated using (true);

drop policy if exists cloze_select on public.article_cloze;
create policy cloze_select on public.article_cloze for select to authenticated using (true);

-- INSERT/UPDATE/DELETE：仅管理员
drop policy if exists art_write on public.articles;
create policy art_write on public.articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists keys_write on public.article_keys;
create policy keys_write on public.article_keys for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists cloze_write on public.article_cloze;
create policy cloze_write on public.article_cloze for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
