-- 批次主表
create table if not exists public.article_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null,          -- openrouter/deepseek/openai
  model text not null,             -- 例如 openai/gpt-4o-mini
  lang text not null,              -- en/ja/zh
  genre text not null,             -- news/science/essay/dialogue/literature
  words int not null default 300,
  temperature float8 not null default 0.6,
  status text not null default 'pending', -- pending|running|done|canceled|failed
  totals jsonb not null default '{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 批次项（队列任务）
create table if not exists public.article_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.article_batches(id) on delete cascade,
  topic text,                      -- 可空（随机/无主题）
  difficulty int not null check (difficulty between 1 and 5),
  status text not null default 'pending', -- pending|processing|done|failed|skipped
  result_draft_id uuid,            -- 生成的草稿 id
  error text,
  usage jsonb default '{}'::jsonb, -- {prompt_tokens, completion_tokens, total_tokens}
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.article_batches enable row level security;
alter table public.article_batch_items enable row level security;

drop policy if exists batch_select on public.article_batches;
create policy batch_select on public.article_batches for select to authenticated using (true);

drop policy if exists batch_write on public.article_batches;
create policy batch_write  on public.article_batches for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists batch_item_select on public.article_batch_items;
create policy batch_item_select on public.article_batch_items for select to authenticated using (true);

drop policy if exists batch_item_write on public.article_batch_items;
create policy batch_item_write  on public.article_batch_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());


