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
  // 基础发音人
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
  },
  // 英语发音人
  {
    voiceId: 'x4_enus_luna_assist',
    displayName: 'Luna',
    language: 'en-US',
    gender: 'female',
    description: '英语女声，已开通'
  },
  {
    voiceId: 'x4_enus_ryan_assist',
    displayName: 'Ryan',
    language: 'en-US',
    gender: 'male',
    description: '英语男声，已开通'
  },
  // 日语发音人
  {
    voiceId: 'x4_jajp_zhongcun_assist',
    displayName: '中村樱',
    language: 'ja-JP',
    gender: 'female',
    description: '日语女声，已开通'
  },
  // 特色发音人 - 情感类
  {
    voiceId: 'x4_lingxiaoyao_em',
    displayName: '聆小瑶-情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，情感表达'
  },
  {
    voiceId: 'x4_lingxiaoyu_emo',
    displayName: '聆小瑜-情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，情感表达'
  },
  // 特色发音人 - 对话类
  {
    voiceId: 'x4_lingxiaoyun_talk',
    displayName: '聆小芸-对话',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，对话专用'
  },
  {
    voiceId: 'x4_lingxiaoyun_talk_emo',
    displayName: '聆小芸-多情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，多情感表达'
  },
  {
    voiceId: 'x4_gaolengnanshen_talk',
    displayName: '萧文-对话',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，对话专用'
  },
  {
    voiceId: 'x4_lingxiaowan_boytalk',
    displayName: '聆万万-对话',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，对话专用'
  },
  // 特色发音人 - 闲聊类
  {
    voiceId: 'x4_lingxiaoxuan_chat',
    displayName: '聆小璇-闲聊',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，闲聊专用'
  },
  // 特色发音人 - 角色类
  {
    voiceId: 'x4_lingxiaowan_boy',
    displayName: '聆小琬-小男孩',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，小男孩角色'
  },
  {
    voiceId: 'x4_lingbosong',
    displayName: '聆伯松',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，老人角色'
  },
  {
    voiceId: 'x4_lingbosong_bad_talk',
    displayName: '聆伯松-反派老人',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，反派老人角色'
  },
  // 新闻播报音色
  {
    voiceId: 'x4_lingxiaoshan_profnews',
    displayName: '聆小珊-新闻播报',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，专业新闻播报，已开通'
  },
  {
    voiceId: 'x4_xiaoguo',
    displayName: '小果-新闻播报',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，专业新闻播报，已开通'
  },
  {
    voiceId: 'x4_chaoge',
    displayName: '超哥-新闻播报',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，专业新闻播报，已开通'
  },
  {
    voiceId: 'x4_xiaozhong',
    displayName: '小忠-新闻播报',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，专业新闻播报，已开通'
  },
  // 新增的发音人
  {
    voiceId: 'x4_lingfeihao_upbeatads',
    displayName: '聆飞皓-广告',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，广告配音'
  },
  {
    voiceId: 'x4_lingxiaoyao_em',
    displayName: '聆小瑶-情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，情感表达'
  },
  {
    voiceId: 'x4_lingxiaoyun_talk',
    displayName: '聆小芸-对话',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，对话场景'
  },
  {
    voiceId: 'x4_gaolengnanshen_talk',
    displayName: '萧文-对话',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，对话场景'
  },
  {
    voiceId: 'x4_lingxiaowan_boytalk',
    displayName: '聆万万-对话',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，对话场景'
  },
  {
    voiceId: 'x4_lingxiaowan_boy',
    displayName: '聆小琬-小男孩',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，小男孩音色'
  },
  {
    voiceId: 'x4_lingxiaoxuan_chat',
    displayName: '聆小璇-闲聊',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，闲聊场景'
  },
  {
    voiceId: 'x4_lingxiaoyu_emo',
    displayName: '聆小瑜-情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，情感表达'
  },
  {
    voiceId: 'x4_lingxiaoyun_talk_emo',
    displayName: '聆小芸-多情感',
    language: 'zh-CN',
    gender: 'female',
    description: '普通话女声，多情感表达'
  },
  {
    voiceId: 'x4_lingbosong_bad_talk',
    displayName: '聆伯松-反派老人',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，反派老人'
  },
  {
    voiceId: 'x4_lingbosong',
    displayName: '聆伯松',
    language: 'zh-CN',
    gender: 'male',
    description: '普通话男声，沉稳专业'
  },
  // 英语发音人
  {
    voiceId: 'x4_enus_luna_assist',
    displayName: 'Luna',
    language: 'en-US',
    gender: 'female',
    description: '英语女声，自然流畅'
  },
  {
    voiceId: 'x4_enus_ryan_assist',
    displayName: 'Ryan',
    language: 'en-US',
    gender: 'male',
    description: '英语男声，专业清晰'
  },
  // 日语发音人
  {
    voiceId: 'x4_jajp_zhongcun_assist',
    displayName: '中村樱',
    language: 'ja-JP',
    gender: 'female',
    description: '日语女声，温柔甜美'
  },
];

// 获取科大讯飞配置
export function getXunfeiConfig(): XunfeiTTSConfig {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('科大讯飞TTS配置缺失，请设置XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET环境变量');
  }

  return { appId, apiKey, apiSecret };
}

// 生成WebSocket认证信息 - 基于科大讯飞官方文档的正确实现
function generateAuthUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  const signatureOrigin = `host: tts-api.xfyun.cn\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
  const signatureSha = createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  
  // 构建authorization原始字符串
  const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signatureSha}"`;
  
  // 对authorization原始字符串进行base64编码
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  
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
      
      const ws = new WebSocket(url);
      const audioChunks: Buffer[] = [];

      ws.on('open', () => {
        // 发送合成请求
        const request = {
          common: {
            app_id: config.appId
          },
          business: {
            aue: 'raw',
            vcn: voiceId,
            speed: speed,
            volume: volume,
            pitch: pitch,
            tte: 'UTF8'
          },
          data: {
            status: 2,
            text: Buffer.from(text, 'utf8').toString('base64')
          }
        };

        ws.send(JSON.stringify(request));
      });

      ws.on('message', (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());

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
        reject(new Error(`科大讯飞WebSocket错误: ${error.message}`));
      });

      ws.on('close', () => {
        // WebSocket连接已关闭
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

// 根据语言获取科大讯飞音色
export function getXunfeiVoicesByLanguage(language: string): XunfeiVoice[] {
  return XUNFEI_VOICES.filter(voice => voice.language === language);
}

// 根据性别获取科大讯飞音色
export function getXunfeiVoicesByGender(gender: 'male' | 'female'): XunfeiVoice[] {
  return XUNFEI_VOICES.filter(voice => voice.gender === gender);
}

// 验证科大讯飞音色ID是否有效
export function isValidXunfeiVoice(voiceId: string): boolean {
  return XUNFEI_VOICES.some(voice => voice.voiceId === voiceId);
}

// 生成科大讯飞长文本语音合成API的认证信息
function generateAuthUrlParams(apiKey: string, apiSecret: string, requestLine: string): { date: string; authorization: string } {
  const date = new Date().toUTCString();
  const algorithm = 'hmac-sha256';
  const headers = 'host date request-line';
  
  // 构建签名原始字符串 - 按照科大讯飞文档格式
  const signatureOrigin = `host: api-dx.xf-yun.com\ndate: ${date}\n${requestLine}`;
  
  // 使用HMAC-SHA256计算签名
  const signature = createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');
  
  // 构建authorization字符串 - 按照科大讯飞文档格式
  const authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString('base64');
  
  return { date, authorization };
}

// 科大讯飞长文本语音合成 - 基于官方文档实现
export async function synthesizeXunfeiLongTextTTS(
  text: string,
  voiceId: string,
  options: {
    speed?: number;
    volume?: number;
    pitch?: number;
    language?: string;
  } = {}
): Promise<Buffer> {
  const config = getXunfeiConfig();
  const { speed = 50, volume = 50, pitch = 50, language = 'zh' } = options;

  // 创建任务
  const createTaskUrl = 'https://api-dx.xf-yun.com/v1/private/dts_create';
  const requestLine = 'POST /v1/private/dts_create HTTP/1.1';

  const createTaskBody = {
    header: {
      app_id: config.appId
    },
    parameter: {
      dts: {
        vcn: voiceId,
        language: language,
        speed: speed,
        volume: volume,
        pitch: pitch,
        rhy: 1,
        audio: {
          encoding: 'lame',
          sample_rate: 16000
        },
        pybuf: {
          encoding: 'utf8',
          compress: 'raw',
          format: 'plain'
        }
      }
    },
    payload: {
      text: {
        encoding: 'utf8',
        compress: 'raw',
        format: 'plain',
        text: Buffer.from(text, 'utf8').toString('base64')
      }
    }
  };

  try {
    // 构建URL参数认证 - 按照科大讯飞官方文档格式
    const authParams = generateAuthUrlParams(config.apiKey, config.apiSecret, requestLine);
    const createTaskUrlWithAuth = `${createTaskUrl}?host=api-dx.xf-yun.com&date=${encodeURIComponent(authParams.date)}&authorization=${authParams.authorization}`;
    
    
    // 发送创建任务请求
    const createResponse = await fetch(createTaskUrlWithAuth, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createTaskBody)
    });

    const createResult = await createResponse.json();
    
    if (!createResult.header || createResult.header.code !== 0) {
      const errorMsg = createResult.header?.message || createResult.message || '未知错误';
      throw new Error(`创建任务失败: ${errorMsg}`);
    }

    const taskId = createResult.header.task_id;

    // 轮询查询任务状态
    const queryTaskUrl = 'https://api-dx.xf-yun.com/v1/private/dts_query';
    const queryRequestLine = 'POST /v1/private/dts_query HTTP/1.1';

    let attempts = 0;
    const maxAttempts = 30; // 最多查询30次，每次间隔2秒

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒

      const queryBody = {
        header: {
          app_id: config.appId,
          task_id: taskId
        }
      };

      // 构建查询任务的URL参数认证 - 按照科大讯飞官方文档格式
      const queryAuthParams = generateAuthUrlParams(config.apiKey, config.apiSecret, queryRequestLine);
      const queryTaskUrlWithAuth = `${queryTaskUrl}?host=api-dx.xf-yun.com&date=${encodeURIComponent(queryAuthParams.date)}&authorization=${queryAuthParams.authorization}`;
      
      
      const queryResponse = await fetch(queryTaskUrlWithAuth, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryBody)
      });

      const queryResult = await queryResponse.json();
      
      if (!queryResult.header || queryResult.header.code !== 0) {
        const errorMsg = queryResult.header?.message || queryResult.message || '未知错误';
        throw new Error(`查询任务失败: ${errorMsg}`);
      }

      const taskStatus = queryResult.header.task_status;

      if (taskStatus === '5') {
        // 任务处理成功
        const audioUrl = queryResult.payload.audio.audio;
        
        // 检查科大讯飞返回的是否是base64编码的URL
        let actualAudioUrl = audioUrl;
        if (!audioUrl.startsWith('http')) {
          try {
            // 尝试解码base64
            const decodedUrl = Buffer.from(audioUrl, 'base64').toString('utf8');
            if (decodedUrl.startsWith('http')) {
              actualAudioUrl = decodedUrl;
            } else {
              throw new Error(`解码后的URL不是有效的HTTP URL: ${decodedUrl}`);
            }
          } catch {
            throw new Error(`科大讯飞返回的不是有效的音频URL: ${audioUrl}`);
          }
        } else {
        }
        
        // 立即在服务器端下载音频文件（科大讯飞URL有有效期限制）
        try {
          const audioResponse = await fetch(actualAudioUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!audioResponse.ok) {
            throw new Error(`下载音频失败: ${audioResponse.status} ${audioResponse.statusText}`);
          }
          
          const audioBuffer = await audioResponse.arrayBuffer();
          
          // 检查下载的内容是否是有效的音频文件
          if (audioBuffer.byteLength < 1000) {
            throw new Error(`下载的音频文件太小，可能不是有效的音频内容: ${audioBuffer.byteLength} 字节`);
          }
          
          return Buffer.from(audioBuffer);
        } catch (downloadError) {
          console.error('音频下载失败:', downloadError);
          console.error('尝试下载的URL:', audioUrl);
          throw new Error(`音频下载失败: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
        }
      } else if (taskStatus === '2' || taskStatus === '4') {
        // 任务失败
        throw new Error(`任务处理失败，状态: ${taskStatus}`);
      }

      attempts++;
    }

    throw new Error('任务处理超时');

    } catch (error) {
      console.error('科大讯飞长文本TTS错误:', error);
      throw new Error(`科大讯飞长文本TTS失败: ${error instanceof Error ? error.message : String(error)}`);
    }
}
