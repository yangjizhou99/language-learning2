-- Create shadowing_sessions table to track user practice sessions
create table if not exists public.shadowing_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  shadowing_item_id uuid references public.shadowing_items(id) on delete cascade not null,
  status text default 'draft' check (status in ('draft', 'completed')),
  
  -- Recording data
  recordings jsonb default '[]'::jsonb, -- Array of {url, duration, created_at}
  
  -- Selected vocabulary for this session
  selected_words jsonb default '[]'::jsonb, -- Array of selected word objects
  imported_vocab_ids uuid[] default array[]::uuid[], -- IDs of words imported to user's vocab
  
  -- Session metadata
  practice_time_seconds integer default 0,
  notes text,
  
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Ensure one active session per user per item
  unique(user_id, shadowing_item_id)
);

-- RLS policies
alter table public.shadowing_sessions enable row level security;

-- Users can only access their own sessions
create policy "Users can view their own shadowing sessions"
  on public.shadowing_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own shadowing sessions"
  on public.shadowing_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own shadowing sessions"
  on public.shadowing_sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete their own shadowing sessions"
  on public.shadowing_sessions for delete
  using (auth.uid() = user_id);

-- Create indexes for better performance
create index idx_shadowing_sessions_user_id on public.shadowing_sessions(user_id);
create index idx_shadowing_sessions_item_id on public.shadowing_sessions(shadowing_item_id);
create index idx_shadowing_sessions_status on public.shadowing_sessions(status);

-- Update trigger for updated_at
create or replace function update_shadowing_sessions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_update_shadowing_sessions_updated_at
  before update on public.shadowing_sessions
  for each row execute function update_shadowing_sessions_updated_at();
