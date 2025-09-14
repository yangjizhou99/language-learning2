export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

type Provider = 'openrouter' | 'openai' | 'deepseek';

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if (!adminResult.ok) {
      return NextResponse.json({ error: adminResult.reason }, { status: adminResult.reason === 'unauthorized' ? 401 : 403 });
    }

    const { searchParams } = new URL(req.url);
    const provider = (searchParams.get('provider') || 'deepseek') as Provider;

    if (provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ provider, models: [], warning: 'OPENROUTER_API_KEY not set' });
      }
      const referer = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const resp = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': referer,
          'X-Title': 'Lang Trainer Admin'
        }
      });
      if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: `OpenRouter models fetch failed: ${text}` }, { status: 502 });
      }
      const json = await resp.json();
      const models = Array.isArray(json?.data) ? json.data.map((m: any) => ({
        id: m?.id || m?.name,
        name: m?.name || m?.id,
        context_length: m?.context_length,
        pricing: m?.pricing,
        description: m?.description
      })).filter((m: any) => m.id) : [];
      return NextResponse.json({ provider, models });
    }

    if (provider === 'openai') {
      // OpenAI 官方 models 列表接口权限较严格，这里提供常用模型静态列表
      const models = [
        { id: 'gpt-4o', name: 'gpt-4o' },
        { id: 'gpt-4o-mini', name: 'gpt-4o-mini' }
      ];
      return NextResponse.json({ provider, models });
    }

    if (provider === 'deepseek') {
      const models = [
        { id: 'deepseek-chat', name: 'deepseek-chat' },
        { id: 'deepseek-reasoner', name: 'deepseek-reasoner' }
      ];
      return NextResponse.json({ provider, models });
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (error) {
    console.error('Get provider models error:', error);
    return NextResponse.json({ error: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Internal server error' }, { status: 500 });
  }
}


