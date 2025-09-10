import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'ffmpeg-static';
import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { audioUrls } = await request.json();
    
    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json({ error: '无效的音频URL列表' }, { status: 400 });
    }

    console.log('开始合并音频文件:', audioUrls);

    // 下载所有音频文件到临时目录
    const tempDir = path.join(os.tmpdir(), 'tts-merge');
    await fs.mkdir(tempDir, { recursive: true });

    const tempFiles: string[] = [];
    
    try {
      // 下载每个音频文件
      for (let i = 0; i < audioUrls.length; i++) {
        const audioUrl = audioUrls[i];
        const response = await fetch(audioUrl);
        
        if (!response.ok) {
          throw new Error(`下载音频文件失败: ${response.status}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        // 检测音频格式
        const buffer = Buffer.from(audioBuffer);
        let fileExtension = '.mp3'; // 默认MP3
        
        // 检查文件头来确定格式
        if (buffer.length >= 4) {
          const header = buffer.toString('hex', 0, 4);
          if (header === '52494646') { // 'RIFF'
            fileExtension = '.wav';
          } else if (header === 'fffb' || header === 'fff3' || header === 'fff2') {
            fileExtension = '.mp3';
          }
        }
        
        const tempFile = path.join(tempDir, `audio_${i}${fileExtension}`);
        await fs.writeFile(tempFile, buffer);
        tempFiles.push(tempFile);
        
        console.log(`下载音频文件 ${i + 1}/${audioUrls.length}: ${tempFile} (${fileExtension})`);
      }

      // 创建ffmpeg输入文件列表
      const inputListFile = path.join(tempDir, 'input_list.txt');
      const inputListContent = tempFiles.map(file => `file '${file}'`).join('\n');
      await fs.writeFile(inputListFile, inputListContent);

      // 使用ffmpeg合并音频
      const outputFile = path.join(tempDir, `merged_${Date.now()}.mp3`);
      
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', inputListFile,
        '-c:a', 'libmp3lame',  // 使用MP3编码器重新编码
        '-b:a', '128k',         // 设置比特率
        outputFile
      ];

      console.log('执行ffmpeg命令:', ffmpeg, ffmpegArgs);

      await new Promise((resolve, reject) => {
        // 使用相对路径执行ffmpeg命令
        const ffmpegPath = './node_modules/.pnpm/ffmpeg-static@5.2.0/node_modules/ffmpeg-static/ffmpeg.exe';
        const command = `"${ffmpegPath}" -f concat -safe 0 -i "${inputListFile}" -c:a libmp3lame -b:a 128k "${outputFile}"`;
        console.log('执行ffmpeg命令:', command);
        
        exec(command, { timeout: 30000 }, async (error, stdout, stderr) => {
          if (error) {
            console.error('ffmpeg执行错误:', error);
            console.error('stderr:', stderr);
            reject(new Error(`ffmpeg合并失败: ${error.message}`));
          } else {
            console.log('ffmpeg合并成功');
            console.log('stdout:', stdout);
            
            // 检查输出文件是否存在
            try {
              const outputStats = await fs.stat(outputFile);
              console.log('输出文件存在，大小:', outputStats.size, 'bytes');
              if (outputStats.size === 0) {
                reject(new Error('ffmpeg合并成功但输出文件大小为0'));
                return;
              }
            } catch (statError) {
              console.error('输出文件不存在:', statError);
              reject(new Error('ffmpeg合并成功但输出文件不存在'));
              return;
            }
            
            resolve(undefined);
          }
        });
      });

      // 检查合并后的音频文件
      const stats = await fs.stat(outputFile);
      console.log('合并后的音频文件大小:', stats.size, 'bytes');
      
      if (stats.size === 0) {
        throw new Error('合并后的音频文件大小为0');
      }

      // 上传合并后的音频到Supabase Storage
      const mergedAudioBuffer = await fs.readFile(outputFile);
      const fileName = `merged_${Date.now()}.mp3`;
      console.log('准备上传音频文件，大小:', mergedAudioBuffer.length, 'bytes');
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tts')
        .upload(`zh/${fileName}`, mergedAudioBuffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`上传合并音频失败: ${uploadError.message}`);
      }

      // 获取带签名的URL（7天有效期）
      const { data: urlData, error: urlError } = await supabase.storage
        .from('tts')
        .createSignedUrl(`zh/${fileName}`, 7 * 24 * 60 * 60); // 7天有效期

      if (urlError) {
        console.error('生成签名URL失败:', urlError);
        // 如果签名URL失败，尝试公开URL
        const { data: publicUrlData } = supabase.storage
          .from('tts')
          .getPublicUrl(`zh/${fileName}`);
        console.log('使用公开URL:', publicUrlData.publicUrl);
        return NextResponse.json({
          success: true,
          mergedAudioUrl: publicUrlData.publicUrl,
          message: '音频合并成功（使用公开URL）'
        });
      }

      console.log('音频合并完成:', urlData.signedUrl);
      console.log('上传数据:', uploadData);

      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }

      return NextResponse.json({
        success: true,
        mergedAudioUrl: urlData.signedUrl,
        message: '音频合并成功'
      });

    } catch (error) {
      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }
      
      throw error;
    }

  } catch (error) {
    console.error('音频合并失败:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '音频合并失败', 
        details: error instanceof Error ? error.message : '未知错误' 
      }, 
      { status: 500 }
    );
  }
}
