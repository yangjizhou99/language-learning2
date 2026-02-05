const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lex_profile')
        .eq('lang', 'en')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== LexText 修复后逻辑模拟测试 (忽略大小写) ===\n');

    for (const item of items) {
        console.log(`Checking Item ${item.id}...`);
        const text = item.text;
        const tokenList = item.lex_profile?.tokenList || [];

        if (tokenList.length === 0) { console.log('  No tokens.'); continue; }

        let processedText = text;
        if (processedText.includes('A:') && processedText.includes('B:') && !processedText.includes('\n')) {
            processedText = processedText.replace(/\s+B:/g, '\nB:');
            processedText = processedText.replace(/([^A])\s+A:/g, '$1\nA:');
        }

        const lines = processedText.split('\n');
        let tokenIndex = 0;
        let totalTokens = tokenList.length;

        lines.forEach((line, lineIdx) => {
            let linePos = 0;

            while (linePos < line.length && tokenIndex < tokenList.length) {
                const token = tokenList[tokenIndex];
                const tokenText = token.token;

                // 模拟修复后的逻辑：大小写不敏感查找
                const lineSubset = line.slice(linePos);
                const matchIndex = lineSubset.toLowerCase().indexOf(tokenText.toLowerCase());
                const foundPos = matchIndex === -1 ? -1 : linePos + matchIndex;

                if (foundPos === -1 || foundPos > linePos + 10) {
                    if (linePos < line.length) {
                        linePos++;
                        continue;
                    } else {
                        break;
                    }
                }

                // 匹配成功!
                // 还需要检查长度是否一致，如果不一致（例如 token 是 "i'm" 长度3，原文 "I'm" 长度3，没问题）
                // 如果 token 是 "cant" 原文 "can't"，长度不同可能导致后续偏移
                // 但 LexText 是基于 indexOf 的，所以只要能找到就行

                linePos = foundPos + tokenText.length;
                tokenIndex++;
            }
        });

        if (tokenIndex < totalTokens) {
            console.log(`  ⚠️ 仍有部分不匹配: ${tokenIndex}/${totalTokens} 成功`);
            // 看看剩下的是什么
            const failToken = tokenList[tokenIndex];
            console.log(`  卡在: "${failToken.token}"`);
        } else {
            console.log(`  ✅ 完美匹配 ${totalTokens}/${totalTokens}`);
        }
        console.log('---');
    }
}

main().catch(console.error);
