-- Ensure created_at has default now() and is not null, and backfill existing nulls
alter table if exists public.api_usage_logs
  alter column created_at set default now();

update public.api_usage_logs
set created_at = now()
where created_at is null;

alter table if exists public.api_usage_logs
  alter column created_at set not null;

-- Helpful index to accelerate date range queries (if not already present)
create index if not exists idx_api_usage_logs_created_at on public.api_usage_logs(created_at);


