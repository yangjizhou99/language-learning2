const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkVocabEntries() {
    try {
        await client.connect();
        console.log('Connected.');

        const res = await client.query(`
      SELECT id, term, cefr_level, explanation, created_at 
      FROM vocab_entries 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

        console.log('Latest vocab entries:');
        res.rows.forEach(row => {
            console.log(`- ${row.term} | CEFR: ${row.cefr_level} | Explanation: ${JSON.stringify(row.explanation).substring(0, 100)}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkVocabEntries();
