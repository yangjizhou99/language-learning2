
import fs from 'fs';
import path from 'path';

// Types
interface GrammarPattern {
    pattern: string;
    level: string;
    definition: string;
    canonical: string;
    source?: string;
}

// Paths
const EXTRA_DIR = path.join(__dirname, '../src/data/grammar/sources/extra');
const OUTPUT_FILE = path.join(__dirname, '../src/data/grammar/ja-grammar-extra.json');

// Process Bunpou (bunpou.json)
function processBunpou(filePath: string): GrammarPattern[] {
    if (!fs.existsSync(filePath)) {
        console.warn(`Bunpou file not found at ${filePath}`);
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        // Assuming Bunpou format is array of objects or similar. 
        // Since we don't have the file, we'll try to handle common structures.
        // Adjust this logic based on actual file content if needed.
        const patterns: GrammarPattern[] = [];

        // If it's an array
        const items = Array.isArray(data) ? data : (data.data || data.items || []);

        for (const item of items) {
            // Heuristic mapping
            const pattern = item.grammar || item.pattern || item.title;
            const level = item.jlpt || item.level || 'Unknown';
            const definition = item.meaning || item.english || item.definition || '';

            if (pattern) {
                patterns.push({
                    pattern: pattern,
                    level: level,
                    definition: definition,
                    canonical: pattern,
                    source: 'bunpou'
                });
            }
        }
        return patterns;
    } catch (e) {
        console.error('Error processing Bunpou:', e);
        return [];
    }
}

// Process DoJG (dojg.json)
function processDoJG(filePath: string): GrammarPattern[] {
    if (!fs.existsSync(filePath)) {
        console.warn(`DoJG file not found at ${filePath}`);
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const patterns: GrammarPattern[] = [];

        // Yomichan format is usually [term, reading, tags, rules, score, glossary, sequence, term_tags]
        // But DoJG might be different. Let's assume it's a list of terms.
        const items = Array.isArray(data) ? data : [];

        for (const item of items) {
            // Yomichan term bank entry structure
            if (Array.isArray(item)) {
                const term = item[0];
                const reading = item[1];
                const definition = Array.isArray(item[5]) ? item[5].join('; ') : item[5];

                patterns.push({
                    pattern: term,
                    level: 'Unknown', // DoJG doesn't usually have JLPT levels in this format
                    definition: definition,
                    canonical: term,
                    source: 'DoJG'
                });
            }
        }
        return patterns;
    } catch (e) {
        console.error('Error processing DoJG:', e);
        return [];
    }
}

// Process Nihongo (nihongo.json)
function processNihongo(filePath: string): GrammarPattern[] {
    if (!fs.existsSync(filePath)) {
        console.warn(`Nihongo file not found at ${filePath}`);
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const patterns: GrammarPattern[] = [];

        const items = Array.isArray(data) ? data : (data.grammar || []);

        for (const item of items) {
            const pattern = item.pattern || item.structure;
            const definition = item.meaning || item.explanation;

            if (pattern) {
                patterns.push({
                    pattern: pattern,
                    level: 'Unknown',
                    definition: definition,
                    canonical: pattern,
                    source: 'nihongo'
                });
            }
        }
        return patterns;
    } catch (e) {
        console.error('Error processing Nihongo:', e);
        return [];
    }
}

function main() {
    console.log('Processing extra grammar files...');

    const bunpouPath = path.join(EXTRA_DIR, 'bunpou.json');
    const dojgPath = path.join(EXTRA_DIR, 'dojg.json');
    const nihongoPath = path.join(EXTRA_DIR, 'nihongo.json');

    const bunpouPatterns = processBunpou(bunpouPath);
    const dojgPatterns = processDoJG(dojgPath);
    const nihongoPatterns = processNihongo(nihongoPath);

    console.log(`Found ${bunpouPatterns.length} patterns from Bunpou`);
    console.log(`Found ${dojgPatterns.length} patterns from DoJG`);
    console.log(`Found ${nihongoPatterns.length} patterns from Nihongo`);

    const allPatterns = [...bunpouPatterns, ...dojgPatterns, ...nihongoPatterns];

    // Deduplicate by pattern string
    const uniquePatterns = new Map<string, GrammarPattern>();
    for (const p of allPatterns) {
        if (!uniquePatterns.has(p.pattern)) {
            uniquePatterns.set(p.pattern, p);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify([...uniquePatterns.values()], null, 2));
    console.log(`Saved ${uniquePatterns.size} unique extra patterns to ${OUTPUT_FILE}`);
}

main();
