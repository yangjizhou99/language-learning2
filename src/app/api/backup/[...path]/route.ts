export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';

const WORKER = process.env.BACKUP_WORKER_URL!;
const API_KEY = process.env.BACKUP_WORKER_API_KEY!;

function mapConnPreset(preset?: string) {
  if (!preset) return undefined;
  if (preset === 'prod') return process.env.BACKUP_CONN_PROD;
  if (preset === 'dev') return process.env.BACKUP_CONN_DEV;
  return undefined;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const url = new URL(req.url);
  const connPreset = url.searchParams.get('connPreset') || undefined;
  const resolvedParams = await params;
  const workerUrl = new URL(`${WORKER}/${resolvedParams.path.join('/')}`);

  // 复制查询参数，并把 connPreset 转成 conn
  url.searchParams.forEach((v, k) => {
    if (k !== 'connPreset') workerUrl.searchParams.set(k, v);
  });
  const mapped = mapConnPreset(connPreset);
  if (mapped) workerUrl.searchParams.set('conn', mapped);

  const r = await fetch(workerUrl, { headers: { 'x-api-key': API_KEY } });
  const buf = await r.arrayBuffer();
  return new NextResponse(buf, { status: r.status, headers: r.headers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const workerUrl = `${WORKER}/${resolvedParams.path.join('/')}`;
  const ct = req.headers.get('content-type') || '';

  let body: BodyInit | undefined;
  let headers: Record<string, string> = { 'x-api-key': API_KEY };

  if (ct.includes('application/json')) {
    const json = await req.json();
    // 支持 connPreset → conn
    if (json && json.connPreset && !json.conn) {
      const mapped = mapConnPreset(json.connPreset);
      if (mapped) {
        json.conn = mapped;
        delete json.connPreset;
      }
    }
    body = JSON.stringify(json);
    headers['content-type'] = 'application/json';
  } else {
    // 透传 formdata/file 等
    body = req.body as any;
    headers['content-type'] = ct;
  }

  const r = await fetch(workerUrl, { method: 'POST', headers, body });
  const buf = await r.arrayBuffer();
  return new NextResponse(buf, { status: r.status, headers: r.headers });
}
