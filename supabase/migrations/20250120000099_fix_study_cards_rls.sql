-- 修复 study_cards 表的 RLS 问题
-- 20250120000099_fix_study_cards_rls.sql

-- 启用 study_cards 表的行级安全
alter table public.study_cards enable row level security;

-- 创建 RLS 策略
-- 用户只能访问自己的学习卡片
create policy study_cards_owner_rw on public.study_cards
  for all to authenticated 
  using (auth.uid() = user_id) 
  with check (auth.uid() = user_id);

-- 管理员可以访问所有学习卡片（用于管理目的）
create policy study_cards_admin_all on public.study_cards
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
