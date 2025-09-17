-- 添加科大讯飞提供商支持
-- 20250120000011_add_xunfei_provider.sql

-- 更新provider字段的检查约束，添加xunfei支持
alter table public.voices 
drop constraint if exists voices_provider_check;

alter table public.voices 
add constraint voices_provider_check 
check (provider in ('google', 'gemini', 'xunfei'));

-- 添加xunfei提供商索引
create index if not exists idx_voices_provider_xunfei on public.voices(provider) where provider = 'xunfei';
