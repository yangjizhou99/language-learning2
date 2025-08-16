import { supabase } from "./supabase";

export async function runMigration() {
  // Split into individual statements since Supabase doesn't support DO blocks
  const statements = [
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goals text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_tone text`,
    `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS domains text[] default '{}'`,
    `CREATE TABLE IF NOT EXISTS public.glossary (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.profiles(id) on delete cascade,
      lang text check (lang in ('en','ja')) not null,
      term text not null,
      definition text not null,
      aliases text[] default '{}',
      tags text[] default '{}',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )`,
    `CREATE OR REPLACE POLICY glossary_all_own ON public.glossary
      FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
  ];

  for (const sql of statements) {
    const { error } = await supabase.query(sql);
    if (error) {
      console.error('Migration failed:', error);
      return false;
    }
  }

  if (error) {
    console.error('Migration failed:', error);
    return false;
  }
  console.log('Migration completed successfully');
  return true;
}
