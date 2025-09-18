export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.log('OpenRouter API key not found, returning fallback models');
      return NextResponse.json(
        {
          success: true,
          models: {
            'anthropic': [
              {
                id: 'anthropic/claude-3.5-sonnet',
                name: 'Claude 3.5 Sonnet',
                description: 'Anthropic\'s most capable model for complex tasks',
              },
              {
                id: 'anthropic/claude-3-haiku',
                name: 'Claude 3 Haiku',
                description: 'Fast and efficient for simple tasks',
              }
            ],
            'openai': [
              {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                description: 'OpenAI\'s most advanced model',
              },
              {
                id: 'openai/gpt-4o-mini',
                name: 'GPT-4o Mini',
                description: 'Faster and cheaper GPT-4o variant',
              }
            ],
            'deepseek': [
              {
                id: 'deepseek/deepseek-chat',
                name: 'DeepSeek Chat',
                description: 'High-quality open source model',
              }
            ]
          },
          total: 5,
          fallback: true,
        },
        { status: 200 },
      );
    }

    console.log('Attempting to fetch models from OpenRouter...');

    // 从OpenRouter获取最新模型列表
    const response = await fetch('https://openrouter.co/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_SITE_NAME || 'Language Learning App',
      },
    });

    console.log('OpenRouter response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      
      // 如果API密钥无效，返回fallback模型
      if (response.status === 401) {
        console.log('OpenRouter API key invalid, returning fallback models');
        return NextResponse.json(
          {
            success: true,
            models: {
              'anthropic': [
                {
                  id: 'anthropic/claude-3.5-sonnet',
                  name: 'Claude 3.5 Sonnet',
                  description: 'Anthropic\'s most capable model for complex tasks',
                },
                {
                  id: 'anthropic/claude-3-haiku',
                  name: 'Claude 3 Haiku',
                  description: 'Fast and efficient for simple tasks',
                }
              ],
              'openai': [
                {
                  id: 'openai/gpt-4o',
                  name: 'GPT-4o',
                  description: 'OpenAI\'s most advanced model',
                },
                {
                  id: 'openai/gpt-4o-mini',
                  name: 'GPT-4o Mini',
                  description: 'Faster and cheaper GPT-4o variant',
                }
              ],
              'deepseek': [
                {
                  id: 'deepseek/deepseek-chat',
                  name: 'DeepSeek Chat',
                  description: 'High-quality open source model',
                }
              ]
            },
            total: 5,
            fallback: true,
          },
          { status: 200 },
        );
      }
      
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
          description:
            `${model.context_length ? `${model.context_length}K context` : ''} ${model.pricing ? `($${model.pricing.prompt}/1M tokens)` : ''}`.trim(),
          context_length: model.context_length,
          pricing: model.pricing,
        });
      });
    }

    return NextResponse.json({
      success: true,
      models: modelsByProvider,
      total: data.data?.length || 0,
    });
  } catch (error) {
    console.error('获取OpenRouter模型列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : String(error)
            : '获取模型列表失败',
      },
      { status: 500 },
    );
  }
}
