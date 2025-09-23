#!/usr/bin/env node
// Create clean DDL for shadowing tables (themes/subtopics/drafts/items/sessions/attempts) minimal columns
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const conn = process.env.LOCAL_DB_URL || process.env.DATABASE_URL || process.env.PG_DATABASE_URL || process.env.PG_URL || process.env.PGURI;
if (!conn) {
  console.error('未找到本地数据库连接串（LOCAL_DB_URL / DATABASE_URL）');
  process.exit(1);
}

const ddl = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- shadowing_themes (minimal)
CREATE TABLE IF NOT EXISTS public.shadowing_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text,
  level integer,
  genre text,
  title text,
  description text,
  status text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  title_en text
);

-- shadowing_subtopics (minimal)
CREATE TABLE IF NOT EXISTS public.shadowing_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid,
  lang text,
  level integer,
  genre text,
  title text,
  seed text,
  one_line text,
  tags text[],
  status text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  ai_provider text,
  ai_model text,
  ai_usage jsonb
);

-- shadowing_drafts (practical fields)
CREATE TABLE IF NOT EXISTS public.shadowing_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text,
  level integer,
  topic text,
  title text,
  text text,
  notes jsonb,
  ai_provider text,
  ai_model text,
  ai_usage jsonb,
  status text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  translations jsonb,
  trans_updated_at timestamptz,
  source text,
  theme_id uuid,
  subtopic_id uuid
);

-- shadowing_items
CREATE TABLE IF NOT EXISTS public.shadowing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text,
  level integer,
  title text,
  text text,
  audio_url text,
  tokens text,
  cefr text,
  meta jsonb,
  created_at timestamptz DEFAULT now(),
  translations jsonb,
  trans_updated_at timestamptz,
  theme_id uuid,
  subtopic_id uuid
);

-- shadowing_sessions (minimal)
CREATE TABLE IF NOT EXISTS public.shadowing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  item_id uuid,
  status text,
  recordings jsonb,
  vocab_entry_ids uuid[],
  picked_preview jsonb,
  notes jsonb,
  created_at timestamptz DEFAULT now()
);

-- shadowing_attempts (minimal)
CREATE TABLE IF NOT EXISTS public.shadowing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  item_id uuid,
  result jsonb,
  created_at timestamptz DEFAULT now()
);
`;

async function main() {
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    await client.query(ddl);
    console.log('Shadowing 六表 DDL 创建完成');
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });


