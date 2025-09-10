// 科大讯飞TTS配置
export function getXunfeiConfig() {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('科大讯飞TTS配置缺失，请检查环境变量：XUNFEI_APP_ID, XUNFEI_API_KEY, XUNFEI_API_SECRET');
  }

  return {
    appId,
    apiKey,
    apiSecret
  };
}
