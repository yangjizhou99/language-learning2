export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const originalText = formData.get('originalText') as string; // 获取原文用于生成相关转录
    
    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('转录请求:', {
      fileName: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
      hasOriginalText: !!originalText
    });

    // 这里可以集成真正的语音识别服务，比如：
    // 1. OpenAI Whisper API
    // 2. Google Cloud Speech-to-Text
    // 3. Azure Speech Services
    // 4. AWS Transcribe
    
    // 根据原文内容生成相关的模拟转录
    let mockTranscriptions: string[] = [];
    
    if (originalText) {
      // 从原文中提取一些关键词和短语
      const sentences = originalText.split(/[。！？\n]/).filter(s => s.trim());
      const shortSentences = sentences.filter(s => s.length < 30 && s.length > 5);
      
      if (shortSentences.length > 0) {
        // 使用原文中的短句，但添加一些变化
        mockTranscriptions = shortSentences.slice(0, 3);
        
        // 添加一些常见的变体
        mockTranscriptions.push(
          shortSentences[0] + 'です',
          shortSentences[0] + 'ね',
          shortSentences[0].replace(/[！？]/, '')
        );
      }
    }
    
    // 如果没有原文或提取失败，使用通用转录
    if (mockTranscriptions.length === 0) {
      mockTranscriptions = [
        'こんにちは、はじめまして',
        '今日はいい天気ですね',
        'ありがとうございます',
        'すみません、もう一度お願いします',
        '日本語を勉強しています',
        'おはようございます',
        'こんばんは',
        'さようなら',
        'お疲れ様でした',
        '頑張ってください',
        '自己紹介をします',
        '最近どうですか',
        '元気ですか',
        'お名前は何ですか',
        'どこから来ましたか'
      ];
    }
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    
    console.log('转录结果:', randomTranscription);
    
    return NextResponse.json({
      success: true,
      transcription: randomTranscription,
      confidence: Math.random() * 0.3 + 0.7 // 70-100% 置信度
    });

  } catch (error) {
    console.error('转录API错误:', error);
    return NextResponse.json(
      { error: '转录失败' },
      { status: 500 }
    );
  }
}
