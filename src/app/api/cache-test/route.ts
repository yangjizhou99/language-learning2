export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

function buildBody() {
  return { ok: true, time: new Date().toISOString(), message: 'cache-test' };
}

function buildETag(body: any) {
  // 简单稳定 ETag：固定内容 + 分钟粒度，便于观察 304
  const minute = Math.floor(Date.now() / 60000);
  return `"cache-test-${minute}"`;
}

export async function GET(req: NextRequest) {
  const body = buildBody();
  const etag = buildETag(body);
  const inm = req.headers.get('if-none-match');

  if (inm && inm === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=30, s-maxage=60',
      },
    });
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'public, max-age=30, s-maxage=60',
    },
  });
}
