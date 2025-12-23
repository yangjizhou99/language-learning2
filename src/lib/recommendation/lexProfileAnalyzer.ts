/**
 * Lex Profile Analyzer - Advanced NLP Version
 * Uses professional NLP libraries for accurate tokenization and lemmatization.
 * - English: compromise.js (lemmatization + POS tagging)
 * - Japanese: kuromoji (default), TinySegmenter, or budoux (configurable)
 * - Chinese: jieba (word segmentation)
 */

import { BroadCEFR } from './difficulty';

// Japanese tokenizer options
export type JaTokenizer = 'kuromoji' | 'tinysegmenter' | 'budoux';

// Japanese vocabulary dictionary options
export type JaVocabDict = 'default' | 'elzup' | 'tanos' | 'combined';

// Japanese grammar dictionary options
export type JaGrammarDict = 'yapan' | 'hagoromo' | 'combined';

import TinySegmenter from 'tiny-segmenter';
import { loadDefaultJapaneseParser } from 'budoux';

// Advanced grammar matching engine
import {
    ParsedGrammarRule,
    GrammarMatchResult,
    KuromojiTokenInfo,
    parseGrammarPattern,
    matchAdvancedGrammar,
    preprocessGrammarPatterns,
    getParseStats,
} from './advancedGrammarMatcher';

// Vocabulary data - loaded from JSON files
/* eslint-disable @typescript-eslint/no-var-requires */
const enCefr = require('@/data/vocab/en-cefr.json') as Record<string, string>;
const jaJlpt = require('@/data/vocab/ja-jlpt.json') as Record<string, string>;
const jaJlptElzup = require('@/data/vocab/ja-jlpt-elzup.json') as Record<string, string>;
const jaJlptTanos = require('@/data/vocab/ja-jlpt-tanos.json') as Record<string, string>;
const jaJlptCombined = require('@/data/vocab/ja-jlpt-combined.json') as Record<string, string>;
const zhHsk = require('@/data/vocab/zh-hsk.json') as Record<string, string>;

// Japanese vocabulary dictionary maps
const jaVocabDictionaries: Record<JaVocabDict, Map<string, string>> = {
    default: new Map(Object.entries(jaJlpt)),
    elzup: new Map(Object.entries(jaJlptElzup)),
    tanos: new Map(Object.entries(jaJlptTanos)),
    combined: new Map(Object.entries(jaJlptCombined)),
};

// Dictionary metadata for UI display
export const JA_VOCAB_DICT_INFO: Record<JaVocabDict, { name: string; size: number; source: string }> = {
    default: { name: 'Default JLPT', size: Object.keys(jaJlpt).length, source: 'Custom' },
    elzup: { name: 'Elzup JLPT', size: Object.keys(jaJlptElzup).length, source: 'github.com/elzup/jlpt-word-list' },
    tanos: { name: 'Tanos JLPT', size: Object.keys(jaJlptTanos).length, source: 'tanos.co.uk (via Bluskyo)' },
    combined: { name: 'Combined (Strong)', size: Object.keys(jaJlptCombined).length, source: 'Merged from all sources' },
};

// Grammar pattern data
const jaGrammarYapan = require('@/data/grammar/ja-grammar-jlpt.json') as GrammarPattern[];
const jaGrammarHagoromo = require('@/data/grammar/ja-grammar-hagoromo-patterns.json') as GrammarPattern[];
const jaGrammarCombined = require('@/data/grammar/ja-grammar-combined.json') as GrammarPattern[];

// Japanese grammar dictionary maps
const jaGrammarDictionaries: Record<JaGrammarDict, GrammarPattern[]> = {
    yapan: jaGrammarYapan,
    hagoromo: jaGrammarHagoromo,
    combined: jaGrammarCombined,
};

// Grammar dictionary metadata for UI display
export const JA_GRAMMAR_DICT_INFO: Record<JaGrammarDict, { name: string; size: number; source: string }> = {
    yapan: { name: 'YAPAN JLPT', size: jaGrammarYapan.length, source: 'jlptsensei.com / japanesetest4you.com' },
    hagoromo: { name: 'Hagoromo 4.1', size: jaGrammarHagoromo.length, source: 'hgrm.jpn.org (大学日语教育学术数据库)' },
    combined: { name: 'Combined (Strong)', size: jaGrammarCombined.length, source: 'Merged YAPAN + Hagoromo' },
};

// Backwards compatibility - default grammar patterns
const jaGrammarPatterns = jaGrammarYapan;


// LLM-discovered rules (loaded dynamically for hot-reload support)
let llmVocabRulesCache: Record<string, { level: string }> | null = null;
let llmGrammarRulesCache: Record<string, GrammarPattern> | null = null;
let llmRulesLastLoad: number = 0;
const LLM_RULES_CACHE_TTL = 5000; // 5 seconds cache

async function loadLLMRules(): Promise<{ vocab: Record<string, { level: string }>, grammar: Record<string, GrammarPattern> }> {
    const now = Date.now();
    if (llmVocabRulesCache && llmGrammarRulesCache && (now - llmRulesLastLoad) < LLM_RULES_CACHE_TTL) {
        return { vocab: llmVocabRulesCache, grammar: llmGrammarRulesCache };
    }

    try {
        // Dynamic import for file system access (server-side only)
        const fs = await import('fs/promises');
        const path = await import('path');

        const vocabPath = path.join(process.cwd(), 'src', 'data', 'vocab', 'llm-vocab-rules.json');
        const grammarPath = path.join(process.cwd(), 'src', 'data', 'grammar', 'llm-grammar-rules.json');

        let vocab: Record<string, { level: string }> = {};
        let grammar: Record<string, GrammarPattern> = {};

        try {
            const vocabContent = await fs.readFile(vocabPath, 'utf-8');
            vocab = JSON.parse(vocabContent);
        } catch { /* File might not exist yet */ }

        try {
            const grammarContent = await fs.readFile(grammarPath, 'utf-8');
            grammar = JSON.parse(grammarContent);
        } catch { /* File might not exist yet */ }

        llmVocabRulesCache = vocab;
        llmGrammarRulesCache = grammar;
        llmRulesLastLoad = now;

        return { vocab, grammar };
    } catch {
        // Fallback for client-side or error cases
        return { vocab: {}, grammar: {} };
    }
}

// Synchronous version using cached values
function getLLMRulesSync(): { vocab: Record<string, { level: string }>, grammar: Record<string, GrammarPattern> } {
    return {
        vocab: llmVocabRulesCache || {},
        grammar: llmGrammarRulesCache || {},
    };
}
/* eslint-enable @typescript-eslint/no-var-requires */

// Grammar pattern interface (from YAPAN)
interface GrammarPattern {
    level: string;      // N1, N2, N3, N4, N5
    pattern: string;    // Grammar pattern text
    source: string;     // Source URL
    definition: string; // English definition
    reading?: string;   // Optional reading (for hiragana matching)
    canonical?: string; // Canonical form (from LLM rules)
    compoundPattern?: string; // If this is a fragment, points to the full compound pattern
}

// Matched grammar pattern with position tracking
interface MatchedGrammarPattern {
    pattern: string;       // Original pattern name from dictionary
    level: string;         // N1, N2, N3, N4, N5
    definition: string;    // English definition
    cleanPattern: string;  // Actual matched string in text
    startIndex: number;    // Start position in cleaned text
    endIndex: number;      // End position in cleaned text
    compoundPattern?: string; // If this is a fragment, points to the full compound pattern
}

// Grammar profile output
export interface GrammarProfileResult {
    total: number;              // Total grammar patterns detected
    byLevel: Record<string, number>;  // Count by JLPT level
    patterns: MatchedGrammarPattern[];
    hardestGrammar: string | null;  // Most difficult grammar point found
    unrecognizedGrammar: string[];  // Grammar tokens not matched to any known pattern
}

// NLP Libraries
import nlp from 'compromise';

// Type definitions
export type SupportedLang = 'en' | 'ja' | 'zh';

export interface TokenInfo {
    token: string;           // Surface form (original)
    lemma: string;           // Base form / lemma / dictionary form
    pos: string;             // Part of speech
    originalLevel: string;   // A1, N5, HSK1, etc.
    broadCEFR: BroadCEFR | 'unknown';
    isContentWord: boolean;  // true = 名詞/動詞/形容詞/副詞, false = 助詞/助動詞/etc
    charStart?: number;      // Start position in cleaned text (for grammar backfill)
    charEnd?: number;        // End position in cleaned text
    compoundGrammar?: string; // If part of a compound grammar pattern, the pattern name
    isGrammarRoot?: boolean;  // For split patterns: true if this token is the grammar root (prefix/suffix)
    isSplitMiddle?: boolean;  // For split patterns: true if this token is the middle content (not grammar)
}

export interface LexProfileResult {
    tokens: number;
    uniqueTokens: number;
    contentWordCount: number;     // Only content words (名詞/動詞/形容詞/副詞)
    functionWordCount: number;    // Function words (助詞/助動詞/etc)
    lexProfile: {
        A1_A2: number;
        B1_B2: number;
        C1_plus: number;
        unknown: number;          // Now only for unknown CONTENT words
    };
    grammarProfile?: GrammarProfileResult;  // Grammar difficulty analysis (Japanese only)
    details: {
        tokenList: TokenInfo[];
        unknownTokens: string[];  // Only unknown content words
        coverage: number;         // Coverage of content words only
        grammarTokens: string[];  // Function words (not counted in coverage)
    };
    difficultySummary?: {
        vocabLevel: string;     // e.g. "N1"
        vocabHardest: string[]; // e.g. ["対立", "耐える"]
        grammarLevel: string;   // e.g. "N2"
        grammarHardest: string[]; // e.g. ["からこそ", "だって"]
        overallLevel: string;   // e.g. "N2"
    };
}

// Create dictionaries from imported JSON
const dictionaries: Record<SupportedLang, Map<string, string>> = {
    en: new Map(Object.entries(enCefr)),
    ja: new Map(Object.entries(jaJlpt)),
    zh: new Map(Object.entries(zhHsk)),
};

// Custom dictionary for missing words or overrides
// MINIMAL version - most vocabulary should be handled by LLM batch assignment
// Only include core vocabulary that is absolutely essential for base functionality
const customDictionary: Record<string, string> = {
    // === Essential base vocabulary (very high frequency, core words) ===
    '本当': 'N5',
    '本当に': 'N5',
    'わかる': 'N5',
    '日本語': 'N5',
    '子ども': 'N5',
    '母': 'N5',

    // All other vocabulary should be handled by:
    // 1. Main dictionary (jaJlpt)
    // 2. LLM batch assignment (saved to llm-vocab-rules.json)
};

// JLPT level order for difficulty comparison (N5 = easiest, N1 = hardest)
const JLPT_LEVEL_ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];

/**
 * Match grammar patterns in Japanese text
 * Uses selected grammar database (YAPAN: 667 patterns, Hagoromo: 1,731 patterns)
 * Enhanced with advanced pattern matching for complex grammar patterns.
 * 
 * @param text - The text to analyze
 * @param grammarDict - Which grammar dictionary to use
 * @param kuromojiTokens - Optional kuromoji tokens for POS-aware matching
 */
function matchGrammarPatterns(
    text: string,
    grammarDict: JaGrammarDict = 'yapan',
    kuromojiTokens?: KuromojiTokenInfo[]
): GrammarProfileResult {
    const matchedPatterns: GrammarProfileResult['patterns'] = [];
    const byLevel: Record<string, number> = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };

    // Get the selected grammar patterns
    const staticPatterns = jaGrammarDictionaries[grammarDict];

    // Get LLM grammar rules and convert to GrammarPattern array
    const { grammar: llmRules } = getLLMRulesSync();
    const llmPatterns: GrammarPattern[] = Object.entries(llmRules).map(([key, rule]) => ({
        ...rule,
        pattern: key, // Use the key (surface form) as the pattern
        source: 'LLM',
    })).filter(p => p.pattern && p.pattern.length > 0);

    // Merge patterns
    const grammarPatterns = [...llmPatterns, ...staticPatterns];

    // ========================
    // Phase 1: Advanced Pattern Matching (for complex patterns)
    // ========================

    // Preprocess patterns into parsed rules
    const parsedRules = preprocessGrammarPatterns(grammarPatterns);

    // Use advanced matching with kuromoji tokens if available
    const advancedMatches = matchAdvancedGrammar(
        text,
        parsedRules,
        kuromojiTokens
    );

    // Track matched ranges to prevent overlap
    const matchedRanges: Array<{ start: number; end: number }> = [];

    // Add advanced matches
    for (const match of advancedMatches) {
        // Avoid duplicate patterns
        if (!matchedPatterns.some(p => p.pattern === match.pattern)) {
            matchedPatterns.push({
                pattern: match.pattern,
                level: match.level,
                definition: match.definition,
                cleanPattern: match.matchedText,
                startIndex: match.startIndex,
                endIndex: match.endIndex,
                compoundPattern: match.pattern,
            });
            byLevel[match.level] = (byLevel[match.level] || 0) + 1;
            matchedRanges.push({ start: match.startIndex, end: match.endIndex });
        }
    }

    // ========================
    // Phase 2: Simple Literal Matching (for remaining patterns)
    // ========================

    // Sort unmatched patterns by length (longer first)
    const sortedPatterns = [...grammarPatterns].sort((a, b) =>
        b.pattern.length - a.pattern.length
    );

    // Use a mask to prevent double counting (longest match wins)
    let maskedText = text;

    for (const gp of sortedPatterns) {
        // Skip if already matched by advanced matcher
        if (matchedPatterns.some(p => p.pattern === gp.pattern)) continue;

        // Clean pattern for matching (remove placeholders)
        const cleanPattern = gp.pattern
            .replace(/[XYZ～〜]/g, '')
            .replace(/[「」『』（）\[\]]/g, '')
            .replace(/〔[^〕]*〕/g, '')  // Remove semantic placeholders
            .replace(/＜[^＞]*＞/g, '')  // Remove meaning annotations
            .replace(/[＋]/g, '')        // Remove connectors
            .trim();

        if (cleanPattern.length < 2) continue; // Skip very short patterns

        // Check if pattern exists in text (and not already masked)
        const matchIndex = maskedText.indexOf(cleanPattern);
        if (matchIndex !== -1) {
            // Check if this overlaps with advanced matches
            const originalIndex = text.indexOf(cleanPattern);
            const overlaps = matchedRanges.some(
                r => originalIndex < r.end && (originalIndex + cleanPattern.length) > r.start
            );

            if (!overlaps) {
                // Calculate the actual grammar part range
                const { start: relativeStart, end: relativeEnd } = alignGrammarSuffix(cleanPattern, gp.canonical);
                const adjustedStart = originalIndex + relativeStart;
                const adjustedEnd = originalIndex + relativeEnd;
                const adjustedPattern = text.substring(adjustedStart, adjustedEnd);

                matchedPatterns.push({
                    pattern: gp.pattern,
                    level: gp.level,
                    definition: gp.definition,
                    cleanPattern: adjustedPattern,
                    startIndex: adjustedStart,
                    endIndex: adjustedEnd,
                    compoundPattern: gp.compoundPattern || gp.pattern,
                });
                byLevel[gp.level] = (byLevel[gp.level] || 0) + 1;
                matchedRanges.push({ start: adjustedStart, end: adjustedEnd });

                // Mask the matched part
                maskedText = maskedText.replace(new RegExp(escapeRegExpLocal(cleanPattern), 'g'), '█'.repeat(cleanPattern.length));
            }
        }
    }

    // ========================
    // Phase 3: Colloquial Grammar Detection
    // ========================

    const unrecognizedGrammar: string[] = [];
    const commonGrammarBlocks = [
        { pattern: /てる/, name: '〜てる (口語ている)', mapTo: '〜ている', level: 'N5' },
        { pattern: /ちゃう|ちゃった/, name: '〜ちゃう (口語てしまう)', mapTo: '〜てしまう', level: 'N4' },
        { pattern: /なきゃ|なくちゃ/, name: '〜なきゃ (口語なければ)', mapTo: '〜なければ', level: 'N4' },
        { pattern: /られる|れる/, name: '〜られる/れる (受身/可能)', mapTo: '〜られる', level: 'N4' },
        { pattern: /させる|せる/, name: '〜させる/せる (使役)', mapTo: '〜させる', level: 'N4' },
        { pattern: /たい/, name: '〜たい (願望)', mapTo: '〜たい', level: 'N5' },
        { pattern: /ている|ていた/, name: '〜ている (進行/状態)', mapTo: '〜ている', level: 'N5' },
        { pattern: /てしまう|てしまった/, name: '〜てしまう (完了/後悔)', mapTo: '〜てしまう', level: 'N4' },
        { pattern: /ようとする/, name: '〜ようとする (意図)', mapTo: '〜ようとする', level: 'N4' },
        { pattern: /ことができる/, name: '〜ことができる (可能)', mapTo: '〜ことができる', level: 'N5' },
    ];

    for (const block of commonGrammarBlocks) {
        if (block.pattern.test(text)) {
            const isCovered = matchedPatterns.some(p =>
                p.pattern.includes(block.mapTo.replace('〜', '')) ||
                p.pattern.includes(block.name.split(' ')[0].replace('〜', ''))
            );

            if (!isCovered) {
                if (block.mapTo) {
                    const match = block.pattern.exec(text);
                    const startIdx = match ? match.index : -1;
                    const matchedStr = match ? match[0] : block.mapTo.replace('〜', '');

                    // Check for overlap
                    const overlaps = matchedRanges.some(r =>
                        startIdx < r.end && (startIdx + matchedStr.length) > r.start
                    );

                    if (!overlaps) {
                        matchedPatterns.push({
                            pattern: block.name,
                            level: block.level,
                            definition: `Colloquial form of ${block.mapTo}`,
                            cleanPattern: matchedStr,
                            startIndex: startIdx,
                            endIndex: startIdx + matchedStr.length,
                        });
                        byLevel[block.level] = (byLevel[block.level] || 0) + 1;
                    }
                } else if (!unrecognizedGrammar.includes(block.name)) {
                    unrecognizedGrammar.push(block.name);
                }
            }
        }
    }

    // Find hardest grammar (based on JLPT level order)
    let hardestGrammar: string | null = null;
    for (const level of JLPT_LEVEL_ORDER.slice().reverse()) { // N1 first
        const match = matchedPatterns.find(p => p.level === level);
        if (match) {
            hardestGrammar = `${match.pattern} (${match.level})`;
            break;
        }
    }

    return {
        total: matchedPatterns.length,
        byLevel,
        patterns: matchedPatterns,
        hardestGrammar,
        unrecognizedGrammar,
    };
}


function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/*** Backfill grammar pattern information to individual tokens
 * This updates tokens that are part of a compound grammar pattern
 * (e.g., にもかかわらず) with the correct pattern level
 */
function backfillGrammarPatterns(
    tokens: TokenInfo[],
    patterns: MatchedGrammarPattern[],
    cleanedText: string
): TokenInfo[] {
    if (patterns.length === 0) return tokens;

    // Build a mapping of character positions to token indices
    let currentPos = 0;
    const tokenPositions: Array<{ start: number; end: number; index: number }> = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenStart = cleanedText.indexOf(token.token, currentPos);
        if (tokenStart !== -1) {
            const tokenEnd = tokenStart + token.token.length;
            tokenPositions.push({ start: tokenStart, end: tokenEnd, index: i });
            tokens[i] = { ...token, charStart: tokenStart, charEnd: tokenEnd };
            currentPos = tokenEnd;
        }
    }

    // For each matched grammar pattern, find overlapping tokens and update them
    for (const pattern of patterns) {
        if (pattern.startIndex < 0) continue;

        const patternStart = pattern.startIndex;
        const patternEnd = pattern.endIndex;

        for (const tp of tokenPositions) {
            const overlaps = tp.start < patternEnd && tp.end > patternStart;

            if (overlaps) {
                const token = tokens[tp.index];
                const isFullyContained = tp.start >= patternStart && tp.end <= patternEnd;

                // Grammar priority: all tokens fully within a compound pattern get the grammar level
                if (isFullyContained) {
                    tokens[tp.index] = {
                        ...token,
                        originalLevel: `grammar (${pattern.level})`,
                        compoundGrammar: pattern.compoundPattern || pattern.pattern,
                    };
                }
            }
        }
    }

    return tokens;
}




// Pre-process grammar patterns for token matching (exact matches only)
const grammarLevelMap = new Map<string, string>();
jaGrammarPatterns.forEach(p => {
    // Only map simple patterns (no regex chars, no placeholders)
    // Clean the pattern first
    const clean = p.pattern.replace(/[XYZ～〜]/g, '').replace(/[「」『』（）\[\]]/g, '').trim();
    if (clean && !/[XYZ～〜]/.test(p.pattern) && clean.length > 0) {
        // Store both the original and clean version if they are simple words
        grammarLevelMap.set(clean, p.level);
        grammarLevelMap.set(p.pattern, p.level);
    }
});

// Kuromoji tokenizer (lazy-loaded for performance)
let kuromojiTokenizer: KuromojiTokenizer | null = null;
let kuromojiLoading: Promise<KuromojiTokenizer> | null = null;

interface KuromojiToken {
    surface_form: string;
    basic_form: string;
    pos: string;
    pos_detail_1: string;
}

interface KuromojiTokenizer {
    tokenize(text: string): KuromojiToken[];
}

/**
 * Initialize kuromoji tokenizer (lazy loading)
 */
async function getKuromojiTokenizer(): Promise<KuromojiTokenizer> {
    if (kuromojiTokenizer) return kuromojiTokenizer;

    if (kuromojiLoading) return kuromojiLoading;

    kuromojiLoading = (async () => {
        try {
            // Dynamic import for kuromoji
            const [{ TokenizerBuilder }, { default: NodeDictionaryLoader }] = await Promise.all([
                import('@patdx/kuromoji'),
                import('@patdx/kuromoji/node'),
            ]);
            // Construct dictionary path from node_modules
            const path = await import('path');
            const dictPath = path.join(process.cwd(), 'node_modules', '@patdx', 'kuromoji', 'dict');
            const loader = new NodeDictionaryLoader({ dic_path: dictPath });
            const builder = new TokenizerBuilder({ loader });
            const tokenizer = await builder.build();
            kuromojiTokenizer = tokenizer as KuromojiTokenizer;
            return kuromojiTokenizer;
        } catch (err) {
            console.error('Failed to initialize kuromoji:', err);
            throw err;
        }
    })();

    return kuromojiLoading;
}

// TinySegmenter instance (lazy-loaded)
let tinySegmenterInstance: TinySegmenter | null = null;

function getTinySegmenter(): TinySegmenter {
    if (!tinySegmenterInstance) {
        tinySegmenterInstance = new TinySegmenter();
    }
    return tinySegmenterInstance;
}

// budoux parser (lazy-loaded)
let budouxParser: ReturnType<typeof loadDefaultJapaneseParser> | null = null;

function getBudouxParser() {
    if (!budouxParser) {
        budouxParser = loadDefaultJapaneseParser();
    }
    return budouxParser;
}

/**
 * Tokenize Japanese using TinySegmenter (lightweight, less accurate)
 */
function tokenizeWithTinySegmenter(text: string, dict: Map<string, string>): TokenInfo[] {
    const segmenter = getTinySegmenter();
    const segments = segmenter.segment(text);

    return segments
        .filter(seg => seg.trim().length > 0)
        .map(segment => {
            const level = dict.get(segment) || customDictionary[segment];

            // Check LLM rules
            let finalLevel = level;
            if (!finalLevel) {
                const llmRules = getLLMRulesSync();
                const llmEntry = llmRules.vocab[segment];
                if (llmEntry?.level) {
                    finalLevel = llmEntry.level;
                }
            }

            // Simple heuristic for content word detection (has kanji or katakana)
            const hasKanji = /[\u4e00-\u9faf]/.test(segment);
            const hasKatakana = /[\u30a0-\u30ff]/.test(segment);
            const isHiraganaOnly = /^[\u3040-\u309f]+$/.test(segment);
            const isContentWord = hasKanji || hasKatakana || (isHiraganaOnly && segment.length >= 3);

            // Check grammar rules for non-content words
            let grammarLevel: string | undefined;
            if (!isContentWord) {
                grammarLevel = grammarLevelMap.get(segment);
                if (!grammarLevel) {
                    const llmRules = getLLMRulesSync();
                    const llmGrammarEntry = llmRules.grammar[segment];
                    if (llmGrammarEntry?.level) {
                        grammarLevel = llmGrammarEntry.level;
                    }
                }
                // Fallback: try vocabulary dictionary if grammar level not found
                if (!grammarLevel) {
                    const vocabLevel = dict.get(segment);
                    if (vocabLevel) {
                        grammarLevel = vocabLevel;
                    }
                }
            }

            let levelLabel: string;
            if (!isContentWord) {
                levelLabel = grammarLevel ? `grammar (${grammarLevel})` : 'grammar';
            } else if (finalLevel) {
                levelLabel = finalLevel;
            } else {
                levelLabel = 'unknown';
            }

            return {
                token: segment,
                lemma: segment, // TinySegmenter doesn't provide lemmas
                pos: isContentWord ? 'Content' : 'Function',
                originalLevel: levelLabel,
                broadCEFR: (isContentWord && finalLevel) ? mapToBroadCEFR(finalLevel, 'ja') : 'unknown',
                isContentWord,
            };
        });
}

/**
 * Tokenize Japanese using budoux (Google ML-based, better for modern Japanese)
 */
function tokenizeWithBudoux(text: string, dict: Map<string, string>): TokenInfo[] {
    const parser = getBudouxParser();
    const segments = parser.parse(text);

    return segments
        .filter(seg => seg.trim().length > 0)
        .map(segment => {
            const level = dict.get(segment) || customDictionary[segment];

            // Check LLM rules
            let finalLevel = level;
            if (!finalLevel) {
                const llmRules = getLLMRulesSync();
                const llmEntry = llmRules.vocab[segment];
                if (llmEntry?.level) {
                    finalLevel = llmEntry.level;
                }
            }

            // Heuristic for content word detection
            const hasKanji = /[\u4e00-\u9faf]/.test(segment);
            const hasKatakana = /[\u30a0-\u30ff]/.test(segment);
            const isHiraganaOnly = /^[\u3040-\u309f]+$/.test(segment);
            const isContentWord = hasKanji || hasKatakana || (isHiraganaOnly && segment.length >= 3);

            // Check grammar rules
            let grammarLevel: string | undefined;
            if (!isContentWord) {
                grammarLevel = grammarLevelMap.get(segment);
                if (!grammarLevel) {
                    const llmRules = getLLMRulesSync();
                    const llmGrammarEntry = llmRules.grammar[segment];
                    if (llmGrammarEntry?.level) {
                        grammarLevel = llmGrammarEntry.level;
                    }
                }
                // Fallback: try vocabulary dictionary if grammar level not found
                if (!grammarLevel) {
                    const vocabLevel = dict.get(segment);
                    if (vocabLevel) {
                        grammarLevel = vocabLevel;
                    }
                }
            }

            let levelLabel: string;
            if (!isContentWord) {
                levelLabel = grammarLevel ? `grammar (${grammarLevel})` : 'grammar';
            } else if (finalLevel) {
                levelLabel = finalLevel;
            } else {
                levelLabel = 'unknown';
            }

            return {
                token: segment,
                lemma: segment, // budoux doesn't provide lemmas
                pos: isContentWord ? 'Content' : 'Function',
                originalLevel: levelLabel,
                broadCEFR: (isContentWord && finalLevel) ? mapToBroadCEFR(finalLevel, 'ja') : 'unknown',
                isContentWord,
            };
        });
}

/**
 * Map language-specific levels to BroadCEFR
 */
function mapToBroadCEFR(level: string, lang: SupportedLang): BroadCEFR | 'unknown' {
    if (!level) return 'unknown';

    const upperLevel = level.toUpperCase();

    switch (lang) {
        case 'en':
            if (upperLevel === 'A1' || upperLevel === 'A2') return 'A1_A2';
            if (upperLevel === 'B1' || upperLevel === 'B2') return 'B1_B2';
            if (upperLevel === 'C1' || upperLevel === 'C2') return 'C1_plus';
            break;

        case 'ja':
            if (upperLevel === 'N5' || upperLevel === 'N4') return 'A1_A2';
            if (upperLevel === 'N3') return 'B1_B2';
            if (upperLevel === 'N2' || upperLevel === 'N1') return 'C1_plus';
            break;

        case 'zh':
            const hskMatch = upperLevel.match(/HSK(\d+)/);
            if (hskMatch) {
                const hskLevel = parseInt(hskMatch[1]);
                if (hskLevel <= 2) return 'A1_A2';
                if (hskLevel <= 4) return 'B1_B2';
                return 'C1_plus';
            }
            break;
    }

    return 'unknown';
}

/**
 * Tokenize English using compromise.js with lemmatization
 */
function tokenizeEnglish(text: string, dict: Map<string, string>): TokenInfo[] {
    const doc = nlp(text);
    const tokens: TokenInfo[] = [];

    // Get all terms from the document
    doc.terms().forEach((term) => {
        const termData = term.json()[0];
        if (!termData) return;

        const surface = termData.text?.toLowerCase() || '';
        // Get lemma (root form)
        const lemma = termData.root || termData.normal || surface;
        const tags = termData.tags || [];

        // Skip empty tokens and punctuation
        if (!surface || surface.match(/^[^\w]+$/)) return;

        // Determine POS from tags
        let pos = 'Unknown';
        let isContentWord = false;

        if (tags.includes('Verb')) { pos = 'Verb'; isContentWord = true; }
        else if (tags.includes('Noun')) { pos = 'Noun'; isContentWord = true; }
        else if (tags.includes('Adjective')) { pos = 'Adjective'; isContentWord = true; }
        else if (tags.includes('Adverb')) { pos = 'Adverb'; isContentWord = true; }
        else if (tags.includes('Preposition')) pos = 'Preposition';
        else if (tags.includes('Conjunction')) pos = 'Conjunction';
        else if (tags.includes('Pronoun')) pos = 'Pronoun';
        else if (tags.includes('Determiner')) pos = 'Determiner';

        // Look up in dictionary (try lemma first, then surface)
        let originalLevel = dict.get(lemma.toLowerCase());
        if (!originalLevel) {
            originalLevel = dict.get(surface);
        }

        const broadCEFR = isContentWord
            ? (originalLevel ? mapToBroadCEFR(originalLevel, 'en') : 'unknown')
            : 'unknown';

        tokens.push({
            token: surface,
            lemma: lemma.toLowerCase(),
            pos,
            originalLevel: isContentWord ? (originalLevel || 'unknown') : 'grammar',
            broadCEFR,
            isContentWord,
        });
    });

    return tokens;
}

/**
 * Normalize Japanese text before tokenization
 * - Fix common Chinese characters mixed in (对→対, etc.)
 * - Handle ellipsis and special punctuation to prevent token merging
 */
function normalizeJapaneseText(text: string): string {
    // Fix common Chinese characters that get mixed in
    const chineseToJapanese: Record<string, string> = {
        '对': '対', '为': '為', '这': 'これ', '那': 'あれ',
    };

    let normalized = text;
    for (const [cn, jp] of Object.entries(chineseToJapanese)) {
        normalized = normalized.replace(new RegExp(cn, 'g'), jp);
    }

    // Normalize ellipsis and special punctuation - add space to prevent token merging
    normalized = normalized
        .replace(/…+/g, '。')           // Ellipsis to period
        .replace(/\.{3,}/g, '。')       // Multiple dots to period
        .replace(/[\r\n]+/g, '。')       // Newlines to period
        .trim();

    return normalized;
}

/**
 * Check if a token is a proper noun (names, titles with さん/ちゃん/くん)
 * Simplified: only use POS tags and honorific suffixes.
 * Unknown katakana words will be marked as "unknown" for LLM to assign level later.
 */
function isProperNoun(surface: string, posDetail: string): boolean {
    // POS indicates proper noun - this is reliable from kuromoji
    if (posDetail.includes('固有名詞') || posDetail.includes('人名') || posDetail.includes('地名')) {
        return true;
    }

    // Titles with honorific suffixes (e.g., 田中さん, みかちゃん)
    const honorificSuffixes = ['さん', 'ちゃん', 'くん', '君', '様', '先生', '氏'];
    if (honorificSuffixes.some(suffix => surface.endsWith(suffix) && surface.length > suffix.length)) {
        return true;
    }

    // Don't guess based on katakana - just check dictionary
    // Unknown words will be marked as "unknown" and can be filled by LLM
    return false;
}

/**
 * Tokenize Japanese using kuromoji morphological analyzer
 */
async function tokenizeJapaneseAsync(text: string, dict: Map<string, string>): Promise<TokenInfo[]> {
    // Step 1: Normalize text before cleaning
    const normalized = normalizeJapaneseText(text);

    // Step 2: Clean punctuation
    const cleaned = normalized
        .replace(/[\s\u3000]/g, '')
        .replace(/[。、！？「」『』（）\.!?,;:\[\](){}]/g, '');

    if (!cleaned) return [];

    try {
        const tokenizer = await getKuromojiTokenizer();
        const rawTokens = tokenizer.tokenize(cleaned);

        // Post-process tokens to fix common sticking issues (e.g. colloquial contractions)
        const kuromojiTokens: any[] = [];

        for (const t of rawTokens) {
            const surface = t.surface_form;

            // Fix: ゃいけないのそんなに -> なきゃいけない + の + そんなに
            // This handles the specific case where "なきゃ" (must) gets stuck with following words
            if (surface.includes('ゃいけない') && surface.includes('そんなに')) {
                // Split into 3 parts: ...なきゃいけない / の / そんなに
                // We reconstruct reasonable token objects for them

                // Part 1: ...なきゃいけない (Grammar block)
                kuromojiTokens.push({
                    surface_form: 'なきゃいけない',
                    basic_form: 'なければならない',
                    pos: '動詞',
                    pos_detail_1: '非自立',
                });

                // Part 2: の (Particle)
                if (surface.includes('の')) {
                    kuromojiTokens.push({
                        surface_form: 'の',
                        basic_form: 'の',
                        pos: '助詞',
                        pos_detail_1: '終助詞',
                    });
                }

                // Part 3: そんなに (Adverb)
                kuromojiTokens.push({
                    surface_form: 'そんなに',
                    basic_form: 'そんなに',
                    pos: '副詞',
                    pos_detail_1: '一般',
                });

                continue;
            }

            kuromojiTokens.push(t);
        }

        // Post-process: Merge specific broken tokens
        const mergedTokens: any[] = [];
        for (let i = 0; i < kuromojiTokens.length; i++) {
            const current = kuromojiTokens[i];
            const next = kuromojiTokens[i + 1];

            // Fix 1: "本" + "当" -> "本当"
            if (next && current.surface_form === '本' && next.surface_form === '当') {
                mergedTokens.push({
                    surface_form: '本当',
                    basic_form: '本当',
                    pos: '副詞', // Usually used as adverb or noun
                    pos_detail_1: '一般',
                });
                i++; // Skip next token
                continue;
            }

            // Fix 2: "Sa-hen Noun" + "Suru" -> Single Verb
            // e.g. "利用" (Noun) + "する" (Verb) -> "利用する" (Verb)
            if (next &&
                current.pos === '名詞' &&
                (current.pos_detail_1 === 'サ変接続' || current.pos_detail_1 === '一般') &&
                next.pos === '動詞' &&
                next.basic_form === 'する') {

                // Merge into a single token
                mergedTokens.push({
                    surface_form: current.surface_form + next.surface_form,
                    basic_form: current.basic_form + 'する', // Construct dictionary form
                    pos: '動詞',
                    pos_detail_1: '自立', // Treat as independent verb
                });
                i++; // Skip next token
                continue;
            }

            // Fix 3: Suffix Merging (Noun + Suffix)
            // e.g. "展覧" + "会" -> "展覧会"
            // e.g. "方向" + "性" -> "方向性"
            // e.g. "実験" + "的" -> "実験的"
            const commonSuffixes = ['会', '性', '的', '費', '化', '力', '長'];
            if (next &&
                current.pos === '名詞' &&
                commonSuffixes.includes(next.surface_form)) {

                // Merge into a single token
                mergedTokens.push({
                    surface_form: current.surface_form + next.surface_form,
                    basic_form: current.basic_form + next.surface_form,
                    pos: '名詞', // Treat as noun (or adjective noun for '的')
                    pos_detail_1: '一般',
                });
                i++; // Skip next token
                continue;
            }

            mergedTokens.push(current);
        }

        // Grammar fragments that should NEVER be counted as unknown content words
        // These were identified from database analysis of 396 items
        const grammarFragments = new Set([
            // === Original auxiliary verb endings (助動詞) ===
            'た', 'だ', 'です', 'ます', 'ません', 'ない', 'なかった',
            'たい', 'たくない', 'たかった', 'そう', 'よう', 'らしい', 'みたい',
            // Te-form and connectives
            'て', 'で', 'って', 'ちゃ', 'じゃ',
            // Modal/evidential
            'かも', 'かな', 'だろう', 'でしょう',
            // Copula forms
            'な', 'に',

            // === High-frequency additions from analysis ===
            // Colloquial contractions (top priority - 154+ occurrences)
            'てる',    // ている contracted (154 occurrences)
            'ちゃっ',  // てしまった contracted (15 occurrences)
            'ちゃう',  // てしまう contracted

            // Negative auxiliaries - conjugation forms
            'なく',    // ない adverbial form (40 occurrences)
            'なかっ',  // ない past form (17 occurrences)

            // Honorific/Polite forms
            'ござい',  // ございます stem (98 occurrences)
            'いたし',  // いたします stem (17 occurrences)

            // Common particles not in pattern dictionary
            'けど',    // 126 occurrences
            'とか',    // 23 occurrences
            'くらい',  // 10 occurrences
            'なんて',  // 7 occurrences

            // Common auxiliary forms
            'いる',    // Progressive auxiliary (61 occurrences)
            'でる',    // 出る as auxiliary (15 occurrences)
            'みる',    // てみる auxiliary (22 occurrences)
            'みよ',    // みる volitional (19 occurrences)
            'おき',    // ておく auxiliary (10 occurrences)
            'れる',    // Passive/potential (10 occurrences)
            'もらえる', // Receiving favor potential (8 occurrences)

            // Common suffixes
            'たち',    // Plural suffix (32 occurrences)
            'ため',    // Purpose (22 occurrences)
            'もの',    // Nominalizer (21 occurrences)
            'ほしい',  // Want someone to do (12 occurrences)
            'すぎ',    // Too much / after time

            // Interjections/Fillers (can be ignored for difficulty)
            'ごめん',  // 22 occurrences
            'ねえ',    // 19 occurrences
            'えっ',    // 18 occurrences
            'うーん',  // 8 occurrences
            'ううん',  // No (casual)
            'おお',    // Oh!
            'いや',    // No / well (as interjection)

            // Common greetings and interjections (感動詞)
            'お疲れ様', // Good work (very common)
            'おかえりなさい', // Welcome back
            'ようこそ', // Welcome
            'よいしょ', // Heave-ho
            'いらっしゃい', // Welcome (shop)
            'らっしゃい', // Welcome (casual)

            // Other common particles/endings
            'じゃん',  // Right? (casual)
            'なぁ',    // Emphasis
            'のう',    // Sentence ending (old)
            'えと',    // Filler
            '次に',    // Next (conjunction)
            'ただし',  // However
            'いけ',    // From いける (can do)

            // Keep only grammar-related items, NOT nouns
            // Nouns like 時半, 談, 官, etc. are now in customDictionary
        ]);

        // Level assignments for grammar fragments (for better accuracy)
        // These assign JLPT levels to the grammar fragments above
        const grammarLevelAssignments: Record<string, string> = {
            // Basic grammar (N5)
            'た': 'N5', 'だ': 'N5', 'です': 'N5', 'ます': 'N5',
            'ない': 'N5', 'なかった': 'N5', 'て': 'N5', 'で': 'N5',
            'なく': 'N5', 'なかっ': 'N5',
            'けど': 'N5', 'いる': 'N5', 'てる': 'N5',

            // N4 level grammar
            'たい': 'N4', 'ません': 'N4', 'そう': 'N4',
            'ちゃう': 'N4', 'ちゃっ': 'N4',
            'ござい': 'N4', 'みたい': 'N4',
            'とか': 'N4', 'みる': 'N4', 'みよ': 'N4',
            'ほしい': 'N4', 'もらえる': 'N4', 'れる': 'N4',
            'たち': 'N4',

            // N3 level grammar
            'よう': 'N3', 'らしい': 'N3', 'かも': 'N3',
            'おき': 'N3', 'くらい': 'N3', 'ため': 'N3',
            'いたし': 'N3', 'なんて': 'N3', 'もの': 'N3',
        };

        // Function word POS categories
        const functionWordPOS = ['助詞', '助動詞', '接続詞', '感動詞', 'フィラー', '記号'];

        return mergedTokens.map(t => {
            const surface = t.surface_form;
            const basicForm = t.basic_form !== '*' ? t.basic_form : surface;
            const pos = t.pos || 'Unknown';
            const posDetail = t.pos_detail_1 || '';

            // Step 1: Check if this is a grammar fragment (explicit list)
            const isGrammarFragment = grammarFragments.has(surface);

            // Step 2: Check if this is a function word by POS
            const isFunctionWordPOS = functionWordPOS.some(p => pos.includes(p));

            // Step 3: Check if this is a non-independent word (補助動詞, etc.)
            const isNonIndependent = posDetail.includes('非自立') || posDetail.includes('接尾');

            // Content words: only independent 名詞/動詞/形容詞/形容動詞/副詞/連体詞
            const contentWordPOS = ['名詞', '動詞', '形容詞', '形容動詞', '副詞', '連体詞'];
            const isContentWordPOS = contentWordPOS.some(p => pos.includes(p));

            // Check if this word is in customDictionary (override kuromoji's non-independent classification)
            const isInCustomDict = !!(customDictionary[basicForm] || customDictionary[surface]);

            // A word is content if: (has content word POS AND is independent) OR is in customDictionary
            const isContentWord = (isContentWordPOS && !isNonIndependent && !isGrammarFragment && !isFunctionWordPOS) || isInCustomDict;

            // Step 4: Check if this is a proper noun (names, titles)
            const isPropNoun = isProperNoun(surface, posDetail);

            // Step 5: Dictionary lookup - ALWAYS use basicForm (lemma) first
            let originalLevel: string | undefined;
            if (isContentWord && !isPropNoun) {
                // Check if this is a number (Arabic, Japanese, or mixed) - assign N5
                const isNumeric = /^[0-9０-９一二三四五六七八九十百千万億兆]+$/.test(surface) ||
                    /^[0-9０-９]+[%％時分秒日月年円個人回本枚台件]?$/.test(surface) ||
                    /^第?[0-9０-９一二三四五六七八九十]+[番号回目]?$/.test(surface);
                if (isNumeric) {
                    originalLevel = 'N5';
                }

                // Check custom dictionary first
                if (!originalLevel) {
                    originalLevel = customDictionary[basicForm] || customDictionary[surface];
                }

                // Check LLM-discovered rules (cached from async load)
                if (!originalLevel) {
                    const llmRules = getLLMRulesSync();
                    const llmVocabEntry = llmRules.vocab[basicForm] || llmRules.vocab[surface];
                    if (llmVocabEntry?.level) {
                        originalLevel = llmVocabEntry.level;
                    }
                }

                if (!originalLevel) {
                    // For content words, try lemma first, then surface
                    originalLevel = dict.get(basicForm);
                    if (!originalLevel && basicForm !== surface) {
                        originalLevel = dict.get(surface);
                    }
                }

                // Special handling for merged Sa-hen verbs (e.g. "利用する")
                // If "利用する" is not found, try looking up "利用" (stem)
                if (!originalLevel && basicForm.endsWith('する')) {
                    const stem = basicForm.slice(0, -2); // Remove 'する'
                    originalLevel = dict.get(stem);
                }
            }

            // Determine level label
            let levelLabel: string;
            if (!isContentWord) {
                // Check if it's a known grammar pattern (base dictionary)
                let grammarLevel = grammarLevelMap.get(surface) || grammarLevelMap.get(basicForm);

                // Check our local grammarLevelAssignments (for fragments identified from analysis)
                if (!grammarLevel) {
                    grammarLevel = grammarLevelAssignments[surface] || grammarLevelAssignments[basicForm];
                }

                // Also check LLM-discovered grammar rules (cached from async load)
                if (!grammarLevel) {
                    const llmRules = getLLMRulesSync();
                    const llmGrammarEntry = llmRules.grammar[surface] || llmRules.grammar[basicForm];
                    if (llmGrammarEntry?.level) {
                        grammarLevel = llmGrammarEntry.level;
                    }
                }

                // Fallback: try vocabulary dictionary if grammar level not found
                if (!grammarLevel) {
                    const vocabLevel = dict.get(surface) || dict.get(basicForm);
                    if (vocabLevel) {
                        grammarLevel = vocabLevel;
                    }
                }

                if (grammarLevel) {
                    levelLabel = `grammar (${grammarLevel})`; // e.g. 'grammar (N3)'
                } else {
                    levelLabel = 'grammar'; // Function words and grammar fragments
                }
            } else if (isPropNoun) {
                levelLabel = 'proper_noun'; // Names, titles - not vocabulary
            } else if (originalLevel) {
                levelLabel = originalLevel; // Found in dictionary
            } else {
                levelLabel = 'unknown'; // Content word not in dictionary
            }

            const broadCEFR = (isContentWord && originalLevel)
                ? mapToBroadCEFR(originalLevel, 'ja')
                : 'unknown';

            return {
                token: surface,
                lemma: basicForm,
                pos,
                originalLevel: levelLabel,
                broadCEFR,
                isContentWord,
            };
        }).filter(t => t.token && !t.token.match(/^[\s\u3000]+$/));
    } catch (err) {
        console.error('Kuromoji tokenization failed, falling back to simple tokenizer:', err);
        // Fallback to simple character-based tokenization
        return tokenizeJapaneseFallback(cleaned, dict);
    }
}

/**
 * Fallback Japanese tokenizer (dictionary-based longest match)
 */
function tokenizeJapaneseFallback(text: string, dict: Map<string, string>): TokenInfo[] {
    const tokens: TokenInfo[] = [];
    let i = 0;

    while (i < text.length) {
        let matched = false;

        for (let len = Math.min(6, text.length - i); len >= 1; len--) {
            const candidate = text.slice(i, i + len);
            const level = dict.get(candidate);

            if (level) {
                tokens.push({
                    token: candidate,
                    lemma: candidate,
                    pos: 'Noun', // Assume content word in fallback
                    originalLevel: level,
                    broadCEFR: mapToBroadCEFR(level, 'ja'),
                    isContentWord: true,
                });
                i += len;
                matched = true;
                break;
            }
        }

        if (!matched) {
            const char = text[i];
            tokens.push({
                token: char,
                lemma: char,
                pos: 'Unknown',
                originalLevel: 'unknown',
                broadCEFR: 'unknown',
                isContentWord: true, // Assume content word in fallback
            });
            i++;
        }
    }

    return tokens;
}

/**
 * Tokenize Chinese using jieba
 */
function tokenizeChinese(text: string, dict: Map<string, string>): TokenInfo[] {
    // Clean text
    const cleaned = text
        .replace(/[\s\u3000]/g, '')
        .replace(/[。、！？「」『』（）""''《》【】\.!\?,;:\[\](){}]/g, '');

    if (!cleaned) return [];

    try {
        // Use jieba for tokenization
        const { cut } = require('@node-rs/jieba');
        const words: string[] = cut(cleaned, false);

        return words.map(word => {
            const originalLevel = dict.get(word);
            const broadCEFR = originalLevel ? mapToBroadCEFR(originalLevel, 'zh') : 'unknown';

            return {
                token: word,
                lemma: word, // Chinese doesn't have lemmatization
                pos: 'Noun', // Assume content word for jieba basic mode
                originalLevel: originalLevel || 'unknown',
                broadCEFR,
                isContentWord: true, // jieba basic mode - assume all tokens are content words
            };
        }).filter(t => t.token && t.token.trim());
    } catch (err) {
        console.error('Jieba tokenization failed, falling back to simple tokenizer:', err);
        return tokenizeChineseFallback(cleaned, dict);
    }
}

/**
 * Fallback Chinese tokenizer (dictionary-based longest match)
 */
function tokenizeChineseFallback(text: string, dict: Map<string, string>): TokenInfo[] {
    const tokens: TokenInfo[] = [];
    let i = 0;

    while (i < text.length) {
        let matched = false;

        for (let len = Math.min(4, text.length - i); len >= 1; len--) {
            const candidate = text.slice(i, i + len);
            const level = dict.get(candidate);

            if (level) {
                tokens.push({
                    token: candidate,
                    lemma: candidate,
                    pos: 'Unknown',
                    originalLevel: level,
                    broadCEFR: mapToBroadCEFR(level, 'zh'),
                    isContentWord: true,
                });
                i += len;
                matched = true;
                break;
            }
        }

        if (!matched) {
            const char = text[i];
            tokens.push({
                token: char,
                lemma: char,
                pos: 'Unknown',
                originalLevel: 'unknown',
                broadCEFR: 'unknown',
                isContentWord: true,
            });
            i++;
        }
    }

    return tokens;
}

/**
 * Remove dialogue identifiers (e.g. "A:", "B:", "John:") from the beginning of lines
 */
function removeDialogueIdentifiers(text: string): string {
    // Matches "A:", "B:", "Name:", "Name1:" at start of line
    // Also handles potential whitespace before the identifier
    return text.replace(/^\s*[A-Za-z0-9]+:\s*/gm, '');
}

/**
 * Main analysis function (async for Japanese kuromoji)
 * @param text - Text to analyze
 * @param lang - Language (en, ja, zh)
 * @param jaTokenizer - Japanese tokenizer to use (kuromoji, tinysegmenter, budoux) - default: kuromoji
 * @param jaVocabDict - Japanese vocabulary dictionary to use (default, elzup, tanos) - default: default
 * @param jaGrammarDict - Japanese grammar dictionary to use (yapan, hagoromo) - default: yapan
 */
export async function analyzeLexProfileAsync(
    text: string,
    lang: SupportedLang,
    jaTokenizer: JaTokenizer = 'kuromoji',
    jaVocabDict: JaVocabDict = 'default',
    jaGrammarDict: JaGrammarDict = 'yapan'
): Promise<LexProfileResult> {
    // Step 0: Normalize text by removing dialogue identifiers
    const cleanText = removeDialogueIdentifiers(text);

    // Pre-load LLM rules for Japanese (warms cache for sync access during tokenization)
    if (lang === 'ja') {
        await loadLLMRules();
    }

    // Select dictionary based on language and jaVocabDict parameter
    const dict = lang === 'ja' ? jaVocabDictionaries[jaVocabDict] : dictionaries[lang];
    let tokenInfoList: TokenInfo[];

    switch (lang) {
        case 'en':
            tokenInfoList = tokenizeEnglish(cleanText, dict);
            break;
        case 'ja':
            // Route to selected Japanese tokenizer
            switch (jaTokenizer) {
                case 'tinysegmenter':
                    tokenInfoList = tokenizeWithTinySegmenter(cleanText, dict);
                    break;
                case 'budoux':
                    tokenInfoList = tokenizeWithBudoux(cleanText, dict);
                    break;
                case 'kuromoji':
                default:
                    tokenInfoList = await tokenizeJapaneseAsync(cleanText, dict);
                    break;
            }
            break;
        case 'zh':
            tokenInfoList = tokenizeChinese(cleanText, dict);
            break;
        default:
            tokenInfoList = [];
    }

    if (tokenInfoList.length === 0) {
        return {
            tokens: 0,
            uniqueTokens: 0,
            contentWordCount: 0,
            functionWordCount: 0,
            lexProfile: { A1_A2: 0, B1_B2: 0, C1_plus: 0, unknown: 1 },
            details: { tokenList: [], unknownTokens: [], coverage: 0, grammarTokens: [] },
        };
    }

    // Create punctuation-free text for position matching (same cleanup as tokenization)
    const cleanedForMatching = cleanText
        .replace(/[\s\u3000]/g, '')
        .replace(/[。、！？「」『』（）.!?,;:\[\](){}]/g, '');

    // Convert TokenInfo to KuromojiTokenInfo for POS-aware grammar matching
    // This enables the advanced grammar matcher to use POS information
    const kuromojiTokensForGrammar: KuromojiTokenInfo[] | undefined = (lang === 'ja' && jaTokenizer === 'kuromoji')
        ? tokenInfoList.map(t => ({
            surface_form: t.token,
            basic_form: t.lemma,
            // Map simplified POS to kuromoji-style POS
            pos: t.pos === 'Verb' ? '動詞' :
                t.pos === 'Noun' ? '名詞' :
                    t.pos === 'Adjective' ? '形容詞' :
                        t.pos === 'Adverb' ? '副詞' :
                            t.pos === 'Particle' ? '助詞' :
                                t.pos === 'AuxVerb' ? '助動詞' :
                                    t.isContentWord ? '名詞' : '助詞',
            pos_detail_1: t.isContentWord ? '自立' : '非自立',
        }))
        : undefined;

    // Grammar pattern matching (Japanese only) - with POS-aware matching when available
    const grammarProfile = lang === 'ja'
        ? matchGrammarPatterns(cleanedForMatching, jaGrammarDict, kuromojiTokensForGrammar)
        : undefined;

    // Backfill grammar pattern information to tokens (Japanese only)
    // This updates tokens that are part of compound grammar patterns (e.g., にもかかわらず)
    if (lang === 'ja' && grammarProfile && grammarProfile.patterns.length > 0) {
        tokenInfoList = backfillGrammarPatterns(tokenInfoList, grammarProfile.patterns, cleanedForMatching);
    }

    // Separate content words from function words
    const contentWords = tokenInfoList.filter(t => t.isContentWord);
    const functionWords = tokenInfoList.filter(t => !t.isContentWord);

    // Calculate statistics ONLY on content words
    const unknownContentTokens: string[] = [];
    const grammarTokens = functionWords.map(t => t.token);
    const levelCounts = { A1_A2: 0, B1_B2: 0, C1_plus: 0, unknown: 0 };

    contentWords.forEach(t => {
        if (t.broadCEFR === 'unknown') {
            // Only count as unknown if it's NOT a proper noun
            // (Proper nouns are marked as 'proper_noun' in originalLevel, but broadCEFR might be 'unknown')
            if (t.originalLevel !== 'proper_noun') {
                unknownContentTokens.push(t.token);
                levelCounts.unknown++;
            }
        } else {
            levelCounts[t.broadCEFR]++;
        }
    });

    const total = tokenInfoList.length;
    const uniqueTokens = new Set(tokenInfoList.map(t => t.lemma)).size;
    const contentWordTotal = contentWords.length;
    const knownContentCount = contentWordTotal - levelCounts.unknown;
    const coverage = contentWordTotal > 0 ? knownContentCount / contentWordTotal : 0;

    // grammarProfile was already calculated earlier for backfilling

    // Calculate difficulty summary
    let difficultySummary: LexProfileResult['difficultySummary'];
    if (lang === 'ja') {
        // 1. Vocab Difficulty
        // Find hardest content words (N1 > N2 > N3...)
        const vocabByLevel: Record<string, string[]> = { N1: [], N2: [], N3: [], N4: [], N5: [] };
        contentWords.forEach(t => {
            if (t.originalLevel && t.originalLevel.startsWith('N')) {
                vocabByLevel[t.originalLevel]?.push(t.token);
            }
        });

        let vocabLevel = 'N5';
        let vocabHardest: string[] = [];
        for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
            if (vocabByLevel[level]?.length > 0) {
                vocabLevel = level;
                vocabHardest = Array.from(new Set(vocabByLevel[level])).slice(0, 3);
                break;
            }
        }

        // 2. Grammar Difficulty
        let grammarLevel = 'N5';
        let grammarHardest: string[] = [];
        if (grammarProfile) {
            for (const level of ['N1', 'N2', 'N3', 'N4', 'N5']) {
                if (grammarProfile.byLevel[level] > 0) {
                    grammarLevel = level;
                    grammarHardest = grammarProfile.patterns
                        .filter(p => p.level === level)
                        .map(p => p.pattern)
                        .slice(0, 3);
                    break;
                }
            }
        }

        // 3. Overall Level (Max of vocab and grammar)
        const levelOrder = ['N5', 'N4', 'N3', 'N2', 'N1'];
        const vIndex = levelOrder.indexOf(vocabLevel);
        const gIndex = levelOrder.indexOf(grammarLevel);
        const overallLevel = levelOrder[Math.max(vIndex, gIndex)];

        difficultySummary = {
            vocabLevel,
            vocabHardest,
            grammarLevel,
            grammarHardest,
            overallLevel
        };
    }

    return {
        tokens: total,
        uniqueTokens,
        contentWordCount: contentWords.length,
        functionWordCount: functionWords.length,
        lexProfile: {
            A1_A2: contentWordTotal > 0 ? levelCounts.A1_A2 / contentWordTotal : 0,
            B1_B2: contentWordTotal > 0 ? levelCounts.B1_B2 / contentWordTotal : 0,
            C1_plus: contentWordTotal > 0 ? levelCounts.C1_plus / contentWordTotal : 0,
            unknown: contentWordTotal > 0 ? levelCounts.unknown / contentWordTotal : 0,
        },
        grammarProfile,
        details: {
            tokenList: tokenInfoList,
            unknownTokens: [...new Set(unknownContentTokens)],
            coverage,
            grammarTokens: [...new Set(grammarTokens)],
        },
    };
}

/**
 * Synchronous wrapper (uses simple tokenization for Japanese if kuromoji not ready)
 */
export function analyzeLexProfile(text: string, lang: SupportedLang): LexProfileResult {
    const dict = dictionaries[lang];
    let tokenInfoList: TokenInfo[];

    switch (lang) {
        case 'en':
            tokenInfoList = tokenizeEnglish(text, dict);
            break;
        case 'ja':
            // Use fallback for sync analysis
            const cleanedJa = text.replace(/[\s\u3000。、！？「」『』（）\.!\?,;:\[\](){}]/g, '');
            tokenInfoList = tokenizeJapaneseFallback(cleanedJa, dict);
            break;
        case 'zh':
            tokenInfoList = tokenizeChinese(text, dict);
            break;
        default:
            tokenInfoList = [];
    }

    if (tokenInfoList.length === 0) {
        return {
            tokens: 0,
            uniqueTokens: 0,
            contentWordCount: 0,
            functionWordCount: 0,
            lexProfile: { A1_A2: 0, B1_B2: 0, C1_plus: 0, unknown: 1 },
            details: { tokenList: [], unknownTokens: [], coverage: 0, grammarTokens: [] },
        };
    }

    // Separate content words from function words
    const contentWords = tokenInfoList.filter(t => t.isContentWord);
    const functionWords = tokenInfoList.filter(t => !t.isContentWord);

    const unknownTokens: string[] = [];
    const grammarTokens = functionWords.map(t => t.token);
    const levelCounts = { A1_A2: 0, B1_B2: 0, C1_plus: 0, unknown: 0 };

    contentWords.forEach(t => {
        if (t.broadCEFR === 'unknown') {
            unknownTokens.push(t.token);
            levelCounts.unknown++;
        } else {
            levelCounts[t.broadCEFR]++;
        }
    });

    const total = tokenInfoList.length;
    const uniqueTokens = new Set(tokenInfoList.map(t => t.lemma)).size;
    const contentWordTotal = contentWords.length;
    const knownCount = contentWordTotal - levelCounts.unknown;
    const coverage = contentWordTotal > 0 ? knownCount / contentWordTotal : 0;

    return {
        tokens: total,
        uniqueTokens,
        contentWordCount: contentWords.length,
        functionWordCount: functionWords.length,
        lexProfile: {
            A1_A2: contentWordTotal > 0 ? levelCounts.A1_A2 / contentWordTotal : 0,
            B1_B2: contentWordTotal > 0 ? levelCounts.B1_B2 / contentWordTotal : 0,
            C1_plus: contentWordTotal > 0 ? levelCounts.C1_plus / contentWordTotal : 0,
            unknown: contentWordTotal > 0 ? levelCounts.unknown / contentWordTotal : 0,
        },
        details: {
            tokenList: tokenInfoList,
            unknownTokens: [...new Set(unknownTokens)],
            coverage,
            grammarTokens: [...new Set(grammarTokens)],
        },
    };
}

/**
 * Convert result to database-compatible lex_profile format
 */
export function toLexProfileForDB(result: LexProfileResult): Record<BroadCEFR, number> {
    const known = 1 - result.lexProfile.unknown;

    if (known <= 0) {
        return { A1_A2: 0.33, B1_B2: 0.34, C1_plus: 0.33 };
    }

    return {
        A1_A2: result.lexProfile.A1_A2 / known,
        B1_B2: result.lexProfile.B1_B2 / known,
        C1_plus: result.lexProfile.C1_plus / known,
    };
}

/**
 * Get dictionary size for a language
 * @param lang - Language code
 * @param jaVocabDict - Japanese vocabulary dictionary (only used when lang is 'ja')
 */
export function getDictionarySize(lang: SupportedLang, jaVocabDict: JaVocabDict = 'default'): number {
    if (lang === 'ja') {
        return jaVocabDictionaries[jaVocabDict].size;
    }
    return dictionaries[lang].size;
}



function escapeRegExpLocal(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to align grammar suffix (e.g. extract "ざるを得ない" from "言わざるを得ない")
function alignGrammarSuffix(surface: string, canonical?: string): { start: number, end: number } {
    if (!canonical) return { start: 0, end: surface.length };

    const cleanCanonical = canonical.replace(/[～〜]/g, '');

    // Simple case: Surface ends with canonical (hiragana match)
    if (surface.endsWith(cleanCanonical)) {
        return { start: surface.length - cleanCanonical.length, end: surface.length };
    }

    // Complex case: Kanji in surface, Hiragana in canonical
    // Reverse alignment
    let sIdx = surface.length - 1;
    let cIdx = cleanCanonical.length - 1;

    while (sIdx >= 0 && cIdx >= 0) {
        const sChar = surface[sIdx];
        const cChar = cleanCanonical[cIdx];

        if (sChar === cChar) {
            sIdx--;
            cIdx--;
        } else {
            // Mismatch. Check if sChar is Kanji
            if (isKanji(sChar)) {
                // Assume Kanji matches current Kana. Consume Kanji and Kana.
                sIdx--;
                cIdx--;

                // Check if we need to consume more Kana for this Kanji
                while (cIdx >= 0 && sIdx >= 0) {
                    const nextS = surface[sIdx];
                    const nextC = cleanCanonical[cIdx];

                    if (nextS === nextC) break; // Found sync point
                    if (isKanji(nextS)) break; // Next char is also Kanji, let main loop handle it

                    // nextS is Kana but doesn't match nextC.
                    // So nextC must be part of the previous Kanji.
                    cIdx--;
                }
            } else {
                // Mismatch and NOT Kanji (e.g. Kana mismatch).
                // This implies the stem is different.
                return { start: sIdx + 1, end: surface.length };
            }
        }
    }

    return { start: sIdx + 1, end: surface.length };
}

function isKanji(char: string): boolean {
    return /[\u4e00-\u9faf]/.test(char);
}
