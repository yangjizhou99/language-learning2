-- 修复函数搜索路径可变的安全警告
-- 20250120000100_fix_function_search_paths.sql

-- 修复 is_admin 函数
create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;

-- 修复 update_updated_at_column 函数
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 修复 update_default_user_permissions_updated_at 函数
create or replace function public.update_default_user_permissions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 修复 update_api_usage_logs_updated_at 函数
create or replace function public.update_api_usage_logs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 修复 generate_invitation_code 函数
create or replace function public.generate_invitation_code()
returns text
language plpgsql
set search_path = public
as $$
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
$$;

-- 修复 validate_invitation_code 函数
create or replace function public.validate_invitation_code(code_text text)
returns table(
  is_valid boolean,
  code_id uuid,
  max_uses integer,
  used_count integer,
  expires_at timestamptz,
  permissions jsonb,
  error_message text
)
language plpgsql
set search_path = public
as $$
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
$$;

-- 修复 update_user_permissions_updated_at 函数
create or replace function public.update_user_permissions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 修复 update_user_api_limits_updated_at 函数
create or replace function public.update_user_api_limits_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
