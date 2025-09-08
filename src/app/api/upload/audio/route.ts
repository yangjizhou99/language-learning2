export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    console.log('录音上传API被调用');
    
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    console.log('认证方式:', hasBearer ? 'Bearer' : 'Cookie');
    
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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
      sessionId
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
    const buffer = new Uint8Array(arrayBuffer);

    console.log('文件转换为buffer完成，大小:', buffer.length);

    // Upload to Supabase Storage (使用tts bucket)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('tts')
      .upload(fileName, buffer, {
        contentType: audioFile.type || 'audio/webm',
        duplex: 'half'
      });

    if (uploadError) {
      console.error('Error uploading audio:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    console.log('上传成功:', uploadData);

    // Get signed URL (for private bucket access)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('tts')
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    if (signedUrlError) {
      console.error('Error creating signed URL:', signedUrlError);
      return NextResponse.json({ error: signedUrlError.message }, { status: 500 });
    }

    // Use provided duration or fallback to estimate
    const recordingDuration = duration ? parseInt(duration) : Math.round(audioFile.size / 16000);

    const audioData = {
      url: signedUrlData.signedUrl,
      fileName: uploadData.path,
      size: audioFile.size,
      type: audioFile.type,
      duration: recordingDuration,
      created_at: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      audio: audioData
    });

  } catch (error) {
    console.error('Error in audio upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
