const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkTokenList() {
    try {
        await client.connect();
        console.log('Connected.');

        // Get Japanese items with lex_profile
        const res = await client.query(`
      SELECT id, title, lang, 
             lex_profile->'details'->'tokenList' as token_list
      FROM shadowing_items 
      WHERE lex_profile IS NOT NULL
        AND lang = 'ja'
      LIMIT 1
    `);

        if (res.rows.length > 0) {
            const row = res.rows[0];
            const tokens = row.token_list;

            console.log(`\nTitle: ${row.title}`);
            console.log(`Lang: ${row.lang}`);
            console.log(`Token count: ${tokens?.length}`);
            console.log(`\nFirst 5 tokens:`);

            if (tokens && tokens.length > 0) {
                tokens.slice(0, 5).forEach((t, i) => {
                    console.log(`  ${i + 1}. ${JSON.stringify(t, null, 4)}`);
                });
            }
        } else {
            console.log('No Japanese items with lex_profile found');

            // Try any lang
            const res2 = await client.query(`
        SELECT id, title, lang, 
               lex_profile->'details'->'tokenList' as token_list
        FROM shadowing_items 
        WHERE lex_profile IS NOT NULL
        LIMIT 1
      `);

            if (res2.rows.length > 0) {
                const row = res2.rows[0];
                const tokens = row.token_list;

                console.log(`\nUsing item: ${row.title} (${row.lang})`);
                console.log(`Token count: ${tokens?.length}`);
                console.log(`\nFirst 5 tokens:`);

                if (tokens && tokens.length > 0) {
                    tokens.slice(0, 5).forEach((t, i) => {
                        console.log(`  ${i + 1}. ${JSON.stringify(t, null, 4)}`);
                    });
                }
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkTokenList();
