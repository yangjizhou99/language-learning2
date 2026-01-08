const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkRawLexProfile() {
    try {
        await client.connect();
        console.log('Connected.');

        // Get raw lex_profile structure
        const res = await client.query(`
      SELECT id, title, lang, 
             jsonb_pretty(lex_profile) as lex_profile_pretty
      FROM shadowing_items 
      WHERE lex_profile IS NOT NULL
        AND lang = 'ja'
      LIMIT 1
    `);

        if (res.rows.length > 0) {
            const row = res.rows[0];

            console.log(`\nTitle: ${row.title}`);
            console.log(`Lang: ${row.lang}`);
            console.log(`\nLex Profile structure (first 3000 chars):`);
            console.log(row.lex_profile_pretty?.substring(0, 3000));
        } else {
            console.log('No Japanese items with lex_profile found');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkRawLexProfile();
