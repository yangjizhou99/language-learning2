-- Step 12H: 为“文本建议”留字段（与索引型答案分开存）
alter table public.article_drafts
  add column if not exists ai_text_provider text,
  add column if not exists ai_text_model text,
  add column if not exists ai_text_usage jsonb default '{}'::jsonb,
  add column if not exists ai_text_suggestion jsonb default '{}'::jsonb;


