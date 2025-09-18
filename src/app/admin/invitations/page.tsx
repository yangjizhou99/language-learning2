'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/contexts/LanguageContext';
import type {
  InvitationCode,
  CreateInvitationRequest,
  InvitationPermissions,
} from '@/types/invitation';
import InvitationPermissionTemplates from '@/components/InvitationPermissionTemplates';

export default function AdminInvitationsPage() {
  const t = useTranslation();
  const [invitations, setInvitations] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateInvitationRequest>({
    max_uses: 1,
    description: '',
    permissions: {
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 50,
      ai_enabled: false,
    },
  });
  const [defaultPermissions, setDefaultPermissions] = useState<any>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // 获取邀请码列表
  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('未登录');
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setError('无法获取认证令牌');
        return;
      }

      const response = await fetch('/api/admin/invitations', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取邀请码列表失败');
      }

      const data = await response.json();
      setInvitations(data.data);
    } catch (err) {
      console.error('获取邀请码列表失败:', err);
      setError(err instanceof Error ? err.message : '获取邀请码列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建邀请码
  const createInvitation = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('未登录');
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setError('无法获取认证令牌');
        return;
      }

      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '创建邀请码失败');
      }

      const data = await response.json();
      setInvitations([data.data, ...invitations]);
      setShowCreateForm(false);
      setCreateForm({
        max_uses: 1,
        description: '',
        permissions: {
          can_access_shadowing: true,
          can_access_cloze: true,
          can_access_alignment: true,
          can_access_articles: true,
          allowed_languages: ['en', 'ja', 'zh'],
          allowed_levels: [1, 2, 3, 4, 5],
          max_daily_attempts: 50,
          ai_enabled: false,
        },
      });
    } catch (err) {
      console.error('创建邀请码失败:', err);
      setError(err instanceof Error ? err.message : '创建邀请码失败');
    }
  };

  // 删除邀请码
  const deleteInvitation = async (id: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('未登录');
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setError('无法获取认证令牌');
        return;
      }

      const response = await fetch(`/api/admin/invitations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '删除邀请码失败');
      }

      setInvitations(invitations.filter((inv) => inv.id !== id));
    } catch (err) {
      console.error('删除邀请码失败:', err);
      setError(err instanceof Error ? err.message : '删除邀请码失败');
    }
  };

  // 切换邀请码状态
  const toggleInvitationStatus = async (id: string, isActive: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('未登录');
        return;
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        setError('无法获取认证令牌');
        return;
      }

      const response = await fetch(`/api/admin/invitations/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新邀请码状态失败');
      }

      setInvitations(
        invitations.map((inv) => (inv.id === id ? { ...inv, is_active: !isActive } : inv)),
      );
    } catch (err) {
      console.error('更新邀请码状态失败:', err);
      setError(err instanceof Error ? err.message : '更新邀请码状态失败');
    }
  };

  // 获取默认权限设置
  const fetchDefaultPermissions = async () => {
    try {
      setLoadingPermissions(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.from('default_user_permissions').select('*').single();

      if (error && error.code !== 'PGRST116') {
        console.error('获取默认权限设置失败:', error);
        return;
      }

      if (data) {
        setDefaultPermissions({
          can_access_shadowing: data.can_access_shadowing ?? true,
          can_access_cloze: data.can_access_cloze ?? true,
          can_access_alignment: data.can_access_alignment ?? true,
          can_access_articles: data.can_access_articles ?? true,
          allowed_languages: data.allowed_languages || ['en', 'ja', 'zh'],
          allowed_levels: data.allowed_levels || [1, 2, 3, 4, 5],
          max_daily_attempts: data.max_daily_attempts || 50,
          ai_enabled: data.ai_enabled || false,
        });
      }
    } catch (error) {
      console.error('获取默认权限设置失败:', error);
    } finally {
      setLoadingPermissions(false);
    }
  };

  // 使用默认权限设置
  const useDefaultPermissions = () => {
    if (defaultPermissions) {
      setCreateForm({
        ...createForm,
        permissions: {
          can_access_shadowing: defaultPermissions.can_access_shadowing,
          can_access_cloze: defaultPermissions.can_access_cloze,
          can_access_alignment: defaultPermissions.can_access_alignment,
          can_access_articles: defaultPermissions.can_access_articles,
          allowed_languages: defaultPermissions.allowed_languages,
          allowed_levels: defaultPermissions.allowed_levels,
          max_daily_attempts: defaultPermissions.max_daily_attempts,
          ai_enabled: defaultPermissions.ai_enabled,
          api_keys: defaultPermissions.api_keys,
          model_permissions: defaultPermissions.model_permissions,
        },
      });
    }
  };

  // 使用权限模板
  const handleTemplateSelect = (permissions: InvitationPermissions) => {
    setCreateForm({
      ...createForm,
      permissions,
    });
  };

  useEffect(() => {
    fetchInvitations();
    fetchDefaultPermissions();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">邀请码管理</h1>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                创建邀请码
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* 邀请码列表 */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      邀请码
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      使用情况
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      过期时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      权限
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {invitation.code}
                          </code>
                          <button
                            onClick={() => navigator.clipboard.writeText(invitation.code)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                            title="复制邀请码"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invitation.used_count} / {invitation.max_uses}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {invitation.expires_at
                          ? new Date(invitation.expires_at).toLocaleDateString()
                          : '永不过期'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {invitation.permissions?.can_access_shadowing && (
                            <span className="px-1 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              跟读
                            </span>
                          )}
                          {invitation.permissions?.can_access_cloze && (
                            <span className="px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              完形
                            </span>
                          )}
                          {invitation.permissions?.can_access_alignment && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              对齐
                            </span>
                          )}
                          {invitation.permissions?.can_access_articles && (
                            <span className="px-1 py-0.5 bg-orange-100 text-orange-800 text-xs rounded">
                              文章
                            </span>
                          )}
                          {invitation.permissions?.ai_enabled && (
                            <span className="px-1 py-0.5 bg-pink-100 text-pink-800 text-xs rounded">
                              AI
                            </span>
                          )}
                          {invitation.permissions?.api_limits?.enabled && (
                            <span className="px-1 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                              API限制
                            </span>
                          )}
                          {(invitation.permissions?.api_keys?.deepseek ||
                            invitation.permissions?.api_keys?.openrouter) && (
                            <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                              API Key
                            </span>
                          )}
                          {invitation.permissions?.model_permissions &&
                            invitation.permissions.model_permissions.length > 0 && (
                              <span className="px-1 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded">
                                模型权限
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            invitation.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {invitation.is_active ? '激活' : '禁用'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(invitation.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() =>
                            toggleInvitationStatus(invitation.id, invitation.is_active)
                          }
                          className={`mr-2 ${
                            invitation.is_active
                              ? 'text-red-600 hover:text-red-900'
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {invitation.is_active ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => deleteInvitation(invitation.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invitations.length === 0 && (
              <div className="text-center py-8 text-gray-500">暂无邀请码</div>
            )}
          </div>
        </div>

        {/* 创建邀请码表单 */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">创建邀请码</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">最大使用次数</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.max_uses}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          max_uses: parseInt(e.target.value) || 1,
                        })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">过期时间</label>
                    <input
                      type="datetime-local"
                      value={createForm.expires_at || ''}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          expires_at: e.target.value || undefined,
                        })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">描述</label>
                    <textarea
                      value={createForm.description || ''}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="可选，用于说明邀请码的用途"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">权限设置</label>
                      {defaultPermissions && (
                        <button
                          onClick={useDefaultPermissions}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          使用默认权限设置
                        </button>
                      )}
                    </div>

                    {/* 权限模板 */}
                    <div className="mb-4">
                      <InvitationPermissionTemplates
                        onSelectTemplate={handleTemplateSelect}
                        currentPermissions={createForm.permissions}
                      />
                    </div>

                    <div className="space-y-4">
                      {/* 功能访问权限 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">功能访问权限</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createForm.permissions?.can_access_shadowing || false}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    can_access_shadowing: e.target.checked,
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            Shadowing 练习
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createForm.permissions?.can_access_cloze || false}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    can_access_cloze: e.target.checked,
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            Cloze 练习
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createForm.permissions?.can_access_alignment || false}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    can_access_alignment: e.target.checked,
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            Alignment 练习
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createForm.permissions?.can_access_articles || false}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    can_access_articles: e.target.checked,
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            广读文章
                          </label>
                        </div>
                      </div>

                      {/* 语言权限 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">允许的语言</h4>
                        <div className="flex gap-4">
                          {['en', 'ja', 'zh'].map((lang) => (
                            <label key={lang} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={
                                  createForm.permissions?.allowed_languages?.includes(lang) || false
                                }
                                onChange={(e) => {
                                  const currentLangs =
                                    createForm.permissions?.allowed_languages || [];
                                  const newLangs = e.target.checked
                                    ? [...currentLangs, lang]
                                    : currentLangs.filter((l) => l !== lang);
                                  setCreateForm({
                                    ...createForm,
                                    permissions: {
                                      ...createForm.permissions!,
                                      allowed_languages: newLangs,
                                    },
                                  });
                                }}
                                className="mr-1"
                              />
                              {lang === 'en' ? '英语' : lang === 'ja' ? '日语' : '中文'}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* 难度等级 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">允许的等级</h4>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <label key={level} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={
                                  createForm.permissions?.allowed_levels?.includes(level) || false
                                }
                                onChange={(e) => {
                                  const currentLevels =
                                    createForm.permissions?.allowed_levels || [];
                                  const newLevels = e.target.checked
                                    ? [...currentLevels, level]
                                    : currentLevels.filter((l) => l !== level);
                                  setCreateForm({
                                    ...createForm,
                                    permissions: {
                                      ...createForm.permissions!,
                                      allowed_levels: newLevels,
                                    },
                                  });
                                }}
                                className="mr-1"
                              />
                              等级 {level}
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* 使用限制 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">使用限制</h4>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-gray-500">每日最大练习次数</label>
                            <input
                              type="number"
                              min="0"
                              value={createForm.permissions?.max_daily_attempts || 50}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    max_daily_attempts: parseInt(e.target.value) || 0,
                                  },
                                })
                              }
                              className="w-24 px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* AI功能 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">AI功能</h4>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={createForm.permissions?.ai_enabled || false}
                            onChange={(e) =>
                              setCreateForm({
                                ...createForm,
                                permissions: {
                                  ...createForm.permissions!,
                                  ai_enabled: e.target.checked,
                                },
                              })
                            }
                            className="mr-2"
                          />
                          启用AI功能
                        </label>
                      </div>

                      {/* API密钥配置 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">API密钥配置</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              DeepSeek API Key
                            </label>
                            <input
                              type="password"
                              value={createForm.permissions?.api_keys?.deepseek || ''}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    api_keys: {
                                      ...createForm.permissions?.api_keys,
                                      deepseek: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="输入DeepSeek API Key"
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              OpenRouter API Key
                            </label>
                            <input
                              type="password"
                              value={createForm.permissions?.api_keys?.openrouter || ''}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    api_keys: {
                                      ...createForm.permissions?.api_keys,
                                      openrouter: e.target.value,
                                    },
                                  },
                                })
                              }
                              placeholder="输入OpenRouter API Key"
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* API使用限制 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">API使用限制</h4>
                        <div className="space-y-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={createForm.permissions?.api_limits?.enabled || false}
                              onChange={(e) =>
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    api_limits: {
                                      ...createForm.permissions?.api_limits,
                                      enabled: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="mr-2"
                            />
                            启用API使用限制
                          </label>

                          {createForm.permissions?.api_limits?.enabled && (
                            <div className="ml-6 space-y-3">
                              {/* 每日限制 */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2">每日限制</h5>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-gray-500">调用次数</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        createForm.permissions?.api_limits?.daily_calls_limit || 0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              daily_calls_limit: parseInt(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">Token限制</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        createForm.permissions?.api_limits?.daily_tokens_limit || 0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              daily_tokens_limit: parseInt(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">
                                      费用限制 ($)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        createForm.permissions?.api_limits?.daily_cost_limit || 0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              daily_cost_limit: parseFloat(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* 每月限制 */}
                              <div>
                                <h5 className="text-xs font-medium text-gray-500 mb-2">每月限制</h5>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="block text-xs text-gray-500">调用次数</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        createForm.permissions?.api_limits?.monthly_calls_limit || 0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              monthly_calls_limit: parseInt(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">Token限制</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        createForm.permissions?.api_limits?.monthly_tokens_limit ||
                                        0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              monthly_tokens_limit: parseInt(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-gray-500">
                                      费用限制 ($)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        createForm.permissions?.api_limits?.monthly_cost_limit || 0
                                      }
                                      onChange={(e) =>
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            api_limits: {
                                              ...createForm.permissions?.api_limits,
                                              monthly_cost_limit: parseFloat(e.target.value) || 0,
                                            },
                                          },
                                        })
                                      }
                                      className="w-full px-2 py-1 border rounded text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 模型权限配置 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-600 mb-2">模型权限配置</h4>
                        <div className="space-y-2">
                          <div className="text-xs text-gray-500 mb-2">
                            配置用户可以使用的AI模型和限制
                          </div>
                          <div className="space-y-2">
                            {createForm.permissions?.model_permissions?.map((model, index) => (
                              <div key={index} className="border rounded p-2 bg-gray-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium">{model.model_name}</span>
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={model.enabled}
                                      onChange={(e) => {
                                        const newModels = [
                                          ...(createForm.permissions?.model_permissions || []),
                                        ];
                                        newModels[index].enabled = e.target.checked;
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            model_permissions: newModels,
                                          },
                                        });
                                      }}
                                      className="mr-2"
                                    />
                                    启用
                                  </label>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="block text-gray-500">每日限制</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={model.daily_limit}
                                      onChange={(e) => {
                                        const newModels = [
                                          ...(createForm.permissions?.model_permissions || []),
                                        ];
                                        newModels[index].daily_limit =
                                          parseInt(e.target.value) || 0;
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            model_permissions: newModels,
                                          },
                                        });
                                      }}
                                      className="w-full px-1 py-0.5 border rounded"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-gray-500">Token限制</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={model.token_limit}
                                      onChange={(e) => {
                                        const newModels = [
                                          ...(createForm.permissions?.model_permissions || []),
                                        ];
                                        newModels[index].token_limit =
                                          parseInt(e.target.value) || 0;
                                        setCreateForm({
                                          ...createForm,
                                          permissions: {
                                            ...createForm.permissions!,
                                            model_permissions: newModels,
                                          },
                                        });
                                      }}
                                      className="w-full px-1 py-0.5 border rounded"
                                    />
                                  </div>
                                </div>
                              </div>
                            )) || []}

                            <button
                              type="button"
                              onClick={() => {
                                const newModels = [
                                  ...(createForm.permissions?.model_permissions || []),
                                ];
                                newModels.push({
                                  model_id: 'custom-model',
                                  model_name: '自定义模型',
                                  provider: 'custom',
                                  daily_limit: 10,
                                  token_limit: 10000,
                                  enabled: true,
                                });
                                setCreateForm({
                                  ...createForm,
                                  permissions: {
                                    ...createForm.permissions!,
                                    model_permissions: newModels,
                                  },
                                });
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              + 添加模型
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                  >
                    取消
                  </button>
                  <button
                    onClick={createInvitation}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
