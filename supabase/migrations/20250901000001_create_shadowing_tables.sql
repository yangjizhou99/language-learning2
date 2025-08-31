-- 单次 Shadowing 练习
create table if not exists public.shadowing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null check (lang in ('en','ja','zh')),
  difficulty int not null check (difficulty between 1 and 5),   -- L1~L5
  recommended boolean not null default true,                    -- 是否采用推荐值
  type text not null default 'monologue',                       -- monologue|dialogue|news
  title text,
  script text not null,                                         -- AI 生成原文
  tts_voice text,                                               -- GCloud voice id
  tts_rate numeric default 1.0,                                 -- 语速
  tts_audio_url text,                                           -- 合成音频地址（可选）
  metrics jsonb default '{}'::jsonb,                            -- {cer|wer,wpm,duration_s, pauses, retries, self_rating}
  status text not null default 'created',                       -- created|completed|aborted
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.shadowing_sessions enable row level security;
drop policy if exists sh_select on public.shadowing_sessions;
create policy sh_select on public.shadowing_sessions for select to authenticated using (auth.uid() = user_id);
drop policy if exists sh_write on public.shadowing_sessions;
create policy sh_write on public.shadowing_sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 可选：为每种语言存一份"最近推荐"
create table if not exists public.shadowing_recommend (
  user_id uuid not null references auth.users(id) on delete cascade,
  lang text not null check (lang in ('en','ja','zh')),
  recommended_level int not null check (recommended_level between 1 and 5),
  reason text,
  updated_at timestamptz default now(),
  primary key(user_id, lang)
);

alter table public.shadowing_recommend enable row level security;
drop policy if exists srw on public.shadowing_recommend;
create policy srw on public.shadowing_recommend for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
