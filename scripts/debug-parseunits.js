// Debug parseUnits logic

function shouldSkipPart(part) {
    // 跳过纯空格
    if (/^\s+$/.test(part)) return true;

    // 跳过纯标点符号（包含中英文标点）
    if (/^[，。！？、；：:""''（）【】\s]+$/.test(part)) return true;

    // 跳过对话标识符（支持中英文冒号，大小写不敏感）
    if (/^[ABab][:：]\s*$/i.test(part)) return true;

    // 跳过单个标点符号（包含中英文标点）
    if (/^[，。！？、；：:""''（）【】]$/.test(part)) return true;

    return false;
}

function parseUnits(marked, sentenceAbsStart, sid) {
    const parts = marked.split('*');
    const units = [];
    let offset = 0;

    console.log('Parsing marked sentence:', marked);
    console.log('Parts after split:', parts);
    console.log();

    for (const part of parts) {
        const shouldSkip = shouldSkipPart(part);
        console.log('Part: "' + part + '", length:' + part.length + ', shouldSkip:' + shouldSkip);

        if (part.length > 0) {
            if (shouldSkip) {
                console.log('  -> Skipping, but adding offset:', part.length);
                offset += part.length;  // First offset increment for skipped parts
                // BUG: offset is not incremented here in the skip case, but...
                // Actually wait, let me check the original code again
            } else {
                const start = sentenceAbsStart + offset;
                const end = start + part.length;
                units.push({
                    span: part,
                    start,
                    end,
                    sid
                });
                console.log('  -> Added unit, offset now:', offset, '-> start:', start, 'end:', end);
            }
        }
        // BUG: This always happens regardless of skip!
        offset += part.length;
        console.log('  -> After loop iteration, offset:', offset);
        console.log();
    }

    return units;
}

// Example: AI returned something like
// "B: *Yeah*,* seeing* everyone* come* together* was* amazing*.*"
// But the actual sentence is "B: Yeah, seeing everyone come together was amazing."

// Let's simulate what the API might have returned:
const markedSentence = "B: *Yeah*,* seeing* everyone* come* together* was* amazing*.";
const sentenceStart = 68;

console.log('=== Simulating parseUnits ===');
const units = parseUnits(markedSentence, sentenceStart, 2);

console.log();
console.log('=== Resulting Units ===');
units.forEach((u, i) => {
    console.log('[' + i + '] span:"' + u.span + '", start:' + u.start + ', end:' + u.end);
});
