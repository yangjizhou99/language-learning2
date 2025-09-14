export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

// 模型缓存
let modelCache: {
  data: Record<string, string[]>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 获取OpenRouter模型列表
async function fetchOpenRouterModels(): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'Language Learning App'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      ?.filter((model: any) => 
        model.id && 
        (model.id.includes('gpt') || 
         model.id.includes('claude') || 
         model.id.includes('gemini') ||
         model.id.includes('llama'))
      )
      ?.map((model: any) => model.id)
      ?.sort() || [];

    return models;
  } catch (error) {
    console.error('获取OpenRouter模型失败:', error);
    // 返回默认模型作为备选
    return [
      'openai/gpt-4o-mini',
      'openai/gpt-4o',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'google/gemini-pro'
    ];
  }
}

// 获取DeepSeek模型列表
async function fetchDeepSeekModels(): Promise<string[]> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      ?.filter((model: any) => model.id && model.id.includes('deepseek'))
      ?.map((model: any) => model.id)
      ?.sort() || [];

    return models;
  } catch (error) {
    console.error('获取DeepSeek模型失败:', error);
    return ['deepseek-chat', 'deepseek-coder'];
  }
}

// 获取OpenAI模型列表
async function fetchOpenAIModels(): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      ?.filter((model: any) => 
        model.id && 
        (model.id.includes('gpt-4') || model.id.includes('gpt-3.5'))
      )
      ?.map((model: any) => model.id)
      ?.sort() || [];

    return models;
  } catch (error) {
    console.error('获取OpenAI模型失败:', error);
    return ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'];
  }
}

// 获取所有模型
async function getAllModels(): Promise<Record<string, string[]>> {
  // 检查缓存
  if (modelCache && Date.now() - modelCache.timestamp < CACHE_DURATION) {
    return modelCache.data;
  }

  try {
    const [openrouterModels, deepseekModels, openaiModels] = await Promise.all([
      fetchOpenRouterModels(),
      fetchDeepSeekModels(),
      fetchOpenAIModels()
    ]);

    const models = {
      openrouter: openrouterModels,
      deepseek: deepseekModels,
      openai: openaiModels
    };

    // 更新缓存
    modelCache = {
      data: models,
      timestamp: Date.now()
    };

    return models;
  } catch (error) {
    console.error('获取模型列表失败:', error);
    
    // 返回默认模型
    return {
      openrouter: [
        'openai/gpt-4o-mini',
        'openai/gpt-4o',
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-haiku',
        'google/gemini-pro'
      ],
      deepseek: ['deepseek-chat', 'deepseek-coder'],
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo']
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const models = await getAllModels();
    
    return NextResponse.json({
      success: true,
      models,
      cache_timestamp: modelCache?.timestamp,
      cache_age: modelCache ? Date.now() - modelCache.timestamp : 0
    });

  } catch (error) {
    console.error('获取模型列表失败:', error);
    return NextResponse.json({
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : "获取模型列表失败"
    }, { status: 500 });
  }
}
