-- 创建邀请码系统相关表
-- 20250120000010_create_invitation_system.sql

-- 1. 邀请码表
create table if not exists public.invitation_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  permissions jsonb default '{}'::jsonb, -- 邀请码对应的权限设置
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 邀请码使用记录表
create table if not exists public.invitation_uses (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.invitation_codes(id) on delete cascade,
  used_by uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz default now(),
  unique(code_id, used_by)
);

-- 3. 更新profiles表，添加邀请码相关字段
alter table public.profiles 
add column if not exists invited_by uuid references auth.users(id),
add column if not exists invitation_code_id uuid references public.invitation_codes(id),
add column if not exists invitation_used_at timestamptz;

-- 4. 启用行级安全
alter table public.invitation_codes enable row level security;
alter table public.invitation_uses enable row level security;

-- 5. 创建RLS策略

-- 邀请码表策略
-- 管理员可以查看所有邀请码
create policy invitation_codes_admin_select on public.invitation_codes
  for select to authenticated
  using (public.is_admin());

-- 管理员可以创建邀请码
create policy invitation_codes_admin_insert on public.invitation_codes
  for insert to authenticated
  with check (public.is_admin());

-- 管理员可以更新邀请码
create policy invitation_codes_admin_update on public.invitation_codes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 管理员可以删除邀请码
create policy invitation_codes_admin_delete on public.invitation_codes
  for delete to authenticated
  using (public.is_admin());

-- 普通用户可以查看自己创建的邀请码
create policy invitation_codes_creator_select on public.invitation_codes
  for select to authenticated
  using (created_by = auth.uid());

-- 普通用户可以创建邀请码（如果允许的话）
create policy invitation_codes_creator_insert on public.invitation_codes
  for insert to authenticated
  with check (created_by = auth.uid());

-- 邀请码使用记录表策略
-- 管理员可以查看所有使用记录
create policy invitation_uses_admin_select on public.invitation_uses
  for select to authenticated
  using (public.is_admin());

-- 用户可以查看自己的使用记录
create policy invitation_uses_user_select on public.invitation_uses
  for select to authenticated
  using (used_by = auth.uid());

-- 系统可以创建使用记录（通过API）
create policy invitation_uses_insert on public.invitation_uses
  for insert to authenticated
  with check (true);

-- 6. 创建索引
create index if not exists idx_invitation_codes_code on public.invitation_codes(code);
create index if not exists idx_invitation_codes_created_by on public.invitation_codes(created_by);
create index if not exists idx_invitation_codes_expires_at on public.invitation_codes(expires_at);
create index if not exists idx_invitation_codes_is_active on public.invitation_codes(is_active);

create index if not exists idx_invitation_uses_code_id on public.invitation_uses(code_id);
create index if not exists idx_invitation_uses_used_by on public.invitation_uses(used_by);
create index if not exists idx_invitation_uses_used_at on public.invitation_uses(used_at);

-- 7. 创建触发器函数，自动更新updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 为invitation_codes表添加触发器
create trigger update_invitation_codes_updated_at
  before update on public.invitation_codes
  for each row
  execute function update_updated_at_column();

-- 8. 创建邀请码生成函数
create or replace function generate_invitation_code()
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i integer;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- 9. 创建验证邀请码函数
create or replace function validate_invitation_code(code_text text)
returns table(
  is_valid boolean,
  code_id uuid,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  permissions jsonb,
  error_message text
) as $$
declare
  invitation_record record;
begin
  -- 查找邀请码
  select * into invitation_record
  from public.invitation_codes
  where code = code_text and is_active = true;
  
  if not found then
    return query select false, null::uuid, 0, 0, null::timestamptz, null::jsonb, '邀请码不存在或已失效'::text;
    return;
  end if;
  
  -- 检查是否过期
  if invitation_record.expires_at is not null and invitation_record.expires_at < now() then
    return query select false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count, 
                       invitation_record.expires_at, invitation_record.permissions, '邀请码已过期'::text;
    return;
  end if;
  
  -- 检查使用次数
  if invitation_record.used_count >= invitation_record.max_uses then
    return query select false, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                       invitation_record.expires_at, invitation_record.permissions, '邀请码使用次数已达上限'::text;
    return;
  end if;
  
  -- 邀请码有效
  return query select true, invitation_record.id, invitation_record.max_uses, invitation_record.used_count,
                     invitation_record.expires_at, invitation_record.permissions, null::text;
end;
$$ language plpgsql;
