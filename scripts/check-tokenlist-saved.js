const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkTokenListSaved() {
    try {
        await client.connect();
        console.log('Connected.');

        // Find item by title
        const res = await client.query(`
      SELECT id, title, lang, 
             lex_profile->>'tokenList' IS NOT NULL as has_tokenlist,
             jsonb_array_length(lex_profile->'tokenList') as tokenlist_length,
             lex_profile->'tokenList'->0 as first_token
      FROM shadowing_items 
      WHERE title LIKE '%半年後%'
      LIMIT 1
    `);

        if (res.rows.length > 0) {
            const row = res.rows[0];
            console.log(`\nTitle: ${row.title}`);
            console.log(`Has tokenList: ${row.has_tokenlist}`);
            console.log(`TokenList length: ${row.tokenlist_length}`);
            console.log(`First token: ${JSON.stringify(row.first_token, null, 2)}`);
        } else {
            console.log('Item not found');
        }

        // Also check the most recently updated item
        const res2 = await client.query(`
      SELECT id, title, lang, updated_at,
             lex_profile->>'tokenList' IS NOT NULL as has_tokenlist,
             jsonb_array_length(lex_profile->'tokenList') as tokenlist_length
      FROM shadowing_items 
      WHERE lex_profile IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 5
    `);

        console.log('\n\nMost recently updated items with lex_profile:');
        res2.rows.forEach(row => {
            console.log(`  ${row.title} (${row.lang}) - tokenList: ${row.has_tokenlist ? row.tokenlist_length + ' tokens' : 'NO'}`);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkTokenListSaved();
