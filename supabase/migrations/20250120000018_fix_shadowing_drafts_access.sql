-- 修复 shadowing_drafts 表的访问权限
-- 允许普通用户读取已审核的题目

-- 删除现有的管理员专用策略
drop policy if exists sd_admin on public.shadowing_drafts;

-- 创建新的策略：管理员可以访问所有记录，普通用户只能访问已审核的记录
create policy sd_admin_all on public.shadowing_drafts for all to authenticated
  using (public.is_admin()) 
  with check (public.is_admin());

-- 创建新的策略：普通用户可以读取已审核的记录
create policy sd_user_read_approved on public.shadowing_drafts for select to authenticated
  using (status = 'approved');
