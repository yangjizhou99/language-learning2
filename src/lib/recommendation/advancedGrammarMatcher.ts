/**
 * Advanced Grammar Pattern Matcher
 * Supports complex pattern types including:
 * - 〔〕 Semantic placeholders (e.g., 〔否定〕 for negation expressions)
 * - （）Optional parts (e.g., のもと（で）)
 * - ＜＞ Meaning annotations (e.g., に＜対象＞)
 * - ～/〜 Gap wildcards (e.g., ば～ほど)
 * - ＋ Connectors
 * - V/N/A/イA/ナA POS placeholders
 */

// ========================
// Type Definitions
// ========================

/**
 * Parsed grammar rule with matching strategy
 */
export interface ParsedGrammarRule {
    originalPattern: string;
    level: string;
    definition: string;
    source: string;
    ruleType: GrammarRuleType;
    // For simple rules
    literalParts?: string[];
    // For split rules (e.g., ば～ほど)
    prefix?: string;
    suffix?: string;
    // For POS-aware rules
    posRequirements?: POSRequirement[];
    // For semantic rules
    semanticRequirements?: SemanticRequirement[];
    // Matching priority (higher = match first)
    priority: number;
}

export type GrammarRuleType =
    | 'literal'        // Simple string match
    | 'optional'       // With optional parts
    | 'split'          // Gap between parts (ば～ほど)
    | 'pos_prefix'     // POS placeholder before core (Vぬまに)
    | 'pos_suffix'     // POS placeholder after core
    | 'semantic'       // Semantic placeholder rules
    | 'unmatchable';   // Cannot be matched (pure semantic templates)

interface POSRequirement {
    position: 'before' | 'after';
    posType: 'V' | 'N' | 'A' | 'イA' | 'ナA' | 'Vマス' | 'Vて' | 'any';
    // Distance from the core pattern (0 = adjacent)
    maxDistance?: number;
}

interface SemanticRequirement {
    type: '否定' | '条件' | '疑問詞' | '数量' | '意志・希望' | '働きかけ' | '状態性述語' | string;
    position: 'before' | 'after' | 'any';
}

// Kuromoji token structure (for type safety)
export interface KuromojiTokenInfo {
    surface_form: string;
    basic_form: string;
    pos: string;           // e.g., '動詞', '名詞', '形容詞'
    pos_detail_1: string;  // e.g., '自立', '非自立', '接尾'
}

// Match result with position info
export interface GrammarMatchResult {
    pattern: string;
    level: string;
    definition: string;
    matchedText: string;
    startIndex: number;
    endIndex: number;
    matchType: GrammarRuleType;
    confidence: number;  // 0-1, higher = more reliable match

    // For split patterns: separate grammar roots from middle content
    splitParts?: {
        prefix: { text: string; startIndex: number; endIndex: number };
        suffix: { text: string; startIndex: number; endIndex: number };
        middleContent: { text: string; startIndex: number; endIndex: number };
    };
}

// ========================
// Pattern Parsing
// ========================

/**
 * Parse raw grammar patterns into structured rules
 */
export function parseGrammarPattern(raw: {
    pattern: string;
    level: string;
    definition: string;
    source: string;
}): ParsedGrammarRule {
    const { pattern, level, definition, source } = raw;

    // 1. Check for unmatchable patterns (pure semantic templates)
    if (isUnmatchable(pattern)) {
        return {
            originalPattern: pattern,
            level,
            definition,
            source,
            ruleType: 'unmatchable',
            priority: 0,
        };
    }

    // 2. Check for semantic placeholders〔〕(these need special handling)
    if (pattern.includes('〔') && pattern.includes('〕')) {
        return parseSemanticPattern(pattern, level, definition, source);
    }

    // 3. Check for split patterns (～/〜)
    if (/[～〜]/.test(pattern)) {
        return parseSplitPattern(pattern, level, definition, source);
    }

    // 4. Check for POS placeholders (V, N, A at start/end)
    if (/^[VNA]|[VNA]$|^イA|^ナA/.test(pattern)) {
        return parsePOSPattern(pattern, level, definition, source);
    }

    // 5. Check for optional parts （）
    if (pattern.includes('（') && pattern.includes('）')) {
        return parseOptionalPattern(pattern, level, definition, source);
    }

    // 6. Default: literal match (after cleaning annotations ＜＞)
    return parseLiteralPattern(pattern, level, definition, source);
}

/**
 * Check if pattern is unmatchable (pure semantic template)
 */
function isUnmatchable(pattern: string): boolean {
    // Patterns that are mostly placeholders
    const cleaned = pattern
        .replace(/〔[^〕]*〕/g, '')
        .replace(/＜[^＞]*＞/g, '')
        .replace(/[VNA]/g, '')
        .replace(/[～〜＋]/g, '')
        .trim();

    // If very little literal content remains, it's unmatchable
    return cleaned.length < 2;
}

/**
 * Parse semantic placeholder patterns
 */
function parseSemanticPattern(
    pattern: string,
    level: string,
    definition: string,
    source: string
): ParsedGrammarRule {
    // Extract literal parts between semantic placeholders
    const parts = pattern.split(/〔[^〕]*〕/);
    const cleanParts = parts
        .map(p => cleanPatternPart(p))
        .filter(p => p.length >= 1);

    // Extract semantic requirements
    const semanticMatches = pattern.match(/〔([^〕]+)〕/g) || [];
    const semanticRequirements: SemanticRequirement[] = semanticMatches.map(m => {
        const type = m.replace(/[〔〕]/g, '');
        // Determine position based on where it appears
        const idx = pattern.indexOf(m);
        const beforePart = pattern.substring(0, idx);
        const afterPart = pattern.substring(idx + m.length);

        let position: 'before' | 'after' | 'any' = 'any';
        if (beforePart.replace(/〔[^〕]*〕/g, '').trim().length > 0) {
            position = 'after';
        } else if (afterPart.replace(/〔[^〕]*〕/g, '').trim().length > 0) {
            position = 'before';
        }

        return { type, position };
    });

    // If we have at least one usable literal part, try to match
    if (cleanParts.length > 0 && cleanParts.some(p => p.length >= 2)) {
        return {
            originalPattern: pattern,
            level,
            definition,
            source,
            ruleType: 'semantic',
            literalParts: cleanParts,
            semanticRequirements,
            priority: 15 + cleanParts.join('').length, // Higher priority than literal for semantic patterns
        };
    }

    // Otherwise unmatchable
    return {
        originalPattern: pattern,
        level,
        definition,
        source,
        ruleType: 'unmatchable',
        priority: 0,
    };
}

/**
 * Parse split patterns (ば～ほど)
 */
function parseSplitPattern(
    pattern: string,
    level: string,
    definition: string,
    source: string
): ParsedGrammarRule {
    const parts = pattern.split(/[～〜]/);

    if (parts.length === 2) {
        const prefix = cleanPatternPart(parts[0]);
        const suffix = cleanPatternPart(parts[1]);

        // Both parts must be meaningful
        if (prefix.length >= 1 && suffix.length >= 1) {
            return {
                originalPattern: pattern,
                level,
                definition,
                source,
                ruleType: 'split',
                prefix,
                suffix,
                priority: 20 + prefix.length + suffix.length, // Higher priority than literal for split patterns
            };
        }
    }

    // Fallback to literal if split failed
    return parseLiteralPattern(pattern, level, definition, source);
}

/**
 * Parse POS placeholder patterns (Vぬまに, Nずくめ)
 */
function parsePOSPattern(
    pattern: string,
    level: string,
    definition: string,
    source: string
): ParsedGrammarRule {
    const posRequirements: POSRequirement[] = [];
    let cleanedPattern = pattern;

    // Check for POS at start
    const posStartMatch = pattern.match(/^(イA|ナA|Vマス|Vて|[VNA])/);
    if (posStartMatch) {
        posRequirements.push({
            position: 'before',
            posType: posStartMatch[1] as POSRequirement['posType'],
            maxDistance: 0,
        });
        cleanedPattern = cleanedPattern.substring(posStartMatch[1].length);
    }

    // Check for POS at end
    const posEndMatch = cleanedPattern.match(/(イA|ナA|Vマス|Vて|[VNA])$/);
    if (posEndMatch) {
        posRequirements.push({
            position: 'after',
            posType: posEndMatch[1] as POSRequirement['posType'],
            maxDistance: 0,
        });
        cleanedPattern = cleanedPattern.substring(0, cleanedPattern.length - posEndMatch[1].length);
    }

    // Clean remaining pattern
    cleanedPattern = cleanPatternPart(cleanedPattern);

    if (cleanedPattern.length >= 2 && posRequirements.length > 0) {
        return {
            originalPattern: pattern,
            level,
            definition,
            source,
            ruleType: posRequirements[0]?.position === 'before' ? 'pos_prefix' : 'pos_suffix',
            literalParts: [cleanedPattern],
            posRequirements,
            priority: 4 + cleanedPattern.length,
        };
    }

    // Fallback
    return parseLiteralPattern(pattern, level, definition, source);
}

/**
 * Parse optional parts patterns (のもと（で）)
 */
function parseOptionalPattern(
    pattern: string,
    level: string,
    definition: string,
    source: string
): ParsedGrammarRule {
    // Generate variants: with and without optional parts
    const withOptional = pattern.replace(/[（）]/g, '');
    const withoutOptional = pattern.replace(/（[^）]*）/g, '');

    const cleanWith = cleanPatternPart(withOptional);
    const cleanWithout = cleanPatternPart(withoutOptional);

    const literalParts = [cleanWith];
    if (cleanWithout !== cleanWith && cleanWithout.length >= 2) {
        literalParts.push(cleanWithout);
    }

    return {
        originalPattern: pattern,
        level,
        definition,
        source,
        ruleType: 'optional',
        literalParts: literalParts.filter(p => p.length >= 2),
        priority: 6 + cleanWith.length,
    };
}

/**
 * Parse literal patterns (simple string match)
 */
function parseLiteralPattern(
    pattern: string,
    level: string,
    definition: string,
    source: string
): ParsedGrammarRule {
    const cleaned = cleanPatternPart(pattern);

    return {
        originalPattern: pattern,
        level,
        definition,
        source,
        ruleType: 'literal',
        literalParts: cleaned.length >= 2 ? [cleaned] : [],
        priority: cleaned.length >= 2 ? 10 + cleaned.length : 0,
    };
}

/**
 * Clean a pattern part (remove annotations, placeholders, etc.)
 */
function cleanPatternPart(part: string): string {
    return part
        .replace(/＜[^＞]*＞/g, '')     // Remove meaning annotations
        .replace(/〔[^〕]*〕/g, '')     // Remove semantic placeholders
        .replace(/[XYZ]/g, '')         // Remove XYZ placeholders
        .replace(/[「」『』（）\[\]]/g, '') // Remove various brackets
        .replace(/[＋]/g, '')          // Remove connectors
        .replace(/\s+/g, '')           // Remove whitespace
        .trim();
}

// ========================
// Pattern Matching
// ========================

/**
 * Match parsed rules against text with kuromoji tokens
 * @param excludeRanges - Ranges already matched in earlier phases to avoid overlap
 */
export function matchAdvancedGrammar(
    text: string,
    parsedRules: ParsedGrammarRule[],
    kuromojiTokens?: KuromojiTokenInfo[],
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    const results: GrammarMatchResult[] = [];
    // Initialize with any pre-existing exclude ranges (from Phase 0)
    const matchedRanges: Array<{ start: number; end: number }> = excludeRanges ? [...excludeRanges] : [];

    // Sort by priority (higher first)
    const sortedRules = [...parsedRules]
        .filter(r => r.ruleType !== 'unmatchable' && r.priority > 0)
        .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
        const matches = matchRule(text, rule, kuromojiTokens, matchedRanges);

        for (const match of matches) {
            // Check overlap with existing matches
            const overlaps = matchedRanges.some(
                r => match.startIndex < r.end && match.endIndex > r.start
            );

            if (!overlaps) {
                results.push(match);
                matchedRanges.push({ start: match.startIndex, end: match.endIndex });
            }
        }
    }

    return results;
}

/**
 * Match a single rule against text
 */
function matchRule(
    text: string,
    rule: ParsedGrammarRule,
    tokens?: KuromojiTokenInfo[],
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    switch (rule.ruleType) {
        case 'literal':
        case 'optional':
            return matchLiteralRule(text, rule, excludeRanges);

        case 'split':
            return matchSplitRule(text, rule, excludeRanges);

        case 'pos_prefix':
        case 'pos_suffix':
            return matchPOSRule(text, rule, tokens, excludeRanges);

        case 'semantic':
            return matchSemanticRule(text, rule, tokens, excludeRanges);

        default:
            return [];
    }
}

/**
 * Match literal/optional rules
 */
function matchLiteralRule(
    text: string,
    rule: ParsedGrammarRule,
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    const results: GrammarMatchResult[] = [];

    for (const literal of rule.literalParts || []) {
        if (literal.length < 2) continue;

        let searchStart = 0;
        while (true) {
            const idx = text.indexOf(literal, searchStart);
            if (idx === -1) break;

            // Check if in excluded range
            const excluded = excludeRanges?.some(
                r => idx < r.end && (idx + literal.length) > r.start
            );

            if (!excluded) {
                results.push({
                    pattern: rule.originalPattern,
                    level: rule.level,
                    definition: rule.definition,
                    matchedText: literal,
                    startIndex: idx,
                    endIndex: idx + literal.length,
                    matchType: rule.ruleType,
                    confidence: rule.ruleType === 'optional' ? 0.95 : 1.0,
                });
                break; // Only first match per literal
            }

            searchStart = idx + 1;
        }
    }

    return results;
}

/**
 * Match split patterns (ば～ほど)
 * 
 * IMPORTANT: Split patterns require careful validation to avoid false positives.
 * Patterns like は〜が are too generic and should be handled with stricter rules.
 */
function matchSplitRule(
    text: string,
    rule: ParsedGrammarRule,
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    if (!rule.prefix || !rule.suffix) return [];

    // Capture to local const to satisfy TypeScript narrowing
    const prefix = rule.prefix;
    const suffix = rule.suffix;

    // STRICT VALIDATION: Skip patterns that are too short/generic
    // Patterns like は〜が (1 char each) match far too many false positives
    const combinedLength = prefix.length + suffix.length;
    if (combinedLength < 4) {
        // Skip patterns where prefix+suffix is less than 4 chars
        // Examples: は〜が (2), も〜なら (4 - OK)
        return [];
    }

    // Very short prefixes (1 char) are too common, require longer suffix
    if (prefix.length === 1 && suffix.length < 3) {
        return [];
    }

    const prefixIdx = text.indexOf(prefix);
    if (prefixIdx === -1) return [];

    // Look for suffix after prefix
    const suffixSearchStart = prefixIdx + prefix.length;
    const suffixIdx = text.indexOf(suffix, suffixSearchStart);
    if (suffixIdx === -1) return [];

    // Check reasonable distance (stricter now: max 20 chars between prefix and suffix)
    const distance = suffixIdx - (prefixIdx + prefix.length);
    if (distance > 20) return []; // Reduced from 50 to 20

    // CRITICAL: Don't match across sentence boundaries
    const middleContent = text.substring(prefixIdx + prefix.length, suffixIdx);
    const sentenceBreakers = ['。', '！', '？', '\n', '、'];
    const hasSentenceBreak = sentenceBreakers.some(b => middleContent.includes(b));
    if (hasSentenceBreak) return [];

    // Check exclusions
    const excluded = excludeRanges?.some(r =>
        (prefixIdx < r.end && (prefixIdx + prefix.length) > r.start) ||
        (suffixIdx < r.end && (suffixIdx + suffix.length) > r.start)
    );

    if (excluded) return [];

    // Return match covering prefix and suffix, with splitParts for separate analysis
    const fullMatch = text.substring(prefixIdx, suffixIdx + suffix.length);
    const prefixEndIdx = prefixIdx + prefix.length;
    const suffixEndIdx = suffixIdx + suffix.length;

    return [{
        pattern: rule.originalPattern,
        level: rule.level,
        definition: rule.definition,
        matchedText: fullMatch,
        startIndex: prefixIdx,
        endIndex: suffixEndIdx,
        matchType: 'split',
        confidence: 0.85,
        // NEW: Split parts for separate grammar root marking
        splitParts: {
            prefix: {
                text: prefix,
                startIndex: prefixIdx,
                endIndex: prefixEndIdx
            },
            suffix: {
                text: suffix,
                startIndex: suffixIdx,
                endIndex: suffixEndIdx
            },
            middleContent: {
                text: middleContent,
                startIndex: prefixEndIdx,
                endIndex: suffixIdx
            }
        }
    }];
}

/**
 * Match POS-aware patterns (Vぬまに, Nずくめ)
 */
function matchPOSRule(
    text: string,
    rule: ParsedGrammarRule,
    tokens?: KuromojiTokenInfo[],
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    if (!rule.literalParts?.length || !rule.posRequirements?.length) return [];
    if (!tokens || tokens.length === 0) {
        // Fallback to literal match if no tokens available
        return matchLiteralRule(text, rule, excludeRanges);
    }

    const results: GrammarMatchResult[] = [];
    const literal = rule.literalParts[0];

    // Find literal in tokens
    let currentPos = 0;
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const tokenStart = text.indexOf(token.surface_form, currentPos);
        if (tokenStart === -1) continue;
        currentPos = tokenStart + token.surface_form.length;

        // Check if this token contains/starts with the literal
        const literalIdx = token.surface_form.indexOf(literal);
        if (literalIdx !== -1 || token.surface_form === literal ||
            literal.startsWith(token.surface_form) || token.surface_form.startsWith(literal)) {

            // Check POS requirements
            let satisfied = true;
            for (const req of rule.posRequirements) {
                if (req.position === 'before' && i > 0) {
                    const prevToken = tokens[i - 1];
                    if (!matchesPOS(prevToken, req.posType)) {
                        satisfied = false;
                        break;
                    }
                } else if (req.position === 'after' && i < tokens.length - 1) {
                    const nextToken = tokens[i + 1];
                    if (!matchesPOS(nextToken, req.posType)) {
                        satisfied = false;
                        break;
                    }
                }
            }

            if (satisfied) {
                const matchStart = text.indexOf(literal, tokenStart - 5);
                if (matchStart !== -1) {
                    const excluded = excludeRanges?.some(r =>
                        matchStart < r.end && (matchStart + literal.length) > r.start
                    );

                    if (!excluded) {
                        results.push({
                            pattern: rule.originalPattern,
                            level: rule.level,
                            definition: rule.definition,
                            matchedText: literal,
                            startIndex: matchStart,
                            endIndex: matchStart + literal.length,
                            matchType: rule.ruleType,
                            confidence: 0.9,
                        });
                        break;
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Check if token matches POS requirement
 */
function matchesPOS(token: KuromojiTokenInfo, posType: POSRequirement['posType']): boolean {
    const pos = token.pos;
    const posDetail = token.pos_detail_1;

    switch (posType) {
        case 'V':
            return pos === '動詞';
        case 'N':
            return pos === '名詞';
        case 'A':
            return pos === '形容詞' || pos === '形容動詞';
        case 'イA':
            return pos === '形容詞';
        case 'ナA':
            return pos === '形容動詞' || (pos === '名詞' && posDetail === '形容動詞語幹');
        case 'Vマス':
            return pos === '動詞' && token.surface_form.endsWith('ます');
        case 'Vて':
            return pos === '動詞' && token.surface_form.endsWith('て');
        case 'any':
            return true;
        default:
            return false;
    }
}

/**
 * Match semantic placeholder patterns
 */
function matchSemanticRule(
    text: string,
    rule: ParsedGrammarRule,
    tokens?: KuromojiTokenInfo[],
    excludeRanges?: Array<{ start: number; end: number }>
): GrammarMatchResult[] {
    if (!rule.literalParts?.length) return [];

    // First, find literal parts
    const literalMatches = matchLiteralRule(text,
        { ...rule, ruleType: 'literal' },
        excludeRanges
    );

    if (literalMatches.length === 0) return [];

    // Then verify semantic requirements (if tokens available)
    if (!tokens || !rule.semanticRequirements?.length) {
        // Without tokens, just return literal match with lower confidence
        return literalMatches.map(m => ({
            ...m,
            confidence: 0.7, // Lower confidence without semantic verification
        }));
    }

    // Check semantic requirements
    const verifiedMatches: GrammarMatchResult[] = [];

    for (const match of literalMatches) {
        let allSatisfied = true;

        for (const req of rule.semanticRequirements) {
            if (!checkSemanticRequirement(text, tokens, match, req)) {
                allSatisfied = false;
                break;
            }
        }

        if (allSatisfied) {
            verifiedMatches.push({
                ...match,
                matchType: 'semantic',
                confidence: 0.85,
            });
        }
    }

    return verifiedMatches;
}

/**
 * Check semantic requirement against text context
 */
function checkSemanticRequirement(
    text: string,
    tokens: KuromojiTokenInfo[],
    match: GrammarMatchResult,
    req: SemanticRequirement
): boolean {
    // Define patterns for semantic types
    const semanticPatterns: Record<string, RegExp | ((t: KuromojiTokenInfo) => boolean)> = {
        '否定': (t) => t.surface_form.includes('ない') || t.surface_form.includes('ぬ') ||
            t.surface_form.includes('ん') || t.basic_form === 'ない',
        '条件': (t) => t.surface_form.includes('ば') || t.surface_form.includes('たら') ||
            t.surface_form.includes('なら') || t.surface_form.includes('と'),
        '疑問詞': (t) => ['何', 'どこ', 'いつ', 'だれ', '誰', 'どう', 'なぜ', 'どれ', 'どの', 'いくつ', 'いくら']
            .some(q => t.surface_form.includes(q)),
        '数量': (t) => t.pos === '名詞' && (t.pos_detail_1 === '数' || /[0-9０-９]/.test(t.surface_form)),
        '意志・希望': (t) => t.surface_form.includes('たい') || t.surface_form.includes('よう') ||
            t.surface_form.includes('つもり'),
        '働きかけ': (t) => t.pos === '動詞' && !t.surface_form.endsWith('ている'),
        '状態性述語': (t) => t.pos === '形容詞' || t.pos === '形容動詞' ||
            (t.pos === '動詞' && t.surface_form.includes('ている')),
    };

    const checkFn = semanticPatterns[req.type];
    if (!checkFn) return true; // Unknown type, assume satisfied

    // Find tokens in the relevant area
    const matchCenter = (match.startIndex + match.endIndex) / 2;

    // Build position map
    let currentPos = 0;
    for (const token of tokens) {
        const tokenStart = text.indexOf(token.surface_form, currentPos);
        if (tokenStart === -1) continue;
        const tokenEnd = tokenStart + token.surface_form.length;
        currentPos = tokenEnd;

        // Check position requirement
        let inValidPosition = false;
        if (req.position === 'before' && tokenEnd <= match.startIndex) {
            inValidPosition = true;
        } else if (req.position === 'after' && tokenStart >= match.endIndex) {
            inValidPosition = true;
        } else if (req.position === 'any') {
            inValidPosition = true;
        }

        if (inValidPosition) {
            if (typeof checkFn === 'function' && checkFn(token)) {
                return true;
            }
        }
    }

    return false;
}

// ========================
// Pre-processing Cache
// ========================

let cachedParsedRules: ParsedGrammarRule[] | null = null;
let cachedPatternHash: string | null = null;

/**
 * Pre-process grammar patterns (with caching)
 */
export function preprocessGrammarPatterns(
    patterns: Array<{ pattern: string; level: string; definition: string; source: string }>
): ParsedGrammarRule[] {
    // Create hash of patterns for cache invalidation
    const hash = patterns.length.toString() + patterns[0]?.pattern + patterns[patterns.length - 1]?.pattern;

    if (cachedParsedRules && cachedPatternHash === hash) {
        return cachedParsedRules;
    }

    cachedParsedRules = patterns.map(parseGrammarPattern);
    cachedPatternHash = hash;

    return cachedParsedRules;
}

/**
 * Get statistics on parsed rules
 */
export function getParseStats(rules: ParsedGrammarRule[]): Record<GrammarRuleType, number> {
    const stats: Record<GrammarRuleType, number> = {
        literal: 0,
        optional: 0,
        split: 0,
        pos_prefix: 0,
        pos_suffix: 0,
        semantic: 0,
        unmatchable: 0,
    };

    for (const rule of rules) {
        stats[rule.ruleType]++;
    }

    return stats;
}
