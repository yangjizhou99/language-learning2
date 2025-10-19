-- Pronunciation test runs – admin-only experimental table
create table if not exists pronunciation_test_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid not null references profiles(id),
  mode text not null check (mode in ('batch', 'stream')),
  locale text not null,
  reference_text text,
  session_label text,
  recognized_text text,
  audio_duration_ms integer,
  audio_storage_path text,
  overall_score numeric,
  accuracy_score numeric,
  fluency_score numeric,
  completeness_score numeric,
  prosody_score numeric,
  azure_detail jsonb,
  azure_raw jsonb,
  extra_metrics jsonb,
  notes text
);

create index if not exists pronunciation_test_runs_admin_idx on pronunciation_test_runs (admin_id);
create index if not exists pronunciation_test_runs_created_at_idx on pronunciation_test_runs (created_at desc);

alter table pronunciation_test_runs enable row level security;
