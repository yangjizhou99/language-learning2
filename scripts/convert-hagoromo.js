/**
 * Convert Hagoromo Excel to JSON
 * Run: node scripts/convert-hagoromo.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../src/data/grammar/hagoromo/hagoromo4.1.xlsx');
const outputPath = path.join(__dirname, '../src/data/grammar/ja-grammar-hagoromo.json');

console.log('Reading Hagoromo Excel file...');
const wb = XLSX.readFile(inputPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log(`Total rows: ${rows.length}`);
console.log('Headers:', rows[0]);

// Header mapping (column indices)
const headers = rows[0];
const COL_ID = headers.indexOf('ID');
const COL_PATTERN = headers.indexOf('表示見出し');
const COL_POS = headers.indexOf('品詞分類');
const COL_CATEGORY = headers.indexOf('上位意味カテゴリー');
const COL_MEANING = headers.indexOf('意味');
const COL_MEANING_DETAIL = headers.indexOf('詳しい意味記述');
const COL_MEANING_EN = headers.indexOf('意味英訳');
const COL_LEVEL = headers.indexOf('レベル');
const COL_EXAMPLE = headers.indexOf('例文');

console.log(`Column indices: ID=${COL_ID}, Pattern=${COL_PATTERN}, Level=${COL_LEVEL}`);

// Process data rows (skip header)
const grammarPatterns = [];
for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[COL_PATTERN]) continue;

    const pattern = String(row[COL_PATTERN] || '').trim();
    const level = String(row[COL_LEVEL] || '').trim();
    const meaning = String(row[COL_MEANING] || '').trim();
    const meaningDetail = String(row[COL_MEANING_DETAIL] || '').trim();
    const meaningEn = String(row[COL_MEANING_EN] || '').trim();
    const example = String(row[COL_EXAMPLE] || '').trim();
    const pos = String(row[COL_POS] || '').trim();
    const category = String(row[COL_CATEGORY] || '').trim();

    // Map level to JLPT format
    // Hagoromo uses: 初級前半, 初級後半, 中級前半, 中級後半, 上級前半, 上級後半
    // Map to N5-N1
    let jlptLevel = level;
    if (level === '初級前半') {
        jlptLevel = 'N5';
    } else if (level === '初級後半') {
        jlptLevel = 'N4';
    } else if (level === '中級前半') {
        jlptLevel = 'N4';
    } else if (level === '中級後半') {
        jlptLevel = 'N3';
    } else if (level === '上級前半') {
        jlptLevel = 'N2';
    } else if (level === '上級後半') {
        jlptLevel = 'N1';
    } else if (!level || level === '-' || level === '―') {
        jlptLevel = 'N3'; // Default to N3 for unspecified
    }

    grammarPatterns.push({
        id: row[COL_ID] || i,
        pattern,
        level: jlptLevel,
        originalLevel: level,
        meaning,
        meaningDetail,
        meaningEn,
        pos,
        category,
        example
    });
}

console.log(`Processed ${grammarPatterns.length} grammar patterns`);

// Level distribution
const levelDist = {};
grammarPatterns.forEach(p => {
    levelDist[p.level] = (levelDist[p.level] || 0) + 1;
});
console.log('Level distribution:', levelDist);

// Save to JSON
fs.writeFileSync(outputPath, JSON.stringify(grammarPatterns, null, 2), 'utf8');
console.log(`Saved to ${outputPath}`);

// Also create a simplified version for pattern matching
const simplifiedPath = path.join(__dirname, '../src/data/grammar/ja-grammar-hagoromo-patterns.json');
const simplified = grammarPatterns.map(p => ({
    pattern: p.pattern,
    level: p.level,
    definition: p.meaning || p.meaningEn,
    source: 'hagoromo'
}));
fs.writeFileSync(simplifiedPath, JSON.stringify(simplified, null, 2), 'utf8');
console.log(`Saved simplified patterns to ${simplifiedPath}`);
