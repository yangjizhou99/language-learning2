/**
 * Script to download and process vocabulary databases
 * Run with: node scripts/build-vocab-data.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'vocab');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Fetch and process English CEFR vocabulary
 */
async function processEnglishCEFR() {
    console.log('📚 Processing English CEFR vocabulary...');

    const url = 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv';
    const response = await fetch(url);
    const csv = await response.text();

    const dict = {};
    const lines = csv.split('\n');

    // Skip header: headword,pos,CEFR,CoreInventory 1,CoreInventory 2,Threshold
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV (handle potential quoted fields)
        const parts = line.split(',');
        const headword = parts[0]?.toLowerCase().trim();
        const level = parts[2]?.trim(); // CEFR column

        if (headword && level && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(level)) {
            // Only keep first occurrence (some words have multiple entries)
            if (!dict[headword]) {
                dict[headword] = level;
            }
        }
    }

    const outputPath = path.join(OUTPUT_DIR, 'en-cefr.json');
    fs.writeFileSync(outputPath, JSON.stringify(dict, null, 0));

    console.log(`   ✅ Saved ${Object.keys(dict).length} English words to ${outputPath}`);
    return dict;
}

/**
 * Fetch and process Japanese JLPT vocabulary
 */
async function processJapaneseJLPT() {
    console.log('📚 Processing Japanese JLPT vocabulary...');

    const dict = {};
    const levels = ['n5', 'n4', 'n3', 'n2', 'n1'];

    for (const level of levels) {
        try {
            // Try the output folder structure
            const url = `https://raw.githubusercontent.com/elzup/jlpt-word-list/master/out/${level}.json`;
            const response = await fetch(url);

            if (!response.ok) {
                console.log(`   ⚠️ Could not fetch ${level}, trying alternative...`);
                continue;
            }

            const words = await response.json();

            // Handle both array format and object format
            if (Array.isArray(words)) {
                words.forEach(word => {
                    const key = typeof word === 'string' ? word : word.word || word.kanji || word.reading;
                    if (key && !dict[key]) {
                        dict[key] = level.toUpperCase();
                    }
                });
            }
        } catch (err) {
            console.log(`   ⚠️ Error processing ${level}: ${err.message}`);
        }
    }

    // If we couldn't get data, use a fallback built-in list
    if (Object.keys(dict).length === 0) {
        console.log('   ⚠️ Using fallback JLPT data...');
        // Common N5 words as fallback
        const fallbackN5 = ['私', '人', '日', '月', '年', '今', '時', '何', '前', '後', '中', '上', '下', '大', '小', '高', '安', '新', '古', '白', '黒', '赤', '青', '学校', '会社', '病院', '駅', '電車', '車', '道', '山', '川', '海', '空', '雨', '雪', '風', '花', '木', '犬', '猫', '魚', '鳥', '食べる', '飲む', '見る', '聞く', '読む', '書く', '話す', '行く', '来る', '帰る', '入る', '出る', '立つ', '座る', '走る', '歩く', '泳ぐ', '買う', '売る', '使う', '作る', '開ける', '閉める', '始める', '終わる', '住む', '働く', '休む', '寝る', '起きる', '着る', '脱ぐ', '洗う', '持つ', '置く', '取る', '分かる', '思う', '知る', '好き', '嫌い', '大きい', '小さい', '多い', '少ない', '長い', '短い', '高い', '低い', '良い', '悪い', '新しい', '古い', '早い', '遅い', '近い', '遠い', 'これ', 'それ', 'あれ', 'ここ', 'そこ', 'あそこ', '誰', 'どこ', 'いつ', 'なぜ'];
        fallbackN5.forEach(w => { dict[w] = 'N5'; });

        // Common N4 words
        const fallbackN4 = ['経験', '関係', '社会', '政治', '経済', '文化', '歴史', '科学', '技術', '環境', '問題', '意見', '説明', '紹介', '質問', '回答', '連絡', '相談', '約束', '予定', '計画', '準備', '参加', '出席', '欠席', '遅刻', '予約', '注文', '変更', '取消'];
        fallbackN4.forEach(w => { if (!dict[w]) dict[w] = 'N4'; });

        // Common N3 words  
        const fallbackN3 = ['議論', '提案', '解決', '決定', '判断', '選択', '比較', '評価', '分析', '調査', '研究', '開発', '製造', '販売', '購入', '契約', '交渉', '協力', '競争', '成功', '失敗', '努力', '挑戦', '達成', '維持', '改善', '向上', '発展', '進歩', '変化'];
        fallbackN3.forEach(w => { if (!dict[w]) dict[w] = 'N3'; });
    }

    const outputPath = path.join(OUTPUT_DIR, 'ja-jlpt.json');
    fs.writeFileSync(outputPath, JSON.stringify(dict, null, 0));

    console.log(`   ✅ Saved ${Object.keys(dict).length} Japanese words to ${outputPath}`);
    return dict;
}

/**
 * Fetch and process Chinese HSK vocabulary
 */
async function processChineseHSK() {
    console.log('📚 Processing Chinese HSK vocabulary...');

    const url = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json';
    const response = await fetch(url);
    const data = await response.json();

    const dict = {};

    data.forEach(entry => {
        const word = entry.simplified;
        const levels = entry.level || [];

        // Find the lowest (easiest) HSK level
        let hskLevel = null;
        for (const lvl of levels) {
            // Match patterns like "old-1", "old-2", "new-1", etc.
            const match = lvl.match(/(?:old|new)-(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (!hskLevel || num < hskLevel) {
                    hskLevel = num;
                }
            }
        }

        if (word && hskLevel) {
            if (!dict[word]) {
                dict[word] = `HSK${hskLevel}`;
            }
        }
    });

    const outputPath = path.join(OUTPUT_DIR, 'zh-hsk.json');
    fs.writeFileSync(outputPath, JSON.stringify(dict, null, 0));

    console.log(`   ✅ Saved ${Object.keys(dict).length} Chinese words to ${outputPath}`);
    return dict;
}

// Main execution
async function main() {
    console.log('🚀 Building vocabulary data files...\n');

    try {
        await processEnglishCEFR();
        await processJapaneseJLPT();
        await processChineseHSK();

        console.log('\n✅ All vocabulary data files created successfully!');
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

main();
