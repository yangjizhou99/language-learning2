const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:15432/postgres';

const client = new Client({
    connectionString: connectionString,
});

async function checkLexProfile() {
    try {
        await client.connect();
        console.log('Connected.');

        // Check structure of lex_profile column
        const res = await client.query(`
      SELECT id, title, lang, 
             jsonb_typeof(lex_profile) as lex_profile_type,
             lex_profile->'tokens' as tokens_count,
             jsonb_array_length(lex_profile->'details'->'tokenList') as token_list_length,
             lex_profile->'details'->'tokenList'->0 as first_token
      FROM shadowing_items 
      WHERE lex_profile IS NOT NULL
        AND status = 'published'
      LIMIT 5
    `);

        console.log('Published items with lex_profile:');
        res.rows.forEach(row => {
            console.log(`\n--- ${row.title} (${row.lang}) ---`);
            console.log(`  Type: ${row.lex_profile_type}`);
            console.log(`  Token count field: ${row.tokens_count}`);
            console.log(`  TokenList length: ${row.token_list_length}`);
            console.log(`  First token: ${JSON.stringify(row.first_token, null, 2)}`);
        });

        // Check how many items have lex_profile
        const countRes = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'published') as published_total,
        COUNT(*) FILTER (WHERE status = 'published' AND lex_profile IS NOT NULL) as published_with_lex,
        COUNT(*) FILTER (WHERE status = 'published' AND lex_profile->'details'->'tokenList' IS NOT NULL) as published_with_tokenlist
      FROM shadowing_items
    `);

        console.log('\n\n=== Summary ===');
        console.log(`Published items: ${countRes.rows[0].published_total}`);
        console.log(`With lex_profile: ${countRes.rows[0].published_with_lex}`);
        console.log(`With tokenList: ${countRes.rows[0].published_with_tokenlist}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkLexProfile();
