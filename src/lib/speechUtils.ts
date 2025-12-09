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
  const langCode =
    {
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
      ko: 'ko-KR',
    }[lang] || 'en-US';

  utterance.lang = langCode;

  // iPad设备韩语语音特殊处理
  const isIPad = /iPad/.test(navigator.userAgent);
  if (lang === 'ko' && isIPad) {
    // iPad韩语优化：保持正常音调
    utterance.rate = options.rate || 0.6;
    utterance.pitch = options.pitch || 1.0; // 正常音调
    utterance.volume = options.volume || 1;
  } else {
    utterance.rate = options.rate || 0.6;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
  }

  // 选择最合适的语音引擎
  const selectBestVoice = () => {
    const voices = window.speechSynthesis.getVoices();

    if (lang === 'ko' && isIPad) {
      // iPad韩语语音引擎选择 - 优先选择女性语音
      const koreanVoices = voices.filter(voice =>
        voice.lang.startsWith('ko') ||
        voice.name.toLowerCase().includes('korean') ||
        voice.name.toLowerCase().includes('korea') ||
        voice.name.toLowerCase().includes('한국어')
      );

      if (koreanVoices.length > 0) {
        // 优先选择女性韩语语音引擎
        const femaleVoices = koreanVoices.filter(voice =>
          voice.name.toLowerCase().includes('female') ||
          voice.name.toLowerCase().includes('woman') ||
          voice.name.toLowerCase().includes('여성') ||
          voice.name.toLowerCase().includes('yuna') ||
          voice.name.toLowerCase().includes('sora') ||
          voice.name.toLowerCase().includes('female')
        );

        if (femaleVoices.length > 0) {
          utterance.voice = femaleVoices[0];
          return;
        }

        // 如果没有女性语音，选择第一个可用的韩语语音
        utterance.voice = koreanVoices[0];
        return;
      }
    }

    if (lang === 'ja') {
      // 对于日语，按优先级选择语音引擎
      const japaneseVoices = voices.filter(
        (voice) =>
          voice.lang.startsWith('ja') ||
          voice.name.toLowerCase().includes('japanese') ||
          voice.name.toLowerCase().includes('japan'),
      );

      if (japaneseVoices.length > 0) {
        // 优先选择本地日语语音引擎，避免使用错误的引擎
        utterance.voice = japaneseVoices[0];
        return;
      }
    }

    // 如果没有找到特定语言的语音，尝试匹配语言代码
    const matchingVoices = voices.filter(
      (voice) => voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0]),
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
  const langCode =
    {
      en: 'en-US',
      ja: 'ja-JP',
      zh: 'zh-CN',
      ko: 'ko-KR',
    }[lang] || 'en-US';

  return voices.filter(
    (voice) =>
      voice.lang === langCode ||
      voice.lang.startsWith(langCode.split('-')[0]) ||
      (lang === 'ja' &&
        (voice.lang.startsWith('ja') ||
          voice.name.toLowerCase().includes('japanese') ||
          voice.name.toLowerCase().includes('japan'))),
  );
};

/**
 * 选择最佳语音引擎并应用到utterance
 * 优先选择女性语音，支持多语言
 * @param utterance SpeechSynthesisUtterance实例
 * @param lang 语言代码 ('en', 'ja', 'zh', 'ko')
 * @param langCode 完整语言代码 (如 'ja-JP', 'zh-CN')
 */
export const selectBestVoiceForUtterance = (
  utterance: SpeechSynthesisUtterance,
  lang: string,
  langCode: string
): void => {
  const voices = window.speechSynthesis.getVoices();
  const nameLower = (name: string) => name.toLowerCase();

  // 通用的女性语音筛选器
  const filterFemaleVoices = (voiceList: SpeechSynthesisVoice[], femaleKeywords: string[]) => {
    return voiceList.filter(voice => {
      const name = nameLower(voice.name);
      return femaleKeywords.some(keyword => name.includes(keyword));
    });
  };

  // 通用的排除男性语音筛选器
  const filterNonMaleVoices = (voiceList: SpeechSynthesisVoice[], maleKeywords: string[]) => {
    return voiceList.filter(voice => {
      const name = nameLower(voice.name);
      return !maleKeywords.some(keyword => name.includes(keyword));
    });
  };

  // 对于日语，优先选择女性日语语音引擎
  if (lang === 'ja') {
    const japaneseVoices = voices.filter(
      (voice) =>
        voice.lang.startsWith('ja') ||
        voice.name.toLowerCase().includes('japanese') ||
        voice.name.toLowerCase().includes('japan'),
    );

    if (japaneseVoices.length > 0) {
      const preferredFemaleVoices = filterFemaleVoices(japaneseVoices, ['kyoko', 'female', 'woman']);
      if (preferredFemaleVoices.length > 0) {
        utterance.voice = preferredFemaleVoices[0];
        return;
      }

      const siriVoices = japaneseVoices.filter(v =>
        nameLower(v.name).includes('siri') && !nameLower(v.name).includes('male')
      );
      if (siriVoices.length > 0) {
        utterance.voice = siriVoices[0];
        return;
      }

      const nonMaleVoices = filterNonMaleVoices(japaneseVoices, ['otoya', 'male', 'man']);
      if (nonMaleVoices.length > 0) {
        utterance.voice = nonMaleVoices[0];
        return;
      }

      utterance.voice = japaneseVoices[0];
      return;
    }
  }

  // 对于中文，优先选择女性中文语音引擎
  if (lang === 'zh') {
    const chineseVoices = voices.filter(
      (voice) =>
        voice.lang.startsWith('zh') ||
        voice.name.toLowerCase().includes('chinese') ||
        voice.name.toLowerCase().includes('mandarin'),
    );

    if (chineseVoices.length > 0) {
      const preferredFemaleVoices = filterFemaleVoices(chineseVoices, ['ting', 'female', 'woman']);
      if (preferredFemaleVoices.length > 0) {
        utterance.voice = preferredFemaleVoices[0];
        return;
      }

      const nonMaleVoices = filterNonMaleVoices(chineseVoices, ['yu-shu', 'male', 'man']);
      if (nonMaleVoices.length > 0) {
        utterance.voice = nonMaleVoices[0];
        return;
      }

      utterance.voice = chineseVoices[0];
      return;
    }
  }

  // 对于韩语，优先选择女性韩语语音引擎
  if (lang === 'ko') {
    const koreanVoices = voices.filter(
      (voice) =>
        voice.lang.startsWith('ko') ||
        voice.name.toLowerCase().includes('korean') ||
        voice.name.toLowerCase().includes('korea') ||
        voice.name.toLowerCase().includes('한국어'),
    );

    if (koreanVoices.length > 0) {
      const preferredFemaleVoices = filterFemaleVoices(koreanVoices, ['yuna', 'sora', 'female', 'woman', '여성']);
      if (preferredFemaleVoices.length > 0) {
        utterance.voice = preferredFemaleVoices[0];
        return;
      }

      const nonMaleVoices = filterNonMaleVoices(koreanVoices, ['male', 'man']);
      if (nonMaleVoices.length > 0) {
        utterance.voice = nonMaleVoices[0];
        return;
      }

      utterance.voice = koreanVoices[0];
      return;
    }
  }

  // 如果没有找到特定语言的语音，尝试匹配语言代码
  const matchingVoices = voices.filter(
    (voice) => voice.lang === langCode || voice.lang.startsWith(langCode.split('-')[0]),
  );

  if (matchingVoices.length > 0) {
    const preferredFemaleVoices = filterFemaleVoices(matchingVoices, ['female', 'woman']);
    if (preferredFemaleVoices.length > 0) {
      utterance.voice = preferredFemaleVoices[0];
      return;
    }

    const nonMaleVoices = filterNonMaleVoices(matchingVoices, ['male', 'man']);
    if (nonMaleVoices.length > 0) {
      utterance.voice = nonMaleVoices[0];
    } else {
      utterance.voice = matchingVoices[0];
    }
  }
};

/**
 * 异步等待语音列表加载并选择最佳语音
 * @param utterance SpeechSynthesisUtterance实例
 * @param lang 语言代码
 * @param langCode 完整语言代码
 * @param onReady 语音选择完成后的回调
 */
export const selectBestVoiceAsync = (
  utterance: SpeechSynthesisUtterance,
  lang: string,
  langCode: string,
  onReady: () => void
): void => {
  const doSelect = () => selectBestVoiceForUtterance(utterance, lang, langCode);

  doSelect();

  if (window.speechSynthesis.getVoices().length === 0) {
    const handleVoicesChanged = () => {
      doSelect();
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      onReady();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    // 备用：如果一段时间后仍然没有加载，直接执行回调
    setTimeout(() => {
      if (window.speechSynthesis.getVoices().length === 0) {
        onReady();
      }
    }, 1000);
  } else {
    onReady();
  }
};
