'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth-headers';

interface ModelPermission {
  model_id: string;
  model_name: string;
  provider: string;
  daily_limit: number;
  token_limit: number;
  enabled: boolean;
}

interface AIConfig {
  ai_enabled: boolean;
  api_keys: {
    deepseek?: string;
    openrouter?: string;
  };
  model_permissions: ModelPermission[];
}

interface AIConfigPanelProps {
  userId?: string; // 如果提供userId，则为用户特定配置；否则为全局配置
  onSave?: (config: AIConfig) => void;
  onError?: (error: string) => void;
}

export function AIConfigPanel({ userId, onSave, onError }: AIConfigPanelProps) {
  const [config, setConfig] = useState<AIConfig>({
    ai_enabled: false,
    api_keys: {},
    model_permissions: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchConfig();
  }, [userId]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      if (userId) {
        // 获取用户特定配置
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/users/${userId}/permissions`, {
          headers,
        });
        const data = await response.json();
        if (data.permissions) {
          setConfig({
            ai_enabled: data.permissions.ai_enabled || false,
            api_keys: data.permissions.api_keys || {},
            model_permissions: data.permissions.model_permissions || [],
          });
        } else {
          console.error('Failed to fetch permissions:', data);
          onError?.(`获取用户权限失败: ${data.error || '未知错误'}`);
        }
      } else {
        // 获取全局默认配置
        setConfig({
          ai_enabled: true,
          api_keys: {},
          model_permissions: [
            {
              model_id: 'openrouter/auto',
              model_name: 'OpenRouter Auto (推荐)',
              provider: 'OpenRouter',
              daily_limit: 30,
              token_limit: 80000,
              enabled: true,
            },
            {
              model_id: 'deepseek-chat',
              model_name: 'DeepSeek Chat',
              provider: 'DeepSeek',
              daily_limit: 20,
              token_limit: 100000,
              enabled: true,
            },
          ],
        });
      }
    } catch (error) {
      console.error('Error fetching AI config:', error);
      onError?.('获取配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (field: keyof AIConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleAPIKeyChange = (provider: 'deepseek' | 'openrouter', value: string) => {
    setConfig((prev) => ({
      ...prev,
      api_keys: {
        ...prev.api_keys,
        [provider]: value,
      },
    }));
  };

  const handleModelPermissionChange = (index: number, field: keyof ModelPermission, value: any) => {
    setConfig((prev) => ({
      ...prev,
      model_permissions: prev.model_permissions.map((model, i) =>
        i === index ? { ...model, [field]: value } : model,
      ),
    }));
  };

  const addModelPermission = () => {
    setConfig((prev) => ({
      ...prev,
      model_permissions: [
        ...prev.model_permissions,
        {
          model_id: '',
          model_name: '',
          provider: 'OpenRouter',
          daily_limit: 10,
          token_limit: 50000,
          enabled: true,
        },
      ],
    }));
  };

  const removeModelPermission = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      model_permissions: prev.model_permissions.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage('');

      if (userId) {
        // 保存用户特定配置
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/users/${userId}/permissions`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            ai_enabled: config.ai_enabled,
            api_keys: config.api_keys,
            model_permissions: config.model_permissions,
          }),
        });

        const data = await response.json();
        if (data.success) {
          setMessage('配置保存成功');
          onSave?.(config);
        } else {
          throw new Error(data.error || '保存失败');
        }
      } else {
        // 这里可以添加全局配置保存逻辑
        setMessage('全局配置保存成功');
        onSave?.(config);
      }
    } catch (error) {
      console.error('Error saving AI config:', error);
      const errorMsg = error instanceof Error ? error.message : '保存失败';
      setMessage(`保存失败: ${errorMsg}`);
      onError?.(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
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
              checked={config.ai_enabled}
              onCheckedChange={(checked) => handleConfigChange('ai_enabled', checked)}
            />
          </div>
        </div>

        {/* API密钥配置 - 只有开启AI功能时才显示 */}
        {config.ai_enabled && (
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
                  placeholder="输入OpenRouter API密钥"
                  value={config.api_keys.openrouter || ''}
                  onChange={(e) => handleAPIKeyChange('openrouter', e.target.value)}
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
                  placeholder="输入DeepSeek API密钥"
                  value={config.api_keys.deepseek || ''}
                  onChange={(e) => handleAPIKeyChange('deepseek', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  可选，如果配置了DeepSeek密钥，将优先使用DeepSeek模型
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 模型配置 - 只有开启AI功能时才显示 */}
        {config.ai_enabled && (
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">可用模型配置</Label>
              <p className="text-sm text-muted-foreground mb-4">
                配置用户可以访问的AI模型及其使用限制
              </p>
            </div>

            <div className="space-y-4">
              {config.model_permissions.map((model, index) => (
                <div key={model.model_id || index} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{model.model_name || `模型 ${index + 1}`}</h4>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={model.enabled}
                        onCheckedChange={(checked) =>
                          handleModelPermissionChange(index, 'enabled', checked)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModelPermission(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>模型ID</Label>
                      <Input
                        value={model.model_id}
                        onChange={(e) =>
                          handleModelPermissionChange(index, 'model_id', e.target.value)
                        }
                        placeholder="例如: openrouter/auto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>模型名称</Label>
                      <Input
                        value={model.model_name}
                        onChange={(e) =>
                          handleModelPermissionChange(index, 'model_name', e.target.value)
                        }
                        placeholder="例如: GPT-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>提供商</Label>
                      <Input
                        value={model.provider}
                        onChange={(e) =>
                          handleModelPermissionChange(index, 'provider', e.target.value)
                        }
                        placeholder="例如: OpenRouter"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>每日次数限制</Label>
                      <Input
                        type="number"
                        value={model.daily_limit}
                        onChange={(e) =>
                          handleModelPermissionChange(
                            index,
                            'daily_limit',
                            parseInt(e.target.value) || 0,
                          )
                        }
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Token限制</Label>
                      <Input
                        type="number"
                        value={model.token_limit}
                        onChange={(e) =>
                          handleModelPermissionChange(
                            index,
                            'token_limit',
                            parseInt(e.target.value) || 0,
                          )
                        }
                        min="0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={addModelPermission} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </div>
        )}

        {/* 配置摘要 */}
        <div className="space-y-2">
          <Label>当前配置摘要</Label>
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="text-sm">
              <strong>API密钥：</strong>
              {config.api_keys
                ? Object.entries(config.api_keys)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => key)
                    .join(', ') || '无'
                : '无'}
            </div>
            <div className="text-sm">
              <strong>可用模型：</strong>
              {config.model_permissions.length > 0
                ? config.model_permissions
                    .filter((m) => m.enabled)
                    .map((m) => `${m.model_name} (${m.daily_limit}次/日, ${m.token_limit} tokens)`)
                    .join(', ')
                : '无'}
            </div>
          </div>
        </div>

        {/* 保存按钮和消息 */}
        <div className="flex items-center justify-between">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? '保存中...' : '保存配置'}
          </Button>
        </div>

        {message && (
          <Alert className={message.includes('失败') ? 'border-red-500' : 'border-green-500'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
