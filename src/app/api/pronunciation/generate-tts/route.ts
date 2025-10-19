// =====================================================
// TTS 音频生成 API
// POST /api/pronunciation/generate-tts
// 使用 Azure Speech Service 生成标准读音
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/pronunciation/generate-tts
 * 生成 TTS 音频（返回 base64 编码的音频数据）
 * 
 * 请求体:
 * {
 *   text: string,
 *   lang?: string,  // zh-CN, en-US, ja-JP
 *   voice?: string  // 可选：指定语音
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, lang = 'zh-CN', voice } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: '缺少 text 参数' },
        { status: 400 }
      );
    }

    const speechKey = process.env.AZURE_SPEECH_KEY;
    const speechRegion = process.env.AZURE_SPEECH_REGION;

    if (!speechKey || !speechRegion) {
      return NextResponse.json(
        { success: false, error: 'Azure Speech 配置缺失' },
        { status: 500 }
      );
    }

    // 配置语音
    const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
    
    // 根据语言设置默认语音
    let voiceName = voice;
    if (!voiceName) {
      switch (lang) {
        case 'zh-CN':
          voiceName = 'zh-CN-XiaoxiaoNeural'; // 中文女声（自然）
          break;
        case 'en-US':
          voiceName = 'en-US-JennyNeural'; // 英文女声
          break;
        case 'ja-JP':
          voiceName = 'ja-JP-NanamiNeural'; // 日文女声
          break;
        default:
          voiceName = 'zh-CN-XiaoxiaoNeural';
      }
    }
    
    speechConfig.speechSynthesisVoiceName = voiceName;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    // 创建合成器（输出到内存）
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);

    // 生成音频
    const audioData = await new Promise<ArrayBuffer>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (result) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
            synthesizer.close();
          } else {
            synthesizer.close();
            reject(new Error(`TTS 失败: ${result.errorDetails}`));
          }
        },
        (error) => {
          synthesizer.close();
          reject(error);
        }
      );
    });

    // 转换为 base64
    const buffer = Buffer.from(audioData);
    const base64Audio = buffer.toString('base64');

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      format: 'mp3',
      voice: voiceName,
      text,
    });
  } catch (error) {
    console.error('[pronunciation/generate-tts] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

