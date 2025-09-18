'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Save,
  Shield,
  Globe,
  Target,
  Settings,
  CheckCircle,
  AlertCircle,
  Users,
  Copy,
  Bookmark,
  Download,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';

interface DefaultPermissions {
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  ai_enabled: boolean;
  api_keys: {
    deepseek?: string;
    openrouter?: string;
  };
  model_permissions: Array<{
    model_id: string;
    model_name: string;
    provider: string;
    daily_limit: number;
    token_limit: number;
    enabled: boolean;
  }>;
  custom_restrictions: Record<string, any>;
}

export default function DefaultPermissionsPage() {
  const [permissions, setPermissions] = useState<DefaultPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; permissions: DefaultPermissions }>
  >([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const fetchDefaultPermissions = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // 获取用户认证信息
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登录');
      }

      // 从数据库获取默认权限设置
      const { data: defaultPerms, error } = await supabase
        .from('default_user_permissions')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        console.error('获取默认权限设置失败:', error);
        throw new Error('获取默认权限设置失败');
      }

      if (defaultPerms) {
        setPermissions({
          can_access_shadowing: defaultPerms.can_access_shadowing ?? true,
          can_access_cloze: defaultPerms.can_access_cloze ?? true,
          can_access_alignment: defaultPerms.can_access_alignment ?? true,
          can_access_articles: defaultPerms.can_access_articles ?? true,
          allowed_languages: defaultPerms.allowed_languages || ['en', 'ja', 'zh'],
          allowed_levels: defaultPerms.allowed_levels || [1, 2, 3, 4, 5],
          max_daily_attempts: defaultPerms.max_daily_attempts || 50,
          ai_enabled: defaultPerms.ai_enabled || false,
          api_keys: defaultPerms.api_keys || { deepseek: '', openrouter: '' },
          model_permissions: defaultPerms.model_permissions || [
            {
              model_id: 'deepseek-chat',
              model_name: 'DeepSeek Chat',
              provider: 'deepseek',
              daily_limit: 50,
              token_limit: 100000,
              enabled: true,
            },
            {
              model_id: 'openrouter/auto',
              model_name: 'OpenRouter Auto (推荐)',
              provider: 'openrouter',
              daily_limit: 30,
              token_limit: 80000,
              enabled: true,
            },
          ],
          custom_restrictions: defaultPerms.custom_restrictions || {},
        });
      } else {
        // 没有默认权限记录，创建默认值
        const defaultPermissions: DefaultPermissions = {
          can_access_shadowing: true,
          can_access_cloze: true,
          can_access_alignment: true,
          can_access_articles: true,
          allowed_languages: ['en', 'ja', 'zh'],
          allowed_levels: [1, 2, 3, 4, 5],
          max_daily_attempts: 50,
          ai_enabled: false,
          api_keys: { deepseek: '', openrouter: '' },
          model_permissions: [
            {
              model_id: 'deepseek-chat',
              model_name: 'DeepSeek Chat',
              provider: 'deepseek',
              daily_limit: 50,
              token_limit: 100000,
              enabled: true,
            },
            {
              model_id: 'openrouter/auto',
              model_name: 'OpenRouter Auto (推荐)',
              provider: 'openrouter',
              daily_limit: 30,
              token_limit: 80000,
              enabled: true,
            },
          ],
          custom_restrictions: {},
        };
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('获取默认权限设置失败:', error);
      setMessage({ type: 'error', text: '获取默认权限设置失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaultPermissions();
  }, []);

  const handlePermissionChange = (field: keyof DefaultPermissions, value: any) => {
    if (!permissions) return;
    setPermissions({ ...permissions, [field]: value });
  };

  const handleModelPermissionChange = (index: number, field: string, value: any) => {
    if (!permissions) return;
    const updatedModelPermissions = permissions.model_permissions.map((model, i) =>
      i === index ? { ...model, [field]: value } : model,
    );
    setPermissions({ ...permissions, model_permissions: updatedModelPermissions });
  };

  const addModelPermission = () => {
    if (!permissions) return;
    const newModel = {
      model_id: '',
      model_name: '',
      provider: 'deepseek',
      daily_limit: 50,
      token_limit: 100000,
      enabled: true,
    };
    setPermissions({
      ...permissions,
      model_permissions: [...permissions.model_permissions, newModel],
    });
  };

  const removeModelPermission = (index: number) => {
    if (!permissions) return;
    setPermissions({
      ...permissions,
      model_permissions: permissions.model_permissions.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!permissions) return;

    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登录');
      }

      // 保存默认权限设置
      const { error } = await supabase.from('default_user_permissions').upsert(
        {
          id: 'default', // 使用固定ID
          can_access_shadowing: permissions.can_access_shadowing,
          can_access_cloze: permissions.can_access_cloze,
          can_access_alignment: permissions.can_access_alignment,
          can_access_articles: permissions.can_access_articles,
          allowed_languages: permissions.allowed_languages,
          allowed_levels: permissions.allowed_levels,
          max_daily_attempts: permissions.max_daily_attempts,
          ai_enabled: permissions.ai_enabled,
          api_keys: permissions.api_keys,
          model_permissions: permissions.model_permissions,
          custom_restrictions: permissions.custom_restrictions,
        },
        {
          onConflict: 'id',
          ignoreDuplicates: false,
        },
      );

      if (error) {
        console.error('保存默认权限设置失败:', error);
        throw new Error('保存默认权限设置失败');
      }

      setMessage({ type: 'success', text: '默认权限设置已保存' });
    } catch (error) {
      console.error('保存失败:', error);
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  const applyToExistingUsers = async () => {
    if (!permissions) return;

    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登录');
      }

      // 调用API批量应用权限
      const response = await fetch('/api/admin/users/apply-default-permissions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(permissions),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '应用权限失败');
      }

      const result = await response.json();
      setMessage({
        type: 'success',
        text: `成功为 ${result.updated_count} 个用户应用了默认权限设置`,
      });
    } catch (error) {
      console.error('应用权限失败:', error);
      setMessage({ type: 'error', text: '应用权限失败' });
    } finally {
      setSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!permissions || !templateName.trim()) return;

    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登录');
      }

      const template = {
        id: `template_${Date.now()}`,
        name: templateName.trim(),
        permissions: permissions,
      };

      // 保存模板到本地存储
      const existingTemplates = JSON.parse(localStorage.getItem('permission_templates') || '[]');
      existingTemplates.push(template);
      localStorage.setItem('permission_templates', JSON.stringify(existingTemplates));

      setTemplates(existingTemplates);
      setTemplateName('');
      setShowTemplateDialog(false);
      setMessage({ type: 'success', text: '模板保存成功' });
    } catch (error) {
      console.error('保存模板失败:', error);
      setMessage({ type: 'error', text: '保存模板失败' });
    } finally {
      setSaving(false);
    }
  };

  const loadTemplate = (template: {
    id: string;
    name: string;
    permissions: DefaultPermissions;
  }) => {
    setPermissions(template.permissions);
    setMessage({ type: 'success', text: `已加载模板: ${template.name}` });
  };

  const deleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter((t) => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem('permission_templates', JSON.stringify(updatedTemplates));
    setMessage({ type: 'success', text: '模板删除成功' });
  };

  const exportTemplate = (template: {
    id: string;
    name: string;
    permissions: DefaultPermissions;
  }) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string);
        if (template.name && template.permissions) {
          const existingTemplates = JSON.parse(
            localStorage.getItem('permission_templates') || '[]',
          );
          const newTemplate = {
            ...template,
            id: `template_${Date.now()}`,
          };
          existingTemplates.push(newTemplate);
          localStorage.setItem('permission_templates', JSON.stringify(existingTemplates));
          setTemplates(existingTemplates);
          setMessage({ type: 'success', text: `模板导入成功: ${template.name}` });
        } else {
          throw new Error('无效的模板文件');
        }
      } catch (error) {
        console.error('导入模板失败:', error);
        setMessage({ type: 'error', text: '导入模板失败，请检查文件格式' });
      }
    };
    reader.readAsText(file);
  };

  // 加载模板列表
  useEffect(() => {
    const savedTemplates = JSON.parse(localStorage.getItem('permission_templates') || '[]');
    setTemplates(savedTemplates);
  }, []);

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>加载中...</p>
          </div>
        </div>
      </Container>
    );
  }

  if (!permissions) {
    return (
      <Container>
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">加载失败</h2>
          <p className="text-gray-600 mb-4">无法加载默认权限设置</p>
          <Link href="/admin/users">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回用户列表
            </Button>
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <Breadcrumbs
        items={[
          { label: '管理员', href: '/admin' },
          { label: '用户管理', href: '/admin/users' },
          { label: '默认权限设置', href: '/admin/users/default-permissions' },
        ]}
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">默认权限设置</h1>
            <p className="text-gray-600">配置新注册用户的默认权限，这些设置将自动应用到新用户</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/users">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回用户列表
              </Button>
            </Link>
            <Button onClick={() => setShowTemplateDialog(true)} variant="outline">
              <Bookmark className="h-4 w-4 mr-2" />
              保存为模板
            </Button>
            <Button onClick={applyToExistingUsers} disabled={saving} variant="outline">
              <Users className="h-4 w-4 mr-2" />
              应用到现有用户
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>

        {message && (
          <Alert
            className={
              message.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
            }
          >
            <div className="flex items-center">
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
              )}
              <AlertDescription
                className={message.type === 'error' ? 'text-red-800' : 'text-green-800'}
              >
                {message.text}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Tabs defaultValue="access" className="space-y-6">
          <TabsList>
            <TabsTrigger value="access">访问权限</TabsTrigger>
            <TabsTrigger value="content">内容权限</TabsTrigger>
            <TabsTrigger value="limits">使用限制</TabsTrigger>
            <TabsTrigger value="ai">AI功能</TabsTrigger>
            <TabsTrigger value="templates">模板管理</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  功能访问权限
                </CardTitle>
                <p className="text-sm text-muted-foreground">设置新用户可以访问哪些功能模块</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Shadowing 练习</Label>
                        <p className="text-sm text-muted-foreground">允许用户进行跟读练习</p>
                      </div>
                      <Switch
                        checked={permissions.can_access_shadowing}
                        onCheckedChange={(checked) =>
                          handlePermissionChange('can_access_shadowing', checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Cloze 练习</Label>
                        <p className="text-sm text-muted-foreground">允许用户进行完形填空练习</p>
                      </div>
                      <Switch
                        checked={permissions.can_access_cloze}
                        onCheckedChange={(checked) =>
                          handlePermissionChange('can_access_cloze', checked)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Alignment 练习</Label>
                        <p className="text-sm text-muted-foreground">允许用户进行对齐练习</p>
                      </div>
                      <Switch
                        checked={permissions.can_access_alignment}
                        onCheckedChange={(checked) =>
                          handlePermissionChange('can_access_alignment', checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">广读文章</Label>
                        <p className="text-sm text-muted-foreground">允许用户访问广读文章</p>
                      </div>
                      <Switch
                        checked={permissions.can_access_articles}
                        onCheckedChange={(checked) =>
                          handlePermissionChange('can_access_articles', checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  内容权限
                </CardTitle>
                <p className="text-sm text-muted-foreground">设置新用户可以访问的语言和难度等级</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">允许的语言</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {['en', 'ja', 'zh'].map((lang) => (
                        <div key={lang} className="flex items-center space-x-2">
                          <Checkbox
                            id={`lang-${lang}`}
                            checked={permissions.allowed_languages.includes(lang)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handlePermissionChange('allowed_languages', [
                                  ...permissions.allowed_languages,
                                  lang,
                                ]);
                              } else {
                                handlePermissionChange(
                                  'allowed_languages',
                                  permissions.allowed_languages.filter((l) => l !== lang),
                                );
                              }
                            }}
                          />
                          <Label htmlFor={`lang-${lang}`} className="text-sm">
                            {lang === 'en' ? '英语' : lang === 'ja' ? '日语' : '中文'}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-medium">允许的等级</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div key={level} className="flex items-center space-x-2">
                          <Checkbox
                            id={`level-${level}`}
                            checked={permissions.allowed_levels.includes(level)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                handlePermissionChange('allowed_levels', [
                                  ...permissions.allowed_levels,
                                  level,
                                ]);
                              } else {
                                handlePermissionChange(
                                  'allowed_levels',
                                  permissions.allowed_levels.filter((l) => l !== level),
                                );
                              }
                            }}
                          />
                          <Label htmlFor={`level-${level}`} className="text-sm">
                            等级 {level}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="limits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  使用限制
                </CardTitle>
                <p className="text-sm text-muted-foreground">设置新用户的每日使用限制</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="max-attempts">每日最大练习次数</Label>
                  <Input
                    id="max-attempts"
                    type="number"
                    min="0"
                    value={permissions.max_daily_attempts}
                    onChange={(e) =>
                      handlePermissionChange('max_daily_attempts', parseInt(e.target.value) || 0)
                    }
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    设置用户每天可以进行的最大练习次数，0 表示无限制
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  AI功能配置
                </CardTitle>
                <p className="text-sm text-muted-foreground">配置新用户的AI功能权限和模型访问</p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI功能总开关 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">启用AI功能</Label>
                      <p className="text-sm text-muted-foreground">
                        开启后新用户可以使用AI生成内容
                      </p>
                    </div>
                    <Switch
                      checked={permissions.ai_enabled}
                      onCheckedChange={(checked) => handlePermissionChange('ai_enabled', checked)}
                    />
                  </div>
                </div>

                {/* API密钥配置 */}
                {permissions.ai_enabled && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">默认API密钥配置</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        为所有新用户提供默认的API密钥配置
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="openrouter-key">OpenRouter API Key (推荐)</Label>
                        <Input
                          id="openrouter-key"
                          type="password"
                          placeholder="sk-or-..."
                          value={permissions.api_keys.openrouter || ''}
                          onChange={(e) =>
                            handlePermissionChange('api_keys', {
                              ...permissions.api_keys,
                              openrouter: e.target.value,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          推荐使用OpenRouter，可以访问多种AI模型，性价比高
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="deepseek-key">DeepSeek API Key (可选)</Label>
                        <Input
                          id="deepseek-key"
                          type="password"
                          placeholder="sk-..."
                          value={permissions.api_keys.deepseek || ''}
                          onChange={(e) =>
                            handlePermissionChange('api_keys', {
                              ...permissions.api_keys,
                              deepseek: e.target.value,
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          可选，如果配置了DeepSeek密钥，将优先使用DeepSeek模型
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 模型配置 */}
                {permissions.ai_enabled && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">默认模型配置</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        配置新用户可以访问的AI模型及其使用限制
                      </p>
                    </div>

                    <div className="space-y-4">
                      {permissions.model_permissions.map((model, index) => (
                        <div key={index} className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">
                              {model.model_name || `模型 ${index + 1}`}
                            </h4>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={model.enabled}
                                onCheckedChange={(checked) =>
                                  handleModelPermissionChange(index, 'enabled', checked)
                                }
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeModelPermission(index)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <Label htmlFor={`model-id-${index}`}>模型ID</Label>
                              <Input
                                id={`model-id-${index}`}
                                value={model.model_id}
                                onChange={(e) =>
                                  handleModelPermissionChange(index, 'model_id', e.target.value)
                                }
                                placeholder="deepseek-chat"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`model-name-${index}`}>模型名称</Label>
                              <Input
                                id={`model-name-${index}`}
                                value={model.model_name}
                                onChange={(e) =>
                                  handleModelPermissionChange(index, 'model_name', e.target.value)
                                }
                                placeholder="DeepSeek Chat"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`provider-${index}`}>提供商</Label>
                              <Select
                                value={model.provider}
                                onValueChange={(value) =>
                                  handleModelPermissionChange(index, 'provider', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                                  <SelectItem value="openrouter">OpenRouter (推荐)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor={`daily-limit-${index}`}>每日次数限制</Label>
                              <Input
                                id={`daily-limit-${index}`}
                                type="number"
                                min="0"
                                value={model.daily_limit}
                                onChange={(e) =>
                                  handleModelPermissionChange(
                                    index,
                                    'daily_limit',
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor={`token-limit-${index}`}>Token限制</Label>
                              <Input
                                id={`token-limit-${index}`}
                                type="number"
                                min="0"
                                value={model.token_limit}
                                onChange={(e) =>
                                  handleModelPermissionChange(
                                    index,
                                    'token_limit',
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                placeholder="100000"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button onClick={addModelPermission} size="sm" variant="outline">
                      添加模型
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>当前配置摘要</Label>
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="text-sm">
                      <strong>API密钥：</strong>
                      {Object.entries(permissions.api_keys)
                        .filter(([_, value]) => value)
                        .map(([key, _]) => key)
                        .join(', ') || '无'}
                    </div>
                    <div className="text-sm">
                      <strong>可用模型：</strong>
                      {permissions.model_permissions
                        .filter((m) => m.enabled)
                        .map(
                          (m) => `${m.model_name} (${m.daily_limit}次/日, ${m.token_limit} tokens)`,
                        )
                        .join(', ') || '无'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5" />
                  权限模板管理
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  保存、加载和管理权限配置模板，方便快速应用不同的权限设置
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 模板操作按钮 */}
                <div className="flex items-center gap-4">
                  <Button onClick={() => setShowTemplateDialog(true)} size="sm">
                    <Bookmark className="h-4 w-4 mr-2" />
                    保存当前配置为模板
                  </Button>
                  <label className="cursor-pointer">
                    <Button asChild size="sm" variant="outline">
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        导入模板
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      onChange={importTemplate}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* 模板列表 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">已保存的模板</h3>
                  {templates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暂无保存的模板</div>
                  ) : (
                    <div className="grid gap-4">
                      {templates.map((template) => (
                        <div key={template.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{template.name}</h4>
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => loadTemplate(template)}
                                size="sm"
                                variant="outline"
                              >
                                加载
                              </Button>
                              <Button
                                onClick={() => exportTemplate(template)}
                                size="sm"
                                variant="outline"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                导出
                              </Button>
                              <Button
                                onClick={() => deleteTemplate(template.id)}
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <div>
                              功能权限:{' '}
                              {Object.entries(template.permissions)
                                .filter(
                                  ([key, value]) => key.startsWith('can_access_') && value === true,
                                )
                                .map(([key]) => key.replace('can_access_', ''))
                                .join(', ') || '无'}
                            </div>
                            <div>
                              语言: {template.permissions.allowed_languages?.join(', ') || '无'}
                            </div>
                            <div>
                              等级: {template.permissions.allowed_levels?.join(', ') || '无'}
                            </div>
                            <div>AI功能: {template.permissions.ai_enabled ? '启用' : '禁用'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 保存模板对话框 */}
        {showTemplateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-96">
              <h3 className="text-lg font-semibold mb-4">保存为模板</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="template-name">模板名称</Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="输入模板名称"
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setShowTemplateDialog(false);
                      setTemplateName('');
                    }}
                    variant="outline"
                  >
                    取消
                  </Button>
                  <Button onClick={saveAsTemplate} disabled={!templateName.trim() || saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}
