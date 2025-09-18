export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

// DeepSeek 尚未提供公开模型目录端点，这里返回常见可用模型清单，
// 若未来官方提供目录接口，可在此替换为实时拉取。
const KNOWN = [
  { id: 'deepseek-chat', name: 'deepseek-chat' },
  { id: 'deepseek-reasoner', name: 'deepseek-reasoner' },
];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // 预留占位：如日后提供官方目录 API，可在此调用并返回完整列表
  return NextResponse.json({ ok: true, models: KNOWN });
}
