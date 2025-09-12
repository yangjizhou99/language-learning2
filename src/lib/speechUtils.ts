/**
 * 语音播放工具函数
 * 解决不同浏览器中语音合成语言检测不准确的问题
 */

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * 播放文本语音
 * @param text 要播放的文本
 * @param lang 语言代码 ('en', 'ja', 'zh')
 * @param options 语音选项
 */
export const speakText = (text: string, lang: string, options: SpeechOptions = {}) => {
  // 检查浏览器是否支持Web Speech API
  if (!('speechSynthesis' in window)) {
    console.warn('浏览器不支持语音合成功能');
    return;
  }

  // 停止当前播放
  window.speechSynthesis.cancel();

  // 创建语音合成实例
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 根据语言设置语音代码
  const langCode = {
    'en': 'en-US',
    'ja': 'ja-JP',
    'zh': 'zh-CN'
  }[lang] || 'en-US';
  
  utterance.lang = langCode;
  utterance.rate = options.rate || 0.8;
  utterance.pitch = options.pitch || 1;
  utterance.volume = options.volume || 1;

  // 选择最合适的语音引擎
  const selectBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    
    if (lang === 'ja') {
      // 对于日语，按优先级选择语音引擎
      const japaneseVoices = voices.filter(voice => 
        voice.lang.startsWith('ja') || 
        voice.name.toLowerCase().includes('japanese') ||
        voice.name.toLowerCase().includes('japan')
      );
      
      if (japaneseVoices.length > 0) {
        // 优先选择本地日语语音引擎，避免使用错误的引擎
        utterance.voice = japaneseVoices[0];
        return;
      }
    }
    
    // 如果没有找到特定语言的语音，尝试匹配语言代码
    const matchingVoices = voices.filter(voice => 
      voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0])
    );
    
    if (matchingVoices.length > 0) {
      utterance.voice = matchingVoices[0];
    }
  };

  // 尝试选择最佳语音引擎
  selectBestVoice();

  // 如果语音列表还没有加载完成，等待加载
  if (window.speechSynthesis.getVoices().length === 0) {
    const handleVoicesChanged = () => {
      selectBestVoice();
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
  }

  // 开始播放
  window.speechSynthesis.speak(utterance);
};

/**
 * 停止当前语音播放
 */
export const stopSpeaking = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * 检查是否支持语音合成
 */
export const isSpeechSynthesisSupported = (): boolean => {
  return 'speechSynthesis' in window;
};

/**
 * 获取可用的语音引擎列表
 */
export const getAvailableVoices = () => {
  if (!('speechSynthesis' in window)) {
    return [];
  }
  return window.speechSynthesis.getVoices();
};

/**
 * 获取特定语言的语音引擎
 */
export const getVoicesForLanguage = (lang: string) => {
  const voices = getAvailableVoices();
  const langCode = {
    'en': 'en-US',
    'ja': 'ja-JP',
    'zh': 'zh-CN'
  }[lang] || 'en-US';

  return voices.filter(voice => 
    voice.lang === langCode || 
    voice.lang.startsWith(langCode.split('-')[0]) ||
    (lang === 'ja' && (
      voice.lang.startsWith('ja') || 
      voice.name.toLowerCase().includes('japanese') ||
      voice.name.toLowerCase().includes('japan')
    ))
  );
};
