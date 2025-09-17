-- 创建注册配置表
-- 20250120000019_create_registration_config.sql

-- 1. 注册配置表
create table if not exists public.registration_config (
  id text primary key default 'main',
  allow_direct_registration boolean not null default false,
  allow_invitation_registration boolean not null default true,
  require_email_verification boolean not null default true,
  allow_google_oauth boolean not null default false,
  allow_anonymous_login boolean not null default false,
  maintenance_mode boolean not null default false,
  maintenance_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 插入默认配置
insert into public.registration_config (id, allow_direct_registration, allow_invitation_registration, require_email_verification, allow_google_oauth, allow_anonymous_login, maintenance_mode, maintenance_message)
values ('main', false, true, true, false, false, false, '系统维护中，请稍后再试')
on conflict (id) do nothing;

-- 3. 启用行级安全
alter table public.registration_config enable row level security;

-- 4. 创建RLS策略
-- 管理员可以查看和修改配置
create policy registration_config_admin_all on public.registration_config
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 所有用户都可以查看配置（用于前端判断）
create policy registration_config_select_all on public.registration_config
  for select to authenticated
  using (true);

-- 5. 创建索引
create index if not exists idx_registration_config_id on public.registration_config(id);

-- 6. 创建更新时间触发器
create trigger update_registration_config_updated_at
  before update on public.registration_config
  for each row
  execute function update_updated_at_column();

-- 7. 添加注释
comment on table public.registration_config is '注册配置表';
comment on column public.registration_config.allow_direct_registration is '是否允许直接注册（邮箱密码）';
comment on column public.registration_config.allow_invitation_registration is '是否允许邀请码注册';
comment on column public.registration_config.require_email_verification is '是否需要邮箱验证';
comment on column public.registration_config.allow_google_oauth is '是否允许Google OAuth登录';
comment on column public.registration_config.allow_anonymous_login is '是否允许匿名登录';
comment on column public.registration_config.maintenance_mode is '是否开启维护模式';
comment on column public.registration_config.maintenance_message is '维护模式提示信息';
