const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Construct connection string from env vars if not provided directly
// Assuming standard Supabase local setup or using the URL from env
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

console.log('Connecting to database...');

const client = new Client({
    connectionString: connectionString,
});

async function applyMigration() {
    try {
        await client.connect();
        console.log('Connected.');

        const sql = `
      ALTER TABLE public.shadowing_sessions
      ADD COLUMN IF NOT EXISTS imported_vocab_ids uuid[] DEFAULT '{}'::uuid[];
      
      COMMENT ON COLUMN public.shadowing_sessions.imported_vocab_ids IS 'List of vocabulary IDs imported from this session';
    `;

        console.log('Running SQL:', sql);
        await client.query(sql);
        console.log('Migration applied successfully.');

    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

applyMigration();
