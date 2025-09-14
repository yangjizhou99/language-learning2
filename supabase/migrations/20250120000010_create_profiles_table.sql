-- 创建用户 profiles 表
-- 20250120000010_create_profiles_table.sql

-- 创建 profiles 表
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text default 'user' not null,
  bio text,
  goals text,
  preferred_tone text,
  domains text[],
  native_lang text,
  target_langs text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 启用行级安全
alter table public.profiles enable row level security;

-- 创建策略：用户可以查看和更新自己的 profile，管理员可以查看所有
create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.is_admin());

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

-- 创建索引
create index if not exists idx_profiles_username on public.profiles(username);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_created_at on public.profiles(created_at);

-- 创建更新时间触发器
create or replace function update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function update_profiles_updated_at();

-- 创建触发器：当新用户注册时自动创建 profile
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    case 
      when new.email = 'admin@example.com' then 'admin'
      else 'user'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- 创建触发器
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 为现有用户创建 profile 记录（如果不存在）
insert into public.profiles (id, username, role)
select 
  id,
  coalesce(raw_user_meta_data->>'username', 'user_' || substr(id::text, 1, 8)) as username,
  case 
    when email = 'admin@example.com' then 'admin'
    else 'user'
  end as role
from auth.users
where id not in (select id from public.profiles);
