import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { uploadAudioFile } from '@/lib/storage-upload';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import ffmpegPathImport from 'ffmpeg-static';

export const runtime = 'nodejs';

// 获取 ffmpeg 可执行文件的正确路径
function getFfmpegPath(): string {
  const ffmpegExe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  
  // 尝试从导入的路径
  if (ffmpegPathImport && fsSync.existsSync(ffmpegPathImport)) {
    console.log('[ffmpeg] 使用导入的路径:', ffmpegPathImport);
    return ffmpegPathImport;
  }
  
  // 尝试多个可能的路径
  const possiblePaths = [
    // pnpm 的 .ignored 目录（优先）
    path.join(process.cwd(), 'node_modules', '.ignored', 'ffmpeg-static', ffmpegExe),
    // pnpm 的标准路径
    path.join(process.cwd(), 'node_modules', '.pnpm', 'ffmpeg-static@5.2.0', 'node_modules', 'ffmpeg-static', ffmpegExe),
    // npm/yarn 的标准路径
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', ffmpegExe),
  ];
  
  // 如果能用 require.resolve，尝试获取模块目录
  try {
    const ffmpegModule = require.resolve('ffmpeg-static');
    const ffmpegDir = path.dirname(ffmpegModule);
    possiblePaths.unshift(path.join(ffmpegDir, ffmpegExe));
    possiblePaths.unshift(path.join(ffmpegDir, '..', ffmpegExe));
  } catch (err) {
    console.warn('[ffmpeg] require.resolve 失败:', err);
  }
  
  // 尝试所有可能的路径
  for (const p of possiblePaths) {
    console.log('[ffmpeg] 尝试路径:', p);
    if (fsSync.existsSync(p)) {
      console.log('[ffmpeg] ✓ 找到 ffmpeg 在:', p);
      return p;
    }
  }
  
  const errorMsg = `找不到 ffmpeg-static 可执行文件。已尝试以下路径:\n${possiblePaths.join('\n')}`;
  console.error('[ffmpeg]', errorMsg);
  throw new Error(errorMsg);
}

type AssessMode = 'batch' | 'stream';

function scrub<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => scrub(item)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = scrub(v);
    }
    return out as T;
  }
  return value;
}

// 提取单词的音素单元（包括 NBestPhonemes）
function extractUnitsWithNBest(word: any) {
  const consumePhonemes = (phs: any[] | undefined) => {
    const units: any[] = [];
    if (!Array.isArray(phs)) return units;
    for (const p of phs) {
      const label = p?.Phoneme ?? p?.Symbol ?? '(phoneme)';
      const acc = p?.PronunciationAssessment?.AccuracyScore ?? p?.AccuracyScore;
      const nb = p?.NBestPhonemes ?? p?.NBest ?? [];
      const nbest = Array.isArray(nb)
        ? nb.map((c: any) => ({
            label: c?.Phoneme ?? c?.Symbol ?? '(cand)',
            score: c?.AccuracyScore ?? c?.Score
          }))
        : undefined;
      units.push({ 
        Phoneme: label,
        PronunciationAssessment: {
          AccuracyScore: acc,
          NBestPhonemes: nbest
        },
        Offset: p?.Offset, 
        Duration: p?.Duration
      });
    }
    return units;
  };

  // 1) 优先 Word.Phonemes（中文常见拼音+调在这里）
  if (Array.isArray(word?.Phonemes) && word.Phonemes.length > 0) {
    return consumePhonemes(word.Phonemes);
  }

  // 2) 兼容 Syllables[].Phonemes（英语/部分语言）
  if (Array.isArray(word?.Syllables)) {
    const allUnits: any[] = [];
    for (const s of word.Syllables) {
      if (Array.isArray(s?.Phonemes) && s.Phonemes.length > 0) {
        allUnits.push(...consumePhonemes(s.Phonemes));
      }
    }
    if (allUnits.length > 0) return allUnits;
  }

  // 3) 回退
  return [];
}

async function runFfmpegToWav(inputPath: string, outputPath: string) {
  const ffmpegExe = getFfmpegPath();
  
  console.log('[ffmpeg] 使用 ffmpeg 路径:', ffmpegExe);
  console.log('[ffmpeg] 输入文件:', inputPath);
  console.log('[ffmpeg] 输出文件:', outputPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      ffmpegExe,
      [
        '-y',
        '-i',
        inputPath,
        '-ar',
        '16000',
        '-ac',
        '1',
        '-acodec',
        'pcm_s16le',
        outputPath,
      ],
      { 
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    
    let stderr = '';
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }
    
    child.on('error', (err) => {
      console.error('[ffmpeg] spawn 错误:', err);
      reject(new Error(`ffmpeg 启动失败: ${err.message}`));
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log('[ffmpeg] 转码成功');
        resolve();
      } else {
        console.error('[ffmpeg] 转码失败，退出码:', code);
        console.error('[ffmpeg] stderr:', stderr);
        reject(new Error(`ffmpeg 转码失败，退出码 ${code}`));
      }
    });
  });
}

async function withTempDir<T>(cb: (dir: string) => Promise<T>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pron-test-'));
  try {
    return await cb(dir);
  } finally {
    // 等待一小段时间确保所有文件句柄都释放了
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (err) {
      console.warn('[cleanup] 删除临时目录失败（可能文件仍在使用）:', err);
      // 不抛出错误，避免影响主流程
    }
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const status =
      auth.reason === 'unauthorized'
        ? 401
        : auth.reason === 'forbidden'
          ? 403
          : 500;
    return NextResponse.json({ success: false, error: auth.reason }, { status });
  }

  const formData = await req.formData();
  const audioFile = formData.get('audio');
  if (!(audioFile instanceof Blob)) {
    return NextResponse.json({ success: false, error: '音频文件缺失' }, { status: 400 });
  }

  const locale = String(formData.get('locale') || 'en-US');
  const referenceText = String(formData.get('referenceText') || '').trim();
  const clientDurationMsRaw = formData.get('durationMs');
  const sessionLabel = String(formData.get('sessionLabel') || '').trim() || null;
  const mode = (String(formData.get('mode') || 'batch') as AssessMode) || 'batch';

  if (mode !== 'batch') {
    return NextResponse.json({ success: false, error: '仅支持 batch 模式音频评测' }, { status: 400 });
  }

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;
  if (!azureKey || !azureRegion) {
    return NextResponse.json(
      { success: false, error: 'Azure Speech 服务密钥或区域未配置' },
      { status: 500 },
    );
  }

  const clientDurationMs = clientDurationMsRaw ? Number(clientDurationMsRaw) : null;
  const supabase = getServiceSupabase();

  return withTempDir(async (tmpDir) => {
    const inputPath = path.join(tmpDir, `input-${Date.now()}.dat`);
    const outputPath = path.join(tmpDir, `converted-${Date.now()}.wav`);
    const arrayBuffer = await audioFile.arrayBuffer();
    const sourceBuffer = Buffer.from(arrayBuffer);
    await fs.writeFile(inputPath, sourceBuffer);

    await runFfmpegToWav(inputPath, outputPath);

    // 读取转换后的 WAV 文件（只读取一次）
    const wavBuffer = await fs.readFile(outputPath);

    const { default: sdkDefault, ...sdkRest } = await import('microsoft-cognitiveservices-speech-sdk');
    const sdk = (sdkDefault || sdkRest) as typeof import('microsoft-cognitiveservices-speech-sdk');

    const speechConfig = sdk.SpeechConfig.fromSubscription(azureKey, azureRegion);
    speechConfig.speechRecognitionLanguage = locale;
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;
    speechConfig.requestWordLevelTimestamps();

    // 直接使用 WAV 文件输入（更稳定）
    const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 创建发音评估配置（按官方示例的方式）
    const pronConfig = new sdk.PronunciationAssessmentConfig(
      referenceText,
      sdk.PronunciationAssessmentGradingSystem.HundredMark,
      sdk.PronunciationAssessmentGranularity.Phoneme,
      true // enableMiscue
    );
    
    // 根据语言设置音素字母表（中文必须用 SAPI）
    const alphabet = locale.toLowerCase().startsWith('zh') ? 'SAPI' : 'IPA';
    (pronConfig as any).phonemeAlphabet = alphabet;
    (pronConfig as any)._phonemeAlphabet = alphabet;
    (pronConfig as any).PhonemeAlphabet = alphabet;
    
    // 设置 NBestPhonemeCount（尝试多种可能的属性名）
    (pronConfig as any).nBestPhonemeCount = 5;
    (pronConfig as any).NBestPhonemeCount = 5;
    (pronConfig as any).privNBestPhonemeCount = 5;
    
    // 英语启用韵律评测
    if (locale.toLowerCase().startsWith('en')) {
      try {
        if (typeof (pronConfig as any).enableProsodyAssessment === 'function') {
          (pronConfig as any).enableProsodyAssessment();
        }
      } catch {
        // 忽略错误
      }
    }
    
    pronConfig.applyTo(recognizer);

    const result = await new Promise<import('microsoft-cognitiveservices-speech-sdk').SpeechRecognitionResult>(
      (resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (res) => resolve(res),
          (err) => reject(err),
        );
      },
    );

    // 清理资源
    try {
      recognizer.close();
    } catch (err) {
      console.warn('[cleanup] recognizer.close() 失败:', err);
    }
    
    // audioConfig.close() 在某些情况下会有问题，暂时跳过
    // 资源会在临时目录清理时一起释放

    if (result.reason === sdk.ResultReason.Canceled) {
      const cancellation = sdk.CancellationDetails.fromResult(result);
      throw new Error(
        `Azure 评测取消: ${cancellation.reason} ${cancellation.errorDetails || ''}`.trim(),
      );
    }
    if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
      throw new Error(`Azure 评测失败，原因代码: ${result.reason}`);
    }

    const pronResult = sdk.PronunciationAssessmentResult.fromResult(result);
    const rawJsonString =
      result.properties.getProperty(sdk.PropertyId.SpeechServiceResponse_JsonResult) || null;
    let rawJson: any = null;
    if (rawJsonString) {
      try {
        rawJson = JSON.parse(rawJsonString);
        
        // 处理每个单词，提取并重构 NBestPhonemes 数据
        if (rawJson?.NBest?.[0]?.Words) {
          for (const word of rawJson.NBest[0].Words) {
            const extractedUnits = extractUnitsWithNBest(word);
            if (extractedUnits.length > 0) {
              // 将提取的单元（包含 NBestPhonemes）覆盖到原 word 上
              word.Phonemes = extractedUnits;
            }
          }
        }
      } catch (err) {
        console.warn('解析 Azure JSON 失败:', err);
      }
    }
    
    // 使用处理后的 rawJson 数据
    const detail = rawJson?.NBest?.[0] ? scrub(rawJson.NBest[0]) : scrub(pronResult.detailResult);

    const durationMs = typeof result.duration === 'number' ? Math.round(result.duration / 10000) : null;

    const fileName = `${auth.user.id}/pronunciation-test/${Date.now()}-${randomUUID()}.wav`;
    const upload = await uploadAudioFile('recordings', fileName, wavBuffer, {
      contentType: 'audio/wav',
      upsert: false,
    });

    if (!upload.success) {
      throw new Error(`音频上传失败: ${upload.error}`);
    }

    const insertPayload = {
      admin_id: auth.user.id,
      mode,
      locale,
      reference_text: referenceText || null,
      session_label: sessionLabel,
      recognized_text: result.text || null,
      audio_duration_ms: durationMs,
      audio_storage_path: fileName,
      overall_score: pronResult.pronunciationScore ?? null,
      accuracy_score: pronResult.accuracyScore ?? null,
      fluency_score: pronResult.fluencyScore ?? null,
      completeness_score: pronResult.completenessScore ?? null,
      prosody_score: pronResult.prosodyScore ?? null,
      azure_detail: detail ? scrub(detail) : null,
      azure_raw: rawJson ? scrub(rawJson) : null,
      extra_metrics: scrub({
        clientDurationMs,
        uploadUrl: upload.url,
        proxyUrl: upload.proxyUrl,
      }),
    };

    const { data: record, error: insertError } = await supabase
      .from('pronunciation_test_runs')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      runId: record?.id,
      recognizedText: result.text,
      scores: {
        overall: pronResult.pronunciationScore ?? null,
        accuracy: pronResult.accuracyScore ?? null,
        fluency: pronResult.fluencyScore ?? null,
        completeness: pronResult.completenessScore ?? null,
        prosody: pronResult.prosodyScore ?? null,
      },
      detail,
      azureJson: rawJson ? scrub(rawJson) : null,
      storage: {
        path: fileName,
        publicUrl: upload.url,
        proxyUrl: upload.proxyUrl,
      },
      durationMs,
    });
  }).catch((error: unknown) => {
    console.error('[pronunciation-test] 评测失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  });
}
