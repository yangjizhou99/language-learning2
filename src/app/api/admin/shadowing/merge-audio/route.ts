import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'ffmpeg-static';
import { spawn, exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// 智能并发控制：根据系统资源动态调整
let activeMergeCount = 0;
let maxConcurrentMerges = 5; // 提高默认并发到5个进行测试
let systemLoad = 0; // 系统负载指标
let ffmpegProcessCount = 0; // ffmpeg进程计数
let lastErrorTime = 0; // 上次错误时间

// 动态调整并发限制
const adjustConcurrencyLimit = () => {
  const now = Date.now();
  const timeSinceLastError = now - lastErrorTime;

  // 如果最近有错误，降低并发
  if (timeSinceLastError < 30000) {
    // 30秒内有错误
    maxConcurrentMerges = 2;
  } else if (systemLoad > 0.9) {
    maxConcurrentMerges = 3; // 极高负载时限制为3
  } else if (systemLoad > 0.7) {
    maxConcurrentMerges = 4; // 高负载时限制为4
  } else if (systemLoad > 0.5) {
    maxConcurrentMerges = 5; // 中等负载时限制为5
  } else if (ffmpegProcessCount > 4) {
    maxConcurrentMerges = 4; // ffmpeg进程过多时限制
  } else {
    maxConcurrentMerges = 6; // 低负载时允许6个并发
  }

  console.log(
    `调整并发限制: ${maxConcurrentMerges} (系统负载: ${systemLoad.toFixed(2)}, ffmpeg进程: ${ffmpegProcessCount})`,
  );
};

// 音频合并队列
const mergeQueue: Array<{
  resolve: (value: Response) => void;
  reject: (error: any) => void;
  request: NextRequest;
}> = [];

// 监控系统资源
const monitorSystemResources = async () => {
  try {
    // 基于多个因素计算系统负载
    const activeTaskLoad = activeMergeCount / 3; // 活跃任务负载
    const queueLoad = Math.min(mergeQueue.length / 10, 1); // 队列长度负载
    const ffmpegLoad = Math.min(ffmpegProcessCount / 3, 1); // ffmpeg进程负载

    // 综合负载计算
    systemLoad = Math.max(activeTaskLoad, queueLoad, ffmpegLoad);

    // 动态调整并发限制
    adjustConcurrencyLimit();

    // 如果队列过长，可以适当增加并发
    if (mergeQueue.length > 3 && systemLoad < 0.6) {
      maxConcurrentMerges = Math.min(maxConcurrentMerges + 2, 8); // 最多8个并发
      console.log(`队列过长，临时增加并发到: ${maxConcurrentMerges}`);
    }
  } catch (error) {
    console.warn('系统资源监控失败:', error);
  }
};

// 处理队列中的下一个请求
const processNextInQueue = async () => {
  // 监控系统资源
  await monitorSystemResources();

  if (mergeQueue.length === 0 || activeMergeCount >= maxConcurrentMerges) {
    return;
  }

  const { resolve, reject, request } = mergeQueue.shift()!;
  activeMergeCount++;
  console.log(
    `处理队列中的音频合并请求，队列长度: ${mergeQueue.length}, 活跃任务: ${activeMergeCount}/${maxConcurrentMerges}`,
  );

  try {
    const result = await processMergeRequest(request);
    resolve(result);
  } catch (error) {
    console.error('队列处理音频合并失败:', error);
    reject(error);
  } finally {
    activeMergeCount--;
    console.log(
      `音频合并任务完成，剩余队列: ${mergeQueue.length}, 活跃任务: ${activeMergeCount}/${maxConcurrentMerges}`,
    );
    // 处理队列中的下一个请求
    setTimeout(processNextInQueue, 50); // 减少延迟，提高响应速度
  }
};

// 定期清理和优化
setInterval(() => {
  // 重置系统负载（如果长时间没有活动）
  if (activeMergeCount === 0 && mergeQueue.length === 0) {
    systemLoad = 0;
    maxConcurrentMerges = 5; // 重置为测试默认值
    console.log('系统空闲，重置并发限制为测试默认值');
  }

  // 清理过期的错误记录
  const now = Date.now();
  if (now - lastErrorTime > 60000) {
    // 1分钟后清除错误记录
    lastErrorTime = 0;
  }
}, 30000); // 每30秒检查一次

export async function POST(request: NextRequest): Promise<Response> {
  // 使用队列机制处理并发请求
  return new Promise<Response>((resolve, reject) => {
    mergeQueue.push({ resolve, reject, request });
    console.log(
      `新的音频合并请求加入队列，当前队列长度: ${mergeQueue.length}, 最大并发: ${maxConcurrentMerges}`,
    );
    processNextInQueue();
  });
}

// 实际处理音频合并的函数
async function processMergeRequest(request: NextRequest): Promise<Response> {
  console.log(`开始音频合并任务 (${activeMergeCount + 1}/${maxConcurrentMerges})`);

  try {
    const { audioUrls } = await request.json();

    if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
      return NextResponse.json({ error: '无效的音频URL列表' }, { status: 400 });
    }

    console.log('开始合并音频文件:', audioUrls);

    // 下载所有音频文件到临时目录 - 使用唯一ID避免冲突
    const uniqueId = randomUUID();
    const tempDir = path.join(os.tmpdir(), `tts-merge-${uniqueId}`);
    await fs.mkdir(tempDir, { recursive: true });
    console.log('创建临时目录:', tempDir);

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
          if (header === '52494646') {
            // 'RIFF'
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
      const inputListContent = tempFiles.map((file) => `file '${file}'`).join('\n');
      await fs.writeFile(inputListFile, inputListContent);

      // 使用ffmpeg合并音频
      const outputFile = path.join(tempDir, `merged_${Date.now()}.mp3`);

      const ffmpegArgs = [
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        inputListFile,
        '-c:a',
        'libmp3lame', // 使用MP3编码器重新编码
        '-b:a',
        '128k', // 设置比特率
        outputFile,
      ];

      console.log('执行ffmpeg命令:', ffmpeg, ffmpegArgs);

      // 验证ffmpeg路径
      let ffmpegPath = ffmpeg;
      if (!ffmpegPath) {
        throw new Error('ffmpeg路径未找到，请检查ffmpeg-static安装');
      }

      console.log('原始ffmpeg路径:', ffmpegPath);
      console.log('当前工作目录:', process.cwd());

      // 标准化路径处理
      ffmpegPath = path.resolve(ffmpegPath);
      console.log('标准化后的ffmpeg路径:', ffmpegPath);

      // 验证ffmpeg文件是否存在
      try {
        await fs.access(ffmpegPath);
        console.log('ffmpeg文件存在:', ffmpegPath);
      } catch (accessError) {
        console.error('ffmpeg文件不存在:', ffmpegPath);
        console.error('accessError:', accessError);

        // 尝试其他可能的路径格式
        const possiblePaths = [
          ffmpegPath,
          path.normalize(ffmpegPath),
          ffmpegPath.replace(/\\/g, '/'),
          ffmpegPath.replace(/\//g, '\\'),
          // 尝试相对路径
          path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
          // 尝试pnpm路径
          path.join(
            process.cwd(),
            'node_modules',
            '.pnpm',
            'ffmpeg-static@5.2.0',
            'node_modules',
            'ffmpeg-static',
            'ffmpeg.exe',
          ),
        ];

        let validPath = null;
        for (const testPath of possiblePaths) {
          try {
            const normalizedPath = path.resolve(testPath);
            await fs.access(normalizedPath);
            validPath = normalizedPath;
            console.log('找到有效的ffmpeg路径:', normalizedPath);
            break;
          } catch (e) {
            console.log('路径无效:', testPath);
          }
        }

        if (!validPath) {
          throw new Error(`ffmpeg文件不存在，尝试的路径: ${possiblePaths.join(', ')}`);
        }

        // 使用找到的有效路径
        ffmpegPath = validPath;
      }

      // 添加重试机制
      let retryCount = 0;
      const maxRetries = 3;

      const executeFfmpeg = async (): Promise<void> => {
        return new Promise((resolve, reject) => {
          // 使用spawn而不是exec来避免路径问题
          const args = [
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            inputListFile,
            '-c:a',
            'libmp3lame',
            '-b:a',
            '128k',
            outputFile,
          ];

          console.log(
            `执行ffmpeg命令 (尝试 ${retryCount + 1}/${maxRetries + 1}):`,
            ffmpegPath,
            args,
          );
          console.log('ffmpeg路径:', ffmpegPath);

          // 增加ffmpeg进程计数
          ffmpegProcessCount++;
          console.log(`启动ffmpeg进程，当前进程数: ${ffmpegProcessCount}`);

          const child = spawn(ffmpegPath, args, {
            timeout: 60000,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          child.on('close', async (code) => {
            // 减少ffmpeg进程计数
            ffmpegProcessCount = Math.max(0, ffmpegProcessCount - 1);
            console.log(`ffmpeg进程结束，当前进程数: ${ffmpegProcessCount}`);

            if (code !== 0) {
              console.error('ffmpeg执行错误，退出码:', code);
              console.error('stderr:', stderr);
              console.error('stdout:', stdout);

              // 记录错误时间
              lastErrorTime = Date.now();

              reject(
                new Error(`ffmpeg合并失败，退出码: ${code}\nstderr: ${stderr}\nstdout: ${stdout}`),
              );
            } else {
              console.log('ffmpeg合并成功');
              console.log('stdout:', stdout);
              if (stderr) {
                console.log('stderr:', stderr);
              }

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

          child.on('error', (error) => {
            // 减少ffmpeg进程计数
            ffmpegProcessCount = Math.max(0, ffmpegProcessCount - 1);
            console.log(`ffmpeg进程错误，当前进程数: ${ffmpegProcessCount}`);

            console.error('ffmpeg进程启动错误:', error);
            reject(new Error(`ffmpeg进程启动失败: ${error.message}`));
          });
        });
      };

      // 执行重试逻辑
      while (retryCount <= maxRetries) {
        try {
          await executeFfmpeg();
          break; // 成功则跳出循环
        } catch (error) {
          retryCount++;
          if (retryCount > maxRetries) {
            throw error; // 超过最大重试次数，抛出错误
          }
          console.log(
            `ffmpeg执行失败，${1000 * retryCount}ms后重试... (${retryCount}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
        }
      }

      // 检查合并后的音频文件
      const stats = await fs.stat(outputFile);
      console.log('合并后的音频文件大小:', stats.size, 'bytes');

      if (stats.size === 0) {
        throw new Error('合并后的音频文件大小为0');
      }

      // 根据第一个音频URL推断语言路径
      const firstAudioUrl = audioUrls[0];
      let langPath = 'zh'; // 默认中文路径

      // 从URL中提取语言路径
      if (firstAudioUrl) {
        const urlMatch = firstAudioUrl.match(/\/tts\/([^\/]+)\//);
        if (urlMatch) {
          langPath = urlMatch[1];
        }
      }

      // 上传合并后的音频到Supabase Storage
      const mergedAudioBuffer = await fs.readFile(outputFile);
      const fileName = `merged_${Date.now()}.mp3`;
      console.log(
        '准备上传音频文件，大小:',
        mergedAudioBuffer.length,
        'bytes',
        '语言路径:',
        langPath,
      );

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tts')
        .upload(`${langPath}/${fileName}`, mergedAudioBuffer, {
          contentType: 'audio/mpeg',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`上传合并音频失败: ${uploadError.message}`);
      }

      // 统一返回代理URL，避免暴露 Supabase 直链/签名链
      const proxyUrl = `/api/storage-proxy?path=${encodeURIComponent(`${langPath}/${fileName}`)}&bucket=tts`;

      console.log('音频合并完成，代理URL:', proxyUrl);
      console.log('上传数据:', uploadData);

      // 清理临时文件
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('清理临时文件失败:', cleanupError);
      }

      console.log(`音频合并任务完成`);

      return NextResponse.json({
        success: true,
        mergedAudioUrl: proxyUrl,
        message: '音频合并成功',
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
        details:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : '未知错误',
      },
      { status: 500 },
    );
  }
}
