import frequencyData from './data/frequency.json';
import frequencyPatchData from './data/frequency-patch.json';

/**
 * Word Frequency Utility
 * 
 * Uses a frequency table to determine word rarity.
 * Rank 1 = most common.
 */

// Type for the frequency map (word -> rank)
let frequencyMap: Record<string, number> = {};
const frequencyPatchMap: Record<string, number> = frequencyPatchData as Record<string, number>;

// Handle both Array (ordered list) and Object (map) formats
if (Array.isArray(frequencyData)) {
    // If it's an array ["word1", "word2"], assign rank based on index
    (frequencyData as string[]).forEach((word, index) => {
        frequencyMap[word] = index + 1;
    });
} else {
    // If it's already a map {"word": 1}, use it directly
    frequencyMap = { ...frequencyData } as Record<string, number>;

    // Check if it's 0-based (contains rank 0) and convert to 1-based if necessary
    // This handles lists like mistval/edict-index where "の" is 0
    const hasZeroRank = Object.values(frequencyMap).some(v => v === 0);
    if (hasZeroRank) {
        Object.keys(frequencyMap).forEach(key => {
            frequencyMap[key] += 1;
        });
    }
}

// Merge patch data into main map
Object.assign(frequencyMap, frequencyPatchMap);

// Common Kana words that are stored as Kanji in the frequency list
// This maps the common Kana form to the Kanji form found in the list
const KANA_TO_KANJI_MAP: Record<string, string> = {
    'ありがとう': '有難う',
    'お父さん': '父',
    'いつも': '何時も',
    'たくさん': '沢山',
    'どういたしまして': '如何致しまして',
    'おはよう': 'お早う',
    'こんにちは': '今日は',
    'こんばんは': '今晩は',
    'ごめんなさい': '御免なさい',
    'ください': '下さい',
    'みんな': '皆',
    'よく': '良く',
    'もっと': '尤も',
    'あまり': '余り',
    'すごく': '凄く',
    'とても': '迚も',
    'きれい': '綺麗',
    'すてき': '素敵',
    'ほしい': '欲しい',
    'わかる': '分かる',
    'できる': '出来る',
    'いただく': '頂く',
    'みる': '見る',
    'いく': '行く',
    'くる': '来る',
    'なる': '成る',
    'する': '為る',
    'ある': '有る',
    'いる': '居る',
    'いい': '良い',
    'よい': '良い',
    'わたし': '私',
    'ぼく': '僕',
    'あなた': '貴方',
    'これ': '此れ',
    'それ': '其れ',
    'あれ': '彼れ',
    'どれ': '何れ',
    'ここ': '此処',
    'そこ': '其処',
    'あそこ': '彼処',
    'どこ': '何処',
    'だれ': '誰',
    'いつ': '何時',
    'なぜ': '何故',
    'どう': '如何',
    'どの': '何の',
    'また': '又',
    'まだ': '未だ',
    'もう': '其れに', // or 既に?
    'すぐ': '直ぐ',
    'ちょっと': '一寸',
    'ちょうど': '丁度',
    'やはり': '矢張り',
    'やっぱり': '矢張り',
    'もちろん': '勿論',
    'はじめて': '初めて',
    'はじめまして': '初めまして',
    'よろしく': '宜しく',
    'お願いします': '御願いします',
    'でも': '然し',
    'そうだ': 'そう',
    '話そ': '話す',
    'いかが': '如何',
    'まずい': '不味い',
    'お前': '御前',
    'しっかり': '確り',
    'ぜひ': '是非',
    'やっと': '漸く', // or 遣っと
    'こちら': '此方',
    'どういう': 'どう言う', // heuristic mapping
    'それぞれ': '其れ其れ',
    'きっかけ': '切っ掛け',
    'もう少し': 'もう少し', // likely compound, maybe map to 少し? Or just keep as is if freq list has it
    'よろしい': '宜しい',
    'ゴミ': 'ごみ',
    'ご覧': '御覧',
    'おっしゃる': '仰る',
    'おじいちゃん': 'お祖父ちゃん',
};

// Custom frequency overrides for words not in the main list or to adjust ranks
// Rank 1-1000: Common (Green)
// Rank 1001-5000: Moderate (Yellow)
// Rank 5001-10000: Uncommon (Orange)
// Rank >10000: Rare (Red)
const CUSTOM_FREQUENCY_MAP: Record<string, number> = {
    'スマホ': 2000,   // Common modern word
    'SNS': 2000,      // Common acronym
    'メンタルヘルス': 5000,
    'ゴミ': 3000,
    '高校生': 1500,
    '第一歩': 4000,
    'マジ': 2000,     // Slang
};

export interface FrequencyScore {
    token: string;
    frequencyScore: number;  // Rank (1-based), or -1 if unknown
    frequencyLabel: 'common' | 'moderate' | 'uncommon' | 'rare';
    isGrammar: boolean;
}

/**
 * Get frequency rank for a token
 * Returns rank (1-based) or -1 if not found
 * 
 * @param token The surface form of the word
 * @param lemma Optional base form/lemma of the word (e.g. for verbs/adjectives)
 */
export function getFrequencyRank(token: string, lemma?: string): number {
    // 0. Check if it's a number (digits)
    // Treat numbers as very common (rank 100)
    if (/^[\d０-９]+$/.test(token)) return 100;

    // 0.5. Check Custom Frequency Map (Manual Overrides)
    if (CUSTOM_FREQUENCY_MAP[token]) return CUSTOM_FREQUENCY_MAP[token];
    if (lemma && CUSTOM_FREQUENCY_MAP[lemma]) return CUSTOM_FREQUENCY_MAP[lemma];

    // 1. Try surface form
    let rank = frequencyMap[token];
    if (rank) return rank;

    // 2. Try lemma if provided
    if (lemma && lemma !== token) {
        rank = frequencyMap[lemma];
        if (rank) return rank;
    }

    // 3. Try Kana -> Kanji mapping for token
    const mappedToken = KANA_TO_KANJI_MAP[token];
    if (mappedToken) {
        rank = frequencyMap[mappedToken];
        if (rank) return rank;
    }

    // 4. Try Kana -> Kanji mapping for lemma
    if (lemma && lemma !== token) {
        const mappedLemma = KANA_TO_KANJI_MAP[lemma];
        if (mappedLemma) {
            rank = frequencyMap[mappedLemma];
            if (rank) return rank;
        }
    }

    // 5. Heuristic: Suru-verbs (Noun + する/し/して/した)
    // Try stripping the suffix to find the noun stem
    // e.g. 担当する -> 担当, 担当し -> 担当
    const suruSuffixes = ['する', 'し', 'して', 'した'];
    for (const suffix of suruSuffixes) {
        if (token.endsWith(suffix) && token.length > suffix.length) {
            const stem = token.slice(0, -suffix.length);
            rank = frequencyMap[stem];
            if (rank) return rank;
        }
        if (lemma && lemma.endsWith(suffix) && lemma.length > suffix.length) {
            const stem = lemma.slice(0, -suffix.length);
            rank = frequencyMap[stem];
            if (rank) return rank;
        }
    }

    // 6. Heuristic: Na-adjectives ending in 的 (〜的)
    // e.g. 社会的 -> 社会
    if (token.endsWith('的') && token.length > 1) {
        const stem = token.slice(0, -1);
        rank = frequencyMap[stem];
        if (rank) return rank;
    }

    // 7. Heuristic: Common Suffixes (〜性, 〜化, 〜さ, 〜会, 〜方, 〜長, 〜様)
    // e.g. 生産性 -> 生産, 活性化 -> 活性, 美しさ -> 美しい(lemma) -> 美し
    const commonSuffixes = ['性', '化', 'さ', '会', '方', '長', '様'];
    for (const suffix of commonSuffixes) {
        if (token.endsWith(suffix) && token.length > suffix.length) {
            const stem = token.slice(0, -suffix.length);
            rank = frequencyMap[stem];
            if (rank) return rank;
        }
    }

    // 8. Heuristic: Common Prefixes (非〜, 不〜, 無〜, 未〜, お〜, ご〜)
    // e.g. 非同期 -> 同期, 不十分 -> 十分
    const commonPrefixes = ['非', '不', '無', '未'];
    for (const prefix of commonPrefixes) {
        if (token.startsWith(prefix) && token.length > prefix.length) {
            const stem = token.slice(prefix.length);
            rank = frequencyMap[stem];
            if (rank) return rank;
        }
    }

    // 9. Heuristic: Honorifics (お〜, ご〜) - Only if length > 2 to avoid stripping real words
    // e.g. お願い -> 願い
    if ((token.startsWith('お') || token.startsWith('ご')) && token.length > 2) {
        const stem = token.slice(1);
        rank = frequencyMap[stem];
        if (rank) return rank;
    }

    return -1;
}

/**
 * Convert rank to human-readable label
 * Based on 20k word list
 */
export function rankToLabel(rank: number): 'common' | 'moderate' | 'uncommon' | 'rare' {
    if (rank === -1) return 'rare';
    if (rank <= 1000) return 'common';     // Top 1000
    if (rank <= 5000) return 'moderate';   // Top 5000
    if (rank <= 10000) return 'uncommon';  // Top 10000
    return 'rare';                         // > 10000
}

/**
 * Get CSS class for frequency rank coloring
 */
export function getFrequencyColorClass(rank: number): string {
    if (rank !== -1 && rank <= 1000) return 'bg-green-100 text-green-700';
    if (rank !== -1 && rank <= 5000) return 'bg-yellow-100 text-yellow-700';
    if (rank !== -1 && rank <= 10000) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
}

/**
 * Calculate frequency scores for a list of tokens
 */
export function calculateFrequencyScores(
    tokenList: Array<{
        token: string;
        lemma?: string;
        originalLevel: string;
        pos?: string;
    }>
): FrequencyScore[] {
    return tokenList.map(t => {
        const isGrammar = t.originalLevel.includes('grammar') ||
            t.pos === '複合語法' ||
            t.pos === '語法詞根';

        const rank = getFrequencyRank(t.token, t.lemma);

        return {
            token: t.token,
            frequencyScore: rank,
            frequencyLabel: rankToLabel(rank),
            isGrammar
        };
    });
}

/**
 * Calculate average frequency rank for a text
 * Lower is easier/more common
 */
export function calculateAverageFrequency(scores: FrequencyScore[]): number {
    if (scores.length === 0) return 0;

    // Only count content words that are found in the list
    const foundScores = scores.filter(s => !s.isGrammar && s.frequencyScore !== -1);
    if (foundScores.length === 0) return 0;

    const sum = foundScores.reduce((acc, s) => acc + s.frequencyScore, 0);
    return Math.round(sum / foundScores.length);
}
