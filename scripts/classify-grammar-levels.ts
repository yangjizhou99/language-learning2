
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { chatJSON } from '../src/lib/ai/client';

// Interfaces
interface GrammarPattern {
    pattern: string;
    level: string;
    definition: string;
    reading: string;
    source: string;
    canonical?: string;
}

const GRAMMAR_FILE = path.join(__dirname, '../src/data/grammar/ja-grammar-combined.json');

async function classifyBatch(patterns: GrammarPattern[]): Promise<Map<string, string>> {
    const prompt = `
You are a Japanese language expert. Classify the JLPT level (N1, N2, N3, N4, N5) for the following grammar patterns.
If you are unsure, use your best judgment based on complexity and usage.
Return a JSON object where keys are the indices (0 to ${patterns.length - 1}) and values are the JLPT levels (e.g., "N1", "N2").

Patterns to classify:
${patterns.map((p, i) => `${i}. ${p.pattern} (Definition: ${p.definition.substring(0, 100)}...)`).join('\n')}
`;

    try {
        const response = await chatJSON({
            provider: 'deepseek', // Using deepseek as it is cost-effective
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            response_json: true
        });

        const content = response.content;
        const result = JSON.parse(content);

        const classificationMap = new Map<string, string>();
        for (const [index, level] of Object.entries(result)) {
            const idx = parseInt(index);
            if (!isNaN(idx) && idx >= 0 && idx < patterns.length) {
                // Normalize level
                let normalizedLevel = String(level).toUpperCase();
                if (!['N1', 'N2', 'N3', 'N4', 'N5'].includes(normalizedLevel)) {
                    // Try to extract N level if format is weird
                    const match = normalizedLevel.match(/N[1-5]/);
                    if (match) normalizedLevel = match[0];
                    else normalizedLevel = 'Unknown';
                }
                classificationMap.set(patterns[idx].pattern, normalizedLevel);
            }
        }
        return classificationMap;

    } catch (error) {
        console.error('Error classifying batch:', error);
        return new Map();
    }
}

async function main() {
    if (!fs.existsSync(GRAMMAR_FILE)) {
        console.error(`File not found: ${GRAMMAR_FILE}`);
        return;
    }

    const rawData = fs.readFileSync(GRAMMAR_FILE, 'utf-8');
    const grammarData: GrammarPattern[] = JSON.parse(rawData);

    const unknownPatterns = grammarData.filter(p => p.level === 'Unknown');
    console.log(`Found ${unknownPatterns.length} patterns with 'Unknown' level.`);

    if (unknownPatterns.length === 0) {
        console.log('No unknown patterns to classify.');
        return;
    }

    // Process in batches
    const BATCH_SIZE = 20;
    let updatedCount = 0;

    for (let i = 0; i < unknownPatterns.length; i += BATCH_SIZE) {
        const batch = unknownPatterns.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${i / BATCH_SIZE + 1} / ${Math.ceil(unknownPatterns.length / BATCH_SIZE)}...`);

        const classifications = await classifyBatch(batch);

        for (const item of batch) {
            if (classifications.has(item.pattern)) {
                const newLevel = classifications.get(item.pattern);
                if (newLevel && newLevel !== 'Unknown') {
                    item.level = newLevel;
                    updatedCount++;
                }
            }
        }

        // Save progress periodically (optional, but good for long processes)
        // For now, we'll save at the end to avoid partial writes if we crash, 
        // or we could save every few batches. Let's save at the end.

        // Add a small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Updated ${updatedCount} patterns.`);

    // Write back to file
    fs.writeFileSync(GRAMMAR_FILE, JSON.stringify(grammarData, null, 2), 'utf-8');
    console.log(`Saved updated grammar data to ${GRAMMAR_FILE}`);
}

main().catch(console.error);
