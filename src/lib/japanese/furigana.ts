// 假名与汉字注音对齐工具

export type FuriganaSegment = {
  text: string; // 原文片段
  type: 'kana' | 'kanji';
  rt?: string; // 仅当 type==='kanji' 时提供对应读法（平假名）
};

const HIRAGANA_START = 0x3040;
const HIRAGANA_END = 0x309F;
const KATAKANA_START = 0x30A0;
const KATAKANA_END = 0x30FF;

function isHiragana(ch: string): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0)!;
  return code >= HIRAGANA_START && code <= HIRAGANA_END;
}

function isKatakana(ch: string): boolean {
  if (!ch) return false;
  const code = ch.codePointAt(0)!;
  return code >= KATAKANA_START && code <= KATAKANA_END;
}

function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch);
}

function isKanji(ch: string): boolean {
  // CJK Unified Ideographs 基本区
  return /[\u4E00-\u9FFF]/.test(ch);
}

function katakanaToHiragana(s: string): string {
  // 片假名 -> 平假名（保留促音、小写拗音等相对映射）
  return Array.from(s).map((ch) => {
    if (isKatakana(ch)) {
      const code = ch.codePointAt(0)!;
      // 平假名与片假名相差0x60（大多数字符）
      return String.fromCodePoint(code - 0x60);
    }
    return ch;
  }).join('');
}

export function sanitizeJapaneseReadingToHiragana(reading: string): string {
  if (!reading) return '';
  let r = reading.normalize('NFKC');
  // 去掉空格与连字符
  r = r.replace(/[\s\-‐‑–—―]+/g, '');
  // 移除拉丁字母与数字、标点（仅保留假名与长音符）
  r = r.replace(/[A-Za-z0-9]/g, '');
  r = r.replace(/[。、「」、，．・・!！?？]/g, '');
  // 片假名转平假名
  r = katakanaToHiragana(r);
  // 对于长音符号（ー），在平假名语境下通常忽略
  r = r.replace(/ー/g, '');
  return r;
}

/**
 * 将原文拆分为 kana/kanji 段。
 */
export function splitKanaKanjiSegments(original: string): FuriganaSegment[] {
  const segs: FuriganaSegment[] = [];
  if (!original) return segs;
  const chars = Array.from(original);
  let i = 0;
  while (i < chars.length) {
    const start = i;
    const startIsKanji = isKanji(chars[i]);
    const startIsKana = isKana(chars[i]);
    if (!startIsKanji && !startIsKana) {
      // 其他符号直接按 kana 段处理（不会加 ruby）
      segs.push({ text: chars[i], type: 'kana' });
      i++;
      continue;
    }
    if (startIsKanji) {
      while (i < chars.length && isKanji(chars[i])) i++;
      segs.push({ text: chars.slice(start, i).join(''), type: 'kanji' });
      continue;
    }
    // kana run
    while (i < chars.length && isKana(chars[i])) i++;
    segs.push({ text: chars.slice(start, i).join(''), type: 'kana' });
  }
  return segs;
}

/**
 * 基于“减法锚点”原则，将连续汉字块对齐到读法子串：
 * - 扫描原文：当遇到 kana 作为锚点，在读法中向前查找该锚点，
 *   将读法指针到锚点之间的子串分配给“前一个未赋读法的汉字块”。
 * - 末尾若以汉字块结束，则将读法剩余全部分配给该块。
 */
export function deriveKanjiFuriganaSegments(original: string, readingRaw: string): FuriganaSegment[] {
  const reading = sanitizeJapaneseReadingToHiragana(readingRaw);
  const segs = splitKanaKanjiSegments(original);
  if (!segs.length) return [];

  // 原文中的 kana 也转换为平假名，用于匹配锚点
  const originalKanaNormalized = katakanaToHiragana(Array.from(original).map(ch => (isKana(ch) ? ch : ch)).join(''));

  let readIdx = 0;
  // 记录上一个未分配读法的汉字段索引
  let pendingKanjiIndex: number | null = null;

  // 遍历原文字符，使用 kana 作为锚点推动读法指针
  const originalChars = Array.from(original);
  for (let i = 0; i < originalChars.length; i++) {
    const ch = originalChars[i];
    if (isKana(ch)) {
      const kanaHira = sanitizeJapaneseReadingToHiragana(ch);
      if (!kanaHira) continue;
      // 在 reading[readIdx..] 中寻找第一个等于 kanaHira 的位置
      const remaining = reading.slice(readIdx);
      const anchorPosRel = remaining.indexOf(kanaHira);
      if (anchorPosRel >= 0) {
        const anchorPosAbs = readIdx + anchorPosRel;
        if (pendingKanjiIndex != null) {
          const rt = reading.slice(readIdx, anchorPosAbs);
          if (rt) segs[pendingKanjiIndex] = { ...segs[pendingKanjiIndex], rt };
          pendingKanjiIndex = null;
        }
        // 推进指针越过这个 kana
        readIdx = anchorPosAbs + kanaHira.length;
      } else {
        // 未找到锚点：无法再精确匹配，终止匹配循环
        break;
      }
    } else if (isKanji(ch)) {
      // 标记最近的汉字段为待分配
      // 找到该字符所在的段索引
      let accLen = 0;
      for (let s = 0; s < segs.length; s++) {
        const len = [...segs[s].text].length;
        if (accLen + len > i) {
          if (segs[s].type === 'kanji') pendingKanjiIndex = s;
          break;
        }
        accLen += len;
      }
    }
  }

  // 收尾：若以汉字段结束，分配读法剩余部分
  if (pendingKanjiIndex != null) {
    const tail = reading.slice(readIdx);
    if (tail) segs[pendingKanjiIndex] = { ...segs[pendingKanjiIndex], rt: tail };
  }

  return segs;
}


