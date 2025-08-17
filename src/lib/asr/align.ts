// 规范化 & 对齐评分
export type Lang = "en"|"ja"|"zh";

const PUNCT = /[^\p{Letter}\p{Number}\s]/gu;

export function normalize(s: string, lang: Lang) {
  s = (s || "").trim();
  // 全半角统一 + 去标点 + 小写
  s = s.normalize("NFKC").replace(PUNCT, " ").replace(/\s+/g, " ").toLowerCase();
  return lang === "en" ? s : s; // ja/zh 继续用字符级
}

export function tokenize(s: string, lang: Lang): string[] {
  if (lang === "en") return s.split(/\s+/).filter(Boolean);
  // ja/zh：简单按字符（已 NFKC）
  return Array.from(s.replace(/\s+/g, ""));
}

// Levenshtein 距离
export function editDistance(a: string[], b: string[]) {
  const n = a.length, m = b.length;
  const dp = Array.from({length: n+1}, () => new Array<number>(m+1).fill(0));
  for (let i=0;i<=n;i++) dp[i][0] = i;
  for (let j=0;j<=m;j++) dp[0][j] = j;
  for (let i=1;i<=n;i++){
    for (let j=1;j<=m;j++){
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i-1][j] + 1,
        dp[i][j-1] + 1,
        dp[i-1][j-1] + cost
      );
    }
  }
  return dp[n][m];
}

// 评分指标
export function scorePronunciation(refRaw: string, hypRaw: string, lang: Lang, durationSec?: number) {
  const refN = normalize(refRaw, lang);
  const hypN = normalize(hypRaw, lang);
  const refT = tokenize(refN, lang);
  const hypT = tokenize(hypN, lang);
  const dist = editDistance(refT, hypT);
  const base = Math.max(refT.length, 1);
  const accuracy = Math.max(0, 1 - dist / base); // 0..1
  const coverage = Math.min(1, hypT.length / Math.max(refT.length,1)); // 覆盖度
  const wpm = durationSec ? Math.round((hypT.length / durationSec) * 60) : undefined;

  return {
    accuracy: Math.round(accuracy * 100),    // %
    coverage: Math.round(coverage * 100),    // %
    speed_wpm: wpm,                           // en:词/分钟；ja/zh:字/分钟
  };
}

// 简单句子切分（用于逐句高亮）
export function splitSentences(s: string, lang: Lang): string[] {
  if (lang === "en") return s.split(/(?<=[.!?])\s+/).filter(Boolean);
  // ja/zh：按句号/叹号/问号/顿号/句读
  return s.split(/(?<=[。！？；])/).map(t=>t.trim()).filter(Boolean);
}
