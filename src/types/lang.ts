export type Lang = 'ja' | 'en' | 'zh' | 'ko'; // UI 语言选项
export function toLocaleCode(lang: Lang | string) {
  if (lang === 'ja') return 'ja-JP';
  if (lang === 'en') return 'en-US';
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ko') return 'ko-KR';
  return lang; // 兼容直接传地区代码
}
export const LANG_LABEL: Record<Lang, string> = {
  ja: '日语',
  en: '英语',
  zh: '中文（普通话）',
  ko: '韩语',
};
