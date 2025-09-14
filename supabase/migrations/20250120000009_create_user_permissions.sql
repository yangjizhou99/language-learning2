-- 创建用户权限管理表
-- 20250120000009_create_user_permissions.sql

-- 用户权限表
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  can_access_shadowing boolean not null default true,
  can_access_cloze boolean not null default true,
  can_access_alignment boolean not null default true,
  can_access_articles boolean not null default true,
  allowed_languages text[] not null default array['en', 'ja', 'zh'],
  allowed_levels int[] not null default array[1, 2, 3, 4, 5],
  max_daily_attempts int not null default 50,
  custom_restrictions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- 启用行级安全
alter table public.user_permissions enable row level security;

-- 创建策略：只有管理员可以查看和修改所有权限，用户只能查看自己的权限
create policy user_permissions_admin_all on public.user_permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy user_permissions_own_read on public.user_permissions
  for select to authenticated
  using (auth.uid() = user_id);

-- 创建索引
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_user_permissions_created_at on public.user_permissions(created_at);

-- 创建更新时间触发器
create or replace function update_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_permissions_updated_at
  before update on public.user_permissions
  for each row execute function update_user_permissions_updated_at();
