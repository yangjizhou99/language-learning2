import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 直接创建 Supabase 客户端
function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE service role not configured");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// 文件类型映射
const CONTENT_TYPE_MAP: Record<string, string> = {
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'webm': 'audio/webm',
  'ogg': 'audio/ogg',
  'm4a': 'audio/mp4',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'avif': 'image/avif',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'pdf': 'application/pdf',
  'txt': 'text/plain',
  'json': 'application/json',
};

// 根据文件类型获取缓存策略
function getCacheStrategy(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  
  // 音频文件：30天缓存
  if (['mp3', 'wav', 'webm', 'ogg', 'm4a'].includes(extension || '')) {
    return 'public, s-maxage=2592000, max-age=2592000, immutable';
  }
  
  // 图片文件：30天缓存
  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(extension || '')) {
    return 'public, s-maxage=2592000, max-age=2592000, immutable';
  }
  
  // 文档文件：1天缓存
  if (['pdf', 'txt', 'json'].includes(extension || '')) {
    return 'public, s-maxage=86400, max-age=86400';
  }
  
  // 默认：7天缓存
  return 'public, s-maxage=604800, max-age=86400';
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get('path');
    const bucket = url.searchParams.get('bucket') || 'tts';
    
    console.log('Storage proxy request:', { path, bucket, url: req.url });
    
    if (!path) {
      console.log('Missing path parameter');
      return new NextResponse('Missing path parameter', { status: 400 });
    }

    // 验证路径安全性
    if (path.includes('..') || path.startsWith('/')) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const supabaseAdmin = getServiceSupabase();

    // 读取 Range 头并透传到上游
    const range = req.headers.get('range') || undefined;

    // 如果路径包含bucket名称，需要提取实际的文件路径
    let actualPath = path;
    if (path.startsWith(`${bucket}/`)) {
      actualPath = path.substring(bucket.length + 1); // 移除 "bucket/" 前缀
    }

    // 生成短期签名URL（同时兼容公开桶）
    const { data: signed } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(actualPath, 60);

    const upstreamUrl = signed?.signedUrl || `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${actualPath}`;

    const upstream = await fetch(upstreamUrl, {
      headers: range ? { Range: range } : undefined,
      cache: 'no-store'
    });

    if (upstream.status === 404) {
      return new NextResponse('File not found', { status: 404 });
    }

    // 复制上游关键响应头并叠加我们的缓存头
    const headers = new Headers();
    const passThroughHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
    for (const [k, v] of upstream.headers) {
      if (passThroughHeaders.includes(k.toLowerCase())) headers.set(k, v);
    }

    // 如上游未提供 content-type，依据扩展名补充
    if (!headers.get('content-type')) {
      const extension = actualPath.split('.').pop()?.toLowerCase();
      const contentType = CONTENT_TYPE_MAP[extension || ''] || 'application/octet-stream';
      headers.set('content-type', contentType);
    }

    headers.set('Cache-Control', getCacheStrategy(actualPath));
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, If-None-Match');

    // 上游返回 200 或 206，我们保持一致并透传主体
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('Storage proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// 支持 OPTIONS 请求（CORS 预检）
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, If-None-Match',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}