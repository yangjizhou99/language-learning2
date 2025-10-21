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
    }
    offset += part.length;
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
  if (/^[ABab][:：]$/i.test(part)) return true;
  
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
  
  // 对话体裁：按行分句
  if (genre === 'dialogue') {
    const lines = text.split('\n').filter(line => line.trim());
    const sentences: SentenceInfo[] = [];
    let currentPos = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        sentences.push({
          text: line,
          sid: i + 1,
          sentenceAbsStart: currentPos
        });
        currentPos += line.length + 1; // +1 for newline
      }
    }
    
    return sentences;
  }
  
  // 非对话体裁：按语言标点分句
  const sentences: SentenceInfo[] = [];
  let currentPos = 0;
  let sid = 1;
  
  if (lang === 'zh') {
    // 中文：按 。！？； 分句
    const pattern = /[。！？；]+/g;
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
        currentPos += sentence.length;
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 处理最后一句
    if (lastIndex < text.length) {
      const sentence = text.slice(lastIndex).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
      }
    }
  } else if (lang === 'en') {
    // 英文：按 . ! ? 分句，保留缩写边界
    const pattern = /(?<![A-Za-z])[.!?]+(?=\s|$)/g;
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
        currentPos += sentence.length;
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 处理最后一句
    if (lastIndex < text.length) {
      const sentence = text.slice(lastIndex).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
      }
    }
  } else if (lang === 'ja' || lang === 'ko') {
    // 日韩：按 。？！ 分句
    const pattern = /[。？！]+/g;
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const sentence = text.slice(lastIndex, match.index + match[0].length).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
        currentPos += sentence.length;
      }
      lastIndex = match.index + match[0].length;
    }
    
    // 处理最后一句
    if (lastIndex < text.length) {
      const sentence = text.slice(lastIndex).trim();
      if (sentence) {
        sentences.push({
          text: sentence,
          sid: sid++,
          sentenceAbsStart: currentPos
        });
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
