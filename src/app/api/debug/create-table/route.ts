export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // Create shadowing_sessions table if it doesn't exist
    const createTableSQL = `
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
    `;
    
    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (createError) {
      console.error('Error creating table:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    
    // Enable RLS
    const enableRLSSQL = `alter table public.shadowing_sessions enable row level security;`;
    await supabase.rpc('exec_sql', { sql: enableRLSSQL });
    
    // Create policies
    const policiesSQL = `
      -- Users can only access their own sessions
      create policy if not exists "Users can view their own shadowing sessions"
        on public.shadowing_sessions for select
        using (auth.uid() = user_id);

      create policy if not exists "Users can insert their own shadowing sessions"
        on public.shadowing_sessions for insert
        with check (auth.uid() = user_id);

      create policy if not exists "Users can update their own shadowing sessions"
        on public.shadowing_sessions for update
        using (auth.uid() = user_id);

      create policy if not exists "Users can delete their own shadowing sessions"
        on public.shadowing_sessions for delete
        using (auth.uid() = user_id);
    `;
    
    const { error: policiesError } = await supabase.rpc('exec_sql', { sql: policiesSQL });
    
    if (policiesError) {
      console.error('Error creating policies:', policiesError);
      return NextResponse.json({ error: policiesError.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Table and policies created successfully'
    });

  } catch (error) {
    console.error('Error in create table API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
