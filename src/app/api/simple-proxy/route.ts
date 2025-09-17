import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'tts';
    
    console.log('Simple proxy request:', { path, bucket, url: req.url });
    
    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter', path, bucket }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      path, 
      bucket, 
      message: 'Simple proxy working' 
    });
  } catch (error) {
    console.error('Simple proxy error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
