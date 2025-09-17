-- 修复 profiles 表的 RLS 策略，允许管理员查看所有用户数据
-- 20250120000012_fix_profiles_admin_access.sql

-- 首先确保 is_admin() 函数存在
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role='admin')
$$;

-- 删除现有的限制性策略
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_upsert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

-- 创建新的策略：管理员可以查看所有用户，普通用户只能查看自己
create policy "profiles_select_admin_or_own" on public.profiles for select
using (public.is_admin() or id = auth.uid());

-- 创建新的策略：管理员可以插入任何用户，普通用户只能插入自己
create policy "profiles_insert_admin_or_own" on public.profiles for insert
with check (public.is_admin() or id = auth.uid());

-- 创建新的策略：管理员可以更新任何用户，普通用户只能更新自己
create policy "profiles_update_admin_or_own" on public.profiles for update
using (public.is_admin() or id = auth.uid())
with check (public.is_admin() or id = auth.uid());

-- 创建新的策略：管理员可以删除任何用户，普通用户只能删除自己
create policy "profiles_delete_admin_or_own" on public.profiles for delete
using (public.is_admin() or id = auth.uid());
