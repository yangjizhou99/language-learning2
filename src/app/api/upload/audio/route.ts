export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { Buffer } from 'buffer';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    console.log('录音上传API被调用');

    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    console.log('认证方式:', hasBearer ? 'Bearer' : 'Cookie');

    let supabase: any;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      });
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    console.log('用户认证结果:', { user: user?.id, error: authError?.message });

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the audio file from FormData
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = formData.get('sessionId') as string;
    const duration = formData.get('duration') as string;

    console.log('接收到的文件信息:', {
      fileName: audioFile?.name,
      size: audioFile?.size,
      type: audioFile?.type,
      sessionId,
    });

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileExtension = audioFile.name.split('.').pop() || 'webm';
    const fileName = `${user.id}/${sessionId || 'practice'}/${timestamp}.${fileExtension}`;

    console.log('准备上传到Storage:', fileName);

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log('文件转换为Buffer完成，大小:', buffer.byteLength);

    // 使用 service role 上传，避免因 RLS 配置不全导致失败；仍然通过用户鉴权确保安全
    const supabaseAdmin = getServiceSupabase();

    // 确认 bucket 存在，不存在则自动创建（私有）
    try {
      const { data: bucketInfo, error: bucketErr } = await supabaseAdmin.storage.getBucket('recordings');
      if (bucketErr || !bucketInfo) {
        console.warn('recordings bucket missing, creating...', bucketErr?.message);
        const { error: createErr } = await supabaseAdmin.storage.createBucket('recordings', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024,
          allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mpeg', 'audio/mp4'],
        });
        if (createErr) {
          console.error('Failed to create recordings bucket:', createErr);
          return NextResponse.json(
            { error: createErr.message, code: createErr.name ?? 'storage_create_bucket_error' },
            { status: 500 },
          );
        }
      }
    } catch (checkBucketError) {
      console.error('Bucket check/create failed:', checkBucketError);
      return NextResponse.json({ error: 'Bucket check failed' }, { status: 500 });
    }

    // 上传
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('recordings')
      .upload(fileName, buffer, {
        contentType: audioFile.type || 'audio/webm',
        duplex: 'half',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      return NextResponse.json(
        {
          error: uploadError.message,
          code: uploadError.name ?? 'storage_upload_error',
          hint: 'Using service role upload failed; check Storage configuration.',
        },
        { status: 500 },
      );
    }

    console.log('上传成功:', uploadData);

    // 构造代理 URL（统一经由 storage-proxy，避免暴露 Supabase 直链/签名链）
    const proxyUrl = `/api/storage-proxy?path=${encodeURIComponent(fileName)}&bucket=recordings`;

    // Use provided duration or fallback to estimate
    const recordingDuration = duration ? parseInt(duration) : Math.round(audioFile.size / 16000);

    const audioData = {
      url: proxyUrl,
      fileName: uploadData.path,
      size: audioFile.size,
      type: audioFile.type,
      duration: recordingDuration,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      audio: audioData,
    });
  } catch (error) {
    console.error('Error in audio upload API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
