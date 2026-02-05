// Debug script to understand the ACU positioning issue

const text = `A: That event was a huge success! I'm so proud of our neighborhood.
B: Yeah, seeing everyone come together was amazing. It really changed my view.
C: I agree. Our bonds feel stronger now. What should we do next?
A: Let's plan more community projects. Maybe a garden or cleanup day?
B: Great idea! I'd love to help organize something.
C: Me too. This feels like just the beginning for us all.`;

console.log('=== Text Analysis ===');
console.log('Text length:', text.length);
console.log();

// Show character positions around line breaks
for (let i = 60; i < 90; i++) {
    const char = text[i];
    const display = char === '\n' ? '\\n' : char;
    console.log('Position ' + i + ': "' + display + '"');
}

console.log();
console.log('=== Split sentences logic simulation ===');

const src = text.replace(/\r\n?/g, '\n');
const lines = src.split('\n').map(l => l.trim()).filter(Boolean);

console.log('Number of lines:', lines.length);

let cursor = 0;
let sid = 1;
for (const line of lines) {
    const pos = src.indexOf(line, cursor);
    const sentenceAbsStart = pos !== -1 ? pos : cursor;
    console.log('Sentence ' + sid + ':');
    console.log('  text: "' + line.substring(0, 30) + '..."');
    console.log('  found at position:', pos);
    console.log('  sentenceAbsStart:', sentenceAbsStart);
    console.log('  line length:', line.length);

    // Verify that text at this position matches
    const extracted = src.slice(sentenceAbsStart, sentenceAbsStart + Math.min(20, line.length));
    console.log('  extracted: "' + extracted + '"');
    console.log();

    cursor = sentenceAbsStart + line.length + 1;
    sid++;
}
