/**
 * ACU (最小可理解块) 工具函数
 * 实现句子切分、校验、解析等核心功能
 */

export interface AcuUnit {
  span: string;
  start: number;
  end: number;
  sid: number;
}

export interface AcuResult {
  acu_marked: string;
  units: AcuUnit[];
  sentenceCount: number;
}

export interface SentenceInfo {
  text: string;
  sid: number;
  sentenceAbsStart: number;
}

/**
 * 校验插星号的句子是否合法
 * @param original 原句
 * @param marked 插星号后的句子
 * @returns 是否合法
 */
export function validateMarkedSentence(original: string, marked: string): boolean {
  // 不允许首尾星号
  if (marked.startsWith('*') || marked.endsWith('*')) return false;

  // 不允许连续星号
  if (/\*\*/.test(marked)) return false;

  // 对于对话格式，忽略 A: 和 B: 标识符进行校验
  const isDialogue = /^[AB]:/.test(original);
  if (isDialogue) {
    // 提取对话内容部分（去掉 A: 或 B: 前缀）
    const originalContent = original.replace(/^[AB]:\s*/, '');
    const markedContent = marked.replace(/^[AB]:\s*/, '');

    // 只校验对话内容部分
    return markedContent.replace(/\*/g, '') === originalContent;
  }

  // 去除星号后必须与原句完全一致
  return marked.replace(/\*/g, '') === original;
}

/**
 * 解析带星号的句子为 ACU units 数组
 * @param marked 插星号后的句子
 * @param sentenceAbsStart 句子在全文中的绝对起始位置
 * @param sid 句子编号
 * @returns ACU units 数组
 */
export function parseUnits(marked: string, sentenceAbsStart: number, sid: number): AcuUnit[] {
  const parts = marked.split('*');
  const units: AcuUnit[] = [];
  let offset = 0;

  for (const part of parts) {
    if (part.length > 0) {
      // 过滤掉不需要的块
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

/**
 * 判断是否应该跳过某个分块
 * @param part 分块内容
 * @returns 是否跳过
 */
function shouldSkipPart(part: string): boolean {
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

/**
 * 按语言规则切分句子
 * @param text 文本
 * @param lang 语言
 * @param genre 体裁
 * @returns 句子信息数组
 */
export function splitSentences(text: string, lang: 'zh' | 'en' | 'ja' | 'ko', genre?: string): SentenceInfo[] {
  if (!text.trim()) return [];

  // 统一换行符
  const src = text.replace(/\r\n?/g, '\n');

  // 轻量对话检测：当 genre 为 dialogue，或文本中出现 A:/B: 等说话人标记（即使没有换行）
  const hasDialogueMarkers = /(?:^|\n)\s*[A-Za-zＡ-Ｚ][:：]\s*/.test(src) || /\s+[ABab][:：]\s*/.test(src);
  const treatAsDialogue = genre === 'dialogue' || hasDialogueMarkers;

  if (treatAsDialogue) {
    const sentences: SentenceInfo[] = [];
    let sid = 1;

    // 若已有换行，优先按行；否则按说话人标记切分
    const lines = src.includes('\n')
      ? src.split('\n').map((l) => l.trim()).filter(Boolean)
      : (() => {
        const indices: number[] = [];
        // 改进对话标记检测：支持 A: 和 B: 格式（大小写不敏感）
        const re = /[ABab][:：]\s*/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src)) !== null) {
          indices.push(m.index);
        }
        if (indices.length === 0) return [src.trim()];
        const arr: string[] = [];
        for (let i = 0; i < indices.length; i++) {
          const start = indices[i];
          const end = i + 1 < indices.length ? indices[i + 1] : src.length;
          const seg = src.slice(start, end).trim();
          if (seg) arr.push(seg);
        }
        return arr;
      })();

    // 计算每行在原文中的绝对位置
    let cursor = 0;
    for (const line of lines) {
      // 在原文中查找该行的首次出现位置（从 cursor 开始，避免重复命中）
      const pos = src.indexOf(line, cursor);
      const sentenceAbsStart = pos !== -1 ? pos : cursor;
      sentences.push({ text: line, sid: sid++, sentenceAbsStart });
      cursor = sentenceAbsStart + line.length + 1; // 近似推进；+1 兼容换行
    }
    return sentences;
  }

  // 非对话体裁：按语言标点分句
  const sentences: SentenceInfo[] = [];
  let sid = 1;

  if (lang === 'zh') {
    // 中文：兼容全角/半角标点
    const pattern = /[。！？；.!?]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(src)) !== null) {
      const matchEnd = match.index + match[0].length;
      const raw = src.slice(lastIndex, matchEnd);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
      lastIndex = matchEnd;
    }

    if (lastIndex < src.length) {
      const raw = src.slice(lastIndex);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
    }
  } else if (lang === 'en') {
    // 英文：按 . ! ? 分句
    const pattern = /[.!?]+(?=\s|$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(src)) !== null) {
      const matchEnd = match.index + match[0].length;
      const raw = src.slice(lastIndex, matchEnd);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
      lastIndex = matchEnd;
    }

    if (lastIndex < src.length) {
      const raw = src.slice(lastIndex);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
    }
  } else if (lang === 'ja' || lang === 'ko') {
    // 日/韩：兼容全角与半角句末标点
    const pattern = /[。．\.？！!?]+/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(src)) !== null) {
      const matchEnd = match.index + match[0].length;
      const raw = src.slice(lastIndex, matchEnd);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
      lastIndex = matchEnd;
    }

    if (lastIndex < src.length) {
      const raw = src.slice(lastIndex);
      const trimmed = raw.trim();
      if (trimmed) {
        const trimStartDelta = raw.length - raw.trimStart().length;
        const sentenceAbsStart = lastIndex + trimStartDelta;
        sentences.push({ text: trimmed, sid: sid++, sentenceAbsStart });
      }
    }
  }

  return sentences;
}

/**
 * 构建 S1 提示词（过度细分）
 * @param lang 语言
 * @param sentence 原句
 * @returns 提示词
 */
export function buildS1Prompt(lang: string, sentence: string): string {
  // 处理对话格式，临时移除 A: 和 B: 标识符
  const isDialogue = /^[ABab][:：]\s/.test(sentence);
  let processedSentence = sentence;

  if (isDialogue) {
    const match = sentence.match(/^([ABab][:：])\s*(.*)$/);
    if (match) {
      processedSentence = match[2];
    }
  }

  if (lang === 'en') {
    return `Language: English (${lang})
Original Sentence: "${processedSentence}"

Please insert asterisks * at semantic boundaries within the sentence to create meaningful Learning Units (ACUs). 
Requirements:
1. Divide strictly into semantic chunks (phrases, clauses, idioms).
2. DO NOT split strictly by single words unless the word stands alone meaningfully.
3. Keep fixed collocations, phrasal verbs, and idioms together (e.g., "look for", "take care of", "in front of").
4. Keep grammatical structures together (e.g., "have been waiting", "would like to").
5. Punctuation can be separate or attached to the adjacent phrase.
6. Asterisks * must ONLY be inserted BETWEEN characters (usually spaces). DO NOT modify original text.
7. NO continuous asterisks **.
8. Output ONLY the marked sentence.

Examples:
Original: "I would like to go to the supermarket with my friend."
Output: "*I would like* to go *to the supermarket* with my friend*."

Original: "She has been working on this project for two years."
Output: "*She has been working* on this project *for two years*."`;
  }

  return `语言: ${lang}
原句: "${processedSentence}"

请在原句中插入星号*作为语义边界，直接产生最终的分块结果。要求：
1. 必须进行细分，不能整句不划分
2. 中文按词或短语划分，如"这个商品"、"价格是多少"、"98元"、"现在有活动"
3. 标点符号可以单独成块，也可以与相邻词汇组合
4. 星号只能插在字符之间，不能插在开头或结尾
5. 不能出现连续的星号**
6. 直接产生语义完整的最小可理解单元，不需要后续合并
7. 输出格式：直接输出插星号后的句子，不要其他内容

示例：
原句: "这个商品的价格是多少？"
输出: "*这个商品的价格*是*多少*？"

原句: "标价是98元，现在有活动。"
输出: "*标价是98元*，*现在有活动*。"`;
}

/**
 * 构建 S2 提示词（最小化合并）
 * @param markedSentence 来自S1的插星号句子
 * @returns 提示词
 */
export function buildS2Prompt(markedSentence: string): string {
  return `过度细分版: "${markedSentence}"

请移除不必要的星号，只保留最小可理解单元边界。要求：
1. 合并过度细分的部分，如"这*个*商*品"合并为"这个商品"
2. 保持有意义的语义边界，如"这个商品*的*价格"
3. 对话格式"A:"、"B:"保持完整，不要对标识符进行细分
4. 数字、标点符号保持完整
5. 如果整句没有星号，需要添加合理的语义边界
6. 输出格式：直接输出调整后的句子，不要其他内容`;
}

/**
 * 检查文本长度是否超限
 * @param text 文本
 * @param maxLength 最大长度，默认50000
 * @returns 是否超限
 */
export function isTextTooLong(text: string, maxLength: number = 50000): boolean {
  return text.length > maxLength;
}
