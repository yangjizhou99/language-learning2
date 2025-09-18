export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// 定义模型配置
const MODEL_CONFIGS = {
  openrouter: {
    name: 'OpenRouter',
    models: [
      { id: 'openrouter/auto', name: 'Auto (智能选择)', description: '根据任务自动选择最佳模型' },

      // Anthropic Claude 系列
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic最新模型，性能卓越',
      },
      { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: '快速且经济实惠' },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', description: '最强大的Claude模型' },
      { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', description: '平衡性能和成本' },
      { id: 'anthropic/claude-2.1', name: 'Claude 2.1', description: 'Claude 2系列最新版本' },
      { id: 'anthropic/claude-2', name: 'Claude 2', description: 'Claude 2基础版本' },
      {
        id: 'anthropic/claude-instant-1.2',
        name: 'Claude Instant 1.2',
        description: 'Claude快速版本',
      },

      // OpenAI 系列
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI最新多模态模型' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', description: '经济实惠的GPT-4o版本' },
      { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', description: 'GPT-4高性能版本' },
      {
        id: 'openai/gpt-4-turbo-preview',
        name: 'GPT-4 Turbo Preview',
        description: 'GPT-4 Turbo预览版本',
      },
      { id: 'openai/gpt-4', name: 'GPT-4', description: 'OpenAI GPT-4基础版本' },
      { id: 'openai/gpt-4-32k', name: 'GPT-4 32K', description: 'GPT-4长上下文版本' },
      { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速经济模型' },
      {
        id: 'openai/gpt-3.5-turbo-16k',
        name: 'GPT-3.5 Turbo 16K',
        description: 'GPT-3.5长上下文版本',
      },
      { id: 'openai/o1-preview', name: 'o1 Preview', description: 'OpenAI推理模型' },
      { id: 'openai/o1-mini', name: 'o1 Mini', description: 'OpenAI快速推理模型' },
      {
        id: 'openai/gpt-5-preview',
        name: 'GPT-5 Preview (待发布)',
        description: 'OpenAI下一代模型预览',
      },

      // Google 系列
      { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', description: 'Google最新模型' },
      { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', description: 'Google快速模型' },
      { id: 'google/gemini-pro', name: 'Gemini Pro', description: 'Google Gemini Pro' },
      { id: 'google/gemini-flash', name: 'Gemini Flash', description: 'Google Gemini Flash' },
      { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', description: 'Google开源模型' },
      { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', description: 'Google大参数开源模型' },
      { id: 'google/gemma-7b-it', name: 'Gemma 7B', description: 'Google Gemma 7B' },

      // Meta Llama 系列
      { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Meta开源模型' },
      {
        id: 'meta-llama/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B',
        description: 'Meta大参数模型',
      },
      {
        id: 'meta-llama/llama-3.1-405b-instruct',
        name: 'Llama 3.1 405B',
        description: 'Meta超大参数模型',
      },
      {
        id: 'meta-llama/llama-3.2-11b-vision-instruct',
        name: 'Llama 3.2 11B Vision',
        description: '支持视觉的Llama模型',
      },
      {
        id: 'meta-llama/llama-3.2-90b-vision-instruct',
        name: 'Llama 3.2 90B Vision',
        description: '大参数视觉模型',
      },
      { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', description: 'Llama 3基础版本' },
      {
        id: 'meta-llama/llama-3-70b-instruct',
        name: 'Llama 3 70B',
        description: 'Llama 3大参数版本',
      },
      { id: 'meta-llama/llama-2-7b-chat', name: 'Llama 2 7B Chat', description: 'Llama 2对话模型' },
      {
        id: 'meta-llama/llama-2-13b-chat',
        name: 'Llama 2 13B Chat',
        description: 'Llama 2中等参数模型',
      },
      {
        id: 'meta-llama/llama-2-70b-chat',
        name: 'Llama 2 70B Chat',
        description: 'Llama 2大参数模型',
      },

      // DeepSeek 系列
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', description: 'DeepSeek对话模型' },
      { id: 'deepseek/deepseek-coder', name: 'DeepSeek Coder', description: 'DeepSeek代码模型' },
      {
        id: 'deepseek/deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        description: 'DeepSeek推理模型',
      },
      { id: 'deepseek/deepseek-v2.5', name: 'DeepSeek V2.5', description: 'DeepSeek最新版本' },
      { id: 'deepseek/deepseek-v2', name: 'DeepSeek V2', description: 'DeepSeek V2版本' },

      // 阿里 Qwen 系列
      { id: 'qwen/qwen-2.5-7b-instruct', name: 'Qwen 2.5 7B', description: '阿里最新7B模型' },
      { id: 'qwen/qwen-2.5-14b-instruct', name: 'Qwen 2.5 14B', description: '阿里14B模型' },
      { id: 'qwen/qwen-2.5-32b-instruct', name: 'Qwen 2.5 32B', description: '阿里32B模型' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', description: '阿里72B大模型' },
      { id: 'qwen/qwen-2-7b-instruct', name: 'Qwen 2 7B', description: '阿里Qwen 2 7B' },
      { id: 'qwen/qwen-2-14b-instruct', name: 'Qwen 2 14B', description: '阿里Qwen 2 14B' },
      { id: 'qwen/qwen-2-32b-instruct', name: 'Qwen 2 32B', description: '阿里Qwen 2 32B' },
      { id: 'qwen/qwen-2-72b-instruct', name: 'Qwen 2 72B', description: '阿里Qwen 2 72B' },
      { id: 'qwen/qwen-1.5-7b-chat', name: 'Qwen 1.5 7B Chat', description: '阿里Qwen 1.5 7B' },
      { id: 'qwen/qwen-1.5-14b-chat', name: 'Qwen 1.5 14B Chat', description: '阿里Qwen 1.5 14B' },
      { id: 'qwen/qwen-1.5-32b-chat', name: 'Qwen 1.5 32B Chat', description: '阿里Qwen 1.5 32B' },
      { id: 'qwen/qwen-1.5-72b-chat', name: 'Qwen 1.5 72B Chat', description: '阿里Qwen 1.5 72B' },

      // Mistral 系列
      {
        id: 'mistralai/mistral-7b-instruct',
        name: 'Mistral 7B',
        description: 'Mistral 7B指令模型',
      },
      {
        id: 'mistralai/mixtral-8x7b-instruct',
        name: 'Mixtral 8x7B',
        description: 'Mistral混合专家模型',
      },
      {
        id: 'mistralai/mixtral-8x22b-instruct',
        name: 'Mixtral 8x22B',
        description: 'Mistral大参数混合模型',
      },
      { id: 'mistralai/mistral-nemo', name: 'Mistral Nemo', description: 'Mistral Nemo模型' },
      { id: 'mistralai/mistral-large', name: 'Mistral Large', description: 'Mistral大模型' },

      // Cohere 系列
      { id: 'cohere/command-r-plus', name: 'Command R+', description: 'Cohere最新模型' },
      { id: 'cohere/command-r', name: 'Command R', description: 'Cohere R系列模型' },
      { id: 'cohere/command', name: 'Command', description: 'Cohere基础模型' },
      { id: 'cohere/command-light', name: 'Command Light', description: 'Cohere轻量模型' },

      // 其他模型
      { id: '01-ai/yi-34b-chat', name: 'Yi 34B Chat', description: '零一万物34B模型' },
      { id: '01-ai/yi-6b-chat', name: 'Yi 6B Chat', description: '零一万物6B模型' },
      {
        id: 'microsoft/phi-3-medium-4k-instruct',
        name: 'Phi-3 Medium',
        description: '微软Phi-3中等模型',
      },
      {
        id: 'microsoft/phi-3-mini-4k-instruct',
        name: 'Phi-3 Mini',
        description: '微软Phi-3小模型',
      },
      {
        id: 'stabilityai/stablelm-2-zephyr-1.6b',
        name: 'StableLM 2 Zephyr',
        description: 'Stability AI轻量模型',
      },
      {
        id: 'huggingface/zephyr-7b-beta',
        name: 'Zephyr 7B Beta',
        description: 'Hugging Face Zephyr模型',
      },
      {
        id: 'togethercomputer/llama-2-7b-chat',
        name: 'Llama 2 7B (Together)',
        description: 'Together AI托管版本',
      },
      {
        id: 'togethercomputer/llama-2-70b-chat',
        name: 'Llama 2 70B (Together)',
        description: 'Together AI大参数版本',
      },
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话模型' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', description: '代码专用模型' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '推理专用模型' },
    ],
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: '最新多模态模型' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: '经济实惠版本' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '高性能模型' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速经济模型' },
    ],
  },
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      providers: MODEL_CONFIGS,
    });
  } catch (error) {
    console.error('获取模型列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取模型列表失败',
      },
      { status: 500 },
    );
  }
}
