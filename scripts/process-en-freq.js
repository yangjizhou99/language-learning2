const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'en_50k.txt');
const outputFile = path.join(__dirname, '../src/lib/nlp/data/frequency-en.json');
const patchFile = path.join(__dirname, '../src/lib/nlp/data/frequency-patch-en.json');

try {
    const data = fs.readFileSync(inputFile, 'utf8');
    const lines = data.split('\n');

    // Create map: word -> rank
    const frequencyMap = {};
    let rank = 1;
    const maxRank = 30000; // Limit to top 30k to keep file size reasonable

    for (const line of lines) {
        if (!line.trim()) continue;

        // Format is "word count"
        const parts = line.trim().split(' ');
        const word = parts[0];

        if (word && !frequencyMap[word]) {
            frequencyMap[word] = rank;
            rank++;
        }

        if (rank > maxRank) break;
    }

    // Write frequency-en.json
    fs.writeFileSync(outputFile, JSON.stringify(frequencyMap), 'utf8');
    console.log(`Successfully wrote ${Object.keys(frequencyMap).length} words to ${outputFile}`);

    // Create empty patch file if not exists
    if (!fs.existsSync(patchFile)) {
        fs.writeFileSync(patchFile, JSON.stringify({}), 'utf8');
        console.log(`Created empty patch file at ${patchFile}`);
    }

} catch (err) {
    console.error('Error processing frequency list:', err);
    process.exit(1);
}
