const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkSchema() {
    try {
        await client.connect();
        console.log('Connected.');

        const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vocab_entries';
    `);

        console.log('Columns in vocab_entries:');
        res.rows.forEach(row => {
            console.log(`- ${row.column_name} (${row.data_type})`);
        });

        const indexes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'vocab_entries';
    `);

        console.log('\nIndexes:');
        indexes.rows.forEach(row => {
            console.log(`- ${row.indexname}: ${row.indexdef}`);
        });

        const constraints = await client.query(`
        SELECT conname as constraint_name, contype as constraint_type, pg_get_constraintdef(c.oid) as definition
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'vocab_entries'
    `);

        console.log('\nConstraints:');
        constraints.rows.forEach(row => {
            console.log(`- ${row.constraint_name} (${row.constraint_type}): ${row.definition}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
