const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // 获取所有英文已发布items
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lex_profile, notes, theme_id')
        .eq('lang', 'en')
        .limit(20);

    if (error) {
        console.log('Error:', error.message);
        return;
    }

    console.log('=== 英文已发布Items分词数据分析 ===\n');
    console.log('共找到', items.length, '个英文items\n');

    let withLexProfile = 0;
    let withTokenList = 0;
    let withAcuUnits = 0;
    let withBoth = 0;
    let withNeither = 0;

    for (const item of items) {
        const hasLexProfile = !!item.lex_profile;
        const hasTokenList = item.lex_profile?.tokenList?.length > 0;
        const hasAcuUnits = item.notes?.acu_units?.length > 0;

        if (hasLexProfile) withLexProfile++;
        if (hasTokenList) withTokenList++;
        if (hasAcuUnits) withAcuUnits++;
        if (hasTokenList && hasAcuUnits) withBoth++;
        if (!hasTokenList && !hasAcuUnits) withNeither++;

        // 显示前5个的详细信息
        if (items.indexOf(item) < 5) {
            console.log('---');
            console.log('Item ID:', item.id);
            console.log('Text preview:', item.text.substring(0, 60) + '...');
            console.log('  lex_profile:', hasLexProfile ? '✓' : '✗');
            console.log('  tokenList:', hasTokenList ? '✓ (' + item.lex_profile.tokenList.length + ' tokens)' : '✗');
            console.log('  acu_units:', hasAcuUnits ? '✓ (' + item.notes.acu_units.length + ' units)' : '✗');

            // 检查tokenList的质量
            if (hasTokenList) {
                const tokens = item.lex_profile.tokenList;
                const hasCharStart = tokens.some(t => t.charStart !== undefined);
                console.log('  tokenList有charStart:', hasCharStart ? '✓' : '✗ (动态查找位置)');
            }
        }
    }

    console.log('\n=== 统计汇总 ===');
    console.log('有lex_profile:', withLexProfile, '/', items.length);
    console.log('有tokenList (可用LexText):', withTokenList, '/', items.length);
    console.log('有acu_units (可用AcuText):', withAcuUnits, '/', items.length);
    console.log('两者都有:', withBoth, '/', items.length);
    console.log('两者都没有 (无法分词显示):', withNeither, '/', items.length);

    // 列出没有分词数据的items
    if (withNeither > 0) {
        console.log('\n=== 没有分词数据的Items ===');
        for (const item of items) {
            const hasTokenList = item.lex_profile?.tokenList?.length > 0;
            const hasAcuUnits = item.notes?.acu_units?.length > 0;
            if (!hasTokenList && !hasAcuUnits) {
                console.log('  ' + item.id + ': ' + item.text.substring(0, 50) + '...');
            }
        }
    }
}

main().catch(console.error);
