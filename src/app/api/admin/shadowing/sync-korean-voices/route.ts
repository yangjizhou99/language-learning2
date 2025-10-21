import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Google Cloud TTS 客户端
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      console.error('权限检查失败:', auth.reason);
      return NextResponse.json({ 
        error: 'forbidden', 
        reason: auth.reason,
        message: '需要管理员权限才能访问此API' 
      }, { status: 403 });
    }

    const supabase = getServiceSupabase();

    // 初始化 Google Cloud TTS 客户端
    const raw = process.env.GOOGLE_TTS_CREDENTIALS;
    if (!raw) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_TTS_CREDENTIALS 环境变量未设置'
      }, { status: 400 });
    }

    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(raw);
    } catch {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.resolve(process.cwd(), raw);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        credentials = JSON.parse(fileContent);
      } catch (fileError: unknown) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        return NextResponse.json({
          success: false,
          error: `Failed to parse GOOGLE_TTS_CREDENTIALS: ${raw}. Error: ${errorMessage}`
        }, { status: 400 });
      }
    }

    const projectId = process.env.GOOGLE_TTS_PROJECT_ID || (credentials.project_id as string);
    const client = new TextToSpeechClient({ credentials, projectId });

    console.log('开始从 Google Cloud TTS 获取韩语音色...');

    // 从 Google Cloud TTS 获取韩语音色列表
    const [result] = await client.listVoices({
      languageCode: 'ko-KR',
    });

    const koreanVoices = result.voices || [];
    console.log(`找到 ${koreanVoices.length} 个韩语音色`);

    if (koreanVoices.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未找到韩语音色，请检查 Google Cloud TTS 配置'
      }, { status: 400 });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 处理每个韩语音色
    for (const voice of koreanVoices) {
      try {
        // 解析音色信息
        const voiceName = voice.name || '';
        const languageCode = voice.languageCodes?.[0] || 'ko-KR';
        const ssmlGender = voice.ssmlGender || 'NEUTRAL';
        const naturalSampleRateHertz = voice.naturalSampleRateHertz || 24000;

        // 确定音色类型和定价
        const isNeural2 = voiceName.includes('Neural2');
        const isWavenet = voiceName.includes('Wavenet');
        const isStandard = voiceName.includes('Standard');
        
        let category = 'standard';
        let pricePerMillionChars = 4.0;
        
        if (isNeural2) {
          category = 'neural2';
          pricePerMillionChars = 16.0;
        } else if (isWavenet) {
          category = 'wavenet';
          pricePerMillionChars = 16.0;
        }

        // 生成显示名称
        const genderText = ssmlGender === 'FEMALE' ? '女声' : ssmlGender === 'MALE' ? '男声' : '中性';
        const voiceType = isNeural2 ? 'Neural2' : isWavenet ? 'Wavenet' : 'Standard';
        const displayName = `韩语${genderText} (${voiceType})`;

        // 生成使用场景
        const useCase = isNeural2 || isWavenet 
          ? '适合对话、新闻播报、教育内容，高质量自然语音'
          : '适合基础TTS需求，成本较低';

        // 确定是否为新闻播报音色
        const isNewsVoice = isNeural2 && (voiceName.includes('A') || voiceName.includes('B'));

        const voiceData = {
          // 注意：voices 表的主键是 uuid，name 唯一；无需提供 id
          name: voiceName,
          display_name: displayName,
          language_code: languageCode,
          ssml_gender: ssmlGender,
          natural_sample_rate_hertz: naturalSampleRateHertz,
          pricing: {
            pricePerMillionChars: pricePerMillionChars,
            examplePrice: (pricePerMillionChars / 1000).toFixed(4),
            examplePrice10k: (pricePerMillionChars / 100).toFixed(2),
          },
          characteristics: {
            voiceType: voiceType,
            tone: '自然',
            pitch: '中等',
          },
          category: category,
          is_active: true,
          provider: 'google',
          // 数据库里有 use_case/usecase 两列，出于兼容保留 use_case
          use_case: useCase,
          is_news_voice: isNewsVoice,
          updated_at: new Date().toISOString(),
        } as const;

        // 首选 upsert（要求存在唯一索引/约束），否则回退到“查后更/插入”
        const { error } = await supabase
          .from('voices')
          .upsert(voiceData, { onConflict: 'name' });

        if (error) {
          const msg = (error as any)?.message || '';
          const code = (error as any)?.code || '';
          const noConflict = code === '42P10' || /no unique|exclusion constraint/i.test(msg);
          const notNullId = code === '23502' || /null value in column\s+"id"/i.test(msg);
          if (noConflict || notNullId) {
            // 兼容环境：没有唯一索引时，手动实现幂等
            const { data: existing, error: qerr } = await supabase
              .from('voices')
              .select('id')
              .eq('name', voiceName)
              .maybeSingle();

            if (qerr) {
              console.error(`查询是否存在失败 ${voiceName}:`, qerr);
              errorCount++;
              errors.push(`${voiceName}: query_error ${qerr.message}`);
            } else if (existing) {
              const { error: uerr } = await supabase
                .from('voices')
                .update(voiceData)
                .eq('name', voiceName);
              if (uerr) {
                console.error(`更新音色失败 ${voiceName}:`, uerr);
                errorCount++;
                errors.push(`${voiceName}: update_error ${uerr.message}`);
              } else {
                successCount++;
                console.log(`更新音色成功: ${voiceName}`);
              }
            } else {
              // 插入路径：显式提供 id，兼容没有默认值的环境
              const withId = { id: (globalThis as any).crypto?.randomUUID?.() || require('crypto').randomUUID(), ...voiceData } as any;
              const { error: ierr } = await supabase.from('voices').insert(withId);
              if (ierr) {
                console.error(`插入音色失败 ${voiceName}:`, ierr);
                errorCount++;
                errors.push(`${voiceName}: insert_error ${ierr.message}`);
              } else {
                successCount++;
                console.log(`插入音色成功: ${voiceName}`);
              }
            }
          } else {
            console.error(`插入音色 ${voiceName} 失败:`, error);
            errorCount++;
            errors.push(`${voiceName}: ${msg || 'unknown_error'}`);
          }
        } else {
          successCount++;
          console.log(`成功同步音色: ${voiceName}`);
        }
      } catch (err) {
        console.error(`处理音色 ${voice.name} 时出错:`, err);
        errorCount++;
        errors.push(`${voice.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `韩语音色同步完成，从 Google Cloud TTS 获取了 ${koreanVoices.length} 个音色`,
      count: successCount,
      errors: errorCount,
      totalFound: koreanVoices.length,
      errorDetails: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('韩语音色同步失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
