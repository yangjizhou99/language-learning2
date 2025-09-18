import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { getXunfeiVoices } from '@/lib/xunfei-tts';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    console.log('开始同步科大讯飞音色到数据库...');

    // 获取科大讯飞音色配置
    const xunfeiVoices = getXunfeiVoices();
    console.log(`找到 ${xunfeiVoices.length} 个科大讯飞音色`);

    // 获取Supabase客户端
    const supabase = getServiceSupabase();

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // 批量插入音色到数据库
    for (const voice of xunfeiVoices) {
      try {
        // 检查音色是否已存在
        const { data: existing } = await supabase
          .from('voices')
          .select('id')
          .eq('name', `xunfei-${voice.voiceId}`)
          .single();

        if (existing) {
          console.log(`音色 ${voice.voiceId} 已存在，跳过`);
          continue;
        }

        // 插入新音色
        const { error: insertError } = await supabase.from('voices').insert({
          name: `xunfei-${voice.voiceId}`,
          display_name: voice.displayName,
          language_code: voice.language,
          ssml_gender: voice.gender,
          natural_sample_rate_hertz: 16000, // 科大讯飞默认16K
          pricing: {
            pricePerMillionChars: 0,
            examplePrice: '$按服务量计费/1K字符',
          },
          category: voice.displayName.includes('新闻播报')
            ? 'Xunfei-News-Female'
            : voice.displayName.includes('新闻播报')
              ? 'Xunfei-News-Male'
              : voice.gender === 'female'
                ? 'Xunfei-Female'
                : 'Xunfei-Male',
          is_active: true,
          provider: 'xunfei',
          is_news_voice: voice.displayName.includes('新闻播报'),
          characteristics: {
            voiceType: voice.description,
            tone: voice.gender === 'female' ? '女声' : '男声',
            pitch: '标准',
          },
        });

        if (insertError) {
          console.error(`插入音色 ${voice.voiceId} 失败:`, insertError);
          errors.push(`${voice.voiceId}: ${insertError.message}`);
          errorCount++;
        } else {
          console.log(`成功插入音色: ${voice.voiceId}`);
          successCount++;
        }
      } catch (err) {
        console.error(`处理音色 ${voice.voiceId} 时出错:`, err);
        errors.push(`${voice.voiceId}: ${err instanceof Error ? err.message : String(err)}`);
        errorCount++;
      }
    }

    console.log(`同步完成: 成功 ${successCount} 个，失败 ${errorCount} 个`);

    if (errorCount > 0) {
      console.warn('部分音色同步失败:', errors);
    }

    return NextResponse.json({
      success: true,
      message: `科大讯飞音色同步完成`,
      count: successCount,
      errors: errorCount > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('同步科大讯飞音色失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
