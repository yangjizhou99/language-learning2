-- 增量同步（Delta Sync）与索引优化
-- 目标：为常用表补充 updated_at、自动更新时间触发器与增量查询索引

-- 1) 通用触发器函数（确保存在）
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 2) 为目标表补充 updated_at 字段
alter table if exists public.articles           add column if not exists updated_at timestamptz default now();
alter table if exists public.article_keys       add column if not exists updated_at timestamptz default now();
alter table if exists public.article_cloze      add column if not exists updated_at timestamptz default now();
alter table if exists public.article_drafts     add column if not exists updated_at timestamptz default now();
alter table if exists public.cloze_items        add column if not exists updated_at timestamptz default now();
alter table if exists public.cloze_drafts       add column if not exists updated_at timestamptz default now();
alter table if exists public.article_batches    add column if not exists updated_at timestamptz default now();
alter table if exists public.article_batch_items add column if not exists updated_at timestamptz default now();
alter table if exists public.shadowing_items    add column if not exists updated_at timestamptz default now();
-- shadowing_sessions 与 vocab_entries 已有 updated_at 与触发器；此处只补索引

-- 3) 创建/刷新触发器（若已存在则替换）
do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_articles_updated_at') then
    drop trigger trg_articles_updated_at on public.articles;
  end if;
end $$;
create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_article_keys_updated_at') then
    drop trigger trg_article_keys_updated_at on public.article_keys;
  end if;
end $$;
create trigger trg_article_keys_updated_at
  before update on public.article_keys
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_article_cloze_updated_at') then
    drop trigger trg_article_cloze_updated_at on public.article_cloze;
  end if;
end $$;
create trigger trg_article_cloze_updated_at
  before update on public.article_cloze
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_article_drafts_updated_at') then
    drop trigger trg_article_drafts_updated_at on public.article_drafts;
  end if;
end $$;
create trigger trg_article_drafts_updated_at
  before update on public.article_drafts
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_cloze_items_updated_at') then
    drop trigger trg_cloze_items_updated_at on public.cloze_items;
  end if;
end $$;
create trigger trg_cloze_items_updated_at
  before update on public.cloze_items
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_cloze_drafts_updated_at') then
    drop trigger trg_cloze_drafts_updated_at on public.cloze_drafts;
  end if;
end $$;
create trigger trg_cloze_drafts_updated_at
  before update on public.cloze_drafts
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_article_batches_updated_at') then
    drop trigger trg_article_batches_updated_at on public.article_batches;
  end if;
end $$;
create trigger trg_article_batches_updated_at
  before update on public.article_batches
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_article_batch_items_updated_at') then
    drop trigger trg_article_batch_items_updated_at on public.article_batch_items;
  end if;
end $$;
create trigger trg_article_batch_items_updated_at
  before update on public.article_batch_items
  for each row execute function public.update_updated_at_column();

do $$ begin
  if exists (select 1 from pg_trigger where tgname = 'trg_shadowing_items_updated_at') then
    drop trigger trg_shadowing_items_updated_at on public.shadowing_items;
  end if;
end $$;
create trigger trg_shadowing_items_updated_at
  before update on public.shadowing_items
  for each row execute function public.update_updated_at_column();

-- 4) 增量查询索引（过滤 + 排序）
create index if not exists idx_articles_lang_genre_updated
  on public.articles (lang, genre, updated_at desc);

create index if not exists idx_article_drafts_status_updated
  on public.article_drafts (status, updated_at desc);

create index if not exists idx_cloze_items_lang_level_updated
  on public.cloze_items (lang, level, updated_at desc);

create index if not exists idx_cloze_drafts_status_updated
  on public.cloze_drafts (status, updated_at desc);

create index if not exists idx_article_batches_status_updated
  on public.article_batches (status, updated_at desc);

create index if not exists idx_article_batch_items_batch_status_updated
  on public.article_batch_items (batch_id, status, updated_at desc);

create index if not exists idx_shadowing_items_status_updated
  on public.shadowing_items (status, updated_at desc);

-- 已存在 updated_at 的表补索引
create index if not exists idx_shadowing_sessions_user_updated
  on public.shadowing_sessions (user_id, updated_at desc);

create index if not exists idx_vocab_entries_user_updated
  on public.vocab_entries (user_id, updated_at desc);


