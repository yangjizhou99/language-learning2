const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    // 获取几个英文item
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, lex_profile')
        .eq('lang', 'en')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== LexText 匹配逻辑模拟测试 ===\n');

    for (const item of items) {
        console.log(`Checking Item ${item.id}...`);
        const text = item.text;
        const tokenList = item.lex_profile?.tokenList || [];

        if (tokenList.length === 0) {
            console.log('  No tokens found.');
            continue;
        }

        // 模拟前端的匹配逻辑
        let processedText = text;
        // 模拟前端的对话格式处理
        if (processedText.includes('A:') && processedText.includes('B:') && !processedText.includes('\n')) {
            processedText = processedText.replace(/\s+B:/g, '\nB:');
            processedText = processedText.replace(/([^A])\s+A:/g, '$1\nA:');
        }

        const lines = processedText.split('\n');
        let tokenIndex = 0;
        let mismatchedTokens = 0;
        let totalTokens = tokenList.length;

        lines.forEach((line, lineIdx) => {
            let linePos = 0;

            while (linePos < line.length && tokenIndex < tokenList.length) {
                const token = tokenList[tokenIndex];
                const tokenText = token.token;

                // 在当前行寻找 token
                const foundPos = line.indexOf(tokenText, linePos);

                // 前端逻辑：如果找不到或者距离太远 (>10字符)，就认为匹配失败
                if (foundPos === -1 || foundPos > linePos + 10) {
                    // 这个 token 在当前位置匹配失败
                    // 如果 linePos 还没到行尾，前端会作为普通字符输出，不算分块

                    // 只有当行还没结束时，我们才算一次尝试匹配失败
                    if (linePos < line.length) {
                        // 这里稍微复杂，因为也许 token 在下一行
                        // 但如果我们在这一行还有文本没处理完，说明这个 token 被跳过了
                        // 或者 text 和 token 不一致
                    }

                    // 模拟前端逻辑：
                    // if (linePos < line.length) linePos++ (跳过一个字符继续尝试)
                    // if (linePos >= line.length) break (换行)
                    if (linePos < line.length) {
                        linePos++;
                        // 注意：这里 tokenIndex 不会增加！前端会试图用同一个 token 匹配下一个字符
                        // 这会导致这个 token 实际上在这一行一直匹配不上，直到行尾
                        continue;
                    } else {
                        break; // 换行
                    }
                }

                // 匹配成功
                // console.log(`  Match: "${tokenText}" at line ${lineIdx}:${foundPos}`);

                // 检查 token 内容和原文内容是否真的一致（indexOf 已经保证了）
                // 但是我们要看看有没有奇怪的情况，比如 token 是 "n't" 但原文是 "not" (这种 indexOf 就会失败)

                linePos = foundPos + tokenText.length;
                tokenIndex++;
            }
        });

        if (tokenIndex < totalTokens) {
            console.log(`  ❌ 匹配不完整!`);
            console.log(`  总 Tokens: ${totalTokens}, 成功匹配并渲染: ${tokenIndex}`);
            console.log(`  有 ${totalTokens - tokenIndex} 个 Token 未能渲染成块。`);

            // 打印第一个失败的
            const failToken = tokenList[tokenIndex];
            console.log(`  卡在 Token: "${failToken.token}" (Index: ${tokenIndex})`);
            // 找到它大概在原文哪里
            // 简单搜索一下上下文
            const contextIndex = text.indexOf(failToken.token);
            if (contextIndex !== -1) {
                console.log(`  原文中存在该词，位于索引 ${contextIndex}，但逻辑未匹配到。`);
            } else {
                console.log(`  原文中完全找不到字符串 "${failToken.token}"！`);
            }

        } else {
            console.log(`  ✅ 完美匹配 (All ${totalTokens} tokens rendered)`);
        }
        console.log('---');
    }
}

main().catch(console.error);
