const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const client = new Client({
    connectionString: connectionString,
});

async function checkSchema() {
    try {
        await client.connect();

        // Check indexes on vocab_entries
        const res = await client.query(`
            SELECT indexname, indexdef 
            FROM pg_indexes 
            WHERE tablename = 'vocab_entries';
        `);

        console.log('Indexes on vocab_entries:');
        res.rows.forEach(row => {
            console.log(`- ${row.indexname}: ${row.indexdef}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
