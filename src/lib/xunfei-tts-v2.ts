import { createHmac } from 'crypto';

interface XunfeiVoice {
  voiceId: string;
  displayName: string;
  language: string;
  gender: 'male' | 'female';
  description: string;
}

interface XunfeiTTSConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

// 科大讯飞音色配置
export const XUNFEI_VOICES: XunfeiVoice[] = [
  {
    voiceId: 'x4_xiaoyan',
    displayName: '讯飞小燕',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，自然清晰'
  },
  {
    voiceId: 'x4_yezi',
    displayName: '讯飞小露',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，温柔甜美'
  },
  {
    voiceId: 'aisjiuxu',
    displayName: '讯飞许久',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，沉稳专业'
  },
  {
    voiceId: 'aisjinger',
    displayName: '讯飞小婧',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，活泼可爱'
  },
  {
    voiceId: 'aisbabyxu',
    displayName: '讯飞许小宝',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，年轻活力'
  }
];

// 获取科大讯飞配置
function getXunfeiConfig(): XunfeiTTSConfig {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('科大讯飞TTS配置缺失，请设置XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET环境变量');
  }

  return { appId, apiKey, apiSecret };
}

// 生成WebSocket认证信息 - 基于官方文档的正确实现
function generateAuthUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  const signatureOrigin = `host: tts-api.xfyun.cn\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  const signatureSha = createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorization = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signatureSha}"`;
  
  return `wss://tts-api.xfyun.cn/v2/tts?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=tts-api.xfyun.cn`;
}

// 科大讯飞TTS合成 - 基于官方文档的正确实现
export async function synthesizeXunfeiTTS(
  text: string,
  voiceId: string,
  options: {
    speed?: number;
    volume?: number;
    pitch?: number;
  } = {}
): Promise<Buffer> {
  const config = getXunfeiConfig();
  const { speed = 50, volume = 50, pitch = 50 } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // 动态导入WebSocket模块
      const WebSocket = (await import('ws')).default;
      const url = generateAuthUrl(config.apiKey, config.apiSecret);
      
      console.log('科大讯飞WebSocket URL:', url);
      console.log('科大讯飞配置:', { appId: config.appId, apiKey: config.apiKey.substring(0, 8) + '...' });
      
      const ws = new WebSocket(url);
      const audioChunks: Buffer[] = [];

      ws.on('open', () => {
        console.log('科大讯飞WebSocket连接已建立');
        
        // 发送合成请求
        const request = {
          common: {
            app_id: config.appId
          },
          business: {
            aue: 'raw',
            auf: 'audio/L16;rate=16000',
            vcn: voiceId,
            speed: speed,
            volume: volume,
            pitch: pitch,
            bgs: 0,
            ttp: 1
          },
          data: {
            status: 2,
            text: Buffer.from(text, 'utf8').toString('base64')
          }
        };

        console.log('发送科大讯飞请求:', request);
        ws.send(JSON.stringify(request));
      });

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          console.log('科大讯飞响应:', response);

          if (response.code !== 0) {
            reject(new Error(`科大讯飞TTS错误: ${response.message}`));
            return;
          }

          if (response.data && response.data.audio) {
            const audioData = Buffer.from(response.data.audio, 'base64');
            audioChunks.push(audioData);
          }

          if (response.data && response.data.status === 2) {
            // 合成完成
            const completeAudio = Buffer.concat(audioChunks);
            resolve(completeAudio);
            ws.close();
          }
        } catch (error) {
          reject(new Error(`解析科大讯飞响应失败: ${error}`));
        }
      });

      ws.on('error', (error: Error) => {
        console.error('科大讯飞WebSocket错误:', error);
        reject(new Error(`科大讯飞WebSocket错误: ${error.message}`));
      });

      ws.on('close', () => {
        console.log('科大讯飞WebSocket连接已关闭');
      });

      // 设置超时
      setTimeout(() => {
        ws.close();
        reject(new Error('科大讯飞TTS合成超时'));
      }, 30000);
    } catch (error) {
      reject(new Error(`初始化科大讯飞TTS失败: ${error}`));
    }
  });
}

// 获取所有科大讯飞音色
export function getXunfeiVoices(): XunfeiVoice[] {
  return XUNFEI_VOICES;
}
