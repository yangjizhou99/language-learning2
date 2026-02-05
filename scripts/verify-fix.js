// Verify the fix for parseUnits

function shouldSkipPart(part) {
    if (/^\s+$/.test(part)) return true;
    if (/^[，。！？、；：:""''（）【】\s]+$/.test(part)) return true;
    if (/^[ABab][:：]\s*$/i.test(part)) return true;
    if (/^[，。！？、；：:""''（）【】]$/.test(part)) return true;
    return false;
}

// FIXED version
function parseUnits(marked, sentenceAbsStart, sid) {
    const parts = marked.split('*');
    const units = [];
    let offset = 0;

    for (const part of parts) {
        if (part.length > 0) {
            if (shouldSkipPart(part)) {
                // Only increment offset once for skipped parts, then continue
                offset += part.length;
                continue;
            }

            const start = sentenceAbsStart + offset;
            const end = start + part.length;
            units.push({
                span: part,
                start,
                end,
                sid
            });
            // Increment offset after adding the unit
            offset += part.length;
        }
        // Note: Do NOT increment offset here again - it was already done above
    }

    return units;
}

// Test case
const text = `A: That event was a huge success! I'm so proud of our neighborhood.
B: Yeah, seeing everyone come together was amazing. It really changed my view.
C: I agree. Our bonds feel stronger now. What should we do next?`;

console.log('=== Text for reference ===');
console.log('Position 68-85:', JSON.stringify(text.slice(68, 85)));
console.log();

// Simulate what the AI might return
const markedSentence = "B: *Yeah*,* seeing* everyone* come* together* was* amazing*.* It* really* changed* my* view*.";
const sentenceStart = 68;

console.log('=== Testing FIXED parseUnits ===');
const units = parseUnits(markedSentence, sentenceStart, 2);

console.log();
console.log('=== Verification ===');
let allCorrect = true;
units.forEach((u, i) => {
    const extracted = text.slice(u.start, u.end);
    const match = extracted === u.span;
    if (!match) allCorrect = false;
    const status = match ? '✓' : '✗';
    console.log('[' + i + '] ' + status + ' span:"' + u.span + '" vs extracted:"' + extracted + '" (pos ' + u.start + '-' + u.end + ')');
});

console.log();
console.log('All correct:', allCorrect);
