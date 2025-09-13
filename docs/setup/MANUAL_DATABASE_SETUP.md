# 手动数据库设置指南

由于Docker Desktop未运行，需要手动在Supabase控制台执行SQL。

## 步骤

### 1. 访问Supabase控制台
1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 "SQL Editor"

### 2. 执行SQL迁移
复制以下SQL代码并在SQL Editor中执行：

```sql
-- 音色表
create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  language_code text not null,
  ssml_gender text,
  natural_sample_rate_hertz integer,
  pricing jsonb not null default '{}'::jsonb,
  characteristics jsonb not null default '{}'::jsonb,
  display_name text,
  category text not null, -- 'Chirp3HD', 'Neural2', 'Wavenet', 'Standard', 'Other'
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 创建索引
create index if not exists idx_voices_language_code on public.voices(language_code);
create index if not exists idx_voices_category on public.voices(category);
create index if not exists idx_voices_is_active on public.voices(is_active);
create index if not exists idx_voices_name on public.voices(name);

-- 启用 RLS
alter table public.voices enable row level security;

-- 所有人都可以读取音色
create policy "voices_select_all"
on public.voices for select
using (is_active = true);

-- 创建更新时间触发器
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_voices_updated_at
  before update on public.voices
  for each row
  execute function update_updated_at_column();
```

### 3. 验证表创建
执行以下查询验证表是否创建成功：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'voices';

-- 检查表结构
\d public.voices;
```

### 4. 测试功能
1. 访问 `http://localhost:3001/admin/test-voices`
2. 点击"同步音色"按钮
3. 等待同步完成

## 注意事项

- 确保有Supabase项目的管理员权限
- 如果遇到权限错误，可能需要调整RLS策略
- 同步过程可能需要几分钟时间

## 故障排除

### 权限错误
如果遇到权限错误，可以临时禁用RLS进行测试：

```sql
-- 临时禁用RLS（仅用于测试）
alter table public.voices disable row level security;
```

### 表已存在
如果表已存在，可以先删除：

```sql
-- 删除现有表（会丢失数据）
drop table if exists public.voices cascade;
```
