import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    // 使用Python脚本获取pyttsx3音色列表
    const pythonScript = `
import pyttsx3
import json
import sys

try:
    engine = pyttsx3.init()
    voices = engine.getProperty('voices')
    
    voice_list = []
    for i, voice in enumerate(voices):
        voice_info = {
            'id': f'pyttsx3-{i}',
            'name': voice.name,
            'languages': voice.languages if voice.languages else ['en-US'],
            'gender': 'FEMALE' if 'female' in voice.name.lower() or 'huihui' in voice.name.lower() or 'haruka' in voice.name.lower() else 'MALE',
            'age': 'adult',
            'description': f'pyttsx3音色 - {voice.name}'
        }
        voice_list.append(voice_info)
    
    print(json.dumps(voice_list, ensure_ascii=False))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    const voices = await new Promise((resolve, reject) => {
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

    return NextResponse.json({
      success: true,
      voices: voices
    });

  } catch (error) {
    console.error('获取pyttsx3音色失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取音色列表失败'
    }, { status: 500 });
  }
}
