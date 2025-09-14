export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      console.log('OpenRouter API key not found, returning fallback models');
      return NextResponse.json({
        success: false,
        error: 'OpenRouter API key not configured',
        fallback: true
      }, { status: 500 });
    }

    console.log('Attempting to fetch models from OpenRouter...');

    // 从OpenRouter获取最新模型列表
    const response = await fetch('https://openrouter.co/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_SITE_NAME || 'Language Learning App'
      }
    });

    console.log('OpenRouter response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('OpenRouter returned', data.data?.length, 'models');
    
    // 处理模型数据，按提供商分类
    const modelsByProvider: Record<string, any[]> = {};
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((model: any) => {
        const provider = model.owned_by || 'unknown';
        if (!modelsByProvider[provider]) {
          modelsByProvider[provider] = [];
        }
        
        modelsByProvider[provider].push({
          id: model.id,
          name: model.id.split('/').pop() || model.id,
          description: `${model.context_length ? `${model.context_length}K context` : ''} ${model.pricing ? `($${model.pricing.prompt}/1M tokens)` : ''}`.trim(),
          context_length: model.context_length,
          pricing: model.pricing
        });
      });
    }

    return NextResponse.json({
      success: true,
      models: modelsByProvider,
      total: data.data?.length || 0
    });

  } catch (error) {
    console.error('获取OpenRouter模型列表失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : '获取模型列表失败'
    }, { status: 500 });
  }
}
