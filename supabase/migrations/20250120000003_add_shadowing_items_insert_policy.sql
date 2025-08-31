-- 为 shadowing_items 表添加插入策略
-- 20250120000003_add_shadowing_items_insert_policy.sql

-- 添加插入策略，允许认证用户插入数据
create policy si_insert on public.shadowing_items 
  for insert to authenticated 
  with check (true);

-- 添加更新策略，允许认证用户更新数据
create policy si_update on public.shadowing_items 
  for update to authenticated 
  using (true) 
  with check (true);

-- 添加删除策略，允许认证用户删除数据
create policy si_delete on public.shadowing_items 
  for delete to authenticated 
  using (true);
