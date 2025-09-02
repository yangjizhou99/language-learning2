-- 训练包：一个主题下含多步（从简对话→复杂写作）
create table if not exists public.alignment_packs (
  id uuid primary key default gen_random_uuid(),
  lang text not null,                  -- en/ja/zh
  topic text not null,                 -- 主题，如 "订餐" / "校园选课"
  tags text[] default '{}',
  level_min int default 1,
  level_max int default 6,
  preferred_style jsonb default '{}'::jsonb,  -- 风格偏好（下方 schema）
  steps jsonb not null,                -- 见下方 JSON schema
  ai_provider text,
  ai_model text,
  ai_usage jsonb default '{}'::jsonb,  -- {prompt_tokens, completion_tokens, total_tokens}
  status text not null default 'draft',-- draft|published|archived
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.alignment_packs enable row level security;
create policy ap_read on public.alignment_packs for select to authenticated using (true);
create policy ap_admin on public.alignment_packs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 学员一次提交（仿写/对话等）的记录（用于后续个性化）
create table if not exists public.alignment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.alignment_packs(id) on delete cascade,
  step_key text not null,                 -- "D1"/"D2"/"T3"/"W4"/"T5"/"W6"
  submission text not null,               -- 学员的仿写文本或对话脚本
  scores jsonb default '{}'::jsonb,      -- {fluency:..., relevance:..., style:..., overall:...}
  feedback jsonb default '{}'::jsonb,    -- 结构化反馈（要点/替换建议/短语补充）
  created_at timestamptz default now()
);

alter table public.alignment_attempts enable row level security;
create policy aa_owner_rw on public.alignment_attempts
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
