'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
  Trash,
} from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/Container';

interface ModelPermission {
  model_id: string;
  model_name: string;
  provider: string;
  daily_limit: number;
  token_limit: number;
  enabled: boolean;
}

interface UserPermissions {
  user_id: string;
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  model_permissions: ModelPermission[];
  api_keys?: {
    deepseek?: string;
    openrouter?: string;
  };
  ai_enabled: boolean;
  custom_restrictions: Record<string, any>;
}

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: string;
}

export default function UserPermissionsPage() {
  const params = useParams();
  const userId = params?.userId as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUserAndPermissions = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // 获取用户信息
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('未登录');
      }

      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API请求失败: ${response.status}`);
      }

      const data = await response.json();
      const users = data.users || [];
      const foundUser = users.find((u: any) => u.id === userId);

      if (!foundUser) {
        throw new Error('用户不存在');
      }

      setUser(foundUser);

      // 获取权限设置
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (permissionsError && permissionsError.code !== 'PGRST116') {
        console.error('获取权限设置失败:', permissionsError);
        throw new Error('获取权限设置失败');
      } else if (permissions) {
        const permissionsWithDefaults: UserPermissions = {
          ...permissions,
          model_permissions: permissions.model_permissions ||
            permissions.custom_restrictions?.model_permissions || [
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
          api_keys: permissions.api_keys || {
            deepseek: '',
            openrouter: '',
          },
          ai_enabled: permissions.ai_enabled || false,
        };
        setPermissions(permissionsWithDefaults);
      } else {
        // 没有权限记录，创建默认权限
        const defaultPermissions: UserPermissions = {
          user_id: userId,
          can_access_shadowing: true,
          can_access_cloze: true,
          can_access_alignment: true,
          can_access_articles: true,
          allowed_languages: ['en', 'ja', 'zh'],
          allowed_levels: [1, 2, 3, 4, 5],
          max_daily_attempts: 50,
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
          api_keys: {
            deepseek: '',
            openrouter: '',
          },
          ai_enabled: false,
          custom_restrictions: {},
        };
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      setMessage({ type: 'error', text: '获取数据失败' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUserAndPermissions();
    }
  }, [userId]);

  const handlePermissionChange = (field: keyof UserPermissions, value: any) => {
    if (!permissions) return;
    setPermissions({ ...permissions, [field]: value });
  };

  const handleModelPermissionChange = (index: number, field: keyof ModelPermission, value: any) => {
    if (!permissions) return;
    const updatedModelPermissions = permissions.model_permissions.map((model, i) =>
      i === index ? { ...model, [field]: value } : model,
    );
    setPermissions({ ...permissions, model_permissions: updatedModelPermissions });
  };

  const addModelPermission = () => {
    if (!permissions) return;
    const newModel: ModelPermission = {
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

  const removeModelPermission = (modelId: string) => {
    if (!permissions) return;
    setPermissions({
      ...permissions,
      model_permissions: permissions.model_permissions.filter(
        (model) => model.model_id !== modelId,
      ),
    });
  };

  const handleSave = async () => {
    if (!permissions) return;

    setSaving(true);
    setMessage(null);

    try {
      // 创建权限对象，将model_permissions存储在custom_restrictions中
      const permissionsToSave = {
        user_id: permissions.user_id,
        can_access_shadowing: permissions.can_access_shadowing,
        can_access_cloze: permissions.can_access_cloze,
        can_access_alignment: permissions.can_access_alignment,
        can_access_articles: permissions.can_access_articles,
        allowed_languages: permissions.allowed_languages,
        allowed_levels: permissions.allowed_levels,
        max_daily_attempts: permissions.max_daily_attempts,
        api_keys: permissions.api_keys,
        ai_enabled: permissions.ai_enabled,
        custom_restrictions: {
          ...permissions.custom_restrictions,
          model_permissions: permissions.model_permissions,
        },
      };

      const { error } = await supabase.from('user_permissions').upsert(permissionsToSave, {
        onConflict: 'user_id',
        ignoreDuplicates: false,
      });

      if (error) {
        console.error('保存权限失败:', error);
        throw new Error('保存权限设置失败');
      }

      setMessage({ type: 'success', text: '权限设置已保存' });
    } catch (error) {
      console.error('保存失败:', error);
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

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

  if (!user || !permissions) {
    return (
      <Container>
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">用户不存在</h2>
          <p className="text-gray-600 mb-4">无法找到指定的用户</p>
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">用户权限管理</h1>
            <p className="text-gray-600">管理用户 {user.username || user.email} 的访问权限</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/users">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回用户列表
              </Button>
            </Link>
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
            <TabsTrigger value="limits">模型控制</TabsTrigger>
            <TabsTrigger value="api-keys">API密钥</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  功能访问权限
                </CardTitle>
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

          {/* API密钥管理 */}
          <TabsContent value="api-keys" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  AI功能配置
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  启用AI功能并配置API密钥，用户将能够使用AI生成内容
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* AI功能总开关 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">启用AI功能</Label>
                      <p className="text-sm text-muted-foreground">
                        开启后用户可以使用AI生成内容，需要配置API密钥
                      </p>
                    </div>
                    <Switch
                      checked={permissions?.ai_enabled || false}
                      onCheckedChange={(checked) => handlePermissionChange('ai_enabled', checked)}
                    />
                  </div>
                </div>

                {/* API密钥配置 - 只有开启AI功能时才显示 */}
                {permissions?.ai_enabled && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">API密钥配置</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        配置一个API密钥即可使用所有AI功能，推荐使用OpenRouter
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="openrouter-key">OpenRouter API Key (推荐)</Label>
                        <Input
                          id="openrouter-key"
                          type="password"
                          placeholder="sk-or-..."
                          value={permissions?.api_keys?.openrouter || ''}
                          onChange={(e) =>
                            handlePermissionChange('api_keys', {
                              ...permissions?.api_keys,
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
                          value={permissions?.api_keys?.deepseek || ''}
                          onChange={(e) =>
                            handlePermissionChange('api_keys', {
                              ...permissions?.api_keys,
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

                {/* 模型配置 - 只有开启AI功能时才显示 */}
                {permissions?.ai_enabled && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">可用模型配置</Label>
                      <p className="text-sm text-muted-foreground mb-4">
                        配置用户可以访问的AI模型及其使用限制
                      </p>
                    </div>

                    <div className="space-y-4">
                      {(permissions?.model_permissions || []).map((model, index) => (
                        <div
                          key={model.model_id || index}
                          className="p-4 border rounded-lg space-y-4"
                        >
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
                                onClick={() => removeModelPermission(model.model_id)}
                              >
                                <Trash className="h-4 w-4 mr-1" />
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
                      {permissions?.api_keys
                        ? Object.entries(permissions.api_keys)
                            .filter(([_, value]) => value)
                            .map(([key, _]) => key)
                            .join(', ') || '无'
                        : '无'}
                    </div>
                    <div className="text-sm">
                      <strong>可用模型：</strong>
                      {(permissions?.model_permissions || [])
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
        </Tabs>
      </div>
    </Container>
  );
}
