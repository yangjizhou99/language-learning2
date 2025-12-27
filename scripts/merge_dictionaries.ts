
import fs from 'fs';
import path from 'path';

// Define paths
const DATA_DIR = path.join(__dirname, '../src/data');
const VOCAB_DIR = path.join(DATA_DIR, 'vocab');
const GRAMMAR_DIR = path.join(DATA_DIR, 'grammar');

// Vocabulary files
const VOCAB_FILES = [
    { name: 'ja-jlpt.json', priority: 1 },       // Highest priority (Custom/Default)
    { name: 'ja-jlpt-tanos.json', priority: 2 }, // Medium priority
    { name: 'ja-jlpt-elzup.json', priority: 3 }, // Lowest priority
];

// Grammar files
const GRAMMAR_FILES = [
    'ja-grammar-jlpt.json',          // YAPAN
    'ja-grammar-hagoromo-patterns.json', // Hagoromo
    'ja-grammar-dojg.json', // DOJG
    'ja-grammar-nihongo-no-sensei.json', // Nihongo no Sensei
    'ja-grammar-donnatoki.json', // Donnatoki
    'ja-grammar-nihongo-net.json', // NihongoNet
    'ja-grammar-edewakaru.json' // Edewakaru
];

// Output files
const VOCAB_OUTPUT = path.join(VOCAB_DIR, 'ja-jlpt-combined.json');
const GRAMMAR_OUTPUT = path.join(GRAMMAR_DIR, 'ja-grammar-combined.json');

interface GrammarPattern {
    level: string;
    pattern: string;
    source: string;
    definition: string;
    reading?: string;
    canonical?: string;
    compoundPattern?: string;
}

function mergeVocab() {
    console.log('Merging vocabulary...');
    const mergedVocab: Record<string, string> = {};
    const stats = { total: 0, conflicts: 0, new: 0 };

    // Process files in reverse priority order (lowest first) so higher priority overwrites
    const sortedFiles = [...VOCAB_FILES].sort((a, b) => b.priority - a.priority);

    for (const file of sortedFiles) {
        const filePath = path.join(VOCAB_DIR, file.name);
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: File not found: ${filePath}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const vocab = JSON.parse(content) as Record<string, string>;
        const count = Object.keys(vocab).length;
        console.log(`Loaded ${file.name}: ${count} entries`);

        for (const [word, level] of Object.entries(vocab)) {
            if (mergedVocab[word]) {
                stats.conflicts++;
                // Overwrite only if this file has higher priority (lower number)
                // Since we iterate from low priority to high, we always overwrite
                mergedVocab[word] = level;
            } else {
                stats.new++;
                mergedVocab[word] = level;
            }
        }
    }

    stats.total = Object.keys(mergedVocab).length;
    console.log(`Merged vocabulary stats: Total=${stats.total}`);

    fs.writeFileSync(VOCAB_OUTPUT, JSON.stringify(mergedVocab, null, 2), 'utf-8');
    console.log(`Saved merged vocabulary to ${VOCAB_OUTPUT}`);
}

function mergeGrammar() {
    console.log('Merging grammar...');
    const mergedGrammar: GrammarPattern[] = [];
    const seenPatterns = new Set<string>();

    for (const fileName of GRAMMAR_FILES) {
        const filePath = path.join(GRAMMAR_DIR, fileName);
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: File not found: ${filePath}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const patterns = JSON.parse(content) as GrammarPattern[];
        console.log(`Loaded ${fileName}: ${patterns.length} patterns`);

        for (const pattern of patterns) {
            // Normalize pattern for deduplication (remove spaces, etc.)
            // We use the raw pattern string as the unique key for now, 
            // but maybe we should be more aggressive? 
            // For now, simple exact string match deduplication.
            if (!seenPatterns.has(pattern.pattern)) {
                seenPatterns.add(pattern.pattern);
                mergedGrammar.push(pattern);
            }
        }
    }

    console.log(`Merged grammar stats: Total=${mergedGrammar.length}`);

    fs.writeFileSync(GRAMMAR_OUTPUT, JSON.stringify(mergedGrammar, null, 2), 'utf-8');
    console.log(`Saved merged grammar to ${GRAMMAR_OUTPUT}`);
}

function main() {
    try {
        mergeVocab();
        console.log('---');
        mergeGrammar();
        console.log('Done!');
    } catch (error) {
        console.error('Error merging dictionaries:', error);
        process.exit(1);
    }
}

main();
