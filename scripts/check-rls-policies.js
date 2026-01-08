const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkRLSPolicies() {
    try {
        await client.connect();
        console.log('Connected.');

        const res = await client.query(`
      SELECT pol.polname as policy_name, 
             CASE pol.polcmd 
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               WHEN '*' THEN 'ALL'
             END as command,
             pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
             pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expression
      FROM pg_policy pol
      JOIN pg_class t ON pol.polrelid = t.oid
      WHERE t.relname = 'vocab_entries'
    `);

        console.log('RLS Policies for vocab_entries:');
        res.rows.forEach(row => {
            console.log(`- ${row.policy_name} (${row.command})`);
            console.log(`  USING: ${row.using_expression}`);
            console.log(`  WITH CHECK: ${row.with_check_expression}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkRLSPolicies();
