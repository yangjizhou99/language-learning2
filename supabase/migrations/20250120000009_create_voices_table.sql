-- 音色表
create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  language_code text not null,
  ssml_gender text,
  natural_sample_rate_hertz integer,
  pricing jsonb not null default '{}'::jsonb,
  characteristics jsonb not null default '{}'::jsonb,
  display_name text,
  category text not null, -- 'Chirp3HD', 'Neural2', 'Wavenet', 'Standard', 'Other'
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 创建索引
create index if not exists idx_voices_language_code on public.voices(language_code);
create index if not exists idx_voices_category on public.voices(category);
create index if not exists idx_voices_is_active on public.voices(is_active);
create index if not exists idx_voices_name on public.voices(name);

-- 启用 RLS
alter table public.voices enable row level security;

-- 所有人都可以读取音色
create policy "voices_select_all"
on public.voices for select
using (is_active = true);

-- 创建更新时间触发器
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_voices_updated_at
  before update on public.voices
  for each row
  execute function update_updated_at_column();
