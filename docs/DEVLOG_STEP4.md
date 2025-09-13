# DEVLOG Step 4

## What we built
- Supabase 匿名登录 + profiles upsert
- SQL：profiles/sessions/phrases + RLS（仅本人可读写）
- API：/api/generate/phrases（DeepSeek）
- Pages：/phrase-bank（生成/保存/删除/查看）
- 写入 sessions：Cloze 判分、SFT 评测

## How to run
1. 配置 .env.local:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY 
   - DEEPSEEK_API_KEY

2. 在 Supabase 控制台执行 SQL 创建表结构（见下方 SQL 部分）

3. 在 Supabase 控制台开启 Allow anonymous sign-ins:
   - Auth → Settings → 开启 Allow anonymous sign-ins

4. 运行开发服务器:
```bash
pnpm dev
```

5. 访问:
- http://localhost:3000/phrase-bank （生成候选 → 保存 → 我的短语出现）
- http://localhost:3000/practice/cloze （判分后写入 sessions）
- http://localhost:3000/practice/sft （打分后写入 sessions）

## SQL (在 Supabase SQL Editor 执行)
```sql
-- 扩展
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- 用户资料
create table if not exists public.profiles (
  id uuid primary key,          -- 对应 auth.users.id
  username text,
  native_lang text,
  target_langs text[] default '{}',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- 仅本人可读
create policy if not exists "profiles_select_own"
on public.profiles for select
using ( id = auth.uid() );

-- 仅本人可插入/更新自身行
create policy if not exists "profiles_upsert_own"
on public.profiles for insert
with check ( id = auth.uid() );

create policy if not exists "profiles_update_own"
on public.profiles for update
using ( id = auth.uid() )
with check ( id = auth.uid() );

-- 学习会话/成绩
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_type text check (task_type in ('cloze','sft','shadowing')),
  topic text,
  input jsonb,
  output jsonb,
  ai_feedback jsonb,
  score numeric,
  created_at timestamptz default now()
);
alter table public.sessions enable row level security;

create policy if not exists "sessions_all_own"
on public.sessions for all
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );

-- 短语库
create table if not exists public.phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lang text check (lang in ('en','ja')),
  tag text,
  text text,
  example text,
  created_at timestamptz default now()
);
alter table public.phrases enable row level security;

create policy if not exists "phrases_all_own"
on public.phrases for all
using ( user_id = auth.uid() )
with check ( user_id = auth.uid() );
```

## Screenshots
请截图保存:
- public/step4-phrase-bank.png （短语库页面）
- public/step4-sessions.png （Supabase sessions 表数据）

## Notes / Issues
- 若出现 RLS 错误，刷新后确保已匿名登录且 profiles 已 upsert
- 首次访问需要等待 Supabase 初始化匿名用户
