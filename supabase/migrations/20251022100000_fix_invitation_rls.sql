-- 修复邀请码RLS策略问题
-- 在Supabase SQL Editor中执行此文件

-- 确保 is_admin() 函数存在
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;

-- 删除现有的邀请码RLS策略
drop policy if exists invitation_codes_admin_select on public.invitation_codes;
drop policy if exists invitation_codes_admin_insert on public.invitation_codes;
drop policy if exists invitation_codes_admin_update on public.invitation_codes;
drop policy if exists invitation_codes_admin_delete on public.invitation_codes;
drop policy if exists invitation_codes_creator_select on public.invitation_codes;
drop policy if exists invitation_codes_creator_insert on public.invitation_codes;

-- 重新创建邀请码RLS策略
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

-- 删除现有的邀请码使用记录RLS策略
-- drop policy if exists invitation_uses_admin_select on public.invitation_uses;
-- drop policy if exists invitation_uses_user_select on public.invitation_uses;
-- drop policy if exists invitation_uses_insert on public.invitation_uses;

-- 重新创建邀请码使用记录RLS策略
-- 管理员可以查看所有使用记录
-- create policy invitation_uses_admin_select on public.invitation_uses
--   for select to authenticated
--   using (public.is_admin());

-- 用户可以查看自己的使用记录
-- create policy invitation_uses_user_select on public.invitation_uses
--   for select to authenticated
--   using (used_by = auth.uid());

-- 系统可以创建使用记录（通过API）
-- create policy invitation_uses_insert on public.invitation_uses
--   for insert to authenticated
--   with check (true);
