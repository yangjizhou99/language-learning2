-- Step 12G: 记录答案生成 Provider/Model/Usage
alter table public.article_drafts
  add column if not exists ai_answer_provider text,
  add column if not exists ai_answer_model text,
  add column if not exists ai_answer_usage jsonb default '{}'::jsonb;


