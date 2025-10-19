import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) {
    const status =
      auth.reason === 'unauthorized'
        ? 401
        : auth.reason === 'forbidden'
          ? 403
          : 500;
    return NextResponse.json({ success: false, error: auth.reason }, { status });
  }

  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;

  if (!azureKey || !azureRegion) {
    return NextResponse.json(
      { success: false, error: 'Azure Speech 服务未配置' },
      { status: 500 },
    );
  }

  try {
    const tokenEndpoint = `https://${azureRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': azureKey,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`获取 Azure token 失败: ${response.status} ${message}`);
    }

    const token = await response.text();

    return NextResponse.json({
      success: true,
      token,
      region: azureRegion,
      expiresIn: 600, // token 默认 10 分钟有效期
    });
  } catch (error) {
    console.error('[pronunciation-test] 获取 Azure token 失败', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 },
    );
  }
}
