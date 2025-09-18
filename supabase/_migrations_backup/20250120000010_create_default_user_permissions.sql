-- 创建默认用户权限配置表
-- 20250120000010_create_default_user_permissions.sql

-- 默认用户权限配置表
create table if not exists public.default_user_permissions (
  id text primary key default 'default',
  can_access_shadowing boolean not null default true,
  can_access_cloze boolean not null default true,
  can_access_alignment boolean not null default true,
  can_access_articles boolean not null default true,
  allowed_languages text[] not null default array['en', 'ja', 'zh'],
  allowed_levels int[] not null default array[1, 2, 3, 4, 5],
  max_daily_attempts int not null default 50,
  ai_enabled boolean not null default false,
  api_keys jsonb default '{}'::jsonb,
  model_permissions jsonb default '[]'::jsonb,
  custom_restrictions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 启用行级安全
alter table public.default_user_permissions enable row level security;

-- 创建策略：只有管理员可以查看和修改默认权限设置
create policy default_user_permissions_admin_all on public.default_user_permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 创建更新时间触发器
create or replace function update_default_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_default_user_permissions_updated_at
  before update on public.default_user_permissions
  for each row execute function update_default_user_permissions_updated_at();

-- 插入默认配置
insert into public.default_user_permissions (id) values ('default')
on conflict (id) do nothing;
