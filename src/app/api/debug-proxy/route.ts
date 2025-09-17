import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'tts';
    
    console.log('Debug proxy request:', { path, bucket, url: req.url });
    
    if (!path) {
      return NextResponse.json({ 
        error: 'Missing path parameter', 
        received: { path, bucket },
        allParams: Object.fromEntries(url.searchParams.entries())
      }, { status: 400 });
    }
    
    // 模拟文件内容
    const mockContent = `Mock file content for ${path}`;
    const arrayBuffer = new TextEncoder().encode(mockContent);
    
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600',
        'ETag': `"${path}-${Date.now()}"`,
      },
    });
  } catch (error) {
    console.error('Debug proxy error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
