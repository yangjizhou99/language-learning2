import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, languageCode } = await request.json();

    if (!text || !voiceId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 });
    }

    // 生成临时文件路径
    const outputDir = path.join(process.cwd(), 'temp', 'tts');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `preview_${Date.now()}.wav`);

    // 使用Python脚本生成音频
    const pythonScript = `
import pyttsx3
import sys
import json

try:
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    
    # 根据voiceId找到对应的音色
    voice_index = int('${voiceId}'.split('-')[1])
    if voice_index < len(voices):
        engine.setProperty('voice', voices[voice_index].id)
    
    # 设置音色属性
    engine.setProperty('rate', 150)  # 语速
    engine.setProperty('volume', 0.9)  # 音量
    
    # 生成音频
    engine.save_to_file('${text.replace(/'/g, "\\'")}', '${outputFile.replace(/\\/g, '\\\\')}')
    engine.runAndWait()
    
    print(json.dumps({'success': True, 'file': '${outputFile}'}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`;

    const result = await new Promise((resolve, reject) => {
      const python = spawn('python', ['-c', pythonScript]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch (e) {
            reject(new Error('Failed to parse Python output'));
          }
        } else {
          reject(new Error(`Python script failed: ${error}`));
        }
      });
    });

    if (result.success && fs.existsSync(outputFile)) {
      // 读取生成的音频文件
      const audioBuffer = fs.readFileSync(outputFile);
      
      // 清理临时文件
      fs.unlinkSync(outputFile);

      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffer.length.toString(),
        },
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '音频生成失败'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('pyttsx3音频生成失败:', error);
    return NextResponse.json({
      success: false,
      error: '音频生成失败'
    }, { status: 500 });
  }
}
