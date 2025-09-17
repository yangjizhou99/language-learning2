"use client";

import { useState } from 'react';
import type { InvitationPermissions } from '@/types/invitation';

interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: InvitationPermissions;
}

const PREDEFINED_TEMPLATES: PermissionTemplate[] = [
  {
    id: 'basic',
    name: '基础用户',
    description: '只能进行基础练习，无AI功能',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: false,
      can_access_articles: false,
      allowed_languages: ['en'],
      allowed_levels: [1, 2],
      max_daily_attempts: 20,
      ai_enabled: false,
      api_limits: {
        enabled: false
      }
    }
  },
  {
    id: 'standard',
    name: '标准用户',
    description: '可以访问大部分功能，无AI功能',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4],
      max_daily_attempts: 50,
      ai_enabled: false,
      api_limits: {
        enabled: false
      }
    }
  },
  {
    id: 'premium',
    name: '高级用户',
    description: '可以访问所有功能，包括AI功能',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 100,
      ai_enabled: true,
      api_limits: {
        enabled: true,
        daily_calls_limit: 100,
        daily_tokens_limit: 50000,
        daily_cost_limit: 5.00,
        monthly_calls_limit: 2000,
        monthly_tokens_limit: 1000000,
        monthly_cost_limit: 100.00
      },
      api_keys: {
        deepseek: '',
        openrouter: ''
      },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 50,
          token_limit: 100000,
          enabled: true
        },
        {
          model_id: 'openrouter/auto',
          model_name: 'OpenRouter Auto (推荐)',
          provider: 'openrouter',
          daily_limit: 30,
          token_limit: 80000,
          enabled: true
        }
      ]
    }
  },
  {
    id: 'trial',
    name: '试用用户',
    description: '限制性试用，只能使用部分功能',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: false,
      can_access_alignment: false,
      can_access_articles: false,
      allowed_languages: ['en'],
      allowed_levels: [1],
      max_daily_attempts: 5,
      ai_enabled: false,
      api_limits: {
        enabled: false
      }
    }
  },
  {
    id: 'english_only',
    name: '英语专修',
    description: '专门学习英语的用户',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 80,
      ai_enabled: true,
      api_limits: {
        enabled: true,
        daily_calls_limit: 50,
        daily_tokens_limit: 25000,
        daily_cost_limit: 2.50,
        monthly_calls_limit: 1000,
        monthly_tokens_limit: 500000,
        monthly_cost_limit: 50.00
      },
      api_keys: {
        deepseek: '',
        openrouter: ''
      },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 25,
          token_limit: 50000,
          enabled: true
        }
      ]
    }
  },
  {
    id: 'japanese_only',
    name: '日语专修',
    description: '专门学习日语的用户',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['ja'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 80,
      ai_enabled: true,
      api_limits: {
        enabled: true,
        daily_calls_limit: 50,
        daily_tokens_limit: 25000,
        daily_cost_limit: 2.50,
        monthly_calls_limit: 1000,
        monthly_tokens_limit: 500000,
        monthly_cost_limit: 50.00
      },
      api_keys: {
        deepseek: '',
        openrouter: ''
      },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 25,
          token_limit: 50000,
          enabled: true
        }
      ]
    }
  }
];

interface InvitationPermissionTemplatesProps {
  onSelectTemplate: (permissions: InvitationPermissions) => void;
  currentPermissions?: InvitationPermissions;
}

export default function InvitationPermissionTemplates({ 
  onSelectTemplate, 
  currentPermissions 
}: InvitationPermissionTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (template: PermissionTemplate) => {
    setSelectedTemplate(template.id);
    onSelectTemplate(template.permissions);
  };

  const isTemplateSelected = (template: PermissionTemplate) => {
    if (selectedTemplate === template.id) return true;
    if (!currentPermissions) return false;
    
    // 检查当前权限是否匹配模板
    return (
      template.permissions.can_access_shadowing === currentPermissions.can_access_shadowing &&
      template.permissions.can_access_cloze === currentPermissions.can_access_cloze &&
      template.permissions.can_access_alignment === currentPermissions.can_access_alignment &&
      template.permissions.can_access_articles === currentPermissions.can_access_articles &&
      template.permissions.ai_enabled === currentPermissions.ai_enabled &&
      template.permissions.max_daily_attempts === currentPermissions.max_daily_attempts &&
      JSON.stringify(template.permissions.allowed_languages?.sort()) === JSON.stringify(currentPermissions.allowed_languages?.sort()) &&
      JSON.stringify(template.permissions.allowed_levels?.sort()) === JSON.stringify(currentPermissions.allowed_levels?.sort())
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-600 mb-2">权限模板</h4>
        <p className="text-xs text-gray-500 mb-3">快速选择常用的权限配置</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PREDEFINED_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
              isTemplateSelected(template)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => handleTemplateSelect(template)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h5 className="font-medium text-sm text-gray-900">{template.name}</h5>
                <p className="text-xs text-gray-600 mt-1">{template.description}</p>
              </div>
              {isTemplateSelected(template) && (
                <div className="text-blue-600 text-sm">✓</div>
              )}
            </div>
            
            <div className="mt-2 flex flex-wrap gap-1">
              {template.permissions.can_access_shadowing && <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">跟读</span>}
              {template.permissions.can_access_cloze && <span className="px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">完形</span>}
              {template.permissions.can_access_alignment && <span className="px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">对齐</span>}
              {template.permissions.can_access_articles && <span className="px-1 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">文章</span>}
              {template.permissions.ai_enabled && <span className="px-1 py-0.5 bg-pink-100 text-pink-800 text-xs rounded">AI</span>}
            </div>
            
            <div className="mt-2 text-xs text-gray-500">
              <div>语言: {template.permissions.allowed_languages?.map(lang => 
                lang === 'en' ? '英语' : lang === 'ja' ? '日语' : '中文'
              ).join(', ')}</div>
              <div>等级: {template.permissions.allowed_levels?.join(', ')} | 限制: {template.permissions.max_daily_attempts}次/日</div>
              {template.permissions.api_limits?.enabled && (
                <div className="text-blue-600">
                  API限制: {template.permissions.api_limits.daily_calls_limit}次/日, 
                  ${template.permissions.api_limits.daily_cost_limit}/日
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
