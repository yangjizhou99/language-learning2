-- 创建 Cloze 挖空练习相关表

-- 1) 草稿表（管理员审核/修改）
create table if not exists public.cloze_drafts (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en','ja','zh')),
  level int not null check (level between 1 and 5),
  topic text default '',
  title text not null,
  passage text not null,              -- 含 {{1}}, {{2}} 占位
  blanks jsonb not null,              -- [{"id":1,"answer":"in spite of","acceptable":["despite"],"distractors":["because of"],"explanation":"...","type":"connector"}, ...]
  ai_provider text,
  ai_model text,
  ai_usage jsonb default '{}'::jsonb,
  status text not null default 'draft',  -- draft|needs_fix|approved
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 2) 正式题库（学员抽题）
create table if not exists public.cloze_items (
  id uuid primary key default gen_random_uuid(),
  lang text not null check (lang in ('en','ja','zh')),
  level int not null check (level between 1 and 5),
  topic text default '',
  title text not null,
  passage text not null,              -- 含 {{1}} 占位
  blanks jsonb not null,              -- 同上，已审定
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- 3) 作答记录（AI 评分 + 反馈）
create table if not exists public.cloze_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.cloze_items(id) on delete cascade,
  lang text not null,
  level int not null,
  answers jsonb not null,             -- {"1":"despite", "2":"although", ...}
  ai_result jsonb not null,           -- {per_blank:[{id:1,score:1,reason:"..."}], overall:..., suggestions:[...]}
  created_at timestamptz default now()
);

-- 启用行级安全策略
alter table public.cloze_drafts enable row level security;
alter table public.cloze_items enable row level security;
alter table public.cloze_attempts enable row level security;

-- 草稿表策略（仅管理员）
create policy cd_admin on public.cloze_drafts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 题库策略（所有用户可读）
create policy ci_read on public.cloze_items for select to authenticated using (true);

-- 作答记录策略（用户只能访问自己的记录）
create policy ca_owner_rw on public.cloze_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 创建索引
create index if not exists idx_cloze_drafts_lang_level on public.cloze_drafts(lang, level);
create index if not exists idx_cloze_drafts_status on public.cloze_drafts(status);
create index if not exists idx_cloze_items_lang_level on public.cloze_items(lang, level);
create index if not exists idx_cloze_attempts_user_id on public.cloze_attempts(user_id);
create index if not exists idx_cloze_attempts_item_id on public.cloze_attempts(item_id);
