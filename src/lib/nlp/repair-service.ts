import { TokenInfo } from '../recommendation/lexProfileAnalyzer';

export interface RepairAction {
    type: 'split_token' | 'map_colloquial' | 'normalize_text' | 'merge_grammar';
    original: string;
    replacement_tokens?: string[]; // For split
    canonical?: string;            // For map/normalize
    grammar_point?: string;        // For grammar map
    jlpt?: string;                 // For grammar map
    notes?: string;
}

export type RepairTask = 'token_repair' | 'vocab_definition' | 'grammar_analysis';

export interface RepairRequest {
    task: RepairTask;
    text: string;
    tokens: TokenInfo[];
    unknownTokens: string[];
    unrecognizedGrammar?: string[];
}

export interface RepairResponse {
    normalized_text: string;
    repairs: RepairAction[];
    grammar_chunks?: Array<{
        surface: string;
        canonical: string;
        jlpt: string;
    }>;
    vocab_entries?: Array<{
        surface: string;
        reading: string;
        definition: string;
        jlpt: string;
    }>;
    confidence: number;
}

/**
 * Diagnose if the text needs LLM repair
 * Trigger conditions:
 * 1. Long unknown tokens (> 8 chars) which might be stuck tokens
 * 2. High ratio of unknown content words (optional, but we focus on stuck tokens first)
 * 3. Specific patterns like "ゃいけない" that imply broken tokenization
 */
export function diagnoseNeedsRepair(tokens: TokenInfo[]): boolean {
    const unknownTokens = tokens.filter(t => t.broadCEFR === 'unknown' && t.originalLevel !== 'proper_noun');

    // Check for stuck tokens (long unknown strings)
    const hasStuckTokens = unknownTokens.some(t => t.token.length > 8);

    // Check for specific broken patterns that rules might have missed
    const hasBrokenPatterns = tokens.some(t =>
        t.token.includes('ゃいけない') ||
        (t.token.includes('なきゃ') && t.token.length > 5) ||
        (t.token.includes('てる') && t.token.length > 5 && t.pos === 'Unknown')
    );

    // Check for any unknown words or unrecognized grammar (as requested)
    const hasUnknownWords = unknownTokens.length > 0;
    const hasUnrecognizedGrammar = unrecognizedGrammar.length > 0;

    return hasStuckTokens || hasBrokenPatterns || hasUnknownWords || hasUnrecognizedGrammar;
}
