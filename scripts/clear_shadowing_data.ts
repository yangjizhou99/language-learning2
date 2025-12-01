import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.LOCAL_DB_URL_FORCE;

if (!dbUrl) {
    console.error('LOCAL_DB_URL_FORCE not found in environment variables.');
    process.exit(1);
}

const client = new Client({
    connectionString: dbUrl,
});

async function clearData() {
    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Clearing shadowing data...');

        const query = `
      TRUNCATE TABLE 
        public.shadowing_sessions,
        public.shadowing_items,
        public.shadowing_drafts,
        public.shadowing_subtopics,
        public.shadowing_themes
      RESTART IDENTITY CASCADE;
    `;

        await client.query(query);
        console.log('Successfully cleared all shadowing tables.');

    } catch (err) {
        console.error('Error clearing data:', err);
    } finally {
        await client.end();
    }
}

clearData();
