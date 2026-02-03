/**
 * Script to convert CEFR-J vocabulary CSV files to JSON format
 * Run with: node scripts/convert-cefrj-vocab.js
 */

const fs = require('fs');
const path = require('path');

// Input files
const cefrjCsvPath = path.join(__dirname, '../src/data/vocab/cefrj-vocabulary-profile-1.5.csv');
const octanoveCsvPath = path.join(__dirname, '../src/data/vocab/octanove-vocabulary-profile-c1c2-1.0.csv');

// Output file
const outputPath = path.join(__dirname, '../src/data/vocab/en-cefr-extended.json');

function parseCsv(content) {
    const lines = content.trim().split('\n');
    const results = new Map();

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV (simple parser, handles basic cases)
        const parts = line.split(',');
        const headword = parts[0]?.trim().toLowerCase();
        const cefr = parts[2]?.trim();

        if (headword && cefr && /^[A-C][12]$/.test(cefr)) {
            // If word already exists, keep the lower level
            if (!results.has(headword)) {
                results.set(headword, cefr);
            } else {
                const existingLevel = results.get(headword);
                if (compareCefr(cefr, existingLevel) < 0) {
                    results.set(headword, cefr);
                }
            }
        }
    }

    return results;
}

function compareCefr(a, b) {
    const order = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
    return (order[a] || 99) - (order[b] || 99);
}

async function main() {
    console.log('Converting CEFR-J vocabulary to JSON...\n');

    const results = new Map();

    // Process CEFR-J vocabulary (A1-B2)
    if (fs.existsSync(cefrjCsvPath)) {
        const cefrjContent = fs.readFileSync(cefrjCsvPath, 'utf-8');
        const cefrjWords = parseCsv(cefrjContent);
        console.log(`CEFR-J vocabulary: ${cefrjWords.size} words`);

        for (const [word, level] of cefrjWords) {
            results.set(word, level);
        }
    } else {
        console.log('CEFR-J CSV not found');
    }

    // Process Octanove C1/C2 vocabulary
    if (fs.existsSync(octanoveCsvPath)) {
        const octanoveContent = fs.readFileSync(octanoveCsvPath, 'utf-8');
        const octanoveWords = parseCsv(octanoveContent);
        console.log(`Octanove C1/C2 vocabulary: ${octanoveWords.size} words`);

        for (const [word, level] of octanoveWords) {
            // Only add if not already in results (don't override A1-B2 with C1/C2)
            if (!results.has(word)) {
                results.set(word, level);
            }
        }
    } else {
        console.log('Octanove CSV not found');
    }

    // Convert to object and sort
    const vocabObject = {};
    const sortedKeys = Array.from(results.keys()).sort();
    for (const key of sortedKeys) {
        vocabObject[key] = results.get(key);
    }

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(vocabObject, null, 2));
    console.log(`\nTotal combined vocabulary: ${Object.keys(vocabObject).length} words`);
    console.log(`Output written to: ${outputPath}`);

    // Show level distribution
    const levelCounts = {};
    for (const level of Object.values(vocabObject)) {
        levelCounts[level] = (levelCounts[level] || 0) + 1;
    }
    console.log('\nLevel distribution:');
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
        console.log(`  ${level}: ${levelCounts[level] || 0} words`);
    }
}

main().catch(console.error);
