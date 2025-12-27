/**
 * Analyze unlabeled tokens - identify patterns and root causes
 * Run: npx tsx scripts/analyze-unlabeled-tokens.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface UnlabeledToken {
    token: string;
    lemma: string;
    pos: string;
    type: 'grammar' | 'unknown';
    context?: string;
}

async function runAnalysis() {
    const { analyzeLexProfileAsync } = await import('../src/lib/recommendation/lexProfileAnalyzer');

    console.log('='.repeat(80));
    console.log('🔍 未标记等级Token分析报告');
    console.log('='.repeat(80));
    console.log('');

    // Fetch test data
    const { data: items, error } = await supabase
        .from('shadowing_items')
        .select('id, text, title')
        .eq('lang', 'ja')
        .not('text', 'is', null)
        .neq('text', '')
        .limit(300);

    if (error || !items?.length) {
        console.error('Error:', error);
        return;
    }

    console.log(`分析样本: ${items.length} 个日语题目\n`);

    const unlabeledGrammar: Map<string, { count: number; samples: string[]; pos: string; lemma: string }> = new Map();
    const unlabeledContent: Map<string, { count: number; samples: string[]; pos: string; lemma: string }> = new Map();

    console.log('正在分析...');

    for (let i = 0; i < items.length; i++) {
        process.stdout.write(`\r  进度: ${i + 1}/${items.length}`);

        try {
            const result = await analyzeLexProfileAsync(
                items[i].text,
                'ja',
                'kuromoji',
                'default',
                'hagoromo'
            );

            if (result?.details?.tokenList) {
                result.details.tokenList.forEach(t => {
                    // Grammar tokens without level
                    if (t.originalLevel === 'grammar') {
                        const existing = unlabeledGrammar.get(t.token);
                        if (existing) {
                            existing.count++;
                            if (existing.samples.length < 3 && !existing.samples.includes(items[i].text.slice(0, 50))) {
                                existing.samples.push(items[i].text.slice(0, 50) + '...');
                            }
                        } else {
                            unlabeledGrammar.set(t.token, {
                                count: 1,
                                samples: [items[i].text.slice(0, 50) + '...'],
                                pos: t.pos,
                                lemma: t.lemma
                            });
                        }
                    }

                    // Unknown content words
                    if (t.isContentWord && t.originalLevel === 'unknown') {
                        const existing = unlabeledContent.get(t.token);
                        if (existing) {
                            existing.count++;
                            if (existing.samples.length < 3 && !existing.samples.includes(items[i].text.slice(0, 50))) {
                                existing.samples.push(items[i].text.slice(0, 50) + '...');
                            }
                        } else {
                            unlabeledContent.set(t.token, {
                                count: 1,
                                samples: [items[i].text.slice(0, 50) + '...'],
                                pos: t.pos,
                                lemma: t.lemma
                            });
                        }
                    }
                });
            }
        } catch (e) {
            // Skip errors
        }
    }

    console.log('\n\n');

    // Sort by count
    const sortedGrammar = [...unlabeledGrammar.entries()].sort((a, b) => b[1].count - a[1].count);
    const sortedContent = [...unlabeledContent.entries()].sort((a, b) => b[1].count - a[1].count);

    // Analyze patterns
    console.log('='.repeat(80));
    console.log('📝 未标记语法词 (grammar 无等级) - Top 50');
    console.log('='.repeat(80));
    console.log('');
    console.log('| Token | 词根 | 词性 | 出现次数 | 可能原因 |');
    console.log('|-------|------|------|----------|----------|');

    let grammarIssues = {
        singleChar: 0,
        verbEnding: 0,
        auxiliaryVerb: 0,
        particle: 0,
        other: 0
    };

    sortedGrammar.slice(0, 50).forEach(([token, info]) => {
        let reason = '';

        // Single character - likely grammar fragment
        if (token.length === 1) {
            reason = '单字符(语法片段)';
            grammarIssues.singleChar += info.count;
        }
        // Verb endings
        else if (/^(た|て|ない|れる|せる|たい|よう|まし|です|ます|ある|いる|おる|える|られ|させ)$/.test(token)) {
            reason = '动词活用语尾';
            grammarIssues.verbEnding += info.count;
        }
        // Auxiliary verbs
        else if (info.pos.includes('助動詞') || info.pos.includes('助詞')) {
            reason = '助词/助动词';
            grammarIssues.auxiliaryVerb += info.count;
        }
        // Particles
        else if (/^(けど|けれど|から|まで|より|ほど|など|とか|って|なんて|だけ|しか|ばかり)$/.test(token)) {
            reason = '接续助词';
            grammarIssues.particle += info.count;
        }
        else {
            reason = '词库未收录?';
            grammarIssues.other += info.count;
        }

        console.log(`| ${token} | ${info.lemma !== token ? info.lemma : '-'} | ${info.pos} | ${info.count} | ${reason} |`);
    });

    console.log('');
    console.log('语法词问题分布:');
    console.log(`  - 单字符片段: ${grammarIssues.singleChar}`);
    console.log(`  - 动词活用语尾: ${grammarIssues.verbEnding}`);
    console.log(`  - 助词/助动词: ${grammarIssues.auxiliaryVerb}`);
    console.log(`  - 接续助词: ${grammarIssues.particle}`);
    console.log(`  - 其他(可能词库问题): ${grammarIssues.other}`);

    console.log('');
    console.log('='.repeat(80));
    console.log('📚 未标记内容词 (unknown) - Top 50');
    console.log('='.repeat(80));
    console.log('');
    console.log('| Token | 词根 | 词性 | 出现次数 | 可能原因 |');
    console.log('|-------|------|------|----------|----------|');

    let contentIssues = {
        properNoun: 0,
        katakana: 0,
        compoundWord: 0,
        rareWord: 0,
        tokenizationError: 0
    };

    sortedContent.slice(0, 50).forEach(([token, info]) => {
        let reason = '';

        // Proper nouns (names, places)
        if (info.pos.includes('固有名詞') || info.pos.includes('人名') || info.pos.includes('地名')) {
            reason = '固有名词';
            contentIssues.properNoun += info.count;
        }
        // Katakana words (likely loanwords)
        else if (/^[\u30A0-\u30FF]+$/.test(token)) {
            reason = '片假名(外来语)';
            contentIssues.katakana += info.count;
        }
        // Long tokens (might be tokenization errors)
        else if (token.length > 6) {
            reason = '长词(可能切分问题)';
            contentIssues.tokenizationError += info.count;
        }
        // Compound words
        else if (token.length >= 4 && /[\u4E00-\u9FFF]/.test(token)) {
            reason = '复合词(词库未收录)';
            contentIssues.compoundWord += info.count;
        }
        else {
            reason = '低频词(词库未收录)';
            contentIssues.rareWord += info.count;
        }

        console.log(`| ${token} | ${info.lemma !== token ? info.lemma : '-'} | ${info.pos} | ${info.count} | ${reason} |`);
    });

    console.log('');
    console.log('内容词问题分布:');
    console.log(`  - 固有名词: ${contentIssues.properNoun}`);
    console.log(`  - 片假名外来语: ${contentIssues.katakana}`);
    console.log(`  - 长词(切分问题): ${contentIssues.tokenizationError}`);
    console.log(`  - 复合词: ${contentIssues.compoundWord}`);
    console.log(`  - 低频词: ${contentIssues.rareWord}`);

    console.log('');
    console.log('='.repeat(80));
    console.log('📊 问题分析总结');
    console.log('='.repeat(80));
    console.log('');

    const totalGrammarUnlabeled = sortedGrammar.reduce((sum, [, info]) => sum + info.count, 0);
    const totalContentUnlabeled = sortedContent.reduce((sum, [, info]) => sum + info.count, 0);

    console.log(`未标记语法词总数: ${totalGrammarUnlabeled} (${sortedGrammar.length} 种)`);
    console.log(`未标记内容词总数: ${totalContentUnlabeled} (${sortedContent.length} 种)`);
    console.log('');
    console.log('主要原因分析:');
    console.log('');
    console.log('【语法词】主要是切分产生的语法片段，如:');
    console.log('  - 动词活用语尾被单独切分 (た、て、ない、れる等)');
    console.log('  - 助动词活用形式未被语法库覆盖');
    console.log('');
    console.log('【内容词】主要是词库覆盖问题:');
    console.log('  - 外来语(片假名词)覆盖不足');
    console.log('  - 复合词、派生词未收录');
    console.log('  - 部分固有名词误判为内容词');
    console.log('');
    console.log('='.repeat(80));
}

runAnalysis().catch(console.error);
