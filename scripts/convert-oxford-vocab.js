/**
 * Script to convert Oxford 5000 vocabulary CSV to JSON format
 * Run with: node scripts/convert-oxford-vocab.js
 */

const fs = require('fs');
const path = require('path');

// Input files
const oxford3000Path = path.join(__dirname, '../src/data/vocab/oxford_3000_raw.json');
const oxford5000CsvPath = path.join(__dirname, '../src/data/vocab/oxford_5000.csv');

// Output files
const oxford3000OutputPath = path.join(__dirname, '../src/data/vocab/en-oxford-3000.json');
const oxford5000OutputPath = path.join(__dirname, '../src/data/vocab/en-oxford-5000.json');

function parseOxford3000Json() {
    const content = fs.readFileSync(oxford3000Path, 'utf-8');
    const data = JSON.parse(content);
    const results = new Map();

    for (const key of Object.keys(data)) {
        const entry = data[key];
        const word = entry.word?.toLowerCase();
        const cefr = entry.cefr?.toUpperCase();

        if (word && cefr && /^[A-C][12]$/.test(cefr)) {
            if (!results.has(word)) {
                results.set(word, cefr);
            } else {
                // Keep lower level
                const existing = results.get(word);
                if (compareCefr(cefr, existing) < 0) {
                    results.set(word, cefr);
                }
            }
        }
    }

    return results;
}

function parseOxford5000Csv() {
    const content = fs.readFileSync(oxford5000CsvPath, 'utf-8');
    const lines = content.trim().split('\n');
    const results = new Map();

    // Skip header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // CSV format: ,word,type,cefr,...
        const parts = line.split(',');
        const word = parts[1]?.trim().toLowerCase();
        const cefr = parts[3]?.trim().toUpperCase();

        if (word && cefr && /^[A-C][12]$/.test(cefr)) {
            if (!results.has(word)) {
                results.set(word, cefr);
            } else {
                const existing = results.get(word);
                if (compareCefr(cefr, existing) < 0) {
                    results.set(word, cefr);
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

function convertToObject(map) {
    const result = {};
    const sortedKeys = Array.from(map.keys()).sort();
    for (const key of sortedKeys) {
        result[key] = map.get(key);
    }
    return result;
}

function showLevelDistribution(name, obj) {
    const levelCounts = {};
    for (const level of Object.values(obj)) {
        levelCounts[level] = (levelCounts[level] || 0) + 1;
    }
    console.log(`\n${name} level distribution:`);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
        console.log(`  ${level}: ${levelCounts[level] || 0} words`);
    }
}

async function main() {
    console.log('Converting Oxford vocabulary to JSON...\n');

    // Process Oxford 3000
    if (fs.existsSync(oxford3000Path)) {
        const oxford3000Words = parseOxford3000Json();
        const oxford3000Obj = convertToObject(oxford3000Words);
        fs.writeFileSync(oxford3000OutputPath, JSON.stringify(oxford3000Obj, null, 2));
        console.log(`Oxford 3000: ${Object.keys(oxford3000Obj).length} unique words`);
        showLevelDistribution('Oxford 3000', oxford3000Obj);
    } else {
        console.log('Oxford 3000 JSON not found');
    }

    // Process Oxford 5000
    if (fs.existsSync(oxford5000CsvPath)) {
        const oxford5000Words = parseOxford5000Csv();
        const oxford5000Obj = convertToObject(oxford5000Words);
        fs.writeFileSync(oxford5000OutputPath, JSON.stringify(oxford5000Obj, null, 2));
        console.log(`\nOxford 5000: ${Object.keys(oxford5000Obj).length} unique words`);
        showLevelDistribution('Oxford 5000', oxford5000Obj);
    } else {
        console.log('Oxford 5000 CSV not found');
    }

    console.log('\nConversion complete!');
}

main().catch(console.error);
