-- Ensure used_count has a safe default and not-null constraint
alter table if exists public.invitation_codes
  alter column used_count set default 0;

update public.invitation_codes
  set used_count = 0
where used_count is null;

alter table if exists public.invitation_codes
  alter column used_count set not null;

-- Also ensure is_active defaults to true and is not null (safety)
alter table if exists public.invitation_codes
  alter column is_active set default true;

update public.invitation_codes
  set is_active = true
where is_active is null;

alter table if exists public.invitation_codes
  alter column is_active set not null;


