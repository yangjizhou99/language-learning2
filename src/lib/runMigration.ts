import { supabase } from "./supabase";

async function runMigration() {
  const { data, error } = await supabase.rpc(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE public.sessions ADD COLUMN duration_sec numeric;
      EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'column duration_sec already exists';
      END;
      
      BEGIN
        ALTER TABLE public.sessions ADD COLUMN difficulty text;
      EXCEPTION WHEN duplicate_column THEN 
        RAISE NOTICE 'column difficulty already exists';
      END;
    END $$;
  `);

  if (error) {
    console.error('Migration failed:', error);
    return false;
  }
  console.log('Migration completed successfully');
  return true;
}

runMigration().then(success => {
  if (success) process.exit(0);
  else process.exit(1);
});
