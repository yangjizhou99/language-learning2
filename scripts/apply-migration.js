require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function applyMigration() {
    console.log('Applying migration manually...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    // Note: Anon key usually doesn't have permissions to ALTER TABLE. 
    // We need the SERVICE_ROLE_KEY or a direct Postgres connection.
    // Let's check if SERVICE_ROLE_KEY is in env, otherwise we might need to use 'pg' with the connection string.
}

// Re-thinking: Supabase JS client cannot run DDL (ALTER TABLE) via standard API usually.
// We should use 'pg' client with the DATABASE_URL from .env.local if available, 
// or construct the connection string for local supabase: postgres://postgres:postgres@127.0.0.1:15432/postgres

const { Client } = require('pg');

async function applyMigrationPg() {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

    console.log('Connecting to database...');
    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        console.log('✅ Connected.');

        const sql = `
            ALTER TABLE profiles 
            ADD COLUMN IF NOT EXISTS bayesian_profile JSONB DEFAULT NULL;
            
            COMMENT ON COLUMN profiles.bayesian_profile IS 'Cached Bayesian user profile for vocabulary prediction';
        `;

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✅ Migration applied successfully.');

    } catch (err) {
        console.error('❌ Error applying migration:', err.message);
    } finally {
        await client.end();
    }
}

applyMigrationPg();
