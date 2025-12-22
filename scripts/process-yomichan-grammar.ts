
import fs from 'fs';
import path from 'path';

// Interfaces
interface GrammarPattern {
    pattern: string;
    level: string;
    definition: string;
    reading: string;
    source: string;
    canonical?: string; // Optional canonical form (e.g. dictionary form)
}

// Paths
const BASE_DIR = path.join(__dirname, '../src/data/grammar');
const SOURCES_DIR = path.join(BASE_DIR, 'sources/extra');
const DOJG_PATH = path.join(SOURCES_DIR, 'dojg/term_bank_1.json');
const NIHONGO_PATH = path.join(SOURCES_DIR, 'nihongo_no_sensei/term_bank_1.json');
const DONNATOKI_PATH = path.join(SOURCES_DIR, 'donnatoki/term_bank_1.json');
const NIHONGO_NET_DIR = path.join(SOURCES_DIR, 'nihongo_net');
const EDEWAKARU_DIR = path.join(SOURCES_DIR, 'edewakaru');

const OUTPUT_DOJG = path.join(BASE_DIR, 'ja-grammar-dojg.json');
const OUTPUT_NIHONGO = path.join(BASE_DIR, 'ja-grammar-nihongo-no-sensei.json');
const OUTPUT_DONNATOKI = path.join(BASE_DIR, 'ja-grammar-donnatoki.json');
const OUTPUT_NIHONGO_NET = path.join(BASE_DIR, 'ja-grammar-nihongo-net.json');
const OUTPUT_EDEWAKARU = path.join(BASE_DIR, 'ja-grammar-edewakaru.json');

// Helper to clean text
function cleanText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

// Helper to extract definition from DOJG glossary
function extractDojgDefinition(glossary: any[]): string {
    if (!glossary || glossary.length === 0) return '';

    let text = '';
    if (typeof glossary[0] === 'string') {
        text = glossary[0];
    } else {
        text = JSON.stringify(glossary);
    }

    const meaningMatch = text.match(/\[意味\]\s*([\s\S]*?)(\[|$)/);
    if (meaningMatch) {
        return cleanText(meaningMatch[1]);
    }

    return cleanText(text).substring(0, 150) + '...';
}

// Helper to extract definition from Nihongo no Sensei glossary
function extractNihongoDefinition(glossary: any[]): string {
    if (!glossary || glossary.length === 0) return '';

    const item = glossary[0];
    if (item && item.type === 'structured-content' && Array.isArray(item.content)) {
        let textContent = '';
        let capturing = false;

        for (const node of item.content) {
            if (typeof node === 'string') {
                if (node.includes('意味')) {
                    capturing = true;
                    continue;
                }
                if (capturing) {
                    if (node.includes('解説') || node.includes('例文') || node.includes('接続')) {
                        break;
                    }
                    textContent += node;
                }
            } else if (typeof node === 'object' && node.content && capturing) {
                textContent += node.content;
            }
        }

        if (textContent) {
            return cleanText(textContent);
        }
    }

    return 'See details';
}

// Helper to extract definition from Donnatoki glossary
function extractDonnatokiDefinition(glossary: any[]): string {
    if (!glossary || glossary.length === 0) return '';
    const item = glossary[0];
    if (item && item.type === 'structured-content' && Array.isArray(item.content)) {
        // Donnatoki format: "pattern\nmeaning\n\n ❶ example..."
        let textContent = '';
        for (const node of item.content) {
            if (typeof node === 'string') {
                const lines = node.split('\n');
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.startsWith('❶') || line.startsWith('接続') || line.includes('google.com')) break;
                    if (line) textContent += line + ' ';
                }
            }
        }
        if (textContent) return cleanText(textContent);
    }
    return 'See details';
}

// Helper to extract definition from NihongoNet glossary
function extractNihongoNetDefinition(glossary: any[]): string {
    // NihongoNet format is very similar to Nihongo no Sensei
    return extractNihongoDefinition(glossary);
}

// Helper to extract definition from Edewakaru glossary
function extractEdewakaruDefinition(glossary: any[]): string {
    if (!glossary || glossary.length === 0) return '';
    const item = glossary[0];
    if (item && item.type === 'structured-content' && Array.isArray(item.content)) {
        let textContent = '';
        for (const node of item.content) {
            if (typeof node === 'string') {
                textContent += node;
            } else if (typeof node === 'object' && node.content) {
                textContent += node.content;
            }
        }

        const meaningMatch = textContent.match(/【意味】\s*([\s\S]*?)(\n\n|【|$)/);
        if (meaningMatch) {
            return cleanText(meaningMatch[1]);
        }

        return cleanText(textContent).substring(0, 150) + '...';
    }
    return 'See details';
}

// Helper to map levels
function mapLevel(tag: string): string {
    if (!tag) return 'Unknown';
    if (tag.includes('DOJG基本')) return 'N4';
    if (tag.includes('DOJG中級')) return 'N2';
    if (tag.includes('DOJG上級')) return 'N1';

    if (tag.includes('Ｎ１') || tag.includes('N1')) return 'N1';
    if (tag.includes('Ｎ２') || tag.includes('N2')) return 'N2';
    if (tag.includes('Ｎ３') || tag.includes('N3')) return 'N3';
    if (tag.includes('Ｎ４') || tag.includes('N4')) return 'N4';
    if (tag.includes('Ｎ５') || tag.includes('N5')) return 'N5';

    if (tag.includes('上級')) return 'N1';
    if (tag.includes('中級')) return 'N2';
    if (tag.includes('初級')) return 'N4';

    return 'Unknown';
}

async function processFile(inputPath: string, outputPath: string, sourceName: string, defExtractor: (g: any[]) => string, append: boolean = false) {
    console.log(`Processing ${sourceName} from ${inputPath}...`);

    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        return;
    }

    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const entries: any[] = JSON.parse(rawData);

    let processed: GrammarPattern[] = [];
    if (append && fs.existsSync(outputPath)) {
        const existing = fs.readFileSync(outputPath, 'utf-8');
        processed = JSON.parse(existing);
    }

    for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length < 8) continue;

        const pattern = entry[0];
        const reading = entry[1];
        const glossary = entry[5];
        const tag = entry[7];

        const level = mapLevel(tag);
        const definition = defExtractor(glossary);

        processed.push({
            pattern,
            level,
            definition,
            reading,
            source: sourceName
        });
    }

    fs.writeFileSync(outputPath, JSON.stringify(processed, null, 2), 'utf-8');
    console.log(`Saved ${processed.length} patterns to ${outputPath}`);
}

async function main() {
    // DOJG
    await processFile(DOJG_PATH, OUTPUT_DOJG, 'DOJG', extractDojgDefinition);

    // Nihongo no Sensei
    await processFile(NIHONGO_PATH, OUTPUT_NIHONGO, 'NihongoNoSensei', extractNihongoDefinition);

    // Donnatoki
    await processFile(DONNATOKI_PATH, OUTPUT_DONNATOKI, 'Donnatoki', extractDonnatokiDefinition);

    // NihongoNet (Multiple files)
    if (fs.existsSync(OUTPUT_NIHONGO_NET)) fs.unlinkSync(OUTPUT_NIHONGO_NET);
    if (fs.existsSync(NIHONGO_NET_DIR)) {
        const netFiles = fs.readdirSync(NIHONGO_NET_DIR).filter(f => f.startsWith('term_bank_') && f.endsWith('.json'));
        for (const file of netFiles) {
            await processFile(path.join(NIHONGO_NET_DIR, file), OUTPUT_NIHONGO_NET, 'NihongoNet', extractNihongoNetDefinition, true);
        }
    } else {
        console.log(`NihongoNet directory not found: ${NIHONGO_NET_DIR}`);
    }

    // Edewakaru (Multiple files)
    if (fs.existsSync(OUTPUT_EDEWAKARU)) fs.unlinkSync(OUTPUT_EDEWAKARU);
    if (fs.existsSync(EDEWAKARU_DIR)) {
        const edeFiles = fs.readdirSync(EDEWAKARU_DIR).filter(f => f.startsWith('term_bank_') && f.endsWith('.json'));
        for (const file of edeFiles) {
            await processFile(path.join(EDEWAKARU_DIR, file), OUTPUT_EDEWAKARU, 'Edewakaru', extractEdewakaruDefinition, true);
        }
    } else {
        console.log(`Edewakaru directory not found: ${EDEWAKARU_DIR}`);
    }
}

main().catch(console.error);
