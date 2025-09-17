-- 添加新闻播报音色相关字段
alter table public.voices 
add column if not exists is_news_voice boolean default false,
add column if not exists use_case text,
add column if not exists provider text default 'google';

-- 创建索引
create index if not exists idx_voices_is_news_voice on public.voices(is_news_voice);
create index if not exists idx_voices_provider on public.voices(provider);

-- 更新现有科大讯飞音色的provider字段
update public.voices 
set provider = 'xunfei' 
where name like 'xunfei-%';
